import { type Candidate, selectCandidates } from "@/lib/candidates";
import { type Listing, formatPkrShort } from "@/lib/listings";
import { type Needs, normalizeNeeds } from "@/lib/needs";

const GEMINI_MODEL = "gemini-3.5-flash-lite";

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

/**
 * Structured output — asking for JSON in prose left `why_it_fits` missing on
 * whole shortlists, which reached the UI as "undefined".
 */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    matches: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "INTEGER" },
          rank: { type: "INTEGER" },
          match_percent: { type: "INTEGER" },
          why_it_fits: { type: "STRING" },
          not_perfect: { type: "STRING" },
        },
        required: ["id", "rank", "match_percent", "why_it_fits", "not_perfect"],
        propertyOrdering: ["id", "rank", "match_percent", "why_it_fits", "not_perfect"],
      },
    },
    recommendation: {
      type: "OBJECT",
      properties: {
        id: { type: "INTEGER" },
        headline: { type: "STRING" },
        rationale: { type: "STRING" },
        trade_off: { type: "STRING" },
      },
      required: ["id", "headline", "rationale", "trade_off"],
      propertyOrdering: ["id", "headline", "rationale", "trade_off"],
    },
  },
  required: ["matches", "recommendation"],
  propertyOrdering: ["matches", "recommendation"],
} as const;

/**
 * What the model sees per home. `fits`/`gaps` come from match-breakdown, so the
 * prose has pre-verified facts to lean on instead of re-deriving them from raw
 * fields and getting the arithmetic wrong.
 */
function toPromptCandidate(candidate: Candidate) {
  const { listing } = candidate;
  return {
    id: listing.id,
    title: listing.title,
    sector: listing.sector,
    society: listing.society,
    price: formatPkrShort(listing.price_pkr),
    price_pkr: listing.price_pkr,
    marla: listing.marla,
    sqft: listing.sqft,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms ?? "not published",
    amenities: listing.amenities,
    checks_out: candidate.fits,
    falls_short: candidate.gaps,
    cannot_confirm: candidate.unknown,
    over_ceiling: candidate.overCeiling,
  };
}

function describeBrief(needs: Needs): string {
  const lines: string[] = [];
  const { budget_min_pkr: min, budget_max_pkr: max } = needs;
  if (max) lines.push(`- Ceiling: ${formatPkrShort(max)} (${max.toLocaleString("en-PK")} PKR)`);
  if (min) lines.push(`- Floor: ${formatPkrShort(min)}`);
  if (needs.preferred_sectors.length)
    lines.push(`- Areas they named: ${needs.preferred_sectors.join(", ")}`);
  if (needs.bedrooms_min) lines.push(`- Bedrooms: ${needs.bedrooms_min} or more`);
  if (needs.bathrooms_min) lines.push(`- Bathrooms: ${needs.bathrooms_min} or more`);
  if (needs.marla_min) lines.push(`- Plot: ${needs.marla_min} marla or more`);
  if (needs.family_size)
    lines.push(`- Household: ${needs.family_size} people living there (this is not a bedroom count)`);
  if (needs.priorities.length) lines.push(`- Priorities, in their words: ${needs.priorities.join("; ")}`);
  if (needs.soft_signal) lines.push(`- Read between the lines: ${needs.soft_signal}`);
  return lines.length ? lines.join("\n") : "- They gave very little to go on.";
}

function buildPrompt(needs: Needs, candidates: Candidate[], notes: string[]): string {
  return `You are Mayaar, an Islamabad property advisor briefing one buyer in private. Rank the five best homes for them and explain each one against what they actually said.

THE BRIEF
${describeBrief(needs)}

HOW THIS SHORTLIST WAS BUILT
${notes.length ? notes.map((note) => `- ${note}`).join("\n") : "- Every home below clears the brief's hard requirements."}

CANDIDATES — all already checked against the brief. "checks_out", "falls_short" and "cannot_confirm" were computed from the listing's own figures and are authoritative: never contradict them, never claim something they list as short, and never assert anything under "cannot_confirm" — the listing simply doesn't say, so write "the listing doesn't say whether it's single storey" rather than deciding for it. The title is part of the record too: never describe a home as something its own title contradicts.
${JSON.stringify(candidates.map(toPromptCandidate))}

CHOOSING THE FIVE
- Any home marked over_ceiling ranks last and never scores above 70, however well it matches otherwise.
- Show real choice: at most two homes from the same society, unless the buyer named only that society.
- Weigh their priorities and household size, not just the numbers. Do the arithmetic — sqft ÷ household size tells you whether they actually fit.

WRITING THE REASONING — this is the part that matters
- Put the exact figure next to theirs: "5.5 crore against your 6 crore ceiling — 50 lakh under" beats "competitively priced". "1,850 sqft across 6 people is 308 sqft each" beats "roomy".
- Name the sector and society, and say plainly whether it is on their list, next door to it, or off it.
- Their priorities will conflict with each other. When a home is strong on one thing they asked for at the cost of another, say both in the same breath rather than glossing over it: "the DHA Phase 2 address you wanted, but reaching it costs 1.25 crore over your ceiling".
- Never describe a shortfall as if it were met. Five bedrooms does not "meet" a six-bedroom minimum — write "one short of the 6 you asked for".
- Lead each entry with whatever is most distinctive about that home. If two entries open the same way, rewrite the second.
- Make each figure count once. Do not state the same price-against-ceiling comparison twice in one entry.
- Banned filler: prime location, spacious, ample, modern amenities, great investment, dream home, nestled, boasts, well-appointed, perfect blend, ideal for, stunning, sought-after, generous, plenty of room, sprawling, expansive, massive. If a sentence could be pasted onto a different home without becoming false, rewrite it.
- Never mention data, fields, records, candidates, or numbered listings. Say "the listing doesn't publish a bathroom count", not "bathrooms is null". Address the buyer as "you".
- Currency: 1 crore = 10,000,000 PKR, 1 lakh = 100,000 PKR. So 122,500,000 is 12.25 crore and 7,750,000 is 77.5 lakh. Check every conversion.

FIELDS
- match_percent: honest 0-100. Reserve 90+ for homes with nothing in "falls_short". If nothing is that clean, the top match must not read 95.
- why_it_fits: 1-2 sentences, specific numbers, tied to their words.
- not_perfect: exactly one sentence naming what choosing this home actually costs them. Never "nothing", never a non-issue, never a restatement of why_it_fits.

RECOMMENDATION
Then pick ONE of the five as the home you would tell this buyer to see first. It need not be rank 1 — if a lower-ranked home is the better real-world answer, pick it and say why you are steering them there. Give the verdict, the reasoning, and the trade-off you are asking them to accept.`;
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
      `[match-listings] Gemini rate-limited (429), retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES}):`,
      bodyText
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export async function matchListings(rawNeeds: unknown, apiKey: string) {
  const needs = normalizeNeeds(rawNeeds);
  const { candidates, notes } = selectCandidates(needs);

  let geminiRes: Response;
  try {
    geminiRes = await callGemini(buildPrompt(needs, candidates, notes), apiKey);
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

  // The model may only rank homes it was actually shown; anything else is a
  // hallucinated id and gets dropped rather than surfaced as a real home.
  const offered = new Map<number, Listing>(
    candidates.map((candidate) => [candidate.listing.id, candidate.listing]),
  );

  const matches = (rawMatches as RawMatch[])
    .filter((match) => offered.has(match?.id))
    .map((match) => ({
      ...offered.get(match.id)!,
      rank: match.rank,
      match_percent: clampPercent(match.match_percent),
      why_it_fits: text(match.why_it_fits),
      not_perfect: text(match.not_perfect),
    }))
    .sort((a, b) => a.rank - b.rank)
    .map((match, index) => ({ ...match, rank: index + 1 }));

  return { matches, recommendation: readRecommendation(parsed, matches) };
}

function clampPercent(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readRecommendation(parsed: unknown, matches: Array<{ id: number }>) {
  const raw = (parsed as { recommendation?: Record<string, unknown> } | null)?.recommendation;
  if (!raw) return null;
  const id = typeof raw.id === "number" ? raw.id : null;
  if (id === null || !matches.some((match) => match.id === id)) return null;
  return {
    id,
    headline: text(raw.headline),
    rationale: text(raw.rationale),
    trade_off: text(raw.trade_off),
  };
}
