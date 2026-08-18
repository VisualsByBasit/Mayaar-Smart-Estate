import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Saved and compare both start empty, and an empty screen with nothing on it
 * reads as broken rather than new. One shape for both, so they look like a
 * designed state instead of a missing one.
 */
export default function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  secondary,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-rule bg-paper/50 px-6 py-16 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-sand">
        <Icon className="size-[1.125rem] text-sage" />
      </span>

      <h2 className="font-heading mt-5 text-[1.125rem] font-medium">{title}</h2>
      <p className="mx-auto mt-2.5 max-w-sm text-[0.875rem] leading-relaxed text-ink-soft">
        {body}
      </p>

      {(action || secondary) && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {action && (
            <Link
              href={action.href}
              className="inline-flex h-10 items-center rounded-md bg-forest px-5 text-[0.875rem] font-medium text-primary-foreground transition-colors hover:bg-forest-deep"
            >
              {action.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex h-10 items-center rounded-md border border-rule px-5 text-[0.875rem] font-medium text-ink-soft transition-colors hover:text-forest"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
