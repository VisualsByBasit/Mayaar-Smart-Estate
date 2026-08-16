import { NextRequest } from "next/server";
import { matchListings, MatchListingsError } from "@/lib/match-listings";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

function buildPrompt(currentNeeds: unknown, message: string): string {
  return `You are updating a user's housing preferences based on a follow-up message during a conversation. You already have their current preferences. Update ONLY what the new message implies should change — keep everything else exactly as it was.

Current preferences:
${JSON.stringify(currentNeeds, null, 2)}

User's new message:
"${message}"

Return the FULL updated preferences object (not just the changed fields) in this exact shape:
{
  "budget_min_pkr": <number or null>,
  "budget_max_pkr": <number or null>,
  "preferred_sectors": [<array of strings>],
  "bedrooms_min": <number or null>,
  "bathrooms_min": <number or null>,
  "marla_min": <number or null>,
  "priorities": [<array of short strings, max 5>],
  "family_size": <number or null>,
  "soft_signal": "<string or null>"
}

Also include a short, natural one-sentence acknowledgment of what changed, e.g. "Got it, I'll reduce the importance of location and prioritize larger homes." If nothing meaningfully changed, say so honestly.

Respond ONLY with valid JSON, no markdown formatting, in this exact shape:
{
  "updated_needs": { ...the full object above... },
  "acknowledgment": "<one sentence>"
}`;
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
  const body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

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
    const matches = await matchListings(updatedNeeds, apiKey);
    return Response.json({ updated_needs: updatedNeeds, acknowledgment, matches });
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
