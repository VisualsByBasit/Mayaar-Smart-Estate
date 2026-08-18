"use client";

import { MapPin } from "lucide-react";

import {
  type Proximity,
  formatDriveEstimate,
  listingProximity,
  matchProximity,
} from "@/lib/landmark";
import type { Listing, Match } from "@/lib/listings";
import { formatKm } from "@/lib/radius";
import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

/**
 * Distance to the place the buyer anchored their search to. The minute figure
 * is straight-line distance over an average city speed — no routing service is
 * involved — so the qualifier travels with it everywhere it appears rather than
 * sitting in a tooltip. A bare "12 min" would read as navigation.
 */
export default function ProximityNote({
  listing,
  className,
}: {
  listing: Listing | Match;
  className?: string;
}) {
  const { needs } = useSession();
  const near: Proximity | null =
    matchProximity(listing) ?? listingProximity(needs, listing);
  if (!near) return null;

  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-[0.75rem] leading-relaxed text-ink-soft",
        className,
      )}
    >
      <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>
        Roughly {formatKm(near.km)}
        {near.name ? ` from ${near.name}` : ""} ·{" "}
        <span className="whitespace-nowrap">{formatDriveEstimate(near.minutes)}</span>
      </span>
    </p>
  );
}
