"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bookmark,
  Check,
  Columns2,
  ExternalLink,
  HelpCircle,
  Minus,
} from "lucide-react";

import Reveal from "@/components/reveal";
import ScoreBar from "@/components/score-bar";
import { buildBreakdown, computedFit, factCheck } from "@/lib/match-breakdown";
import { type Listing, formatPkr, listingGallery, listingPhoto } from "@/lib/listings";
import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

const SPEC_LABELS: Array<[keyof Listing | "price", string]> = [
  ["price", "Price"],
  ["marla", "Plot size"],
  ["sqft", "Covered area"],
  ["bedrooms", "Bedrooms"],
  ["bathrooms", "Bathrooms"],
  ["sector", "Sector"],
];

export default function ListingDetail({ listing }: { listing: Listing }) {
  const { needs, matches, saved, compare, toggleSaved, toggleCompare } = useSession();
  const match = matches.find((entry) => entry.id === listing.id);
  const photo = listingPhoto(listing, 1400);
  // The grid below is 2fr + a stacked 1fr column: exactly two slots beside the
  // hero. Asking for three wrapped the extra frame onto a new row.
  const gallery = listingGallery(listing, 2);
  const isSaved = saved.includes(listing.id);
  const isComparing = compare.includes(listing.id);

  const breakdown = needs ? buildBreakdown(needs, listing) : [];
  const checks = needs ? factCheck(needs, listing) : null;
  const computed = computedFit(breakdown);

  const specs: Array<[string, string]> = SPEC_LABELS.map(([key, label]) => {
    if (key === "price") return [label, formatPkr(listing.price_pkr)];
    if (key === "marla") return [label, `${listing.marla} marla`];
    if (key === "sqft") return [label, `${listing.sqft.toLocaleString("en-PK")} sq ft`];
    if (key === "bathrooms") return [label, listing.bathrooms?.toString() ?? "Not published"];
    return [label, String(listing[key as keyof Listing] ?? "—")];
  });

  return (
    <article className="shell py-8 md:py-12">
      <Link
        href="/matches"
        className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-ink-soft transition-colors hover:text-forest"
      >
        <ArrowLeft className="size-3.5" />
        Back to your matches
      </Link>

      {/* ---------------------------------------------------------- gallery */}
      <Reveal className="mt-6 grid gap-2 sm:grid-cols-[2fr_1fr] sm:grid-rows-2 sm:[&>*:first-child]:row-span-2">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand sm:aspect-auto">
          <Image
            src={photo.src}
            alt={listing.title}
            fill
            priority
            sizes="(min-width: 640px) 60vw, 100vw"
            className="object-cover"
          />
          {photo.isRepresentative && (
            <span className="absolute bottom-3 left-3 rounded-full bg-ink/70 px-3 py-1 text-[0.6875rem] font-medium text-paper backdrop-blur">
              Representative photo — not this house
            </span>
          )}
        </div>
        {gallery.map((src) => (
          <div key={src} className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl bg-sand sm:block">
            <Image src={src} alt="" fill sizes="30vw" className="object-cover" />
          </div>
        ))}
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
        <div>
          {/* ------------------------------------------------------- header */}
          <Reveal>
            <div className="flex flex-wrap items-center gap-3">
              {match && (
                <span className="inline-flex items-center gap-2 rounded-full bg-forest px-3 py-1 text-[0.6875rem] font-semibold tracking-wide text-primary-foreground uppercase">
                  Rank {match.rank} · {match.match_percent}% fit
                </span>
              )}
              <span className="eyebrow">{listing.society}</span>
            </div>

            <h1 className="font-heading mt-4 text-[1.875rem] leading-tight font-medium text-balance sm:text-[2.25rem]">
              {listing.title}
            </h1>
            <p className="mt-3 text-[1.0625rem] font-medium">{formatPkr(listing.price_pkr)}</p>
            <p className="mt-1 text-[0.875rem] text-ink-soft">{listing.location_note}</p>
          </Reveal>

          {/* -------------------------------------------------- the numbers */}
          {breakdown.length > 0 ? (
            <Reveal delay={80} className="mt-12">
              <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
                <h2 className="font-heading text-[1.125rem] font-medium">
                  Scored against what you asked for
                </h2>
                {computed !== null && (
                  <span className="font-mono text-xs text-ink-soft">{computed}% overall</span>
                )}
              </div>

              <ul className="mt-6 space-y-5">
                {breakdown.map((dimension, index) => (
                  <li key={dimension.key}>
                    <ScoreBar
                      label={dimension.label}
                      score={dimension.score}
                      note={dimension.note}
                      delay={index * 90}
                    />
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
                <p className="max-w-md text-[0.75rem] leading-relaxed text-ink-soft">
                  Every bar above is computed from this listing&apos;s own fields and
                  the preferences you gave — no model output is involved.
                </p>
                <Link
                  href={`/breakdown/${listing.id}`}
                  className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-forest hover:underline"
                >
                  <BarChart3 className="size-3.5" />
                  Full breakdown
                </Link>
              </div>
            </Reveal>
          ) : (
            <Reveal delay={80} className="mt-12 rounded-2xl border border-rule bg-paper p-6">
              <p className="text-[0.875rem] leading-relaxed text-ink-soft">
                Describe what you&apos;re looking for and this home gets scored
                against it, dimension by dimension.{" "}
                <Link href="/describe" className="font-medium text-forest hover:underline">
                  Start a search
                </Link>
                .
              </p>
            </Reveal>
          )}

          {/* --------------------------------------------------- fact check */}
          {checks && (checks.fits.length > 0 || checks.gaps.length > 0) && (
            <Reveal delay={120} className="mt-12">
              <h2 className="font-heading border-b border-rule pb-3 text-[1.125rem] font-medium">
                What checks out
              </h2>
              <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-2">
                <CheckList icon={Check} tone="fit" title="Fits" items={checks.fits} />
                <CheckList icon={Minus} tone="gap" title="Doesn't" items={checks.gaps} />
                {checks.unknown.length > 0 && (
                  <CheckList
                    icon={HelpCircle}
                    tone="unknown"
                    title="Can't be confirmed"
                    items={checks.unknown}
                  />
                )}
              </div>
            </Reveal>
          )}

          {/* ------------------------------------------- the model's read */}
          {match && (
            <Reveal delay={160} className="mt-12">
              <h2 className="font-heading border-b border-rule pb-3 text-[1.125rem] font-medium">
                Mayaar&apos;s read
              </h2>
              <p className="mt-5 text-[0.9375rem] leading-relaxed">{match.why_it_fits}</p>
              {match.not_perfect && (
                <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                  {match.not_perfect}
                </p>
              )}
              <p className="mt-5 text-[0.75rem] text-ink-soft italic">
                Written by the matching model. Kept separate from the computed
                scores above so you can weigh it accordingly.
              </p>
            </Reveal>
          )}
        </div>

        {/* ----------------------------------------------------------- aside */}
        <aside className="space-y-8 lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl border border-rule bg-paper p-5">
            <span className="eyebrow">The facts</span>
            <dl className="mt-4 space-y-2.5">
              {specs.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 text-[0.8125rem]">
                  <dt className="text-ink-soft">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            {listing.amenities.length > 0 && (
              <>
                <div className="mt-5 h-px bg-rule" />
                <span className="eyebrow mt-5 block">Listed amenities</span>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {listing.amenities.map((amenity) => (
                    <li
                      key={amenity}
                      className="rounded-full bg-sand px-2.5 py-1 text-[0.75rem] text-ink-soft"
                    >
                      {amenity}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="mt-6 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleSaved(listing.id)}
                  aria-pressed={isSaved}
                  className={cn(
                    "inline-flex h-10 items-center justify-center gap-2 rounded-md text-[0.8125rem] font-medium transition-colors",
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
                    "inline-flex h-10 items-center justify-center gap-2 rounded-md text-[0.8125rem] font-medium transition-colors",
                    isComparing
                      ? "bg-forest/10 text-forest"
                      : "border border-rule text-ink-soft hover:text-forest",
                  )}
                >
                  <Columns2 className="size-3.5" />
                  {isComparing ? "Comparing" : "Compare"}
                </button>
              </div>
              <a
                href={listing.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-forest text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-forest-deep"
              >
                Open original listing
                <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          <p className="text-[0.75rem] leading-relaxed text-ink-soft">
            Data confidence: {listing.data_confidence} · Location:{" "}
            {listing.geocode_confidence}
          </p>
        </aside>
      </div>
    </article>
  );
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
      <span className="eyebrow">{title}</span>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[0.875rem] leading-snug">
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
