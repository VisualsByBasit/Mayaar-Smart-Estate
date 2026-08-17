import {
  LISTINGS,
  type Listing,
  formatPkrShort,
  sectorFamily,
} from "@/lib/listings";

/** Shape returned by /api/extract-needs and /api/refine-needs. */
export interface Needs {
  budget_min_pkr: number | null;
  budget_max_pkr: number | null;
  preferred_sectors: string[];
  bedrooms_min: number | null;
  bathrooms_min: number | null;
  marla_min: number | null;
  priorities: string[];
  family_size: number | null;
  soft_signal: string | null;
}

export const EMPTY_NEEDS: Needs = {
  budget_min_pkr: null,
  budget_max_pkr: null,
  preferred_sectors: [],
  bedrooms_min: null,
  bathrooms_min: null,
  marla_min: null,
  priorities: [],
  family_size: null,
  soft_signal: null,
};

/** Tolerates missing/odd fields from the model without throwing. */
export function normalizeNeeds(raw: unknown): Needs {
  const source = (raw ?? {}) as Partial<Record<keyof Needs, unknown>>;
  const num = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  const strings = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];

  return {
    budget_min_pkr: num(source.budget_min_pkr),
    budget_max_pkr: num(source.budget_max_pkr),
    preferred_sectors: strings(source.preferred_sectors),
    bedrooms_min: num(source.bedrooms_min),
    bathrooms_min: num(source.bathrooms_min),
    marla_min: num(source.marla_min),
    priorities: strings(source.priorities).slice(0, 6),
    family_size: num(source.family_size),
    soft_signal:
      typeof source.soft_signal === "string" && source.soft_signal.trim()
        ? source.soft_signal.trim()
        : null,
  };
}

/* ------------------------------------------------------------------ chips */

export interface NeedChip {
  key: keyof Needs;
  label: string;
  value: string;
  /** Requirements the user stated vs. things Mayaar read between the lines. */
  inferred?: boolean;
}

export function needChips(needs: Needs): NeedChip[] {
  const chips: NeedChip[] = [];

  if (needs.budget_min_pkr || needs.budget_max_pkr) {
    const min = needs.budget_min_pkr ? formatPkrShort(needs.budget_min_pkr) : null;
    const max = needs.budget_max_pkr ? formatPkrShort(needs.budget_max_pkr) : null;
    chips.push({
      key: "budget_max_pkr",
      label: "Budget",
      value:
        min && max ? `PKR ${min} – ${max}` : max ? `Up to PKR ${max}` : `From PKR ${min}`,
    });
  }

  if (needs.preferred_sectors.length) {
    chips.push({
      key: "preferred_sectors",
      label: "Location",
      value: needs.preferred_sectors.join(" · "),
    });
  }

  if (needs.bedrooms_min) {
    chips.push({
      key: "bedrooms_min",
      label: "Bedrooms",
      value: `${needs.bedrooms_min}+`,
    });
  }

  if (needs.bathrooms_min) {
    chips.push({
      key: "bathrooms_min",
      label: "Bathrooms",
      value: `${needs.bathrooms_min}+`,
    });
  }

  if (needs.marla_min) {
    chips.push({
      key: "marla_min",
      label: "Plot size",
      value: `${needs.marla_min}+ marla`,
    });
  }

  if (needs.family_size) {
    chips.push({
      key: "family_size",
      label: "Household",
      value: `${needs.family_size} people`,
    });
  }

  return chips;
}

/* --------------------------------------------------------------- narrowing */

export interface Funnel {
  total: number;
  viable: number;
  strong: number;
  shortlist: number;
}

/**
 * Real, deterministic narrowing over the dataset — this is what the funnel on
 * the matches screen counts down. `viable` applies the hard requirements with a
 * small budget tolerance; `strong` additionally honours location preference.
 */
export function narrowListings(needs: Needs, listings: Listing[] = LISTINGS) {
  const budgetMax = needs.budget_max_pkr ? needs.budget_max_pkr * 1.1 : null;
  const budgetMin = needs.budget_min_pkr ? needs.budget_min_pkr * 0.9 : null;

  const viable = listings.filter((listing) => {
    if (budgetMax && listing.price_pkr > budgetMax) return false;
    if (budgetMin && listing.price_pkr < budgetMin) return false;
    if (needs.bedrooms_min && listing.bedrooms < needs.bedrooms_min) return false;
    if (
      needs.bathrooms_min &&
      listing.bathrooms !== null &&
      listing.bathrooms < needs.bathrooms_min
    ) {
      return false;
    }
    if (needs.marla_min && listing.marla < needs.marla_min) return false;
    return true;
  });

  const families = needs.preferred_sectors.map((sector) => sectorFamily(sector));
  const strong = families.length
    ? viable.filter((listing) => families.includes(sectorFamily(listing.sector)))
    : viable.slice(0, 12);

  return { viable, strong };
}

export function buildFunnel(
  needs: Needs,
  shortlistCount: number,
  listings: Listing[] = LISTINGS,
): Funnel {
  const { viable, strong } = narrowListings(needs, listings);
  // The stages must read as a narrowing sequence even when the filters are
  // loose, so each stage is clamped to be no smaller than the one after it.
  const shortlist = Math.max(shortlistCount, 1);
  const strongCount = Math.max(strong.length, shortlist);
  const viableCount = Math.max(viable.length, strongCount);
  return {
    total: listings.length,
    viable: viableCount,
    strong: strongCount,
    shortlist,
  };
}

/* ---------------------------------------------------------------- diffing */

export interface NeedChange {
  label: string;
  from: string;
  to: string;
  direction: "up" | "down" | "change";
}

const NONE = "—";

function fmtBudget(value: number | null) {
  return value ? `PKR ${formatPkrShort(value)}` : NONE;
}

/**
 * Turns "before" and "after" preferences into human-readable change lines, so
 * the refine screen can show conversation → preference change → new ranking.
 */
export function diffNeeds(before: Needs, after: Needs): NeedChange[] {
  const changes: NeedChange[] = [];

  const numeric: Array<[keyof Needs, string, (v: number | null) => string]> = [
    ["budget_min_pkr", "Minimum budget", fmtBudget],
    ["budget_max_pkr", "Maximum budget", fmtBudget],
    ["bedrooms_min", "Bedrooms", (v) => (v ? `${v}+` : NONE)],
    ["bathrooms_min", "Bathrooms", (v) => (v ? `${v}+` : NONE)],
    ["marla_min", "Plot size", (v) => (v ? `${v} marla` : NONE)],
    ["family_size", "Household", (v) => (v ? `${v} people` : NONE)],
  ];

  for (const [key, label, format] of numeric) {
    const from = before[key] as number | null;
    const to = after[key] as number | null;
    if (from === to) continue;
    changes.push({
      label,
      from: format(from),
      to: format(to),
      direction: (to ?? 0) > (from ?? 0) ? "up" : "down",
    });
  }

  const beforeSectors = before.preferred_sectors.join(" · ") || NONE;
  const afterSectors = after.preferred_sectors.join(" · ") || NONE;
  if (beforeSectors !== afterSectors) {
    changes.push({
      label: "Location",
      from: beforeSectors,
      to: afterSectors,
      direction:
        after.preferred_sectors.length < before.preferred_sectors.length
          ? "down"
          : after.preferred_sectors.length > before.preferred_sectors.length
            ? "up"
            : "change",
    });
  }

  const added = after.priorities.filter((item) => !before.priorities.includes(item));
  const dropped = before.priorities.filter((item) => !after.priorities.includes(item));
  for (const item of added) {
    changes.push({ label: "Priority added", from: NONE, to: item, direction: "up" });
  }
  for (const item of dropped) {
    changes.push({ label: "Priority dropped", from: item, to: NONE, direction: "down" });
  }

  return changes;
}

/** How many homes entered, left, or moved in the ranked shortlist. */
export function rankingDelta(
  beforeIds: number[],
  afterIds: number[],
): { entered: number; left: number; moved: number } {
  const beforeSet = new Set(beforeIds);
  const afterSet = new Set(afterIds);
  const entered = afterIds.filter((id) => !beforeSet.has(id)).length;
  const left = beforeIds.filter((id) => !afterSet.has(id)).length;
  const moved = afterIds.filter(
    (id, index) => beforeSet.has(id) && beforeIds.indexOf(id) !== index,
  ).length;
  return { entered, left, moved };
}
