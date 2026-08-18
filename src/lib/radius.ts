import { LISTINGS, type Listing, haversineKm } from "@/lib/listings";

/**
 * Area search is pure geometry over coordinates that are already in
 * listings.json. Nothing here talks to a network service: the circle is drawn
 * client-side as GeoJSON and membership is decided by the haversine distance
 * in `listings.ts`, so the feature stays inside Mapbox's free map-loads tier.
 */

export const RADIUS_MIN_KM = 0.5;
export const RADIUS_MAX_KM = 10;
export const RADIUS_DEFAULT_KM = 2;
export const RADIUS_STEP_KM = 0.1;

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RadiusHit {
  listing: Listing;
  km: number;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function clampRadiusKm(km: number): number {
  if (!Number.isFinite(km)) return RADIUS_DEFAULT_KM;
  const rounded = Math.round(km * 10) / 10;
  return Math.min(RADIUS_MAX_KM, Math.max(RADIUS_MIN_KM, rounded));
}

/**
 * Every listing whose centre falls inside the circle, nearest first. The
 * distance is kept on each hit so the list can show it without recomputing.
 */
export function listingsWithin(
  center: LatLng,
  km: number,
  listings: Listing[] = LISTINGS,
): RadiusHit[] {
  const hits: RadiusHit[] = [];
  for (const listing of listings) {
    const distance = haversineKm(center, listing);
    if (distance <= km) hits.push({ listing, km: distance });
  }
  return hits.sort((a, b) => a.km - b.km);
}

/**
 * Walks `km` from `center` along a compass bearing. Used for the drag handle
 * and for tracing the circle — a flat lng/lat offset would draw an ellipse at
 * Islamabad's latitude rather than a true circle on the ground.
 */
export function destinationPoint(center: LatLng, km: number, bearingDeg: number): LatLng {
  const angular = km / EARTH_RADIUS_KM;
  const bearing = toRad(bearingDeg);
  const lat1 = toRad(center.latitude);
  const lon1 = toRad(center.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: toDeg(lat2),
    // Keep longitude in -180..180 so the ring doesn't wrap oddly.
    longitude: ((toDeg(lon2) + 540) % 360) - 180,
  };
}

/** A closed ring approximating the circle, for a mapbox GeoJSON source. */
export function circleFeature(
  center: LatLng,
  km: number,
  steps = 96,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring: GeoJSON.Position[] = [];
  for (let index = 0; index < steps; index++) {
    const point = destinationPoint(center, km, (index * 360) / steps);
    ring.push([point.longitude, point.latitude]);
  }
  ring.push(ring[0]);

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

/** Bounding box of the circle as [west, south, east, north]. */
export function circleBounds(
  center: LatLng,
  km: number,
): [number, number, number, number] {
  const north = destinationPoint(center, km, 0).latitude;
  const south = destinationPoint(center, km, 180).latitude;
  const east = destinationPoint(center, km, 90).longitude;
  const west = destinationPoint(center, km, 270).longitude;
  return [west, south, east, north];
}

/** "800 m" under a kilometre, "2.4 km" above it. */
export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${Number(km.toFixed(1))} km`;
}
