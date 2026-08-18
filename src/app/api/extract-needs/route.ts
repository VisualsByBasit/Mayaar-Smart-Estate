import { NextRequest } from "next/server";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const MIN_TEXT_LENGTH = 10;

/**
 * Every downstream prompt reads these fields, so a dropped key here quietly
 * degrades the matching reasoning. The schema makes the shape non-negotiable.
 */
const RESPONSE_SCHEMA = {
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
} as const;

function buildPrompt(userText: string): string {
  return `You are extracting structured housing preferences from a user's free-text description. Be generous about inferring reasonable values, but never invent specifics the user didn't imply.

User's description:
"${userText}"

Extract into this exact JSON shape. Use null for any field the user didn't mention or imply — do not guess randomly.

{
  "budget_min_pkr": <number or null>,
  "budget_max_pkr": <number or null>,
  "preferred_sectors": [<array of strings, e.g. "F-11", "DHA" — empty array if none mentioned>],
  "bedrooms_min": <number or null>,
  "bathrooms_min": <number or null>,
  "marla_min": <number or null>,
  "priorities": [<array of short strings capturing what matters to them, e.g. "security", "quiet", "corner plot", "near schools" — infer softly from tone/context, max 5>],
  "family_size": <number or null, if mentioned or clearly implied>,
  "soft_signal": "<one short sentence noting anything implied but not explicitly stated, e.g. 'mentioned hosting guests often, may want larger living areas' — or null if nothing to note>"
}

Convert any "crore"/"lakh" mentions to raw PKR numbers (1 crore = 10000000, 1 lakh = 100000).
family_size is how many people will live in the house. Never copy it into bedrooms_min — a family of six may well have asked for four bedrooms, and inventing a sixth would rule out homes that suit them.
Respond ONLY with valid JSON, no markdown formatting, no explanation.`;
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
      `[extract-needs] Gemini rate-limited (429), retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`,
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

  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || text.trim().length < MIN_TEXT_LENGTH) {
    return Response.json(
      { error: "Tell us a bit more about what you're looking for — a short phrase isn't enough to work with." },
      { status: 400 }
    );
  }

  let geminiRes: Response;
  try {
    geminiRes = await callGemini(buildPrompt(text.trim()), apiKey);
  } catch (err) {
    console.error("[extract-needs] Gemini fetch threw:", err);
    return Response.json(
      { error: "Couldn't reach the matching service. Please check your connection and try again." },
      { status: 502 }
    );
  }

  if (!geminiRes.ok) {
    const bodyText = await geminiRes.text();
    console.error(
      `[extract-needs] Gemini responded with non-OK status ${geminiRes.status} ${geminiRes.statusText}:`,
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
    console.error("[extract-needs] Gemini response missing text content:", JSON.stringify(data, null, 2));
    return Response.json(
      { error: "We couldn't understand a response from the matching service. Please try rephrasing your description." },
      { status: 502 }
    );
  }

  let needs: unknown;
  try {
    needs = JSON.parse(stripMarkdownFences(rawText));
  } catch (err) {
    console.error("[extract-needs] Failed to JSON.parse Gemini text. Error:", err, "Raw text:", rawText);
    return Response.json(
      { error: "We had trouble understanding your description. Please try rephrasing it." },
      { status: 502 }
    );
  }

  return Response.json({ needs });
}
