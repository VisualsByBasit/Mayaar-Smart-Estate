"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { type Match, type Recommendation, getListing } from "@/lib/listings";
import {
  type NeedChange,
  type Needs,
  diffNeeds,
  normalizeNeeds,
  rankingDelta,
} from "@/lib/needs";

export type SearchStatus = "idle" | "extracting" | "matching" | "ready" | "error";

export interface ConversationEntry {
  id: string;
  role: "user" | "mayaar";
  text: string;
  changes?: NeedChange[];
  delta?: { entered: number; left: number; moved: number };
}

/** A short confirmation shown by <Toaster> — saving, comparing, removing. */
export interface Notice {
  id: string;
  text: string;
  tone: "done" | "undone" | "blocked";
  href?: string;
  hrefLabel?: string;
}

/** The compare table stops being readable past three columns. */
export const COMPARE_LIMIT = 3;

interface SessionState {
  description: string;
  needs: Needs | null;
  matches: Match[];
  recommendation: Recommendation | null;
  conversation: ConversationEntry[];
  saved: number[];
  compare: number[];
  status: SearchStatus;
  error: string | null;
  refining: boolean;
}

const INITIAL: SessionState = {
  description: "",
  needs: null,
  matches: [],
  recommendation: null,
  conversation: [],
  saved: [],
  compare: [],
  status: "idle",
  error: null,
  refining: false,
};

const STORAGE_KEY = "mayaar:session:v1";

interface SessionValue extends SessionState {
  hydrated: boolean;
  /** Transient, never persisted — see the sessionStorage effect below. */
  notice: Notice | null;
  runSearch: (description: string) => Promise<void>;
  refine: (message: string) => Promise<void>;
  applyNeeds: (needs: Needs) => Promise<void>;
  toggleSaved: (id: number) => void;
  toggleCompare: (id: number) => void;
  dismissNotice: () => void;
  reset: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (data as { error?: string } | null)?.error ??
        "Something went wrong. Please try again.",
    );
  }
  return data as Record<string, unknown>;
}

/** Falls back to the top-ranked match so the recommendation card is never empty. */
function normalizeRecommendation(raw: unknown, matches: Match[]): Recommendation | null {
  const source = (raw ?? {}) as Partial<Record<keyof Recommendation, unknown>>;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  const id = typeof source.id === "number" ? source.id : null;
  const rationale = text(source.rationale);
  if (id !== null && rationale && matches.some((match) => match.id === id)) {
    return {
      id,
      headline: text(source.headline) ?? "The one I'd look at first",
      rationale,
      trade_off: text(source.trade_off) ?? "",
    };
  }

  const top = matches[0];
  if (!top) return null;
  return {
    id: top.id,
    headline: "The strongest fit on your brief",
    rationale: top.why_it_fits,
    trade_off: top.not_perfect ?? "",
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const inFlight = useRef(false);

  // Async actions need the latest state without re-creating their callbacks.
  const stateRef = useRef(state);
  stateRef.current = state;

  // sessionStorage keeps the flow alive across reloads and hard navigations
  // without pulling in a state library for a two-day build.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<SessionState>;
        setState((current) => ({
          ...current,
          ...parsed,
          // A search interrupted by a reload is not still running.
          refining: false,
          status:
            parsed.status === "extracting" || parsed.status === "matching"
              ? "idle"
              : (parsed.status ?? "idle"),
        }));
      }
    } catch {
      // Corrupt or unavailable storage just means a fresh session.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      // `notice` is deliberately not part of `state` — a toast that survived a
      // reload would announce something the user did minutes ago.
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota or private-mode failures shouldn't break the flow.
    }
  }, [state, hydrated]);

  const notify = useCallback(
    (text: string, tone: Notice["tone"], link?: { href: string; label: string }) => {
      setNotice({
        id: newId(),
        text,
        tone,
        href: link?.href,
        hrefLabel: link?.label,
      });
    },
    [],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);

  const runSearch = useCallback(async (description: string) => {
    const text = description.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;

    setState((current) => ({
      ...current,
      description: text,
      needs: null,
      matches: [],
      recommendation: null,
      conversation: [],
      status: "extracting",
      error: null,
    }));

    try {
      const extracted = await postJson("/api/extract-needs", { text });
      const needs = normalizeNeeds(extracted.needs);
      setState((current) => ({ ...current, needs, status: "matching" }));

      const matched = await postJson("/api/match-listings", { needs });
      const matches = (matched.matches ?? []) as Match[];
      setState((current) => ({
        ...current,
        matches,
        recommendation: normalizeRecommendation(matched.recommendation, matches),
        status: "ready",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : "Something went wrong.",
      }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  const refine = useCallback(async (message: string) => {
    const text = message.trim();
    if (!text) return;

    const previousNeeds = stateRef.current.needs;
    const previousIds = stateRef.current.matches.map((match) => match.id);
    if (!previousNeeds) return;

    setState((current) => ({
      ...current,
      refining: true,
      error: null,
      conversation: [...current.conversation, { id: newId(), role: "user", text }],
    }));

    try {
      const result = await postJson("/api/refine-needs", {
        current_needs: previousNeeds,
        message: text,
      });
      const updated = normalizeNeeds(result.updated_needs);
      const matches = (result.matches ?? []) as Match[];
      const changes = diffNeeds(previousNeeds, updated);
      const delta = rankingDelta(
        previousIds,
        matches.map((match) => match.id),
      );

      setState((current) => ({
        ...current,
        needs: updated,
        matches,
        recommendation: normalizeRecommendation(result.recommendation, matches),
        refining: false,
        conversation: [
          ...current.conversation,
          {
            id: newId(),
            role: "mayaar",
            text: String(result.acknowledgment ?? "Updated your shortlist."),
            changes,
            delta,
          },
        ],
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        refining: false,
        conversation: [
          ...current.conversation,
          {
            id: newId(),
            role: "mayaar",
            text:
              error instanceof Error
                ? error.message
                : "I couldn't update your search just then. Try rephrasing?",
          },
        ],
      }));
    }
  }, []);

  /** Re-ranks after the user edits an extracted preference by hand. */
  const applyNeeds = useCallback(async (needs: Needs) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((current) => ({ ...current, needs, refining: true, error: null }));
    try {
      const matched = await postJson("/api/match-listings", { needs });
      const matches = (matched.matches ?? []) as Match[];
      setState((current) => ({
        ...current,
        matches,
        recommendation: normalizeRecommendation(matched.recommendation, matches),
        refining: false,
        status: "ready",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        refining: false,
        error: error instanceof Error ? error.message : "Something went wrong.",
      }));
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Both toggles read through `stateRef` rather than a setState updater: the
  // toast is a side effect, and updaters have to stay pure to survive a
  // double-invoked render in development.
  const toggleSaved = useCallback(
    (id: number) => {
      const title = getListing(id)?.title ?? "This home";
      const short = title.length > 34 ? `${title.slice(0, 33).trimEnd()}…` : title;
      const current = stateRef.current.saved;

      if (current.includes(id)) {
        setState((previous) => ({
          ...previous,
          saved: previous.saved.filter((saved) => saved !== id),
        }));
        notify(`Removed “${short}” from saved`, "undone");
        return;
      }

      const saved = [...current, id];
      setState((previous) => ({ ...previous, saved }));
      notify(`Saved · ${saved.length} home${saved.length === 1 ? "" : "s"} shortlisted`, "done", {
        href: "/saved",
        label: "View saved",
      });
    },
    [notify],
  );

  const toggleCompare = useCallback(
    (id: number) => {
      const current = stateRef.current.compare;

      if (current.includes(id)) {
        const compare = current.filter((item) => item !== id);
        setState((previous) => ({ ...previous, compare }));
        notify(
          compare.length ? `Removed from compare · ${compare.length} selected` : "Compare cleared",
          "undone",
        );
        return;
      }

      // Silently dropping the oldest selection reads as a bug from the outside,
      // so a full tray refuses the fourth home and says why.
      if (current.length >= COMPARE_LIMIT) {
        notify(`Compare holds ${COMPARE_LIMIT} homes — remove one to add another`, "blocked", {
          href: "/compare",
          label: "Open compare",
        });
        return;
      }

      const compare = [...current, id];
      setState((previous) => ({ ...previous, compare }));
      notify(
        compare.length < 2
          ? "Added to compare · pick one more to see them side by side"
          : `Added to compare · ${compare.length} selected`,
        "done",
        compare.length >= 2 ? { href: "/compare", label: "Compare now" } : undefined,
      );
    },
    [notify],
  );

  const reset = useCallback(() => {
    setState(INITIAL);
    setNotice(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      ...state,
      hydrated,
      notice,
      runSearch,
      refine,
      applyNeeds,
      toggleSaved,
      toggleCompare,
      dismissNotice,
      reset,
    }),
    [
      state,
      hydrated,
      notice,
      runSearch,
      refine,
      applyNeeds,
      toggleSaved,
      toggleCompare,
      dismissNotice,
      reset,
    ],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return value;
}
