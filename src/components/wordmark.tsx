import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The mark is a doorway arch — restrained, architectural, and legible at 20px.
 */
export function MayaarMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-6", className)}
      fill="none"
    >
      <path
        d="M3 21V10.4L12 3l9 7.4V21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8.6 21v-6.1a3.4 3.4 0 0 1 6.8 0V21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Wordmark({
  href = "/",
  compact = false,
  className,
}: {
  href?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 text-forest transition-opacity hover:opacity-80",
        className,
      )}
    >
      <MayaarMark className="size-[22px] shrink-0" />
      <span className="font-heading text-[1.0625rem] leading-none font-medium text-ink">
        Mayaar
        {!compact && (
          <span className="ml-1.5 font-sans text-[0.8125rem] font-normal tracking-tight text-ink-soft">
            Smart Estate
          </span>
        )}
      </span>
    </Link>
  );
}
