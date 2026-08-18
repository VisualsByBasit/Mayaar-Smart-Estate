"use client";

import Link from "next/link";
import { Bookmark, Columns2, Loader2 } from "lucide-react";

import EmptyState from "@/components/empty-state";
import ListingRow from "@/components/listing-row";
import Reveal from "@/components/reveal";
import { formatPkrShort, getListing } from "@/lib/listings";
import { useSession } from "@/lib/session-store";

export default function SavedScreen() {
  const { saved, matches, compare, toggleSaved, hydrated } = useSession();

  if (!hydrated) {
    return (
      <div className="shell flex flex-1 items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  // A saved id can outlive the shortlist it came from — a re-ranked search
  // drops homes the user still wants to keep, so read from the dataset and
  // treat the match as optional decoration.
  const listings = saved
    .map((id) => ({ listing: getListing(id), match: matches.find((entry) => entry.id === id) }))
    .filter((entry): entry is { listing: NonNullable<ReturnType<typeof getListing>>; match: (typeof matches)[number] | undefined } =>
      Boolean(entry.listing),
    );

  const total = listings.reduce((sum, { listing }) => sum + listing.price_pkr, 0);
  const prices = listings.map((entry) => entry.listing.price_pkr);
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;
  // "5.85 Cr to 5.85 Cr" reads like a bug, so identical prices collapse to one.
  const priceSummary =
    prices.length < 2
      ? ""
      : low === high
        ? `, both at ${formatPkrShort(low)}`
        : `, ${formatPkrShort(low)} to ${formatPkrShort(high)}`;

  return (
    <div className="shell py-10 md:py-14">
      <Reveal className="max-w-2xl">
        <span className="eyebrow">Your shortlist</span>
        <h1 className="font-heading mt-4 text-[2rem] leading-tight font-medium text-balance sm:text-[2.375rem]">
          Homes you&apos;ve kept.
        </h1>
        <p className="mt-4 text-[1.0625rem] leading-relaxed text-ink-soft">
          {listings.length === 0
            ? "Nothing saved yet — the bookmark on any match keeps it here."
            : `${listings.length} home${listings.length === 1 ? "" : "s"} saved${priceSummary}. They stay here while this session lasts.`}
        </p>
      </Reveal>

      {listings.length === 0 ? (
        <Reveal delay={80} className="mt-10">
          <EmptyState
            icon={Bookmark}
            title="No saved homes yet"
            body="Tap the bookmark on any match and it lands here, so you can come back to a shortlist instead of scrolling the ranking again."
            action={{ href: "/matches", label: "Back to your matches" }}
            secondary={{ href: "/describe", label: "Start a new search" }}
          />
        </Reveal>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-12">
          <div>
            <div className="flex items-center justify-between gap-4 border-b border-rule pb-3">
              <h2 className="font-heading text-[1.125rem] font-medium">
                {listings.length} saved
              </h2>
              <Link
                href="/matches"
                className="text-[0.8125rem] font-medium text-ink-soft transition-colors hover:text-forest"
              >
                Back to matches
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {listings.map(({ listing, match }, index) => (
                <Reveal key={listing.id} delay={index * 60}>
                  <ListingRow
                    listing={listing}
                    matchPercent={match?.match_percent}
                    onRemove={() => toggleSaved(listing.id)}
                    removeLabel="Unsave"
                  />
                </Reveal>
              ))}
            </div>
          </div>

          <aside className="space-y-8 lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-2xl border border-rule bg-paper p-5">
              <span className="eyebrow">At a glance</span>
              <dl className="mt-4 space-y-2.5 text-[0.8125rem]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Homes saved</dt>
                  <dd className="font-medium">{listings.length}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Average asking price</dt>
                  <dd className="font-medium">
                    {formatPkrShort(Math.round(total / listings.length))}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Areas</dt>
                  <dd className="max-w-[9rem] text-right font-medium">
                    {[...new Set(listings.map((entry) => entry.listing.sector))]
                      .slice(0, 3)
                      .join(", ")}
                  </dd>
                </div>
              </dl>

              <Link
                href="/compare"
                className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-forest text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-forest-deep"
              >
                <Columns2 className="size-3.5" />
                {compare.length >= 2
                  ? `Compare ${compare.length} side by side`
                  : "Compare side by side"}
              </Link>
              {compare.length < 2 && (
                <p className="mt-2.5 text-[0.75rem] leading-relaxed text-ink-soft">
                  Pick two or three with the compare button to see them in one table.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
