"use client";

import { Crosshair, X } from "lucide-react";

import {
  RADIUS_MAX_KM,
  RADIUS_MIN_KM,
  RADIUS_STEP_KM,
  type LatLng,
  formatKm,
} from "@/lib/radius";

/**
 * The controls for area search. Kept visually separate from the ranked list —
 * this is a plain geographic filter over the dataset, not the AI's opinion, and
 * the copy says so rather than letting the two blur together.
 */
export default function RadiusPanel({
  center,
  km,
  total,
  rankedInside,
  onKmChange,
  onClear,
}: {
  center: LatLng | null;
  km: number;
  total: number;
  rankedInside: number;
  onKmChange: (km: number) => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-forest/25 bg-paper p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="eyebrow flex items-center gap-1.5 text-forest">
            <Crosshair className="size-3" />
            Area search
          </span>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
            {center
              ? "Distance from your point, measured against every listing in the dataset — separate from the ranking above."
              : "Click anywhere on the map to drop a point, then set how far you'll go."}
          </p>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-rule px-3 text-[0.75rem] font-medium text-ink-soft transition-colors hover:text-destructive"
        >
          <X className="size-3" />
          Clear
        </button>
      </div>

      {center && (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-rule pt-4">
            <span className="font-heading text-[1.375rem] leading-none font-medium text-forest">
              {total}
            </span>
            <span className="text-[0.875rem] text-ink">
              {total === 1 ? "home" : "homes"} within {formatKm(km)}
            </span>
            {rankedInside > 0 && (
              <span className="text-[0.8125rem] text-ink-soft">
                · {rankedInside} of your ranked {rankedInside === 1 ? "match" : "matches"}
              </span>
            )}
          </div>

          <div className="mt-4">
            <label
              htmlFor="radius-km"
              className="flex items-baseline justify-between gap-4 text-[0.75rem] text-ink-soft"
            >
              <span>Radius</span>
              <span className="font-mono">{formatKm(km)}</span>
            </label>
            <input
              id="radius-km"
              type="range"
              min={RADIUS_MIN_KM}
              max={RADIUS_MAX_KM}
              step={RADIUS_STEP_KM}
              value={km}
              onChange={(event) => onKmChange(Number(event.target.value))}
              className="accent-forest mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-sand-deep"
            />
            <div className="mt-1.5 flex justify-between text-[0.6875rem] text-ink-soft">
              <span>{formatKm(RADIUS_MIN_KM)}</span>
              <span>{formatKm(RADIUS_MAX_KM)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
