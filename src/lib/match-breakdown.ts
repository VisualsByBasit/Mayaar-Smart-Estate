import { type Listing, formatPkrShort, sectorFamily } from "@/lib/listings";
import type { Needs } from "@/lib/needs";

/**
 * Everything in this file is computed locally from the user's stated
 * preferences and the listing's own fields. Nothing here is generated text —
 * the model's prose is shown separately and labelled as such, so the bars and
 * tick-lists stay checkable against the data.
 */

export interface Dimension {
  key: string;
  label: string;
  score: number;
  note: string;
}

const clamp = (value: number) => Math.max(5, Math.min(100, Math.round(value)));

/** Amenity keywords a stated priority can be checked against. */
const PRIORITY_SIGNALS: Array<{ test: RegExp; amenities: string[] }> = [
  { test: /corner/i, amenities: ["Corner plot"] },
  { test: /(park|green|garden|lawn|outdoor|kids|children|play)/i, amenities: ["Lawn/garden", "Park facing"] },
  { test: /(pool|swim)/i, amenities: ["Swimming pool"] },
  { test: /(solar|power|electric|load.?shed)/i, amenities: ["Solar power"] },
  { test: /(furnish|move.?in)/i, amenities: ["Furnished"] },
  { test: /(lift|elevator|elderly|parents|accessib|mobility)/i, amenities: ["Elevator/lift"] },
  { test: /(modern|new|contemporary|design|architect)/i, amenities: ["Modern design"] },
  { test: /(storey|story|double|floors?)/i, amenities: ["Double storey"] },
  { test: /(light|sun|bright|airy|ventilat)/i, amenities: ["Park facing", "Modern design"] },
];

/**
 * Priorities an amenity actively rules out. Without this, "single storey" hits
 * the generic storey signal below and a home listing "Double storey" comes back
 * as satisfying it — the buyer who asked because stairs are a problem then gets
 * told the stairs are a feature.
 */
const PRIORITY_CONFLICTS: Array<{ test: RegExp; amenities: string[] }> = [
  {
    test: /(single|one).?(storey|story|level)|ground.?floor|no stairs|without stairs/i,
    amenities: ["Double storey"],
  },
];

/**
 * true / false when the dataset can answer it, null when it simply doesn't
 * record anything about that priority — we never guess in that case.
 */
export function checkPriority(priority: string, listing: Listing): boolean | null {
  const amenities = listing.amenities ?? [];

  const conflict = PRIORITY_CONFLICTS.find((entry) => entry.test.test(priority));
  if (conflict) {
    // A contradicting amenity settles it; its absence doesn't prove the
    // opposite, since nothing in the data records storey count positively.
    return conflict.amenities.some((amenity) => amenities.includes(amenity)) ? false : null;
  }

  const signal = PRIORITY_SIGNALS.find((entry) => entry.test.test(priority));
  if (signal) {
    return signal.amenities.some((amenity) => amenities.includes(amenity));
  }
  const haystack = `${listing.title} ${amenities.join(" ")}`.toLowerCase();
  const words = priority.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
  if (!words.length) return null;
  return words.some((word) => haystack.includes(word)) ? true : null;
}

function locationScore(needs: Needs, listing: Listing): number {
  const listingSector = listing.sector.toLowerCase();
  const listingSociety = listing.society.toLowerCase();
  const exact = needs.preferred_sectors.some((sector) => {
    const wanted = sector.trim().toLowerCase();
    return listingSector.includes(wanted) || listingSociety.includes(wanted);
  });
  if (exact) return 100;
  const families = needs.preferred_sectors.map(sectorFamily);
  return families.includes(sectorFamily(listing.sector)) ? 86 : 48;
}

export function buildBreakdown(needs: Needs, listing: Listing): Dimension[] {
  const dimensions: Dimension[] = [];

  if (needs.budget_max_pkr || needs.budget_min_pkr) {
    const max = needs.budget_max_pkr;
    const min = needs.budget_min_pkr;
    let score = 100;
    let note = `${formatPkrShort(listing.price_pkr)} against your range`;
    if (max && listing.price_pkr > max) {
      const over = (listing.price_pkr - max) / max;
      score = clamp(100 - over * 220);
      note = `${Math.round(over * 100)}% above your ceiling`;
    } else if (min && listing.price_pkr < min) {
      score = 94;
      note = `Under your floor — more budget left over`;
    } else {
      note = `${formatPkrShort(listing.price_pkr)} — inside your range`;
    }
    dimensions.push({ key: "budget", label: "Budget", score, note });
  }

  if (needs.preferred_sectors.length) {
    const score = locationScore(needs, listing);
    dimensions.push({
      key: "location",
      label: "Location",
      score,
      note:
        score === 100
          ? `${listing.sector} is on your list`
          : score === 86
            ? `${listing.sector} — same area, different phase`
            : `${listing.sector} is outside the areas you named`,
    });
  }

  if (needs.bedrooms_min) {
    const short = needs.bedrooms_min - listing.bedrooms;
    dimensions.push({
      key: "bedrooms",
      label: "Bedrooms",
      score: clamp(short > 0 ? 100 - short * 24 : 100),
      note:
        short > 0
          ? `${listing.bedrooms} bedrooms, you asked for ${needs.bedrooms_min}+`
          : `${listing.bedrooms} bedrooms`,
    });
  }

  if (needs.bathrooms_min && listing.bathrooms !== null) {
    const short = needs.bathrooms_min - listing.bathrooms;
    dimensions.push({
      key: "bathrooms",
      label: "Bathrooms",
      score: clamp(short > 0 ? 100 - short * 20 : 100),
      note: `${listing.bathrooms} bathrooms`,
    });
  }

  if (needs.marla_min) {
    const short = needs.marla_min - listing.marla;
    dimensions.push({
      key: "plot",
      label: "Plot size",
      score: clamp(short > 0 ? 100 - (short / needs.marla_min) * 130 : 100),
      note:
        short > 0
          ? `${listing.marla} marla, you wanted ${needs.marla_min}+`
          : `${listing.marla} marla`,
    });
  }

  if (needs.family_size) {
    const perPerson = listing.sqft / needs.family_size;
    dimensions.push({
      key: "household",
      label: "Room for the household",
      score: clamp((perPerson / 450) * 100),
      note: `${Math.round(perPerson)} sq ft per person across ${needs.family_size}`,
    });
  }

  const checkable = needs.priorities
    .map((priority) => ({ priority, result: checkPriority(priority, listing) }))
    .filter((entry) => entry.result !== null);

  if (checkable.length) {
    const met = checkable.filter((entry) => entry.result).length;
    dimensions.push({
      key: "priorities",
      label: "Your priorities",
      score: clamp(40 + (met / checkable.length) * 60),
      note: `${met} of ${checkable.length} confirmable priorities met`,
    });
  }

  return dimensions;
}

export interface FactCheck {
  fits: string[];
  gaps: string[];
  /** Priorities the dataset can't confirm either way. */
  unknown: string[];
}

/** The ✓ / • lists — every line traceable to a field in the listing. */
export function factCheck(needs: Needs, listing: Listing): FactCheck {
  const fits: string[] = [];
  const gaps: string[] = [];
  const unknown: string[] = [];

  if (needs.budget_max_pkr) {
    if (listing.price_pkr <= needs.budget_max_pkr) {
      fits.push(`Within budget at ${formatPkrShort(listing.price_pkr)}`);
    } else {
      const over = listing.price_pkr - needs.budget_max_pkr;
      gaps.push(`${formatPkrShort(over)} above your ceiling`);
    }
  }

  if (needs.preferred_sectors.length) {
    const score = locationScore(needs, listing);
    if (score === 100) fits.push(`In ${listing.sector}, an area you asked for`);
    else if (score === 86) fits.push(`${listing.sector} — same area, different phase`);
    else gaps.push(`${listing.sector} is outside your preferred areas`);
  }

  if (needs.bedrooms_min) {
    if (listing.bedrooms >= needs.bedrooms_min) {
      fits.push(`${listing.bedrooms} bedrooms for your ${needs.bedrooms_min}+ requirement`);
    } else {
      gaps.push(`${listing.bedrooms} bedrooms, one short of your ${needs.bedrooms_min}+`);
    }
  }

  if (needs.bathrooms_min && listing.bathrooms !== null) {
    if (listing.bathrooms >= needs.bathrooms_min) {
      fits.push(`${listing.bathrooms} bathrooms`);
    } else {
      gaps.push(`Only ${listing.bathrooms} bathrooms`);
    }
  }

  if (needs.marla_min) {
    if (listing.marla >= needs.marla_min) {
      fits.push(`${listing.marla} marla plot`);
    } else {
      gaps.push(`${listing.marla} marla — smaller than the ${needs.marla_min} you wanted`);
    }
  }

  for (const priority of needs.priorities) {
    const result = checkPriority(priority, listing);
    if (result === true) fits.push(capitalize(priority));
    else if (result === false) gaps.push(`No ${priority.toLowerCase()} listed`);
    else unknown.push(capitalize(priority));
  }

  if (!listing.bathrooms) unknown.push("Bathroom count not published");

  return { fits, gaps, unknown };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Average of the computed dimensions — shown beside, not instead of, the model's read. */
export function computedFit(dimensions: Dimension[]): number | null {
  if (!dimensions.length) return null;
  const total = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  return Math.round(total / dimensions.length);
}

/* -------------------------------------------------------------- comparison */

export interface ComparisonRow {
  key: string;
  label: string;
  /** One cell per compared home, aligned by index; null where not scored. */
  cells: Array<Dimension | null>;
  /** Every cell sharing the top score — more than one means they tie. */
  bestIndexes: number[];
  /** True when nothing separates the homes here, so a win isn't implied. */
  allTied: boolean;
}

/**
 * buildBreakdown skips dimensions a listing can't answer (an unpublished
 * bathroom count, say), so comparing two homes row-by-row needs the union of
 * their dimensions with gaps left explicit rather than silently shifting rows.
 */
export function buildComparison(needs: Needs, listings: Listing[]): ComparisonRow[] {
  const perListing = listings.map((listing) => buildBreakdown(needs, listing));

  const order: string[] = [];
  const labels = new Map<string, string>();
  for (const dimensions of perListing) {
    for (const dimension of dimensions) {
      if (!labels.has(dimension.key)) {
        labels.set(dimension.key, dimension.label);
        order.push(dimension.key);
      }
    }
  }

  return order.map((key) => {
    const cells = perListing.map(
      (dimensions) => dimensions.find((dimension) => dimension.key === key) ?? null,
    );

    // Most rows tie at 100 once every home clears a requirement. Marking each
    // joint-best cell keeps the row readable — "all three clear this" — instead
    // of leaving it blank and looking unscored.
    const scored = cells
      .map((cell, index) => ({ cell, index }))
      .filter((entry): entry is { cell: Dimension; index: number } => Boolean(entry.cell));
    const best = Math.max(...scored.map((entry) => entry.cell.score), -1);
    const bestIndexes = scored
      .filter((entry) => entry.cell.score === best)
      .map((entry) => entry.index);

    return {
      key,
      label: labels.get(key)!,
      cells,
      bestIndexes,
      allTied: bestIndexes.length === scored.length && scored.length > 1,
    };
  });
}
