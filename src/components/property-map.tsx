"use client";

import mapboxgl, { type Marker } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import { type Listing, type Match, formatPkrShort, haversineKm } from "@/lib/listings";
import {
  type LatLng,
  circleBounds,
  circleFeature,
  clampRadiusKm,
  destinationPoint,
} from "@/lib/radius";

const ISLAMABAD_CENTER: [number, number] = [73.0479, 33.6844];

const CIRCLE_SOURCE = "radius-circle";
const CIRCLE_FILL = "radius-circle-fill";
const CIRCLE_LINE = "radius-circle-line";

/**
 * Ranked matches render as numbered price pills; the rest of the dataset sits
 * behind them as quiet dots, so a shortlist reads in the context of the whole
 * city rather than floating on an empty map.
 *
 * Area search adds a circle drawn as a client-side GeoJSON polygon plus two
 * draggable markers (centre and edge). All of it is rendered by mapbox-gl
 * locally — no Geocoding, Directions or other billed endpoint is involved.
 */
export default function PropertyMap({
  matches,
  context = [],
  activeId,
  onSelect,
  radiusMode = false,
  radiusCenter = null,
  radiusKm,
  onPickCenter,
  onRadiusChange,
}: {
  matches: Match[];
  context?: Listing[];
  activeId: number | null;
  onSelect: (id: number) => void;
  radiusMode?: boolean;
  radiusCenter?: LatLng | null;
  radiusKm?: number;
  onPickCenter?: (center: LatLng) => void;
  onRadiusChange?: (km: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const centerMarkerRef = useRef<Marker | null>(null);
  const handleMarkerRef = useRef<Marker | null>(null);
  const draggingHandleRef = useRef(false);
  const [ready, setReady] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

  // Handlers are read through refs so the map's own listeners can stay
  // registered once instead of being torn down whenever a parent re-renders.
  // Synced after render rather than during it, so the refs are never written
  // while React is still deciding what to draw.
  const pickRef = useRef(onPickCenter);
  const radiusChangeRef = useRef(onRadiusChange);
  const radiusModeRef = useRef(radiusMode);
  const centerRef = useRef(radiusCenter);

  useEffect(() => {
    pickRef.current = onPickCenter;
    radiusChangeRef.current = onRadiusChange;
    radiusModeRef.current = radiusMode;
    centerRef.current = radiusCenter;
  });

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: ISLAMABAD_CENTER,
      zoom: 10,
      maxZoom: 15,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setReady(true));

    // Dropping a new centre is the only click the map itself handles, and only
    // while area search is switched on.
    map.on("click", (event) => {
      if (!radiusModeRef.current) return;
      pickRef.current?.({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const markers = markersRef.current;
    markers.forEach((marker) => marker.remove());
    markers.clear();

    const matchIds = new Set(matches.map((match) => match.id));
    const bounds = new mapboxgl.LngLatBounds();

    for (const listing of context) {
      if (matchIds.has(listing.id)) continue;
      const element = document.createElement("button");
      element.type = "button";
      element.className = "listing-dot";
      element.title = `${listing.title} — ${listing.price_display}`;
      element.setAttribute("aria-label", listing.title);
      element.addEventListener("click", () => onSelect(listing.id));
      markers.set(
        listing.id,
        new mapboxgl.Marker({ element })
          .setLngLat([listing.longitude, listing.latitude])
          .addTo(map),
      );
    }

    for (const match of matches) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "listing-pill";
      element.setAttribute("aria-label", `Rank ${match.rank}: ${match.title}`);
      element.innerHTML = `<span class="listing-pill__rank">${match.rank}</span>`;
      element.append(formatPkrShort(match.price_pkr));
      element.addEventListener("click", () => onSelect(match.id));
      const coordinates: [number, number] = [match.longitude, match.latitude];
      markers.set(
        match.id,
        new mapboxgl.Marker({ element }).setLngLat(coordinates).addTo(map),
      );
      bounds.extend(coordinates);
    }

    // In area search the circle owns the viewport; refitting to the ranked
    // pins here would yank the map away from the point the user just dropped.
    if (!bounds.isEmpty() && !radiusMode) {
      map.fitBounds(bounds, { padding: 72, maxZoom: 13, duration: 600 });
    }

    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
    };
  }, [matches, context, ready, onSelect, radiusMode]);

  /* ------------------------------------------------------------ the circle */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const active = radiusMode && radiusCenter && radiusKm;

    if (!active) {
      if (map.getLayer(CIRCLE_FILL)) map.removeLayer(CIRCLE_FILL);
      if (map.getLayer(CIRCLE_LINE)) map.removeLayer(CIRCLE_LINE);
      if (map.getSource(CIRCLE_SOURCE)) map.removeSource(CIRCLE_SOURCE);
      centerMarkerRef.current?.remove();
      centerMarkerRef.current = null;
      handleMarkerRef.current?.remove();
      handleMarkerRef.current = null;
      return;
    }

    const feature = circleFeature(radiusCenter, radiusKm);
    const existing = map.getSource(CIRCLE_SOURCE);

    if (existing) {
      (existing as mapboxgl.GeoJSONSource).setData(feature);
    } else {
      map.addSource(CIRCLE_SOURCE, { type: "geojson", data: feature });
      map.addLayer({
        id: CIRCLE_FILL,
        type: "fill",
        source: CIRCLE_SOURCE,
        paint: { "fill-color": "#1b4332", "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: CIRCLE_LINE,
        type: "line",
        source: CIRCLE_SOURCE,
        paint: { "line-color": "#1b4332", "line-width": 1.5, "line-dasharray": [2, 1.5] },
      });
    }

    const centreLngLat: [number, number] = [radiusCenter.longitude, radiusCenter.latitude];
    const edge = destinationPoint(radiusCenter, radiusKm, 90);
    const edgeLngLat: [number, number] = [edge.longitude, edge.latitude];

    if (!centerMarkerRef.current) {
      const element = document.createElement("div");
      element.className = "radius-center";
      element.setAttribute("aria-label", "Search centre — drag to move");
      const marker = new mapboxgl.Marker({ element, draggable: true })
        .setLngLat(centreLngLat)
        .addTo(map);
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        pickRef.current?.({ latitude: lat, longitude: lng });
      });
      centerMarkerRef.current = marker;
    } else {
      centerMarkerRef.current.setLngLat(centreLngLat);
    }

    if (!handleMarkerRef.current) {
      const element = document.createElement("div");
      element.className = "radius-handle";
      element.setAttribute("aria-label", "Drag to resize the search radius");
      const marker = new mapboxgl.Marker({ element, draggable: true })
        .setLngLat(edgeLngLat)
        .addTo(map);
      // Resizing is just the distance from the centre to wherever the handle
      // was dropped — the same haversine used to filter the listings.
      const resize = () => {
        const origin = centerRef.current;
        if (!origin) return;
        const { lat, lng } = marker.getLngLat();
        radiusChangeRef.current?.(
          clampRadiusKm(haversineKm(origin, { latitude: lat, longitude: lng })),
        );
      };
      marker.on("dragstart", () => {
        draggingHandleRef.current = true;
      });
      marker.on("drag", resize);
      marker.on("dragend", () => {
        draggingHandleRef.current = false;
        resize();
      });
      handleMarkerRef.current = marker;
    } else if (!draggingHandleRef.current) {
      // Snapping the handle back onto due-east mid-drag would wrestle the
      // pointer, so it only re-seats once the drag has finished.
      handleMarkerRef.current.setLngLat(edgeLngLat);
    }
  }, [radiusMode, radiusCenter, radiusKm, ready]);

  /**
   * Frame the circle when the centre moves, and again only if widening pushed
   * it outside the viewport. Refitting on every slider tick would feel like the
   * map fighting back; never refitting loses the circle off-screen entirely.
   */
  const lastFitRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !radiusMode || !radiusCenter || !radiusKm) return;

    const [west, south, east, north] = circleBounds(radiusCenter, radiusKm);
    const centreKey = `${radiusCenter.latitude},${radiusCenter.longitude}`;
    const centreMoved = lastFitRef.current !== centreKey;

    const view = map.getBounds();
    const escaped =
      !view ||
      west < view.getWest() ||
      east > view.getEast() ||
      south < view.getSouth() ||
      north > view.getNorth();

    // Mid-drag the pointer owns the interaction; re-frame once it is released.
    if (!centreMoved && (!escaped || draggingHandleRef.current)) return;

    lastFitRef.current = centreKey;
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 64, duration: 500 },
    );
  }, [radiusCenter, radiusKm, radiusMode, ready]);

  /* Crosshair while a point is waiting to be dropped. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getCanvas().style.cursor = radiusMode && !radiusCenter ? "crosshair" : "";
  }, [radiusMode, radiusCenter, ready]);

  // Highlighting is a class swap on the existing markers — rebuilding them on
  // every hover would tear down and re-add a hundred DOM nodes.
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      marker.getElement().classList.toggle("is-active", id === activeId);
    });

    const map = mapRef.current;
    if (!map || activeId === null) return;
    const active = matches.find((match) => match.id === activeId);
    if (active) {
      map.easeTo({
        center: [active.longitude, active.latitude],
        zoom: Math.max(map.getZoom(), 12.5),
        duration: 600,
      });
    }
  }, [activeId, matches]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-sand p-8 text-center">
        <p className="max-w-xs text-[0.8125rem] leading-relaxed text-ink-soft">
          Add <code className="font-mono text-xs">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>{" "}
          to <code className="font-mono text-xs">.env.local</code> to show the map.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className="property-map" aria-label="Map of matching homes" />;
}
