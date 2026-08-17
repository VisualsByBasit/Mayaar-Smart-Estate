"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import Wordmark from "@/components/wordmark";

// Root-relative so the sections still resolve from /describe, /matches and
// the listing pages, where the header is shown but the anchors don't exist.
const LINKS = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "The reasoning", href: "/#reasoning" },
  { label: "For agents", href: "/#for-agents" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);

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

        <div className="flex items-center gap-2">
          <Link
            href="/describe"
            className="hidden h-9 items-center rounded-md bg-forest px-4 text-[0.8125rem] font-medium text-primary-foreground transition-colors hover:bg-forest-deep sm:inline-flex"
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
