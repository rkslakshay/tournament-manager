"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { useLiveView } from "@/components/use-live-view";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { PublicView } from "@/lib/public-view";
import { FORMAT_LABELS } from "@/lib/tournament-config";
import { ResultsPanel } from "./results-panel";
import { SchedulePanel } from "./schedule-panel";
import { StartPanel } from "./start-panel";
import { TeamManager } from "./team-manager";
import { useAdminToken } from "./use-admin-token";

type ApiOptions = { method?: string; body?: unknown };

/** Helpers shared by the admin panels. */
export interface AdminActions {
  busy: boolean;
  /** Call an admin endpoint under `/api/t/:slug/`. */
  api: <T = unknown>(path: string, options?: ApiOptions) => Promise<T>;
  /**
   * Run a write, then refresh the view. Shows `success` or the API error message.
   * Returns false when it failed.
   */
  run: (write: () => Promise<unknown>, success: string) => Promise<boolean>;
  setView: (view: PublicView) => void;
  /** Reload the view from the server. */
  refresh: () => Promise<void>;
  notify: (message: string, tone?: "success" | "error") => void;
}

export function AdminApp({ initialView }: { initialView: PublicView }) {
  const slug = initialView.tournament.slug;
  const { token, forget } = useAdminToken(slug);
  // Live too, so two organizers see each other's changes.
  const { view, setView } = useLiveView(initialView);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const notify = useCallback(
    (text: string, tone: "success" | "error" = "success") => setMessage({ text, tone }),
    [],
  );

  const api = useCallback(
    <T,>(path: string, options: ApiOptions = {}) =>
      apiFetch<T>(`/api/t/${slug}/${path}`, { ...options, token }),
    [slug, token],
  );

  const refresh = useCallback(async () => {
    setView(await apiFetch<PublicView>(`/api/t/${slug}`));
  }, [slug, setView]);

  const run = useCallback(
    async (write: () => Promise<unknown>, success: string) => {
      setBusy(true);
      try {
        await write();
        await refresh();
        notify(success);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.code === "UNAUTHORIZED") forget();
        notify(
          error instanceof ApiError ? error.message : "Something went wrong. Try again.",
          "error",
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh, notify, forget],
  );

  const actions: AdminActions = { busy, api, run, setView, refresh, notify };
  const started = view.tournament.status !== "DRAFT" && view.tournament.status !== "REGISTRATION";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Admin · {view.tournament.sport} · {FORMAT_LABELS[view.tournament.format]}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{view.tournament.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={view.tournament.status} />
          <Link
            href={`/t/${slug}`}
            className="text-sm font-medium text-accent-700 underline dark:text-accent-500"
          >
            Public page
          </Link>
        </div>
      </div>

      <div aria-live="polite" className="mt-4 min-h-6">
        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={`rounded-md px-3 py-2 text-sm ${message.tone === "error" ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-accent-50 text-accent-900 dark:bg-accent-900/40 dark:text-accent-100"}`}
          >
            {message.text}
          </p>
        )}
      </div>

      {token === undefined ? null : token === null ? (
        <NoToken slug={slug} />
      ) : (
        <div className="mt-4 space-y-8">
          {started ? (
            <>
              <ResultsPanel view={view} actions={actions} />
              {view.tournament.status === "IN_PROGRESS" && (
                <SchedulePanel actions={actions} venueNames={view.venues.map((v) => v.name)} />
              )}
            </>
          ) : (
            <>
              <TeamManager teams={view.teams} actions={actions} />
              <StartPanel view={view} actions={actions} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NoToken({ slug }: { slug: string }) {
  return (
    <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <h2 className="font-semibold">Admin link needed</h2>
      <p className="mt-1 text-sm">
        Open the private admin link you received when the tournament was created. Without it you can
        still{" "}
        <Link href={`/t/${slug}`} className="underline">
          follow the tournament
        </Link>
        .
      </p>
    </div>
  );
}
