"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { PublicView } from "@/lib/public-view";

export type LiveMode = "connecting" | "live" | "polling";

const POLL_MS = 10_000;
/**
 * Safety re-sync while SSE is connected. With several server instances (e.g. serverless), an
 * event published on one instance does not reach streams held by another; this bounds the delay.
 */
const LIVE_RESYNC_MS = 30_000;
const DEBOUNCE_MS = 250;
/** Consecutive SSE errors without a successful open before falling back to polling. */
const MAX_SSE_ERRORS = 3;

/**
 * Keep a tournament view fresh. Subscribes to `/api/t/:slug/events` and refetches the whole view
 * whenever something changes: always the full current state, never a patch, so missed events
 * cannot leave the page wrong. Also refetches after reconnecting and when the tab becomes visible.
 * If SSE is unavailable or keeps failing, polls every 10 seconds instead.
 */
export function useLiveView(initialView: PublicView): {
  view: PublicView;
  setView: (view: PublicView) => void;
  refresh: () => Promise<void>;
  mode: LiveMode;
} {
  const slug = initialView.tournament.slug;
  const [view, setView] = useState(initialView);
  const [mode, setMode] = useState<LiveMode>("connecting");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setView(await apiFetch<PublicView>(`/api/t/${slug}`));
    } catch {
      // Keep showing the last good view; the next event or poll will try again.
    }
  }, [slug]);

  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), DEBOUNCE_MS);
  }, [refresh]);

  useEffect(() => {
    let source: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    const resync = setInterval(() => void refresh(), LIVE_RESYNC_MS);
    let errors = 0;
    let wasDisconnected = false;

    const startPolling = () => {
      clearInterval(resync);
      source?.close();
      source = null;
      setMode("polling");
      poll ??= setInterval(() => void refresh(), POLL_MS);
    };

    if (typeof EventSource === "undefined") {
      startPolling();
    } else {
      source = new EventSource(`/api/t/${slug}/events`);
      source.onopen = () => {
        errors = 0;
        setMode("live");
        if (wasDisconnected) scheduleRefresh();
        wasDisconnected = false;
      };
      source.addEventListener("match_updated", scheduleRefresh);
      source.addEventListener("tournament_updated", scheduleRefresh);
      source.onerror = () => {
        errors += 1;
        wasDisconnected = true;
        if (errors >= MAX_SSE_ERRORS || source?.readyState === EventSource.CLOSED) startPolling();
      };
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      source?.close();
      if (poll) clearInterval(poll);
      clearInterval(resync);
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, refresh, scheduleRefresh]);

  return { view, setView, refresh, mode };
}
