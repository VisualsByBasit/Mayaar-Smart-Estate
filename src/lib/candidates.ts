import { type Listing, LISTINGS, formatPkrShort, sectorFamily } from "@/lib/listings";
import { buildBreakdown, computedFit, factCheck } from "@/lib/match-breakdown";
import type { Needs } from "@/lib/needs";

/**
 * Picking which homes reach the model is a filtering job, and filtering is
 * something code does reliably and a small model does not. Asking Gemini to
 * hold a budget ceiling across 146 listings produced shortlists priced ten
 * times over the ceiling; narrowing here first and handing over ~24 pre-checked
 * candidates leaves the model doing what it is actually good at — weighing
 * trade-offs and writing the reasoning.
 */

export interface Candidate {
  listing: Listing;
  /** Local score from match-breakdown, used to order what the model sees. */
  fit: number;
  overCeiling: boolean;
  fits: string[];
  gaps: string[];
  /** Priorities the dataset can't settle either way — never assert these. */
  unknown: string[];
}

export interface CandidateSet {
  candidates: Candidate[];
  /** Plain-language framing so the model can be honest about the compromise. */
  notes: string[];
}

const TARGET = 24;
const MIN_CANDIDATES = 6;

interface Relaxation {
  budgetTolerance: number;
  sector: boolean;
  bedrooms: boolean;
  bathrooms: boolean;
  marla: boolean;
}

const STRICT: Relaxation = {
  budgetTolerance: 0,
  sector: true,
  bedrooms: true,
  bathrooms: true,
  marla: true,
};

/**
 * Each step gives up the least valuable constraint next: area first (a phase
 * over is rarely a dealbreaker), then size, then fixtures, then bedrooms, and
 * only then does the budget move — and never by more than 10%.
 */
const LADDER: Array<{ relax: Partial<Relaxation>; note: (needs: Needs) => string | null }> = [
  { relax: {}, note: () => null },
  {
    relax: { sector: false },
    note: (needs) =>
      needs.preferred_sectors.length
        ? `Nothing in ${needs.preferred_sectors.join(" or ")} clears the rest of the brief, so homes outside those areas are included.`
        : null,
  },
  {
    relax: { sector: false, marla: false },
    note: (needs) =>
      needs.marla_min ? `Some of these sit under the ${needs.marla_min} marla asked for.` : null,
  },
  {
    relax: { sector: false, marla: false, bathrooms: false },
    note: (needs) =>
      needs.bathrooms_min ? `Some fall short of ${needs.bathrooms_min} bathrooms.` : null,
  },
  {
    relax: { sector: false, marla: false, bathrooms: false, bedrooms: false },
    note: (needs) =>
      needs.bedrooms_min ? `Some fall short of ${needs.bedrooms_min} bedrooms.` : null,
  },
  {
    relax: { sector: false, marla: false, bathrooms: false, bedrooms: false, budgetTolerance: 0.1 },
    note: (needs) =>
      needs.budget_max_pkr
        ? `Too little clears ${formatPkrShort(needs.budget_max_pkr)}, so homes up to 10% over are included and flagged.`
        : null,
  },
];

function passes(listing: Listing, needs: Needs, rules: Relaxation): boolean {
  const { budget_max_pkr: max, budget_min_pkr: min } = needs;
  if (max && listing.price_pkr > max * (1 + rules.budgetTolerance)) return false;
  if (min && listing.price_pkr < min * 0.9) return false;
  if (rules.bedrooms && needs.bedrooms_min && listing.bedrooms < needs.bedrooms_min) return false;
  if (
    rules.bathrooms &&
    needs.bathrooms_min &&
    listing.bathrooms !== null &&
    listing.bathrooms < needs.bathrooms_min
  ) {
    return false;
  }
  if (rules.marla && needs.marla_min && listing.marla < needs.marla_min) return false;
  if (rules.sector && needs.preferred_sectors.length) {
    const families = needs.preferred_sectors.map(sectorFamily);
    if (!families.includes(sectorFamily(listing.sector))) return false;
  }
  return true;
}

function toCandidate(listing: Listing, needs: Needs): Candidate {
  const checks = factCheck(needs, listing);
  return {
    listing,
    fit: computedFit(buildBreakdown(needs, listing)) ?? 50,
    overCeiling: Boolean(needs.budget_max_pkr && listing.price_pkr > needs.budget_max_pkr),
    fits: checks.fits,
    gaps: checks.gaps,
    unknown: checks.unknown,
  };
}

/**
 * Widens the filter one constraint at a time until there are enough homes to
 * rank, then hands back the best `TARGET` of them by local fit score.
 */
export function selectCandidates(
  needs: Needs,
  listings: Listing[] = LISTINGS,
  target = TARGET,
): CandidateSet {
  const notes: string[] = [];
  let matched: Listing[] = [];

  for (const step of LADDER) {
    const rules = { ...STRICT, ...step.relax };
    matched = listings.filter((listing) => passes(listing, needs, rules));
    if (matched.length >= MIN_CANDIDATES) {
      const note = step.note(needs);
      if (note) notes.push(note);
      break;
    }
  }

  // Nothing survived even the loosest pass — rank the whole city rather than
  // showing an empty screen, and say so.
  if (matched.length < MIN_CANDIDATES) {
    matched = listings;
    notes.push(
      "Almost nothing in the city fits this brief as stated, so these are the closest homes available.",
    );
  }

  const candidates = matched
    .map((listing) => toCandidate(listing, needs))
    .sort((a, b) => b.fit - a.fit)
    .slice(0, target);

  // When the areas they named are simply out of reach, one in-sector home is
  // worth showing so the shortlist can say what that address actually costs.
  const aspirational = pickAspirational(needs, listings, candidates);
  if (aspirational) {
    candidates.push(aspirational);
    notes.push(
      `Nothing in ${needs.preferred_sectors.join(" or ")} comes in at or under ${formatPkrShort(
        needs.budget_max_pkr!,
      )} — the cheapest there is ${formatPkrShort(aspirational.listing.price_pkr)}, included last and flagged so the gap is visible.`,
    );
  }

  return { candidates, notes };
}

function pickAspirational(
  needs: Needs,
  listings: Listing[],
  chosen: Candidate[],
): Candidate | null {
  if (!needs.preferred_sectors.length || !needs.budget_max_pkr) return null;
  if (chosen.some((candidate) => !candidate.overCeiling && inPreferredSector(candidate.listing, needs))) {
    return null;
  }

  const families = needs.preferred_sectors.map(sectorFamily);
  const cheapest = listings
    .filter((listing) => families.includes(sectorFamily(listing.sector)))
    .sort((a, b) => a.price_pkr - b.price_pkr)[0];

  if (!cheapest || chosen.some((candidate) => candidate.listing.id === cheapest.id)) return null;
  return toCandidate(cheapest, needs);
}

function inPreferredSector(listing: Listing, needs: Needs): boolean {
  const families = needs.preferred_sectors.map(sectorFamily);
  return families.includes(sectorFamily(listing.sector));
}
