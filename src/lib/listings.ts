import listingsData from "@/data/listings.json";

export interface Listing {
  id: number;
  title: string;
  city: string;
  sector: string;
  society: string;
  latitude: number;
  longitude: number;
  marla: number;
  sqft: number;
  price_pkr: number;
  price_display: string;
  bedrooms: number;
  bathrooms: number | null;
  amenities: string[];
  source_url: string;
  image_url?: string | null;
  data_confidence: string;
  geocode_confidence: string;
  location_note: string;
}

/** A listing plus the reasoning Gemini returned for it. */
export interface Match extends Listing {
  rank: number;
  match_percent: number;
  why_it_fits: string;
  not_perfect: string;
}

/**
 * The one home Mayaar would actually put in front of this buyer, chosen out of
 * the ranked five. Deliberately separate from the list so it can disagree with
 * rank 1 and say why.
 */
export interface Recommendation {
  id: number;
  headline: string;
  rationale: string;
  trade_off: string;
}

export const LISTINGS = listingsData as Listing[];
export const TOTAL_LISTINGS = LISTINGS.length;

const BY_ID = new Map(LISTINGS.map((listing) => [listing.id, listing]));

export function getListing(id: number): Listing | undefined {
  return BY_ID.get(id);
}

/**
 * Only 18 of the 146 scraped listings carry a real photo. The rest fall back to
 * a fixed pool of architectural photography, picked deterministically from the
 * listing id so a home always shows the same image. `isRepresentative` lets the
 * UI say so out loud rather than passing stock photography off as the house.
 */
const PHOTO_POOL = [
  "7031595", // modern two-storey villa with lawn
  "7031407", // white villa, paved driveway
  "323780", // contemporary glass-and-render exterior
  "7061662", // garden-facing house with verandah
  "5997993", // white house, mature lawn
  "259588", // stone frontage, wide driveway
  "1571460", // bright living room with open stair
  "5982764", // warm living room, full-height glazing
  "6970048", // dark-toned modern living room
  "1080721", // kitchen island, natural light
  "2724749", // white kitchen
  "1643383", // compact modern living space
  "1918291", // loft-style living room
  "1396122", // suburban frontage at dusk
  "106399", // suburban frontage, evening light
  "3935350", // kitchen with hardwood floors
  "2724748", // kitchen, island seating
  "8082553", // bathroom, stone finishes
];

function pexels(id: string, width: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

export interface ListingPhoto {
  src: string;
  isRepresentative: boolean;
}

export function listingPhoto(listing: Listing, width = 1000): ListingPhoto {
  if (listing.image_url) {
    return { src: listing.image_url, isRepresentative: false };
  }
  const photoId = PHOTO_POOL[listing.id % PHOTO_POOL.length];
  return { src: pexels(photoId, width), isRepresentative: true };
}

/** Extra frames for the detail page gallery — always representative. */
export function listingGallery(listing: Listing, count = 3): string[] {
  const start = (listing.id * 7) % PHOTO_POOL.length;
  return Array.from({ length: count }, (_, index) =>
    pexels(PHOTO_POOL[(start + index + 1) % PHOTO_POOL.length], 800),
  );
}

export const HERO_PHOTO = pexels("7031407", 1400);
export const EDITORIAL_PHOTO = pexels("5982764", 1200);
export const REASONING_PHOTO = pexels("7031595", 1000);

/** 43000000 -> "4.3 Cr", 850000 -> "8.5 Lac". Compact enough for map pins. */
export function formatPkrShort(value: number): string {
  if (value >= 10_000_000) {
    const crore = value / 10_000_000;
    return `${crore >= 100 ? Math.round(crore) : Number(crore.toFixed(2))} Cr`;
  }
  if (value >= 100_000) {
    return `${Number((value / 100_000).toFixed(1))} Lac`;
  }
  return value.toLocaleString("en-PK");
}

export function formatPkr(value: number): string {
  return `PKR ${formatPkrShort(value)}`;
}

/** Groups "DHA Defence Phase 5" and "DHA Phase 3 - Block B" under "DHA". */
export function sectorFamily(sector: string): string {
  const normalized = sector.trim().toUpperCase();
  if (normalized.startsWith("DHA")) return "DHA";
  if (normalized.startsWith("BAHRIA")) return "BAHRIA";
  const sectorCode = normalized.match(/^([A-Z]-\d+)/);
  return sectorCode ? sectorCode[1] : normalized;
}

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
