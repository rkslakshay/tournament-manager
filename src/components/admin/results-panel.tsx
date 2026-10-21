"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import type { PublicMatch, PublicStage, PublicView } from "@/lib/public-view";
import {
  allowsDraws,
  indexMatches,
  isWalkover,
  roundsOf,
  slotText,
  stageTitle,
  withOptimisticResult,
  type MatchInfo,
} from "@/lib/view-model";
import type { AdminActions } from "./admin-app";

interface PendingEdit {
  match: PublicMatch;
  homeScore: number;
  awayScore: number;
  invalidated: string[];
}

/** Inline result entry for every match, with confirmation when an edit resets later results. */
export function ResultsPanel({ view, actions }: { view: PublicView; actions: AdminActions }) {
  const index = useMemo(() => indexMatches(view), [view]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingEdit | null>(null);

  async function save(
    match: PublicMatch,
    homeScore: number,
    awayScore: number,
    confirmReset = false,
  ) {
    const before = view;
    setSavingId(match.id);
    actions.setView(withOptimisticResult(view, match.id, homeScore, awayScore));
    try {
      const res = await actions.api<{ view: PublicView; resetMatchIds: string[] }>(
        `matches/${match.id}/result`,
        {
          method: "PUT",
          body: {
            homeScore,
            awayScore,
            expectedVersion: match.version,
            confirmReset: confirmReset || undefined,
          },
        },
      );
      actions.setView(res.view);
      const reset = res.resetMatchIds.length;
      actions.notify(
        reset > 0 ? `Result saved. ${reset} later result(s) were reset.` : "Result saved",
      );
    } catch (error) {
      actions.setView(before);
      if (error instanceof ApiError && error.code === "CONFIRMATION_REQUIRED") {
        const details = error.details as { invalidated?: Array<{ id: string }> } | undefined;
        setPending({
          match,
          homeScore,
          awayScore,
          invalidated: (details?.invalidated ?? []).map((m) => m.id),
        });
      } else if (error instanceof ApiError && error.code === "VERSION_CONFLICT") {
        actions.notify(error.message, "error");
        await actions.refresh();
      } else {
        actions.notify(
          error instanceof ApiError ? error.message : "Could not save the result.",
          "error",
        );
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {view.stages.map((stage) => (
        <Card key={stage.id}>
          <h2 className="text-lg font-semibold">{stageTitle(stage)}</h2>
          <div className="mt-3 space-y-5">
            {roundsOf(stage).map((round) => (
              <section key={round.key} aria-label={`${stageTitle(stage)}, ${round.title}`}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {round.title}
                </h3>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {round.matches.map((match) => (
                    <ResultRow
                      key={`${match.id}-${match.version}-${match.status}`}
                      view={view}
                      index={index}
                      info={index.get(match.id) as MatchInfo}
                      stage={stage}
                      saving={savingId === match.id}
                      onSave={(h, a) => save(match, h, a)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Card>
      ))}

      <ConfirmDialog
        open={pending !== null}
        title="Reset later results?"
        confirmLabel="Save and reset"
        tone="danger"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const edit = pending as PendingEdit;
          setPending(null);
          void save(edit.match, edit.homeScore, edit.awayScore, true);
        }}
      >
        <p>
          This changes who advanced, so these matches were played by the wrong teams and their
          results will be cleared:
        </p>
        <ul className="mt-2 list-disc pl-5">
          {pending?.invalidated.map((id) => {
            const info = index.get(id);
            return (
              <li key={id}>
                {info
                  ? `${info.roundName === info.label ? info.roundName : `${info.roundName} (${info.label})`}: ${slotText(view, index, info.match, "home")} vs ${slotText(view, index, info.match, "away")}`
                  : id}
              </li>
            );
          })}
        </ul>
      </ConfirmDialog>
    </div>
  );
}

interface RowProps {
  view: PublicView;
  index: Map<string, MatchInfo>;
  info: MatchInfo;
  stage: PublicStage;
  saving: boolean;
  onSave: (homeScore: number, awayScore: number) => void;
}

function ResultRow({ view, index, info, stage, saving, onSave }: RowProps) {
  const { match } = info;
  const [home, setHome] = useState(match.homeScore?.toString() ?? "");
  const [away, setAway] = useState(match.awayScore?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const homeName = slotText(view, index, match, "home");
  const awayName = slotText(view, index, match, "away");
  const ready = match.homeTeamId !== null && match.awayTeamId !== null && !isWalkover(match);

  function submit(event: FormEvent) {
    event.preventDefault();
    const h = Number(home);
    const a = Number(away);
    if (
      home === "" ||
      away === "" ||
      !Number.isInteger(h) ||
      !Number.isInteger(a) ||
      h < 0 ||
      a < 0
    ) {
      return setError("Enter both scores as whole numbers.");
    }
    if (h === a && !allowsDraws(stage)) return setError("Knockout matches need a winner.");
    setError(null);
    onSave(h, a);
  }

  if (!ready) {
    return (
      <li className="flex items-center justify-between gap-3 py-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="truncate">
          {homeName} vs {awayName}
        </span>
        <span className="shrink-0 text-xs">
          {isWalkover(match)
            ? match.winnerTeamId
              ? "Advances on a bye"
              : "Not needed"
            : "Waiting"}
        </span>
      </li>
    );
  }

  const done = match.status === "FINISHED";
  return (
    <li className="py-2">
      <form
        onSubmit={submit}
        className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)_auto]"
        aria-label={`${info.label}: ${homeName} vs ${awayName}`}
      >
        <span className="col-span-full text-xs text-slate-500 dark:text-slate-400">
          {info.label}
        </span>
        <span
          className={`truncate text-right ${done && match.winnerTeamId === match.homeTeamId ? "font-bold" : ""}`}
        >
          {homeName}
        </span>
        <input
          aria-label={`${homeName} score`}
          inputMode="numeric"
          type="number"
          min={0}
          max={999}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="h-9 w-12 rounded-md border border-slate-300 bg-white text-center tabular-nums dark:border-slate-700 dark:bg-slate-900"
        />
        <span aria-hidden>–</span>
        <input
          aria-label={`${awayName} score`}
          inputMode="numeric"
          type="number"
          min={0}
          max={999}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="h-9 w-12 rounded-md border border-slate-300 bg-white text-center tabular-nums dark:border-slate-700 dark:bg-slate-900"
        />
        <span
          className={`truncate ${done && match.winnerTeamId === match.awayTeamId ? "font-bold" : ""}`}
        >
          {awayName}
        </span>
        <Button
          type="submit"
          size="sm"
          variant={done ? "secondary" : "primary"}
          disabled={saving}
          className="col-span-full justify-self-end sm:col-span-1"
        >
          {saving ? "Saving…" : done ? "Update" : "Save"}
        </Button>
        {error && (
          <p
            role="alert"
            className="col-span-full text-xs font-medium text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        )}
      </form>
    </li>
  );
}
