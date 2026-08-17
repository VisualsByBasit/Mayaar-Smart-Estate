"use client";

import { type Needs, buildFunnel } from "@/lib/needs";

const STAGE_LABELS = [
  ["total", "Listings in Islamabad"],
  ["viable", "Meet your requirements"],
  ["strong", "In the areas you named"],
  ["shortlist", "Ranked for you"],
] as const;

/**
 * The narrowing is computed locally in `buildFunnel`, so these numbers are
 * countable against the dataset rather than a decorative loading animation.
 */
export default function SearchFunnel({
  needs,
  shortlistCount,
  pending = false,
}: {
  needs: Needs;
  shortlistCount: number;
  pending?: boolean;
}) {
  const funnel = buildFunnel(needs, shortlistCount);

  return (
    <div>
      <span className="eyebrow">How this narrowed</span>
      <ol className="mt-4 space-y-3">
        {STAGE_LABELS.map(([key, label], index) => {
          const value = funnel[key];
          const width = Math.max((value / funnel.total) * 100, 2.5);
          const isLast = index === STAGE_LABELS.length - 1;

          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[0.8125rem] text-ink-soft">{label}</span>
                <span
                  className={
                    isLast
                      ? "font-heading text-[0.9375rem] font-medium text-forest"
                      : "font-mono text-xs text-ink-soft"
                  }
                >
                  {pending && isLast ? "—" : value}
                </span>
              </div>
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-sand-deep">
                <span
                  className="animate-bar block h-full origin-left rounded-full bg-forest/70"
                  style={{ width: `${width}%`, animationDelay: `${index * 110}ms` }}
                />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
