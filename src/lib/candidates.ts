import {
  LANDMARK_OUTER_KM,
  NEAR_LANDMARK_KM,
  type LandmarkPoint,
  type Proximity,
  landmarkFromNeeds,
  proximity,
} from "@/lib/landmark";
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
 *
 * Distance from a named landmark now runs through the same split. Asked which
 * sectors sit near Faisal Mosque, the model offered Bahria Enclave — about 50
 * minutes away — while F-6 and F-7 sit a couple of kilometres from it. So
 * extraction resolves the landmark to coordinates and the comparison happens
 * here, in haversine, against every listing's own lat/lng.
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
  /** Straight-line km and estimated drive minutes to the brief's landmark. */
  near: Proximity | null;
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
  /** Hard distance ceiling from the landmark; null drops the constraint. */
  landmarkKm: number | null;
}

const STRICT: Relaxation = {
  budgetTolerance: 0,
  sector: true,
  bedrooms: true,
  bathrooms: true,
  marla: true,
  landmarkKm: NEAR_LANDMARK_KM,
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
  // The landmark radius is the last thing to give, and when it goes the note
  // has to say so — "near your office" stops being true past this point.
  {
    relax: {
      sector: false,
      marla: false,
      bathrooms: false,
      bedrooms: false,
      budgetTolerance: 0.1,
      landmarkKm: LANDMARK_OUTER_KM,
    },
    note: (needs) =>
      needs.landmark_lat
        ? `Too little sits within ${NEAR_LANDMARK_KM} km of ${landmarkLabel(needs)}, so the search widened to ${LANDMARK_OUTER_KM} km — say so rather than calling these homes close by.`
        : null,
  },
  {
    relax: {
      sector: false,
      marla: false,
      bathrooms: false,
      bedrooms: false,
      budgetTolerance: 0.1,
      landmarkKm: null,
    },
    note: (needs) =>
      needs.landmark_lat
        ? `Nothing within ${LANDMARK_OUTER_KM} km of ${landmarkLabel(needs)} clears the rest of the brief, so distance was set aside entirely — every home below is a real commute away and the figures given say how far.`
        : null,
  },
];

function landmarkLabel(needs: Needs): string {
  return needs.landmark_name ?? "the place they named";
}

function passes(
  listing: Listing,
  needs: Needs,
  rules: Relaxation,
  point: LandmarkPoint | null,
): boolean {
  if (point && rules.landmarkKm !== null) {
    if (proximity(point, listing).km > rules.landmarkKm) return false;
  }
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

function toCandidate(listing: Listing, needs: Needs, point: LandmarkPoint | null): Candidate {
  const checks = factCheck(needs, listing);
  return {
    listing,
    fit: computedFit(buildBreakdown(needs, listing)) ?? 50,
    overCeiling: Boolean(needs.budget_max_pkr && listing.price_pkr > needs.budget_max_pkr),
    fits: checks.fits,
    gaps: checks.gaps,
    unknown: checks.unknown,
    near: point ? proximity(point, listing) : null,
  };
}

/**
 * Distance has to compete with the other dimensions rather than merely gate
 * them, or a 7.9 km home with a marginally better fit score still leads a 1.5 km
 * one. Anything inside 3 km reads as genuinely on the doorstep and pays nothing;
 * past the "near" threshold the cost doubles, so widened searches still rank
 * the closest homes first.
 */
function distancePenalty(km: number): number {
  if (km <= 3) return 0;
  if (km <= NEAR_LANDMARK_KM) return (km - 3) * 4;
  return (NEAR_LANDMARK_KM - 3) * 4 + (km - NEAR_LANDMARK_KM) * 8;
}

function rankScore(candidate: Candidate): number {
  return candidate.near ? candidate.fit - distancePenalty(candidate.near.km) : candidate.fit;
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
  const point = landmarkFromNeeds(needs);
  let matched: Listing[] = [];

  if (point) {
    notes.push(
      `They anchored this search to ${landmarkLabel(needs)}. Each home carries a straight-line distance and an estimated drive time to it, computed from coordinates — those are the only distance figures to use, and the time is an estimate from distance, never a routed or traffic-aware one.`,
    );
  }

  for (const step of LADDER) {
    const rules = { ...STRICT, ...step.relax };
    matched = listings.filter((listing) => passes(listing, needs, rules, point));
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
    .map((listing) => toCandidate(listing, needs, point))
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, target);

  // When the areas they named are simply out of reach, one in-sector home is
  // worth showing so the shortlist can say what that address actually costs.
  const aspirational = pickAspirational(needs, listings, candidates, point);
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
  point: LandmarkPoint | null,
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
  // A stretch on price is worth showing; a stretch on price *and* an hour from
  // the landmark they anchored to is just noise.
  if (point && proximity(point, cheapest).km > LANDMARK_OUTER_KM) return null;
  return toCandidate(cheapest, needs, point);
}

function inPreferredSector(listing: Listing, needs: Needs): boolean {
  const families = needs.preferred_sectors.map(sectorFamily);
  return families.includes(sectorFamily(listing.sector));
}
