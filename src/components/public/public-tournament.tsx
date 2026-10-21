"use client";

import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import type { PublicView } from "@/lib/public-view";
import { FORMAT_LABELS } from "@/lib/tournament-config";
import { indexMatches, stageTitle, teamNamer } from "@/lib/view-model";
import { FixturesList } from "./fixtures-list";
import { StandingsTable } from "./standings-table";

/** The public, read-only tournament page. */
export function PublicTournament({ initialView }: { initialView: PublicView }) {
  const view = initialView;
  const index = useMemo(() => indexMatches(view), [view]);
  const name = teamNamer(view);
  const leagueStages = view.stages.filter((s) => s.standings !== null);

  const tabs: TabItem[] = [];
  if (leagueStages.length > 0) {
    tabs.push({
      id: "standings",
      label: "Standings",
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          {leagueStages.map((stage) => (
            <StandingsTable
              key={stage.id}
              title={stageTitle(stage)}
              rows={stage.standings ?? []}
              teamName={(id) => name(id)}
              qualifyingPlaces={
                stage.type === "GROUP" ? (view.tournament.rules.advancePerGroup ?? 0) : 0
              }
            />
          ))}
        </div>
      ),
    });
  }
  tabs.push({
    id: "fixtures",
    label: "Fixtures",
    content: <FixturesList view={view} index={index} />,
  });
  const [active, setActive] = useState(tabs[0]?.id ?? "fixtures");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {view.tournament.sport} · {FORMAT_LABELS[view.tournament.format]} · {view.teams.length}{" "}
            teams
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{view.tournament.name}</h1>
          <div className="mt-2">
            <StatusBadge status={view.tournament.status} />
          </div>
        </div>
        <ShareButton />
      </header>

      {view.championTeamId && (
        <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <span aria-hidden>🏆 </span>Champion: {name(view.championTeamId)}
        </p>
      )}

      <div className="mt-6">
        {view.stages.length === 0 ? (
          <Upcoming view={view} />
        ) : (
          <Tabs label="Tournament sections" tabs={tabs} active={active} onChange={setActive} />
        )}
      </div>
    </div>
  );
}

function Upcoming({ view }: { view: PublicView }) {
  return (
    <section aria-labelledby="teams-heading">
      <h2 id="teams-heading" className="font-semibold">
        Teams
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Fixtures appear once the organizer starts the tournament.
      </p>
      {view.teams.length > 0 && (
        <ol className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
          {view.teams.map((t) => (
            <li key={t.id}>
              <span className="inline-block w-8 tabular-nums text-slate-500">{t.seed}.</span>
              {t.name}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ShareButton() {
  const [url, setUrl] = useState("");
  // Read after hydration so server and first client render match.
  useEffect(() => setUrl(window.location.href), []);
  return url ? <CopyButton text={url} label="Share" /> : null;
}
