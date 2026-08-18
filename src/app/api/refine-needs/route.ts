import { NextRequest } from "next/server";
import { matchListings, MatchListingsError } from "@/lib/match-listings";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

/** Mirrors the shape below so the model can't drop `acknowledgment` mid-flow. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    updated_needs: {
      type: "OBJECT",
      properties: {
        budget_min_pkr: { type: "NUMBER", nullable: true },
        budget_max_pkr: { type: "NUMBER", nullable: true },
        preferred_sectors: { type: "ARRAY", items: { type: "STRING" } },
        bedrooms_min: { type: "NUMBER", nullable: true },
        bathrooms_min: { type: "NUMBER", nullable: true },
        marla_min: { type: "NUMBER", nullable: true },
        priorities: { type: "ARRAY", items: { type: "STRING" } },
        family_size: { type: "NUMBER", nullable: true },
        soft_signal: { type: "STRING", nullable: true },
      },
      required: [
        "budget_min_pkr",
        "budget_max_pkr",
        "preferred_sectors",
        "bedrooms_min",
        "bathrooms_min",
        "marla_min",
        "priorities",
        "family_size",
        "soft_signal",
      ],
    },
    acknowledgment: { type: "STRING" },
  },
  required: ["updated_needs", "acknowledgment"],
  propertyOrdering: ["updated_needs", "acknowledgment"],
} as const;

function buildPrompt(currentNeeds: unknown, message: string): string {
  return `You are Mayaar, an Islamabad property advisor mid-conversation with a buyer. You already hold their preferences. Their new message adjusts the brief — update ONLY what it implies and leave everything else exactly as it was.

Their preferences right now:
${JSON.stringify(currentNeeds, null, 2)}

Their new message:
"${message}"

UPDATING
- Move only the fields the message actually touches. Unmentioned fields keep their current values verbatim — do not re-derive or "tidy" them.
- Convert money to raw PKR: 1 crore = 10,000,000, 1 lakh = 100,000. "Push it up by a crore" on a 60,000,000 ceiling means 70,000,000.
- Relative language moves the number: "a bit more space", "slightly cheaper", "one more bedroom". Pick a sensible step and apply it rather than leaving the field alone.
- Priorities are short phrases in their words. Drop one when they say it matters less; add one when they raise something new. Keep the list under six.
- soft_signal is for what they implied but didn't say outright. Update it when the new message reveals something; otherwise leave it.

THE ACKNOWLEDGMENT — one or two sentences, spoken to them
- Say what moved, with the actual numbers: "Ceiling up from 6 to 7 crore — that puts DHA Phase 2 back in play" beats "Got it, I've updated your budget".
- If this change works against something else they asked for, say so plainly in the same breath: "More space at this budget means leaving F-11 behind — you can have one or the other here, not both." Naming the trade-off is more useful than agreeing smoothly.
- If the message changes nothing you can act on, say that honestly instead of inventing a change.
- Never mention fields, JSON, preferences objects, or that you are a model. Address them as "you".`;
}

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

const MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 10000;

function parseRetryDelayMs(bodyText: string): number | null {
  const match = bodyText.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.min(Math.ceil(Number(match[1]) * 1000), MAX_RETRY_DELAY_MS) : null;
}

async function callGemini(prompt: string, apiKey: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.status !== 429 || attempt >= MAX_RETRIES) return res;

    const bodyText = await res.clone().text();
    const delayMs = parseRetryDelayMs(bodyText) ?? 2000 * (attempt + 1);
    console.error(
      `[refine-needs] Gemini rate-limited (429), retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`,
      bodyText
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server isn't configured to process this request right now. Please try again later." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const currentNeeds = (body as { current_needs?: unknown } | null)?.current_needs;
  if (
    !currentNeeds ||
    typeof currentNeeds !== "object" ||
    Array.isArray(currentNeeds) ||
    Object.keys(currentNeeds).length === 0
  ) {
    return Response.json(
      { error: "We need your current housing preferences before we can refine them." },
      { status: 400 }
    );
  }

  const message = (body as { message?: unknown } | null)?.message;
  if (typeof message !== "string" || message.trim().length === 0) {
    return Response.json(
      { error: "Tell us what you'd like to change about your preferences." },
      { status: 400 }
    );
  }

  let geminiRes: Response;
  try {
    geminiRes = await callGemini(buildPrompt(currentNeeds, message.trim()), apiKey);
  } catch (err) {
    console.error("[refine-needs] Gemini fetch threw:", err);
    return Response.json(
      { error: "Couldn't reach the matching service. Please check your connection and try again." },
      { status: 502 }
    );
  }

  if (!geminiRes.ok) {
    const bodyText = await geminiRes.text();
    console.error(
      `[refine-needs] Gemini responded with non-OK status ${geminiRes.status} ${geminiRes.statusText}:`,
      bodyText
    );
    return Response.json(
      { error: "The matching service had trouble processing that. Please try again in a moment." },
      { status: 502 }
    );
  }

  const data = await geminiRes.json();
  const rawText: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    console.error("[refine-needs] Gemini response missing text content:", JSON.stringify(data, null, 2));
    return Response.json(
      { error: "We couldn't understand a response from the matching service. Please try again." },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(rawText));
  } catch (err) {
    console.error("[refine-needs] Failed to JSON.parse Gemini text. Error:", err, "Raw text:", rawText);
    return Response.json(
      { error: "We had trouble understanding the updated preferences. Please try again." },
      { status: 502 }
    );
  }

  const updatedNeeds = (parsed as { updated_needs?: unknown } | null)?.updated_needs;
  const acknowledgment = (parsed as { acknowledgment?: unknown } | null)?.acknowledgment;

  if (
    !updatedNeeds ||
    typeof updatedNeeds !== "object" ||
    Array.isArray(updatedNeeds) ||
    typeof acknowledgment !== "string"
  ) {
    console.error(
      "[refine-needs] Parsed response missing updated_needs/acknowledgment:",
      JSON.stringify(parsed, null, 2)
    );
    return Response.json(
      { error: "We had trouble understanding the updated preferences. Please try again." },
      { status: 502 }
    );
  }

  try {
    const { matches, recommendation } = await matchListings(updatedNeeds, apiKey);
    return Response.json({
      updated_needs: updatedNeeds,
      acknowledgment,
      matches,
      recommendation,
    });
  } catch (err) {
    if (err instanceof MatchListingsError) {
      console.error("[refine-needs] matchListings failed:", err);
      return Response.json(
        { error: `Your preferences were updated, but we couldn't refresh your matches: ${err.message}` },
        { status: 502 }
      );
    }
    throw err;
  }
}
