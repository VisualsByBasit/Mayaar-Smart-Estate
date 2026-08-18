"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Columns2, List, Loader2, Map as MapIcon, RotateCcw } from "lucide-react";

import MatchCard from "@/components/match-card";
import PropertyMap from "@/components/property-map";
import RecommendationCard from "@/components/recommendation-card";
import RefinePanel from "@/components/refine-panel";
import Reveal from "@/components/reveal";
import SearchFunnel from "@/components/search-funnel";
import { formatPkrShort } from "@/lib/listings";
import { EMPTY_NEEDS, needChips } from "@/lib/needs";
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
                  {/* Only the ranked shortlist goes on the map — dropping the
                      other 141 homes in as context turned the view into a
                      dataset browser rather than these five in the city. */}
                  <div className="relative h-[26rem] overflow-hidden rounded-2xl border border-rule sm:h-[30rem]">
                    <PropertyMap
                      matches={matches}
                      activeId={activeId}
                      onSelect={handleActivate}
                    />
                  </div>

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
                          <span className="shrink-0 text-right text-[0.8125rem] font-medium">
                            {formatPkrShort(match.price_pkr)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
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
