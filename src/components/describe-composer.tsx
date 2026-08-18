"use client";

import { useRef, useState } from "react";

import Reveal from "@/components/reveal";
import { EXAMPLE_QUERIES, useStartSearch } from "@/components/search-entry";
import { useSession } from "@/lib/session-store";
import { TOTAL_LISTINGS } from "@/lib/listings";

const PROMPTS = [
  "Who's moving in, and how many of you?",
  "What can you comfortably spend?",
  "Which parts of town would you actually live in?",
  "What would make you rule a house out?",
];

const MIN_LENGTH = 10;

export default function DescribeComposer() {
  const { description } = useSession();
  // null means "untouched", so the session description can still appear once it
  // hydrates from sessionStorage — without an effect racing the user's typing.
  const [draft, setDraft] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startSearch = useStartSearch();

  const text = draft ?? description;
  const setText = setDraft;

  const tooShort = text.trim().length > 0 && text.trim().length < MIN_LENGTH;
  const canSubmit = text.trim().length >= MIN_LENGTH;

  return (
    <section className="shell py-14 md:py-20">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <span className="eyebrow">Step one of two</span>
          <h1 className="font-heading mt-4 text-[2.25rem] leading-[1.05] font-medium text-balance sm:text-[2.75rem]">
            Tell Mayaar what you&apos;re looking for.
          </h1>
          <p className="mt-5 text-[1.0625rem] leading-relaxed text-ink-soft">
            Write it the way you&apos;d explain it to a friend. The more context
            you give, the more of it Mayaar can hold onto when it ranks all{" "}
            {TOTAL_LISTINGS} listings.
          </p>
        </Reveal>

        <Reveal delay={90} className="mt-10">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) startSearch(text);
            }}
          >
            <div className="rounded-2xl border border-rule bg-paper p-2 transition-colors focus-within:border-forest/40 focus-within:ring-4 focus-within:ring-forest/10">
              <label htmlFor="description" className="sr-only">
                Describe your ideal home
              </label>
              <textarea
                id="description"
                ref={textareaRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  // ⌘/Ctrl+Enter submits without reaching for the mouse.
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canSubmit) {
                    event.preventDefault();
                    startSearch(text);
                  }
                }}
                rows={7}
                autoFocus
                placeholder="We're a family of five moving from Lahore. Budget is around 8 crore, could stretch to 9 for the right place. We'd like DHA or Bahria — somewhere with a lawn, and my parents live with us so a bedroom on the ground floor matters…"
                className="w-full resize-none bg-transparent px-4 py-3.5 text-[0.9375rem] leading-relaxed text-ink outline-none placeholder:text-ink-soft/60"
              />

              <div className="flex items-center justify-between gap-4 border-t border-rule px-4 py-3">
                <p className="text-xs text-ink-soft">
                  {tooShort
                    ? "A little more detail would help."
                    : "Press ⌘ + Enter to search"}
                </p>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex h-10 items-center rounded-md bg-forest px-5 text-[0.875rem] font-medium text-primary-foreground transition-colors hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Find my matches
                </button>
              </div>
            </div>
          </form>

          {/* Extraction resolves a named place to real coordinates and the
              distance maths runs from there, so a recognisable landmark buys a
              far better shortlist than an office name nobody outside it knows. */}
          <p className="mt-3 px-1 text-[0.8125rem] leading-snug text-ink-soft">
            Mentioning your office by name? Also name a nearby well-known place
            — a mosque, mall, or major road — so we can pinpoint the area
            accurately.
          </p>
        </Reveal>

        <Reveal delay={150} className="mt-12 grid gap-10 sm:grid-cols-2">
          <div>
            <span className="eyebrow">Worth mentioning</span>
            <ul className="mt-4 space-y-2.5">
              {PROMPTS.map((prompt) => (
                <li
                  key={prompt}
                  className="flex gap-2.5 text-[0.875rem] leading-snug text-ink-soft"
                >
                  <span aria-hidden="true" className="mt-[0.45rem] size-1 shrink-0 rounded-full bg-sage" />
                  {prompt}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <span className="eyebrow">Start from an example</span>
            <div className="mt-4 flex flex-col items-start gap-2">
              {EXAMPLE_QUERIES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setText(example);
                    textareaRef.current?.focus();
                  }}
                  className="rounded-lg border border-rule bg-paper/60 px-3.5 py-2 text-left text-[0.8125rem] leading-snug text-ink-soft transition-colors hover:border-forest/35 hover:text-forest"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
