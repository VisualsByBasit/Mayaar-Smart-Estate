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

import type { Match } from "@/lib/listings";
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

interface SessionState {
  description: string;
  needs: Needs | null;
  matches: Match[];
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
  runSearch: (description: string) => Promise<void>;
  refine: (message: string) => Promise<void>;
  applyNeeds: (needs: Needs) => Promise<void>;
  toggleSaved: (id: number) => void;
  toggleCompare: (id: number) => void;
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL);
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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Quota or private-mode failures shouldn't break the flow.
    }
  }, [state, hydrated]);

  const runSearch = useCallback(async (description: string) => {
    const text = description.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;

    setState((current) => ({
      ...current,
      description: text,
      needs: null,
      matches: [],
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
      setState((current) => ({ ...current, matches, status: "ready" }));
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
      setState((current) => ({
        ...current,
        matches: (matched.matches ?? []) as Match[],
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

  const toggleSaved = useCallback((id: number) => {
    setState((current) => ({
      ...current,
      saved: current.saved.includes(id)
        ? current.saved.filter((saved) => saved !== id)
        : [...current.saved, id],
    }));
  }, []);

  const toggleCompare = useCallback((id: number) => {
    setState((current) => {
      if (current.compare.includes(id)) {
        return { ...current, compare: current.compare.filter((item) => item !== id) };
      }
      // Comparison only stays readable up to three homes.
      const next = [...current.compare, id].slice(-3);
      return { ...current, compare: next };
    });
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL);
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
      runSearch,
      refine,
      applyNeeds,
      toggleSaved,
      toggleCompare,
      reset,
    }),
    [state, hydrated, runSearch, refine, applyNeeds, toggleSaved, toggleCompare, reset],
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
