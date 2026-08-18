"use client";

import { formatPkrShort } from "@/lib/listings";
import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

/**
 * Flags a listing priced above the ceiling the user actually stated. The
 * matcher deliberately surfaces the odd stretch listing — the cheapest way into
 * a sector they named, say — and this makes that visible at a glance instead of
 * only in the reasoning paragraph.
 *
 * The rule lives here, once, so every price on every screen agrees: a badge
 * means price_pkr > budget_max_pkr, nothing else. Reading `needs` from the
 * session rather than taking it as a prop keeps callers from passing a stale
 * or different budget by accident.
 */
export default function OverBudgetBadge({
  price,
  size = "default",
  onDark = false,
  className,
}: {
  price: number;
  size?: "default" | "compact";
  /** For the forest-green recommendation card, where the wash is invisible. */
  onDark?: boolean;
  className?: string;
}) {
  const { needs } = useSession();
  const ceiling = needs?.budget_max_pkr ?? null;

  // No stated ceiling means nothing to be over; equal to it is still within.
  if (!ceiling || price <= ceiling) return null;

  return (
    <span
      title={`${formatPkrShort(price - ceiling)} above your ${formatPkrShort(ceiling)} ceiling`}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border font-semibold tracking-wide whitespace-nowrap uppercase",
        size === "compact"
          ? "px-1.5 py-px text-[0.5625rem]"
          : "px-2 py-0.5 text-[0.625rem]",
        onDark
          ? "border-warn-bright/35 bg-warn-bright/15 text-warn-bright"
          : "border-warn-line bg-warn-soft text-warn",
        className,
      )}
    >
      Over budget
    </span>
  );
}
