"use client";

import mapboxgl, { type Marker } from "mapbox-gl";
import { useEffect, useMemo, useRef, useState } from "react";

type Listing = {
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
  source_url: string;
};

type Props = { listings: Listing[] };
const ISLAMABAD_CENTER: [number, number] = [73.0479, 33.6844];

export default function ListingExplorer({ listings }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();

  const filteredListings = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return listings;
    return listings.filter((listing) =>
      [listing.title, listing.sector, listing.society, listing.city]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [listings, query]);

  const selectedListing = listings.find((listing) => listing.id === selectedId);

  useEffect(() => {
    if (!token || !mapContainerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: ISLAMABAD_CENTER,
      zoom: 10,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => setMapReady(true));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const bounds = new mapboxgl.LngLatBounds();

    filteredListings.forEach((listing) => {
      const element = document.createElement("button");
      element.className = "listing-marker";
      element.type = "button";
      element.title = `${listing.title} — ${listing.price_display}`;
      element.setAttribute("aria-label", `Open ${listing.title}`);
      element.addEventListener("click", () => setSelectedId(listing.id));
      const coordinates: [number, number] = [listing.longitude, listing.latitude];
      const marker = new mapboxgl.Marker({ element })
        .setLngLat(coordinates)
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend(coordinates);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 500 });
    }
  }, [filteredListings, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedListing) return;
    map.flyTo({
      center: [selectedListing.longitude, selectedListing.latitude],
      zoom: Math.max(map.getZoom(), 14),
    });
  }, [selectedListing]);

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900">
      <header className="border-b bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold">Mayaar Smart Estate</h1>
          <p className="mt-1 text-sm text-gray-600">
            Islamabad properties shown using their saved coordinates
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[360px_1fr]">
        <section className="rounded border bg-white p-3">
          <label className="mb-1 block text-sm font-medium" htmlFor="search">
            Search listings
          </label>
          <input
            id="search"
            className="w-full rounded border px-3 py-2 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sector, society or title"
          />
          <p className="my-3 text-sm text-gray-600">
            Showing {filteredListings.length} of {listings.length}
          </p>

          <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            {filteredListings.map((listing) => (
              <button
                key={listing.id}
                type="button"
                onClick={() => setSelectedId(listing.id)}
                className={`w-full rounded border p-3 text-left hover:bg-gray-50 ${
                  selectedId === listing.id ? "border-green-700 bg-green-50" : ""
                }`}
              >
                <span className="block text-sm font-semibold">{listing.title}</span>
                <span className="mt-1 block text-sm text-gray-600">
                  {listing.society} · {listing.sector}
                </span>
                <span className="mt-1 block text-sm font-medium">
                  {listing.price_display}
                </span>
              </button>
            ))}
            {filteredListings.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500">
                No listings match that search.
              </p>
            )}
          </div>
        </section>

        <section className="relative min-h-[620px] overflow-hidden rounded border bg-white">
          {token ? (
            <div ref={mapContainerRef} className="property-map" aria-label="Property map" />
          ) : (
            <div className="flex h-full min-h-[620px] items-center justify-center p-8 text-center">
              <div>
                <h2 className="text-lg font-semibold">Mapbox token needed</h2>
                <p className="mt-2 max-w-lg text-sm text-gray-600">
                  Create <code>.env.local</code> in the project root and add your token as{" "}
                  <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>, then restart the server.
                </p>
              </div>
            </div>
          )}

          {selectedListing && (
            <article className="absolute bottom-4 left-4 right-4 z-10 max-w-md rounded border bg-white p-4 shadow-lg">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="float-right px-2 text-xl text-gray-500"
                aria-label="Close listing details"
              >
                ×
              </button>
              <h2 className="pr-8 font-semibold">{selectedListing.title}</h2>
              <p className="mt-1 text-sm text-gray-600">
                {selectedListing.society} · {selectedListing.sector}
              </p>
              <p className="mt-2 font-semibold">{selectedListing.price_display}</p>
              <p className="mt-1 text-sm">
                {selectedListing.bedrooms} beds · {selectedListing.bathrooms ?? "N/A"} baths ·{" "}
                {selectedListing.marla} marla
              </p>
              <a
                href={selectedListing.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm font-medium text-green-700 underline"
              >
                Open original listing
              </a>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
