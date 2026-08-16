import { NextRequest } from "next/server";
import listings from "@/data/listings.json";

const GEMINI_MODEL = "gemini-3.5-flash";

interface Listing {
  id: number;
  [key: string]: unknown;
}

interface RawMatch {
  id: number;
  rank: number;
  match_percent: number;
  why_it_fits: string;
  not_perfect: string;
}

function buildPrompt(needs: unknown, allListings: Listing[]): string {
  return `You are a helpful real estate matching assistant. Given a user's housing needs and a list of available properties, return the top 5 best matches ranked from best to worst fit. Consider budget fit, sector/location match, bedroom/bathroom/size requirements, and the user's stated priorities. Weigh explicit requirements (budget, bedrooms) more heavily than soft priorities, but factor in priorities meaningfully — don't just sort by price.

User's needs:
${JSON.stringify(needs, null, 2)}

Available properties:
${JSON.stringify(allListings, null, 2)}

For each of the top 5 matches, give:
- A match percentage (0-100) reflecting overall fit
- A short "why it fits" reason (1-2 sentences, plain language, cite specific numbers where relevant)
- A short "what's not perfect" note (1 sentence — every home has some tradeoff, be honest, never say "nothing")

Respond ONLY with valid JSON in this exact shape, no markdown formatting, no explanation:
{
  "matches": [
    {
      "id": <listing id>,
      "rank": <1-5>,
      "match_percent": <number>,
      "why_it_fits": "<reasoning>",
      "not_perfect": "<tradeoff>"
    }
  ]
}`;
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

  const needs = (body as { needs?: unknown } | null)?.needs;
  if (
    !needs ||
    typeof needs !== "object" ||
    Array.isArray(needs) ||
    Object.keys(needs).length === 0
  ) {
    return Response.json(
      { error: "We need your extracted housing preferences before we can find matches." },
      { status: 400 }
    );
  }

  const allListings = listings as Listing[];

  let geminiRes: Response;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(needs, allListings) }] }],
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
      { error: "We couldn't understand a response from the matching service. Please try again." },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(rawText));
  } catch {
    return Response.json(
      { error: "We had trouble understanding the matching results. Please try again." },
      { status: 502 }
    );
  }

  const rawMatches = (parsed as { matches?: unknown } | null)?.matches;
  if (!Array.isArray(rawMatches)) {
    return Response.json(
      { error: "We had trouble understanding the matching results. Please try again." },
      { status: 502 }
    );
  }

  const listingsById = new Map(allListings.map((listing) => [listing.id, listing]));

  const matches = (rawMatches as RawMatch[])
    .filter((match) => listingsById.has(match?.id))
    .map((match) => {
      const listing = listingsById.get(match.id)!;
      return {
        ...listing,
        rank: match.rank,
        match_percent: match.match_percent,
        why_it_fits: match.why_it_fits,
        not_perfect: match.not_perfect,
      };
    });

  return Response.json({ matches });
}
