"use client";

import Image from "next/image";
import Link from "next/link";
import { Columns2, X } from "lucide-react";

import { type Listing, formatPkr, listingPhoto } from "@/lib/listings";
import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

/**
 * The compact form of a home — used wherever a list is a shortlist rather than
 * the main event. Keeps the same card language as MatchCard at two-thirds the
 * height, so /saved doesn't read as a different product.
 */
export default function ListingRow({
  listing,
  matchPercent,
  onRemove,
  removeLabel = "Remove",
}: {
  listing: Listing;
  matchPercent?: number;
  onRemove: () => void;
  removeLabel?: string;
}) {
  const { compare, toggleCompare } = useSession();
  const photo = listingPhoto(listing, 400);
  const isComparing = compare.includes(listing.id);

  return (
    <article className="group relative flex gap-4 rounded-2xl border border-rule bg-paper p-3.5 transition-colors hover:border-forest/35">
      <div className="relative aspect-square w-[5.25rem] shrink-0 overflow-hidden rounded-xl bg-sand sm:w-[6.5rem]">
        <Image
          src={photo.src}
          alt={listing.title}
          fill
          sizes="104px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-heading text-[0.9375rem] leading-snug font-medium">
              <Link
                href={`/listing/${listing.id}`}
                className="after:absolute after:inset-0 hover:text-forest"
              >
                {listing.title}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-[0.8125rem] text-ink-soft">
              {listing.society} · {listing.sector}
            </p>
          </div>

          {matchPercent !== undefined && (
            <span className="shrink-0 text-right">
              <span className="font-heading block text-[0.9375rem] leading-none font-medium">
                {matchPercent}%
              </span>
              <span className="mt-0.5 block text-[0.5625rem] tracking-wider text-ink-soft uppercase">
                fit
              </span>
            </span>
          )}
        </div>

        <p className="mt-2 text-[0.8125rem] font-medium">{formatPkr(listing.price_pkr)}</p>
        <p className="mt-0.5 text-[0.8125rem] text-ink-soft">
          {listing.bedrooms} bed · {listing.bathrooms ?? "—"} bath · {listing.marla} marla
        </p>

        {/* Above the card-wide link overlay so these stay clickable. */}
        <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-1">
          <Link
            href={`/breakdown/${listing.id}`}
            className="rounded-md px-2 py-1 text-[0.75rem] font-medium text-forest hover:underline"
          >
            See the reasoning
          </Link>
          <button
            type="button"
            onClick={() => toggleCompare(listing.id)}
            aria-pressed={isComparing}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.75rem] font-medium transition-colors",
              isComparing ? "text-forest" : "text-ink-soft hover:text-forest",
            )}
          >
            <Columns2 className="size-3" />
            {isComparing ? "Comparing" : "Compare"}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.75rem] font-medium text-ink-soft transition-colors hover:text-destructive"
          >
            <X className="size-3" />
            {removeLabel}
          </button>
        </div>
      </div>
    </article>
  );
}
