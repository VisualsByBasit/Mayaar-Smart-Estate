"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import OverBudgetBadge from "@/components/over-budget-badge";
import { type Match, type Recommendation, formatPkr, listingPhoto } from "@/lib/listings";

/**
 * A ranked list makes the reader do the deciding. This is the one answer —
 * deliberately styled against the cream ground so it reads as a verdict rather
 * than a sixth card, and it names the trade-off instead of selling.
 */
export default function RecommendationCard({
  recommendation,
  match,
}: {
  recommendation: Recommendation;
  match: Match;
}) {
  const photo = listingPhoto(match, 600);

  return (
    <section className="overflow-hidden rounded-2xl bg-forest text-primary-foreground">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:p-7">
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-[0.16em] text-primary-foreground/70 uppercase">
            <Sparkles className="size-3" />
            If you asked me
          </span>

          <h2 className="font-heading mt-3.5 text-[1.375rem] leading-snug font-medium text-balance sm:text-[1.5rem]">
            {recommendation.headline}
          </h2>

          <p className="mt-4 text-[0.9375rem] leading-relaxed text-primary-foreground/85">
            {recommendation.rationale}
          </p>

          {recommendation.trade_off && (
            <p className="mt-4 border-l-2 border-primary-foreground/25 pl-3.5 text-[0.875rem] leading-relaxed text-primary-foreground/70">
              <span className="font-medium text-primary-foreground/90">
                What you&apos;d be accepting:{" "}
              </span>
              {recommendation.trade_off}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link
              href={`/listing/${match.id}`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-foreground px-4 text-[0.8125rem] font-medium text-forest transition-opacity hover:opacity-90"
            >
              See this home
              <ArrowRight className="size-3.5" />
            </Link>
            <Link
              href={`/breakdown/${match.id}`}
              className="inline-flex h-10 items-center rounded-md border border-primary-foreground/25 px-4 text-[0.8125rem] font-medium text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
            >
              Why it scores this way
            </Link>
          </div>
        </div>

        <Link
          href={`/listing/${match.id}`}
          className="group block shrink-0 sm:w-[13.5rem]"
          aria-label={match.title}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-forest-deep">
            <Image
              src={photo.src}
              alt={match.title}
              fill
              sizes="(min-width: 640px) 216px, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute top-2.5 left-2.5 rounded-full bg-forest/85 px-2.5 py-1 text-[0.6875rem] font-semibold backdrop-blur">
              Rank {match.rank} · {match.match_percent}% fit
            </span>
          </div>
          <p className="mt-3 truncate text-[0.875rem] font-medium">{match.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.8125rem] text-primary-foreground/70">
            <span>
              {formatPkr(match.price_pkr)} · {match.marla} marla
            </span>
            <OverBudgetBadge price={match.price_pkr} size="compact" onDark />
          </p>
          <p className="mt-0.5 truncate text-[0.8125rem] text-primary-foreground/70">
            {match.society} · {match.sector}
          </p>
        </Link>
      </div>
    </section>
  );
}
