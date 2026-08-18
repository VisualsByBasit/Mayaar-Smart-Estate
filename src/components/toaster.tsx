"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Bookmark, Check, Info, X } from "lucide-react";

import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

const ICONS = { done: Check, undone: Bookmark, blocked: Info } as const;
const VISIBLE_MS = 4200;

/**
 * Saving and comparing are one-tap actions with no page change, so without an
 * acknowledgement the tap reads as a no-op. Mounted once in the root layout.
 */
export default function Toaster() {
  const { notice, dismissNotice } = useSession();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  const Icon = ICONS[notice.tone];

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
    >
      <div
        // Keyed on the notice so a second toast replays the entrance rather
        // than swapping its text in place.
        key={notice.id}
        className={cn(
          "animate-rise pointer-events-auto flex max-w-[min(30rem,100%)] items-center gap-3 rounded-full border py-2.5 pr-2.5 pl-4 shadow-[0_12px_32px_-18px_rgb(28_26_23/45%)]",
          notice.tone === "blocked"
            ? "border-sand-deep bg-sand text-ink"
            : "border-forest-deep bg-forest text-primary-foreground",
        )}
      >
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            notice.tone === "done" && "fill-none",
            notice.tone === "undone" && "opacity-70",
          )}
        />
        <p className="min-w-0 flex-1 text-[0.8125rem] leading-snug">{notice.text}</p>

        {notice.href && notice.hrefLabel && (
          <Link
            href={notice.href}
            onClick={dismissNotice}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-[0.75rem] font-medium whitespace-nowrap transition-colors",
              notice.tone === "blocked"
                ? "bg-forest text-primary-foreground hover:bg-forest-deep"
                : "bg-primary-foreground/15 hover:bg-primary-foreground/25",
            )}
          >
            {notice.hrefLabel}
          </Link>
        )}

        <button
          type="button"
          onClick={dismissNotice}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
