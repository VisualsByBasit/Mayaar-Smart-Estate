"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Columns2, Loader2, Trophy, X } from "lucide-react";

import EmptyState from "@/components/empty-state";
import OverBudgetBadge from "@/components/over-budget-badge";
import Reveal from "@/components/reveal";
import ScoreBar from "@/components/score-bar";
import { type Listing, formatPkr, getListing, listingPhoto } from "@/lib/listings";
import { buildComparison, computedFit, buildBreakdown } from "@/lib/match-breakdown";
import { COMPARE_LIMIT, useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

const FACT_ROWS: Array<{
  label: string;
  value: (listing: Listing) => string;
  /** Extra mark beside the value — the budget flag on the price row. */
  badge?: (listing: Listing) => React.ReactNode;
}> = [
  {
    label: "Price",
    value: (listing) => formatPkr(listing.price_pkr),
    badge: (listing) => <OverBudgetBadge price={listing.price_pkr} size="compact" />,
  },
  { label: "Plot size", value: (listing) => `${listing.marla} marla` },
  { label: "Covered area", value: (listing) => `${listing.sqft.toLocaleString("en-PK")} sq ft` },
  { label: "Bedrooms", value: (listing) => String(listing.bedrooms) },
  { label: "Bathrooms", value: (listing) => listing.bathrooms?.toString() ?? "Not published" },
  { label: "Sector", value: (listing) => listing.sector },
];

export default function CompareScreen() {
  const { compare, matches, needs, saved, toggleCompare, toggleSaved, hydrated } = useSession();

  if (!hydrated) {
    return (
      <div className="shell flex flex-1 items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  // Read homes from the dataset, not the shortlist: a re-rank can drop a home
  // the user is still comparing, and the table shouldn't lose a column for it.
  const entries = compare
    .map((id) => ({
      listing: getListing(id),
      match: matches.find((match) => match.id === id),
    }))
    .filter((entry): entry is { listing: Listing; match: (typeof matches)[number] | undefined } =>
      Boolean(entry.listing),
    );

  if (entries.length < 2) {
    return (
      <div className="shell py-10 md:py-14">
        <Reveal className="max-w-2xl">
          <span className="eyebrow">Side by side</span>
          <h1 className="font-heading mt-4 text-[2rem] leading-tight font-medium text-balance sm:text-[2.375rem]">
            Compare up to three.
          </h1>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">
            One table, every number lined up, and each criterion scored the same
            way it was on the match cards.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-10">
          <EmptyState
            icon={Columns2}
            title={
              entries.length === 0
                ? "Nothing selected to compare yet"
                : "One more home and the table fills in"
            }
            body={
              entries.length === 0
                ? "Hit Compare on two or three matches and they line up here — price, size, rooms and every scored criterion in one table."
                : `You've picked ${entries[0].listing.title}. Choose at least one more to see them next to each other.`
            }
            action={{ href: "/matches", label: "Pick from your matches" }}
            secondary={{ href: "/saved", label: "Pick from saved" }}
          />
        </Reveal>
      </div>
    );
  }

  const listings = entries.map((entry) => entry.listing);
  const rows = needs ? buildComparison(needs, listings) : [];
  const overall = listings.map((listing, index) => {
    const modelPercent = entries[index].match?.match_percent;
    const computed = needs ? computedFit(buildBreakdown(needs, listing)) : null;
    return modelPercent ?? computed ?? 0;
  });
  const bestOverall = overall.indexOf(Math.max(...overall));

  const columns = `minmax(7.5rem,1fr) repeat(${listings.length}, minmax(0,1fr))`;

  return (
    <div className="shell py-10 md:py-14">
      <Reveal className="max-w-2xl">
        <span className="eyebrow">Side by side</span>
        <h1 className="font-heading mt-4 text-[2rem] leading-tight font-medium text-balance sm:text-[2.375rem]">
          {listings.length} homes, one table.
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">
          The facts first, then every criterion Mayaar scored against your brief.
          The best cell in each row is marked.
        </p>
      </Reveal>

      <Reveal delay={80} className="mt-10">
        <div className="overflow-x-auto pb-2">
          <div className="min-w-[42rem]">
            {/* ------------------------------------------------ home headers */}
            <div className="grid gap-px" style={{ gridTemplateColumns: columns }}>
              <div className="flex items-start pt-1 pb-4">
                <span className="eyebrow">Comparing</span>
              </div>

              {listings.map((listing, index) => {
                const photo = listingPhoto(listing, 400);
                const isSaved = saved.includes(listing.id);
                return (
                  // Titles wrap to different heights, so the cell is a column
                  // with the actions pinned to the bottom — otherwise the
                  // Save/Breakdown row stair-steps across the table.
                  <div key={listing.id} className="flex flex-col px-3 pb-4">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-sand">
                      <Image
                        src={photo.src}
                        alt={listing.title}
                        fill
                        sizes="240px"
                        className="object-cover"
                      />
                      {index === bestOverall && (
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-forest px-2.5 py-1 text-[0.625rem] font-semibold tracking-wide text-primary-foreground uppercase">
                          <Trophy className="size-2.5" />
                          Best fit
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleCompare(listing.id)}
                        aria-label={`Remove ${listing.title} from compare`}
                        className="absolute top-2 right-2 inline-flex size-6 items-center justify-center rounded-full bg-paper/90 text-ink-soft backdrop-blur transition-colors hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </div>

                    <h2 className="mt-3 line-clamp-2 font-heading text-[0.9375rem] leading-snug font-medium">
                      <Link href={`/listing/${listing.id}`} className="hover:text-forest">
                        {listing.title}
                      </Link>
                    </h2>
                    <p className="mt-1 truncate text-[0.75rem] text-ink-soft">
                      {listing.society}
                    </p>

                    <div className="mt-auto flex flex-wrap gap-1 pt-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSaved(listing.id)}
                        className={cn(
                          "rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors",
                          isSaved ? "bg-forest/10 text-forest" : "text-ink-soft hover:text-forest",
                        )}
                      >
                        {isSaved ? "Saved" : "Save"}
                      </button>
                      <Link
                        href={`/breakdown/${listing.id}`}
                        className="rounded-md px-2 py-1 text-[0.6875rem] font-medium text-forest hover:underline"
                      >
                        Breakdown
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* -------------------------------------------------- the facts */}
            <SectionLabel>The facts</SectionLabel>
            {FACT_ROWS.map((row, rowIndex) => (
              <div
                key={row.label}
                className={cn(
                  "grid items-baseline gap-px border-t border-rule py-3",
                  rowIndex === 0 && "border-t-0",
                )}
                style={{ gridTemplateColumns: columns }}
              >
                <span className="text-[0.8125rem] text-ink-soft">{row.label}</span>
                {listings.map((listing) => (
                  <span
                    key={listing.id}
                    className="flex flex-wrap items-center gap-1.5 px-3 text-[0.8125rem] font-medium"
                  >
                    {row.value(listing)}
                    {row.badge?.(listing)}
                  </span>
                ))}
              </div>
            ))}

            {/* ------------------------------------------- scored criteria */}
            {rows.length > 0 ? (
              <>
                <SectionLabel>Scored against your brief</SectionLabel>
                {rows.map((row, rowIndex) => (
                  <div
                    key={row.key}
                    className={cn(
                      "grid gap-px border-t border-rule py-4",
                      rowIndex === 0 && "border-t-0",
                    )}
                    style={{ gridTemplateColumns: columns }}
                  >
                    <span className="pt-0.5 text-[0.8125rem] text-ink-soft">
                      {row.label}
                      {row.allTied && (
                        <span className="mt-0.5 block text-[0.6875rem] text-ink-soft/70">
                          All equal
                        </span>
                      )}
                    </span>
                    {row.cells.map((cell, index) => (
                      <div key={`${row.key}-${index}`} className="px-3">
                        {cell ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-ink-soft">
                                {cell.score}
                              </span>
                              {row.bestIndexes.includes(index) && (
                                <Check
                                  className={cn(
                                    "size-3",
                                    row.allTied ? "text-sage" : "text-forest",
                                  )}
                                  aria-label={row.allTied ? "Equal best" : "Best here"}
                                />
                              )}
                            </div>
                            <ScoreBar score={cell.score} size="compact" delay={rowIndex * 60} />
                            <p className="mt-1.5 text-[0.75rem] leading-snug text-ink-soft">
                              {cell.note}
                            </p>
                          </>
                        ) : (
                          <span className="text-[0.75rem] text-ink-soft">Not scored</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            ) : (
              <p className="border-t border-rule py-6 text-[0.8125rem] text-ink-soft">
                Describe what you&apos;re looking for and each criterion gets scored here too.{" "}
                <Link href="/describe" className="font-medium text-forest hover:underline">
                  Start a search
                </Link>
                .
              </p>
            )}

            {/* ----------------------------------------------------- verdict */}
            <div
              className="mt-2 grid items-center gap-px rounded-2xl bg-sand/70 py-4"
              style={{ gridTemplateColumns: columns }}
            >
              <span className="pl-4 text-[0.8125rem] font-medium">Overall match</span>
              {listings.map((listing, index) => (
                <div key={listing.id} className="px-3">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "font-heading text-[1.375rem] leading-none font-medium",
                        index === bestOverall ? "text-forest" : "text-ink-soft",
                      )}
                    >
                      {overall[index]}%
                    </span>
                    {index === bestOverall && (
                      <span className="text-[0.6875rem] font-semibold tracking-wide text-forest uppercase">
                        Best
                      </span>
                    )}
                  </div>
                  <ScoreBar score={overall[index]} size="compact" delay={index * 80} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal delay={140} className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/matches"
          className="inline-flex h-10 items-center rounded-md border border-rule px-5 text-[0.875rem] font-medium text-ink-soft transition-colors hover:text-forest"
        >
          Back to your matches
        </Link>
        <p className="text-[0.8125rem] text-ink-soft">
          {entries.length < COMPARE_LIMIT
            ? `You can add ${COMPARE_LIMIT - entries.length} more.`
            : `That's the ${COMPARE_LIMIT}-home limit — remove one to swap in another.`}
        </p>
      </Reveal>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-rule pt-5 pb-2">
      <span className="eyebrow">{children}</span>
    </div>
  );
}
