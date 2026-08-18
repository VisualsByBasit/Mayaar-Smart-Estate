import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The house-and-M monogram lifted from the Mayaar logo lockup. The full lockup
 * already sets "MAYAAR SMART ESTATE" in type, so the header pairs the mark
 * alone with live text rather than repeating the words twice at 22px.
 */
export function MayaarMark({ className }: { className?: string }) {
  return (
    <Image
      src="/mayaar-mark.png"
      alt=""
      aria-hidden="true"
      width={381}
      height={381}
      priority
      className={cn("size-6 object-contain", className)}
    />
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
      <MayaarMark className="size-[30px] shrink-0" />
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
