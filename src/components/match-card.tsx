"use client";

import Image from "next/image";
import Link from "next/link";
import { BarChart3, Bookmark, Columns2 } from "lucide-react";

import OverBudgetBadge from "@/components/over-budget-badge";
import { type Match, formatPkr, listingPhoto } from "@/lib/listings";
import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

export default function MatchCard({
  match,
  active,
  onActivate,
}: {
  match: Match;
  active: boolean;
  onActivate: (id: number | null) => void;
}) {
  const { saved, compare, toggleSaved, toggleCompare } = useSession();
  const photo = listingPhoto(match, 600);
  const isSaved = saved.includes(match.id);
  const isComparing = compare.includes(match.id);

  return (
    <article
      onMouseEnter={() => onActivate(match.id)}
      onFocus={() => onActivate(match.id)}
      className={cn(
        "group relative rounded-2xl border bg-paper transition-all duration-200",
        active
          ? "border-forest/40 shadow-[0_10px_28px_-16px_rgb(28_26_23/28%)]"
          : "border-rule",
      )}
    >
      <div className="flex gap-4 p-4">
        <div className="relative aspect-square w-[6.5rem] shrink-0 overflow-hidden rounded-xl bg-sand sm:w-32">
          <Image
            src={photo.src}
            alt={match.title}
            fill
            sizes="128px"
            className="object-cover"
          />
          <span className="absolute top-1.5 left-1.5 inline-flex size-6 items-center justify-center rounded-full bg-forest text-[0.6875rem] font-semibold text-primary-foreground">
            {match.rank}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-heading text-[1.0625rem] leading-snug font-medium">
                <Link
                  href={`/listing/${match.id}`}
                  className="after:absolute after:inset-0 hover:text-forest"
                >
                  {match.title}
                </Link>
              </h3>
              <p className="mt-0.5 truncate text-[0.8125rem] text-ink-soft">
                {match.society} · {match.sector}
              </p>
            </div>
            <span className="shrink-0 text-right">
              <span className="font-heading block text-[1.0625rem] leading-none font-medium">
                {match.match_percent}%
              </span>
              <span className="mt-1 block text-[0.625rem] tracking-wider text-ink-soft uppercase">
                fit
              </span>
            </span>
          </div>

          <p className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.875rem] font-medium">
            {formatPkr(match.price_pkr)}
            <OverBudgetBadge price={match.price_pkr} />
          </p>
          <p className="mt-1 text-[0.8125rem] text-ink-soft">
            {match.bedrooms} bed · {match.bathrooms ?? "—"} bath · {match.marla} marla
          </p>
        </div>
      </div>

      <div className="border-t border-rule px-4 py-3.5">
        <p className="text-[0.8125rem] leading-relaxed text-ink">
          <span className="eyebrow mr-1.5 align-[0.1em] text-forest">Fits</span>
          {match.why_it_fits}
        </p>
        {match.not_perfect && (
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
            <span className="eyebrow mr-1.5 align-[0.1em]">But</span>
            {match.not_perfect}
          </p>
        )}
      </div>

      {/* Sits above the card-wide link overlay so the buttons stay clickable. */}
      <div className="relative z-10 flex items-center gap-1.5 border-t border-rule px-3 py-2">
        <button
          type="button"
          onClick={() => toggleSaved(match.id)}
          aria-pressed={isSaved}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            isSaved ? "bg-forest/10 text-forest" : "text-ink-soft hover:text-forest",
          )}
        >
          <Bookmark className={cn("size-3.5", isSaved && "fill-current")} />
          {isSaved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => toggleCompare(match.id)}
          aria-pressed={isComparing}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
            isComparing ? "bg-forest/10 text-forest" : "text-ink-soft hover:text-forest",
          )}
        >
          <Columns2 className="size-3.5" />
          {isComparing ? "Comparing" : "Compare"}
        </button>
        <Link
          href={`/breakdown/${match.id}`}
          className="relative ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-forest hover:underline"
        >
          <BarChart3 className="size-3.5" />
          See the reasoning
        </Link>
      </div>
    </article>
  );
}
