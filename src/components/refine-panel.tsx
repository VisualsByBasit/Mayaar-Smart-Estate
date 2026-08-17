"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Loader2 } from "lucide-react";

import { useSession } from "@/lib/session-store";
import type { NeedChange } from "@/lib/needs";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Location matters less than space",
  "Push the budget up by a crore",
  "I'd rather have a newer build",
];

function ChangeRow({ change }: { change: NeedChange }) {
  const Icon =
    change.direction === "up" ? ArrowUp : change.direction === "down" ? ArrowDown : ArrowRight;

  return (
    <li className="flex items-start gap-2 text-[0.75rem] leading-snug">
      <Icon className="mt-0.5 size-3 shrink-0 text-sage" />
      <span className="text-ink-soft">
        <span className="text-ink">{change.label}</span>{" "}
        <span className="line-through opacity-60">{change.from}</span>{" "}
        <span aria-hidden="true">→</span> <span className="text-ink">{change.to}</span>
      </span>
    </li>
  );
}

export default function RefinePanel() {
  const { conversation, refine, refining, needs } = useSession();
  const [message, setMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [conversation.length, refining]);

  if (!needs) return null;

  return (
    <div className="flex flex-col">
      <span className="eyebrow">Not quite right?</span>
      <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-soft">
        Say what&apos;s off in a sentence. Mayaar updates your preferences and
        re-ranks — and shows you exactly what changed.
      </p>

      {conversation.length > 0 && (
        <div className="thin-scroll mt-5 max-h-[22rem] space-y-3 overflow-y-auto pr-1">
          {conversation.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "rounded-xl px-3.5 py-2.5 text-[0.8125rem] leading-relaxed",
                entry.role === "user"
                  ? "ml-4 bg-forest text-primary-foreground"
                  : "mr-4 border border-rule bg-paper text-ink",
              )}
            >
              <p>{entry.text}</p>

              {entry.changes && entry.changes.length > 0 && (
                <ul className="mt-2.5 space-y-1.5 border-t border-rule pt-2.5">
                  {entry.changes.map((change, index) => (
                    <ChangeRow key={`${change.label}-${index}`} change={change} />
                  ))}
                </ul>
              )}

              {entry.delta &&
                (entry.delta.entered > 0 || entry.delta.left > 0 || entry.delta.moved > 0) && (
                  <p className="mt-2.5 text-[0.6875rem] tracking-wide text-ink-soft uppercase">
                    {entry.delta.entered} in · {entry.delta.left} out · {entry.delta.moved} moved
                  </p>
                )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {conversation.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setMessage(suggestion)}
              className="rounded-full border border-rule bg-paper px-3 py-1.5 text-[0.75rem] text-ink-soft transition-colors hover:border-forest/35 hover:text-forest"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!message.trim() || refining) return;
          void refine(message);
          setMessage("");
        }}
        className="relative mt-4"
      >
        <label htmlFor="refine" className="sr-only">
          Tell Mayaar what to change
        </label>
        <input
          id="refine"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={refining}
          placeholder="Actually, closer to the city centre…"
          className="h-11 w-full rounded-lg border border-rule bg-paper pr-11 pl-3.5 text-[0.8125rem] text-ink outline-none transition-colors placeholder:text-ink-soft/70 focus:border-forest/40 focus:ring-4 focus:ring-forest/10 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={refining || !message.trim()}
          aria-label="Send"
          className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md bg-forest text-primary-foreground transition-colors hover:bg-forest-deep disabled:opacity-35"
        >
          {refining ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ArrowRight className="size-3.5" />
          )}
        </button>
      </form>
    </div>
  );
}
