import { NextRequest } from "next/server";

const GEMINI_MODEL = "gemini-3.5-flash";
const MIN_TEXT_LENGTH = 10;

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
Respond ONLY with valid JSON, no markdown formatting, no explanation.`;
}

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
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
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(text.trim()) }] }],
        }),
      }
    );
  } catch {
    return Response.json(
      { error: "Couldn't reach the matching service. Please check your connection and try again." },
      { status: 502 }
    );
  }

  if (!geminiRes.ok) {
    return Response.json(
      { error: "The matching service had trouble processing that. Please try again in a moment." },
      { status: 502 }
    );
  }

  const data = await geminiRes.json();
  const rawText: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    return Response.json(
      { error: "We couldn't understand a response from the matching service. Please try rephrasing your description." },
      { status: 502 }
    );
  }

  let needs: unknown;
  try {
    needs = JSON.parse(stripMarkdownFences(rawText));
  } catch {
    return Response.json(
      { error: "We had trouble understanding your description. Please try rephrasing it." },
      { status: 502 }
    );
  }

  return Response.json({ needs });
}
