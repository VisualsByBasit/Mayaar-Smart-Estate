"use client";

import mapboxgl, { type Marker } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import { type Listing, type Match, formatPkrShort } from "@/lib/listings";

const ISLAMABAD_CENTER: [number, number] = [73.0479, 33.6844];

/**
 * Ranked matches render as numbered price pills; the rest of the dataset sits
 * behind them as quiet dots, so a shortlist reads in the context of the whole
 * city rather than floating on an empty map.
 */
export default function PropertyMap({
  matches,
  context = [],
  activeId,
  onSelect,
}: {
  matches: Match[];
  context?: Listing[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

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

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 72, maxZoom: 13, duration: 600 });
    }

    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
    };
  }, [matches, context, ready, onSelect]);

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
