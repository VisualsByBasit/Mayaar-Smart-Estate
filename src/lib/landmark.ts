import { type Listing, type Match, haversineKm } from "@/lib/listings";
import type { Needs } from "@/lib/needs";
import { formatKm } from "@/lib/radius";

/**
 * "Near Faisal Mosque" is a geography question, and the model answered it by
 * vibes — a search for an office near the mosque came back with Bahria Enclave,
 * the better part of an hour away. The model is good at knowing *where* Faisal
 * Mosque is; it is bad at holding 146 coordinates in its head and comparing
 * them. So extraction now returns the landmark's lat/lng and everything after
 * that is arithmetic, the same split already used for the budget ceiling in
 * candidates.ts.
 *
 * Nothing here calls a routing service. Mapbox Directions and Google Directions
 * are both metered, and the drive time below is deliberately a straight-line
 * estimate rather than a road route — which is why every surface that shows it
 * has to say so.
 */

/** Inside this, "not too far from X" is honestly true. */
export const NEAR_LANDMARK_KM = 8;

/** The widest a landmark search will stretch before it is dropped entirely. */
export const LANDMARK_OUTER_KM = 12;

/**
 * Straight-line km ÷ this ≈ drive minutes. Islamabad's grid moves faster than
 * this on Kashmir Highway and slower than it inside the sectors; 27 km/h is a
 * middling city average that also absorbs some of the error from measuring the
 * distance as the crow flies rather than along roads.
 */
export const AVERAGE_CITY_SPEED_KMH = 27;

export interface LandmarkPoint {
  latitude: number;
  longitude: number;
  name: string | null;
}

/** The landmark from a brief, or null when extraction wasn't confident. */
export function landmarkFromNeeds(needs: Needs | null | undefined): LandmarkPoint | null {
  if (!needs) return null;
  const { landmark_lat: lat, landmark_lng: lng } = needs;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng, name: needs.landmark_name };
}

/** Rough minutes by car. An estimate, never a routed time — see the note above. */
export function driveMinutes(km: number): number {
  return Math.max(1, Math.round((km / AVERAGE_CITY_SPEED_KMH) * 60));
}

export interface Proximity {
  km: number;
  minutes: number;
  name: string | null;
}

export function proximity(point: LandmarkPoint, listing: Listing): Proximity {
  const km = haversineKm(point, listing);
  return { km, minutes: driveMinutes(km), name: point.name };
}

/**
 * The figures the matching API already measured and returned on a match. Used
 * in preference to recomputing so a card can never disagree with the reasoning
 * printed beside it.
 */
export function matchProximity(listing: Listing | Match): Proximity | null {
  const { landmark_km: km, landmark_minutes: minutes, landmark_name: name } =
    listing as Partial<Match>;
  if (typeof km !== "number" || typeof minutes !== "number") return null;
  return { km, minutes, name: name ?? null };
}

/** Convenience for UI that holds the brief rather than the API response. */
export function listingProximity(
  needs: Needs | null | undefined,
  listing: Listing,
): Proximity | null {
  const point = landmarkFromNeeds(needs);
  return point ? proximity(point, listing) : null;
}

/**
 * The time never appears without this qualifier attached. A bare "12 min" reads
 * as a navigation figure, and this one is a division.
 */
export function formatDriveEstimate(minutes: number): string {
  return `~${minutes} min (estimated, doesn't account for traffic)`;
}

/** "Roughly 3.2 km from Faisal Mosque, ~7 min (estimated, …)" */
export function formatProximity({ km, minutes, name }: Proximity): string {
  const from = name ? ` from ${name}` : "";
  return `Roughly ${formatKm(km)}${from}, ${formatDriveEstimate(minutes)}`;
}

/** Same figures, phrased for a prompt rather than a card. */
export function describeProximity({ km, minutes, name }: Proximity): string {
  return `${km.toFixed(1)} km straight-line from ${name ?? "the landmark they named"}, roughly ${minutes} minutes by car (estimated from distance, not routed)`;
}
