"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Columns2,
  HelpCircle,
  Loader2,
  Minus,
  ScrollText,
} from "lucide-react";

import EmptyState from "@/components/empty-state";
import Reveal from "@/components/reveal";
import ScoreBar from "@/components/score-bar";
import { type Listing, formatPkr, listingPhoto } from "@/lib/listings";
import { buildBreakdown, computedFit, factCheck } from "@/lib/match-breakdown";
import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

/**
 * The listing page answers "what is this house". This one answers "why did it
 * rank there" — the same dimensions, but scored against the other four matches
 * so a bar has something to be good or bad relative to.
 */
export default function BreakdownScreen({ listing }: { listing: Listing }) {
  const router = useRouter();
  const { needs, matches, saved, compare, toggleSaved, toggleCompare, hydrated } = useSession();

  const match = matches.find((entry) => entry.id === listing.id);
  const isSaved = saved.includes(listing.id);
  const isComparing = compare.includes(listing.id);

  // Landing here with no session means there is nothing to score against.
  useEffect(() => {
    if (hydrated && !needs && matches.length === 0) router.replace("/describe");
  }, [hydrated, needs, matches.length, router]);

  if (!hydrated) {
    return (
      <div className="shell flex flex-1 items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!needs) {
    return (
      <div className="shell py-14">
        <EmptyState
          icon={ScrollText}
          title="Nothing to score this against yet"
          body="A breakdown compares a home to what you asked for. Describe what you're after and every match gets scored, dimension by dimension."
          action={{ href: "/describe", label: "Describe your home" }}
          secondary={{ href: `/listing/${listing.id}`, label: "See the listing" }}
        />
      </div>
    );
  }

  const breakdown = buildBreakdown(needs, listing);
  const checks = factCheck(needs, listing);
  const computed = computedFit(breakdown);
  const photo = listingPhoto(listing, 600);

  // Same dimensions computed for every other ranked home, so each bar can show
  // where this one sits in the shortlist rather than floating on its own.
  const peers = matches
    .filter((entry) => entry.id !== listing.id)
    .map((entry) => ({ match: entry, dimensions: buildBreakdown(needs, entry) }));

  /**
   * Most dimensions clamp to 100 once a requirement is met, so without the tie
   * check every match would claim to be "best" on nearly every row.
   */
  const standingFor = (key: string, score: number): string | null => {
    const others = peers
      .map(({ dimensions }) => dimensions.find((dimension) => dimension.key === key)?.score)
      .filter((value): value is number => typeof value === "number");
    if (!others.length) return null;

    const total = others.length + 1;
    const better = others.filter((value) => value > score).length;
    const equal = others.filter((value) => value === score).length;

    if (equal === others.length) return `Level with your other ${others.length} matches here`;
    if (better === 0) return equal > 0 ? `Joint best of your ${total} matches on this` : `Best of your ${total} matches on this`;
    if (better === others.length) return `Weakest of your ${total} matches on this`;
    return `${ordinal(better + 1)} of your ${total} matches on this`;
  };

  return (
    <article className="shell py-8 md:py-12">
      <Link
        href="/matches"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:text-forest"
      >
        <ArrowLeft className="size-3.5" />
        Back to your matches
      </Link>

      {/* ----------------------------------------------------------- header */}
      <Reveal className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-2xl bg-sand sm:w-[15rem]">
          <Image
            src={photo.src}
            alt={listing.title}
            fill
            priority
            sizes="(min-width: 640px) 240px, 100vw"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="eyebrow">The breakdown</span>
            {match && (
              <span className="inline-flex items-center rounded-full bg-forest px-3 py-1 text-[0.6875rem] font-semibold tracking-wide text-primary-foreground uppercase">
                Rank {match.rank} of {matches.length}
              </span>
            )}
          </div>

          <h1 className="font-heading mt-3.5 text-[1.625rem] leading-tight font-medium text-balance sm:text-[1.875rem]">
            {listing.title}
          </h1>
          <p className="mt-2.5 text-[0.9375rem] font-medium">{formatPkr(listing.price_pkr)}</p>
          <p className="mt-1 text-[0.8125rem] text-ink-soft">
            {listing.society} · {listing.sector} · {listing.bedrooms} bed ·{" "}
            {listing.bathrooms ?? "—"} bath · {listing.marla} marla
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleSaved(listing.id)}
              aria-pressed={isSaved}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[0.8125rem] font-medium transition-colors",
                isSaved
                  ? "bg-forest/10 text-forest"
                  : "border border-rule text-ink-soft hover:text-forest",
              )}
            >
              <Bookmark className={cn("size-3.5", isSaved && "fill-current")} />
              {isSaved ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => toggleCompare(listing.id)}
              aria-pressed={isComparing}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[0.8125rem] font-medium transition-colors",
                isComparing
                  ? "bg-forest/10 text-forest"
                  : "border border-rule text-ink-soft hover:text-forest",
              )}
            >
              <Columns2 className="size-3.5" />
              {isComparing ? "Comparing" : "Compare"}
            </button>
            <Link
              href={`/listing/${listing.id}`}
              className="inline-flex h-9 items-center rounded-md bg-forest px-4 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-forest-deep"
            >
              Full listing
            </Link>
          </div>
        </div>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
        <div>
          {/* --------------------------------------------- dimension scores */}
          <Reveal delay={60}>
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
              <h2 className="font-heading text-[1.125rem] font-medium">
                Scored against what you asked for
              </h2>
              {computed !== null && (
                <span className="font-mono text-xs text-ink-soft">{computed}% overall</span>
              )}
            </div>

            {breakdown.length > 0 ? (
              <>
                <ul className="mt-7 space-y-7">
                  {breakdown.map((dimension, index) => {
                    const standing = standingFor(dimension.key, dimension.score);
                    const peerScores = peers
                      .map(
                        ({ dimensions }) =>
                          dimensions.find((entry) => entry.key === dimension.key)?.score,
                      )
                      .filter((value): value is number => typeof value === "number");

                    return (
                      <li key={dimension.key}>
                        <ScoreBar
                          label={dimension.label}
                          score={dimension.score}
                          note={dimension.note}
                          peers={peerScores}
                          delay={index * 90}
                        />
                        {standing && (
                          <p className="mt-1 text-[0.75rem] text-ink-soft">{standing}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-8 text-[0.75rem] leading-relaxed text-ink-soft">
                  Every bar is computed from this listing&apos;s own figures and the
                  preferences you gave — no model output is involved. The faint ticks
                  mark where your other matches land on the same scale.
                </p>
              </>
            ) : (
              <p className="mt-6 text-[0.875rem] leading-relaxed text-ink-soft">
                You didn&apos;t give any hard requirements to score against — add a
                budget, an area or a bedroom count and this fills in.{" "}
                <Link href="/matches" className="font-medium text-forest hover:underline">
                  Refine your search
                </Link>
                .
              </p>
            )}
          </Reveal>

          {/* ---------------------------------------------------- the model */}
          {match && (
            <Reveal delay={120} className="mt-12">
              <h2 className="font-heading border-b border-rule pb-3 text-[1.125rem] font-medium">
                Mayaar&apos;s read
              </h2>
              <p className="mt-5 text-[0.9375rem] leading-relaxed">{match.why_it_fits}</p>
              {match.not_perfect && (
                <p className="mt-4 border-l-2 border-sand-deep pl-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                  {match.not_perfect}
                </p>
              )}
              <div className="mt-6 flex items-baseline gap-6 border-t border-rule pt-4">
                <span className="text-[0.8125rem] text-ink-soft">
                  Model&apos;s fit{" "}
                  <span className="font-heading ml-1 text-[0.9375rem] font-medium text-ink">
                    {match.match_percent}%
                  </span>
                </span>
                {computed !== null && (
                  <span className="text-[0.8125rem] text-ink-soft">
                    Computed fit{" "}
                    <span className="font-heading ml-1 text-[0.9375rem] font-medium text-ink">
                      {computed}%
                    </span>
                  </span>
                )}
              </div>
              <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-soft italic">
                The two are worked out differently and won&apos;t always agree. When
                they diverge, the bars above are the checkable half.
              </p>
            </Reveal>
          )}
        </div>

        {/* ------------------------------------------------------- fact check */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-rule bg-paper p-5">
            <span className="eyebrow">Line by line</span>
            <div className="mt-4 space-y-5">
              <CheckList icon={Check} tone="fit" title="Checks out" items={checks.fits} />
              <CheckList icon={Minus} tone="gap" title="Falls short" items={checks.gaps} />
              <CheckList
                icon={HelpCircle}
                tone="unknown"
                title="Can't be confirmed"
                items={checks.unknown}
              />
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}

function ordinal(value: number): string {
  const suffix = value === 1 ? "st" : value === 2 ? "nd" : value === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

function CheckList({
  icon: Icon,
  tone,
  title,
  items,
}: {
  icon: typeof Check;
  tone: "fit" | "gap" | "unknown";
  title: string;
  items: string[];
}) {
  if (!items.length) return null;

  return (
    <div>
      <span className="text-[0.75rem] font-medium text-ink-soft">{title}</span>
      <ul className="mt-2.5 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[0.8125rem] leading-snug">
            <Icon
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                tone === "fit" && "text-forest",
                tone === "gap" && "text-destructive",
                tone === "unknown" && "text-ink-soft",
              )}
            />
            <span className={tone === "fit" ? "text-ink" : "text-ink-soft"}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
