import type { PublicView } from "@/lib/public-view";
import { roundsOf, stageTitle, type MatchInfo } from "@/lib/view-model";
import { MatchCard } from "./match-card";

/** All matches, grouped by stage and round. Headings never skip a level. */
export function FixturesList({ view, index }: { view: PublicView; index: Map<string, MatchInfo> }) {
  if (view.stages.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Fixtures appear once the organizer starts the tournament.
      </p>
    );
  }
  const multiStage = view.stages.length > 1;
  return (
    <div className="space-y-8">
      {view.stages.map((stage) => (
        <section key={stage.id} aria-label={stageTitle(stage)}>
          {multiStage && <h2 className="mb-3 text-lg font-bold">{stageTitle(stage)}</h2>}
          <div className="space-y-5">
            {roundsOf(stage).map((round) => (
              <div key={round.key}>
                <RoundHeading level={multiStage ? 3 : 2}>{round.title}</RoundHeading>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {round.matches.map((match) => (
                    <li key={match.id}>
                      <MatchCard view={view} index={index} match={match} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RoundHeading({ level, children }: { level: 2 | 3; children: string }) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {children}
    </Tag>
  );
}
