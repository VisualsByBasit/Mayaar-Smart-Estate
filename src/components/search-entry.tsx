"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { useSession } from "@/lib/session-store";

export const EXAMPLE_QUERIES = [
  "Family of five, 6–9 crore, somewhere in DHA with a lawn for the kids",
  "4 bed in F-11 or E-11, walkable to schools, under 8 crore",
  "Corner plot, modern build, lots of natural light",
  "My parents live with us — ground-floor bedroom, quiet street",
];

/**
 * Both entry points (the hero field and the /describe composer) share one
 * action: kick off the search, then move to /matches, which owns every
 * loading, error and result state from there on.
 */
export function useStartSearch() {
  const router = useRouter();
  const { runSearch } = useSession();

  return useCallback(
    (description: string) => {
      const text = description.trim();
      if (!text) return;
      // Navigate first so the funnel is on screen while the request is in
      // flight — runSearch keeps writing into the shared session either way.
      router.push("/matches");
      void runSearch(text);
    },
    [router, runSearch],
  );
}

/** The single-line pill field used in the landing hero. */
export function HeroSearch() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const startSearch = useStartSearch();

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          startSearch(query);
        }}
        className="group relative max-w-2xl"
      >
        <label htmlFor="hero-search" className="sr-only">
          Describe your ideal home
        </label>
        <input
          id="hero-search"
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="A 5-bed house in DHA under 9 crore, with a lawn…"
          className="h-16 w-full rounded-full border border-rule bg-paper pr-[3.75rem] pl-6 text-[0.9375rem] text-ink shadow-[0_1px_2px_rgb(28_26_23/4%)] transition-colors outline-none placeholder:text-ink-soft/70 focus:border-forest/40 focus:ring-4 focus:ring-forest/10"
        />
        <button
          type="submit"
          aria-label="Find matching homes"
          className="absolute top-1/2 right-2.5 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-forest text-primary-foreground transition-colors hover:bg-forest-deep"
        >
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden="true">
            <path
              d="M4 12h15m0 0-6-6m6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>

      <div className="mt-5 max-w-2xl">
        <span className="eyebrow">Or start from one of these</span>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.slice(0, 3).map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-rule bg-paper/60 px-3.5 py-1.5 text-left text-xs text-ink-soft transition-colors hover:border-forest/35 hover:text-forest"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
