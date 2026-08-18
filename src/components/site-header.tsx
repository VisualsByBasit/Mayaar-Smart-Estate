"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bookmark, Columns2, Menu, X } from "lucide-react";

import Wordmark from "@/components/wordmark";
import { useSession } from "@/lib/session-store";
import { cn } from "@/lib/utils";

// Root-relative so the sections still resolve from /describe, /matches and
// the listing pages, where the header is shown but the anchors don't exist.
const LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "The reasoning", href: "/#reasoning" },
  { label: "For agents", href: "/#for-agents" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { saved, compare, hydrated } = useSession();
  const pathname = usePathname();

  const shortlists = [
    { href: "/saved", label: "Saved", icon: Bookmark, count: saved.length },
    { href: "/compare", label: "Compare", icon: Columns2, count: compare.length },
  ];

  return (
    <header className="relative z-30">
      <div className="shell flex h-[4.5rem] items-center justify-between gap-6">
        <Wordmark />

        <nav className="hidden items-center gap-9 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[0.8125rem] font-medium text-ink-soft transition-colors hover:text-forest"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          {shortlists.map(({ href, label, icon: Icon, count }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[0.8125rem] font-medium transition-colors",
                pathname === href ? "text-forest" : "text-ink-soft hover:text-forest",
              )}
            >
              <Icon className={cn("size-3.5", count > 0 && "fill-current")} />
              <span className="hidden sm:inline">{label}</span>
              {hydrated && count > 0 && (
                <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-forest px-1 text-[0.625rem] leading-[1.125rem] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          ))}

          <Link
            href="/describe"
            className="ml-1.5 hidden h-9 items-center rounded-md bg-forest px-4 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-forest-deep sm:inline-flex"
          >
            Get started
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="-mr-2 inline-flex size-10 items-center justify-center text-ink md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-y border-rule bg-paper md:hidden">
          <nav className="shell flex flex-col py-2">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-rule/60 py-3 text-sm text-ink-soft last:border-0"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/describe"
              onClick={() => setOpen(false)}
              className="mt-3 mb-3 inline-flex h-10 items-center justify-center rounded-md bg-forest text-sm font-medium text-primary-foreground sm:hidden"
            >
              Get started
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
