"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { planStages } from "@/lib/plan-stages";
import type { PublicView } from "@/lib/public-view";
import { MIN_TEAMS } from "@/lib/tournament-config";
import { configOf, stageTitle } from "@/lib/view-model";
import type { AdminActions } from "./admin-app";

type Preview =
  | {
      ok: true;
      stages: Array<{ title: string; matches: number; rounds: number; firstRound: string[] }>;
    }
  | { ok: false; error: string };

/**
 * Preview of the fixtures the current teams would produce, generated in the browser with the
 * same pure code the server uses, and the Start button.
 */
export function StartPanel({ view, actions }: { view: PublicView; actions: AdminActions }) {
  const [confirming, setConfirming] = useState(false);
  const preview = useMemo(() => buildPreview(view), [view]);
  const enoughTeams = view.teams.length >= MIN_TEAMS;

  async function start() {
    setConfirming(false);
    await actions.run(
      () => actions.api("start", { method: "POST" }),
      "Tournament started. Fixtures are live.",
    );
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Fixtures preview</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Updates as you add or reorder teams.
          </p>
        </div>
        <Button
          onClick={() => setConfirming(true)}
          disabled={!enoughTeams || !preview.ok || actions.busy}
        >
          Start tournament
        </Button>
      </div>

      {!enoughTeams ? (
        <p className="text-sm text-slate-500">
          Add at least {MIN_TEAMS} teams to see the fixtures.
        </p>
      ) : !preview.ok ? (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {preview.error}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {preview.stages.map((stage) => (
            <div
              key={stage.title}
              className="rounded-md border border-slate-200 p-3 dark:border-slate-800"
            >
              <h3 className="font-medium">{stage.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stage.matches} matches over {stage.rounds} rounds
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {stage.firstRound.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Start the tournament?"
        confirmLabel="Start"
        onConfirm={start}
        onCancel={() => setConfirming(false)}
      >
        Fixtures will be generated and the team list will be locked. Teams cannot be added, removed
        or reseeded afterwards.
      </ConfirmDialog>
    </Card>
  );
}

function buildPreview(view: PublicView): Preview {
  if (view.teams.length < MIN_TEAMS) return { ok: true, stages: [] };
  try {
    const plan = planStages(configOf(view), view.teams, "preview-");
    const name = new Map(view.teams.map((t) => [t.id, t.name]));
    return {
      ok: true,
      stages: plan.stages.map((stage) => {
        const real = stage.matches.filter(
          (m) => !(m.status === "FINISHED" && m.homeScore === null),
        );
        const firstRound = stage.matches
          .filter((m) => m.round === 1 && m.bracket !== "LOSERS" && m.bracket !== "GRAND_FINAL")
          .map((m) => {
            const home = m.homeTeamId ? name.get(m.homeTeamId) : "TBD";
            const away = m.awayTeamId
              ? name.get(m.awayTeamId)
              : m.awaySource?.type === "bye"
                ? "bye"
                : "TBD";
            return `${home} vs ${away}`;
          });
        return {
          title: stageTitle({ ...stage, standings: null, matches: [] }),
          matches: real.length,
          rounds: new Set(stage.matches.map((m) => `${m.bracket}-${m.round}`)).size,
          firstRound: firstRound
            .slice(0, 8)
            .concat(firstRound.length > 8 ? [`…and ${firstRound.length - 8} more`] : []),
        };
      }),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "These settings cannot produce fixtures.",
    };
  }
}
