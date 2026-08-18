"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Columns2, Crosshair, List, Loader2, Map as MapIcon, RotateCcw } from "lucide-react";

import MatchCard from "@/components/match-card";
import OverBudgetBadge from "@/components/over-budget-badge";
import PropertyMap from "@/components/property-map";
import RadiusPanel from "@/components/radius-panel";
import RecommendationCard from "@/components/recommendation-card";
import RefinePanel from "@/components/refine-panel";
import Reveal from "@/components/reveal";
import SearchFunnel from "@/components/search-funnel";
import { formatPkrShort } from "@/lib/listings";
import { EMPTY_NEEDS, needChips } from "@/lib/needs";
import {
  RADIUS_DEFAULT_KM,
  type LatLng,
  clampRadiusKm,
  formatKm,
  listingsWithin,
} from "@/lib/radius";
import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

const STATUS_COPY = {
  extracting: "Reading what you wrote…",
  matching: "Ranking every listing against it…",
} as const;

type View = "list" | "map";

export default function MatchesScreen() {
  const router = useRouter();
  const {
    description,
    needs,
    matches,
    recommendation,
    compare,
    status,
    error,
    refining,
    hydrated,
    runSearch,
    reset,
  } = useSession();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [view, setView] = useState<View>("list");
  const [radiusMode, setRadiusMode] = useState(false);
  const [radiusCenter, setRadiusCenter] = useState<LatLng | null>(null);
  const [radiusKm, setRadiusKm] = useState(RADIUS_DEFAULT_KM);

  // Everything about area search is derived locally from listings.json — the
  // haversine distance decides membership, no service is consulted.
  const radiusHits = useMemo(
    () => (radiusCenter ? listingsWithin(radiusCenter, radiusKm) : []),
    [radiusCenter, radiusKm],
  );

  const rankedIds = useMemo(() => new Set(matches.map((match) => match.id)), [matches]);
  const rankedInsideRadius = useMemo(
    () => matches.filter((match) => radiusHits.some((hit) => hit.listing.id === match.id)),
    [matches, radiusHits],
  );

  const exitRadiusMode = useCallback(() => {
    setRadiusMode(false);
    setRadiusCenter(null);
    setRadiusKm(RADIUS_DEFAULT_KM);
  }, []);

  const toggleRadiusMode = useCallback(() => {
    setRadiusMode((current) => {
      if (current) {
        setRadiusCenter(null);
        setRadiusKm(RADIUS_DEFAULT_KM);
        return false;
      }
      // Dropping a point only makes sense on the map, so entering the mode
      // brings the map forward rather than leaving the user on the list.
      setView("map");
      return true;
    });
  }, []);

  // A direct hit on /matches with nothing in the session has nothing to show.
  useEffect(() => {
    if (hydrated && status === "idle" && !description) router.replace("/describe");
  }, [hydrated, status, description, router]);

  const handleActivate = useCallback((id: number | null) => setActiveId(id), []);

  if (!hydrated) {
    return (
      <div className="shell flex flex-1 items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="shell flex flex-1 items-center justify-center py-24">
        <div className="max-w-md text-center">
          <h1 className="font-heading text-2xl font-medium">That didn&apos;t go through.</h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">{error}</p>
          <div className="mt-7 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void runSearch(description)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-forest px-5 text-[0.875rem] font-medium text-primary-foreground transition-colors hover:bg-forest-deep"
            >
              <RotateCcw className="size-3.5" />
              Try again
            </button>
            <Link
              href="/describe"
              onClick={reset}
              className="inline-flex h-10 items-center rounded-md border border-rule px-5 text-[0.875rem] font-medium text-ink-soft transition-colors hover:text-forest"
            >
              Start over
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const loading = status === "extracting" || status === "matching";
  const chips = needs ? needChips(needs) : [];
  const recommended = recommendation
    ? matches.find((match) => match.id === recommendation.id)
    : undefined;

  return (
    <div className="shell py-10 md:py-14">
      {/* ------------------------------------------------------ what we heard */}
      <Reveal className="max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="eyebrow">What Mayaar heard</span>
          <Link
            href="/describe"
            className="text-[0.75rem] font-medium text-forest hover:underline"
          >
            Edit
          </Link>
        </div>

        <p className="font-heading mt-4 text-[1.375rem] leading-snug font-medium text-balance sm:text-[1.625rem]">
          &ldquo;{description}&rdquo;
        </p>

        {chips.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li
                key={chip.key}
                className="rounded-full border border-rule bg-paper px-3.5 py-1.5 text-[0.8125rem]"
              >
                <span className="text-ink-soft">{chip.label}</span>{" "}
                <span className="font-medium">{chip.value}</span>
              </li>
            ))}
          </ul>
        )}

        {needs?.soft_signal && (
          <p className="mt-4 max-w-2xl border-l-2 border-sage pl-3.5 text-[0.8125rem] leading-relaxed text-ink-soft italic">
            Read between the lines: {needs.soft_signal}
          </p>
        )}
      </Reveal>

      {/* --------------------------------------------------- the one answer */}
      {!loading && recommendation && recommended && (
        <Reveal delay={60} className="mt-10">
          <RecommendationCard recommendation={recommendation} match={recommended} />
        </Reveal>
      )}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
        {/* ------------------------------------------------------- shortlist */}
        <div>
          <div className="flex items-center justify-between gap-4 border-b border-rule pb-3">
            <h1 className="font-heading text-[1.125rem] font-medium">
              {loading ? "Working…" : `Your ${matches.length} best matches`}
            </h1>

            {!loading && matches.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleRadiusMode}
                  aria-pressed={radiusMode}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.75rem] font-medium transition-colors",
                    radiusMode
                      ? "border-forest bg-forest text-primary-foreground"
                      : "border-rule text-ink-soft hover:text-forest",
                  )}
                >
                  <Crosshair className="size-3" />
                  Search by area
                </button>

                <div className="flex rounded-md border border-rule p-0.5">
                  {(
                    [
                      { key: "list", label: "List", icon: List },
                      { key: "map", label: "Map", icon: MapIcon },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setView(key)}
                      aria-pressed={view === key}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-[0.3125rem] px-2.5 py-1 text-[0.75rem] font-medium transition-colors",
                        view === key
                          ? "bg-forest text-primary-foreground"
                          : "text-ink-soft hover:text-forest",
                      )}
                    >
                      <Icon className="size-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              <p className="flex items-center gap-2 text-[0.875rem] text-ink-soft">
                <Loader2 className="size-3.5 animate-spin" />
                {STATUS_COPY[status]}
              </p>
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="h-[9.5rem] animate-pulse rounded-2xl border border-rule bg-paper/60"
                  style={{ animationDelay: `${index * 120}ms` }}
                />
              ))}
            </div>
          ) : (
            <div
              className={cn(
                "transition-opacity",
                refining && "pointer-events-none opacity-50",
              )}
              onMouseLeave={() => setActiveId(null)}
            >
              {view === "map" ? (
                <div className="mt-4">
                  {/* Outside area search only the ranked shortlist goes on the
                      map — dropping the other 141 homes in as context turned
                      the view into a dataset browser rather than these five in
                      the city. Area search deliberately widens that to every
                      home inside the circle. */}
                  <div className="relative h-[26rem] overflow-hidden rounded-2xl border border-rule sm:h-[30rem]">
                    <PropertyMap
                      matches={radiusMode ? rankedInsideRadius : matches}
                      context={
                        radiusMode
                          ? radiusHits
                              .map((hit) => hit.listing)
                              .filter((listing) => !rankedIds.has(listing.id))
                          : []
                      }
                      activeId={activeId}
                      onSelect={handleActivate}
                      radiusMode={radiusMode}
                      radiusCenter={radiusCenter}
                      radiusKm={radiusKm}
                      onPickCenter={setRadiusCenter}
                      onRadiusChange={(km) => setRadiusKm(clampRadiusKm(km))}
                    />
                  </div>

                  {radiusMode && (
                    <RadiusPanel
                      center={radiusCenter}
                      km={radiusKm}
                      total={radiusHits.length}
                      rankedInside={rankedInsideRadius.length}
                      onKmChange={(km) => setRadiusKm(clampRadiusKm(km))}
                      onClear={exitRadiusMode}
                    />
                  )}

                  {/* Until a point is dropped there is nothing to filter by, so
                      the ranked list stays put rather than leaving a dead gap
                      under the map. */}
                  {radiusMode && radiusCenter ? (
                    radiusHits.length > 0 ? (
                        <ol className="thin-scroll mt-4 max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
                          {radiusHits.map(({ listing, km }) => {
                            const ranked = matches.find((match) => match.id === listing.id);
                            return (
                              <li key={listing.id}>
                                <Link
                                  href={`/listing/${listing.id}`}
                                  onMouseEnter={() => setActiveId(listing.id)}
                                  onFocus={() => setActiveId(listing.id)}
                                  className={cn(
                                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                                    activeId === listing.id
                                      ? "border-forest/40 bg-paper"
                                      : "border-rule bg-paper/60 hover:border-forest/30",
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold",
                                      ranked
                                        ? "bg-forest text-primary-foreground"
                                        : "bg-sand text-ink-soft",
                                    )}
                                  >
                                    {ranked ? ranked.rank : "·"}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[0.8125rem] font-medium">
                                      {listing.title}
                                    </span>
                                    <span className="block truncate text-[0.75rem] text-ink-soft">
                                      {listing.sector} · {formatKm(km)} away
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 flex-col items-end gap-1">
                                    <span className="text-[0.8125rem] font-medium">
                                      {formatPkrShort(listing.price_pkr)}
                                    </span>
                                    <OverBudgetBadge
                                      price={listing.price_pkr}
                                      size="compact"
                                    />
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ol>
                    ) : (
                      <p className="mt-4 rounded-xl border border-dashed border-rule bg-paper/50 py-10 text-center text-[0.8125rem] text-ink-soft">
                        No homes inside {formatKm(radiusKm)} of that point. Widen the
                        radius or drop the point somewhere else.
                      </p>
                    )
                  ) : (
                    <ol className="mt-4 space-y-1.5">
                      {matches.map((match) => (
                        <li key={match.id}>
                          <Link
                            href={`/listing/${match.id}`}
                            onMouseEnter={() => setActiveId(match.id)}
                            onFocus={() => setActiveId(match.id)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                              activeId === match.id
                                ? "border-forest/40 bg-paper"
                                : "border-rule bg-paper/60 hover:border-forest/30",
                            )}
                          >
                            <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-[0.6875rem] font-semibold text-primary-foreground">
                              {match.rank}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[0.8125rem] font-medium">
                                {match.title}
                              </span>
                              <span className="block truncate text-[0.75rem] text-ink-soft">
                                {match.sector}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-[0.8125rem] font-medium">
                                {formatPkrShort(match.price_pkr)}
                              </span>
                              <OverBudgetBadge price={match.price_pkr} size="compact" />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {matches.map((match, index) => (
                    <Reveal key={match.id} delay={index * 70}>
                      <MatchCard
                        match={match}
                        active={activeId === match.id}
                        onActivate={handleActivate}
                      />
                    </Reveal>
                  ))}

                  {matches.length === 0 && (
                    <p className="py-16 text-center text-[0.875rem] text-ink-soft">
                      No homes came back for that. Try loosening the budget or adding
                      another area.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------- aside */}
        <aside className="space-y-10 lg:sticky lg:top-8 lg:self-start">
          <SearchFunnel
            needs={needs ?? EMPTY_NEEDS}
            shortlistCount={matches.length || 5}
            pending={loading}
          />

          {compare.length > 0 && (
            <div className="rounded-2xl border border-rule bg-paper p-4">
              <span className="eyebrow">Comparing</span>
              <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
                {compare.length === 1
                  ? "One home picked. Add another to see them side by side."
                  : `${compare.length} homes picked.`}
              </p>
              <Link
                href="/compare"
                className={cn(
                  "mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md text-[0.8125rem] font-medium transition-colors",
                  compare.length >= 2
                    ? "bg-forest text-primary-foreground hover:bg-forest-deep"
                    : "border border-rule text-ink-soft hover:text-forest",
                )}
              >
                <Columns2 className="size-3.5" />
                Open compare
              </Link>
            </div>
          )}

          {!loading && needs && <RefinePanel />}
        </aside>
      </div>
    </div>
  );
}
