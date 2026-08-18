import { cn } from "@/lib/utils";

/**
 * One scored dimension from match-breakdown, drawn the same way everywhere it
 * appears — listing detail, the breakdown screen and the compare table — so a
 * bar means the same thing on every screen.
 */
export default function ScoreBar({
  label,
  score,
  note,
  peers,
  delay = 0,
  size = "default",
}: {
  label?: string;
  score: number;
  note?: string;
  /** Scores for the same dimension across the other matches, drawn as ticks. */
  peers?: number[];
  delay?: number;
  size?: "default" | "compact";
}) {
  return (
    <div>
      {label && (
        <div className="flex items-baseline justify-between gap-4">
          <span
            className={cn(
              "font-medium",
              size === "compact" ? "text-[0.8125rem]" : "text-[0.875rem]",
            )}
          >
            {label}
          </span>
          <span className="font-mono text-xs text-ink-soft">{score}</span>
        </div>
      )}

      <span
        className={cn(
          "relative mt-2 block overflow-hidden rounded-full bg-sand-deep",
          size === "compact" ? "h-1" : "h-1.5",
        )}
      >
        <span
          className="animate-bar block h-full origin-left rounded-full bg-forest"
          style={{ width: `${score}%`, animationDelay: `${delay}ms` }}
        />
        {peers?.map((peer, index) => (
          <span
            key={`${peer}-${index}`}
            aria-hidden="true"
            className="absolute top-0 h-full w-px bg-ink/25"
            style={{ left: `${peer}%` }}
          />
        ))}
      </span>

      {note && <p className="mt-1.5 text-[0.8125rem] text-ink-soft">{note}</p>}
    </div>
  );
}
