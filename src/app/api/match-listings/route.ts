import { NextRequest } from "next/server";
import { matchListings, MatchListingsError } from "@/lib/match-listings";

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

  try {
    const { matches, recommendation } = await matchListings(needs, apiKey);
    return Response.json({ matches, recommendation });
  } catch (err) {
    if (err instanceof MatchListingsError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
