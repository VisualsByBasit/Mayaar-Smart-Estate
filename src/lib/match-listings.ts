import listings from "@/data/listings.json";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

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

export class MatchListingsError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface PromptListing {
  id: number;
  title: unknown;
  city: unknown;
  sector: unknown;
  society: unknown;
  marla: unknown;
  sqft: unknown;
  price_pkr: unknown;
  bedrooms: unknown;
  bathrooms: unknown;
  amenities: unknown;
}

function toPromptListing(listing: Listing): PromptListing {
  return {
    id: listing.id,
    title: listing.title,
    city: listing.city,
    sector: listing.sector,
    society: listing.society,
    marla: listing.marla,
    sqft: listing.sqft,
    price_pkr: listing.price_pkr,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    amenities: listing.amenities,
  };
}

function buildPrompt(needs: unknown, allListings: Listing[]): string {
  const promptListings = allListings.map(toPromptListing);
  return `You are a helpful real estate matching assistant. Given a user's housing needs and a list of available properties, return the top 5 best matches ranked from best to worst fit. Consider budget fit, sector/location match, bedroom/bathroom/size requirements, and the user's stated priorities. Weigh explicit requirements (budget, bedrooms) more heavily than soft priorities, but factor in priorities meaningfully — don't just sort by price.

User's needs:
${JSON.stringify(needs, null, 2)}

Available properties (id, title, city, sector, society, marla, sqft, price_pkr, bedrooms, bathrooms, amenities):
${JSON.stringify(promptListings)}

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
      `[match-listings] Gemini rate-limited (429), retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`,
      bodyText
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

export async function matchListings(needs: unknown, apiKey: string) {
  const allListings = listings as Listing[];

  let geminiRes: Response;
  try {
    geminiRes = await callGemini(buildPrompt(needs, allListings), apiKey);
  } catch (err) {
    console.error("[match-listings] Gemini fetch threw:", err);
    throw new MatchListingsError(
      "Couldn't reach the matching service. Please check your connection and try again.",
      502
    );
  }

  if (!geminiRes.ok) {
    const bodyText = await geminiRes.text();
    console.error(
      `[match-listings] Gemini responded with non-OK status ${geminiRes.status} ${geminiRes.statusText}:`,
      bodyText
    );
    throw new MatchListingsError(
      "The matching service had trouble processing that. Please try again in a moment.",
      502
    );
  }

  const data = await geminiRes.json();
  const rawText: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof rawText !== "string" || rawText.trim().length === 0) {
    console.error("[match-listings] Gemini response missing text content:", JSON.stringify(data, null, 2));
    throw new MatchListingsError(
      "We couldn't understand a response from the matching service. Please try again.",
      502
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownFences(rawText));
  } catch (err) {
    console.error("[match-listings] Failed to JSON.parse Gemini text. Error:", err, "Raw text:", rawText);
    throw new MatchListingsError(
      "We had trouble understanding the matching results. Please try again.",
      502
    );
  }

  const rawMatches = (parsed as { matches?: unknown } | null)?.matches;
  if (!Array.isArray(rawMatches)) {
    console.error("[match-listings] Parsed response missing matches array:", JSON.stringify(parsed, null, 2));
    throw new MatchListingsError(
      "We had trouble understanding the matching results. Please try again.",
      502
    );
  }

  const listingsById = new Map(allListings.map((listing) => [listing.id, listing]));

  return (rawMatches as RawMatch[])
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
}
