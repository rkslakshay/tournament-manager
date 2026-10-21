import type { PublicMatch, PublicView } from "@/lib/public-view";
import { isAutoDecided, slotText, type MatchInfo } from "@/lib/view-model";

interface Props {
  view: PublicView;
  index: Map<string, MatchInfo>;
  match: PublicMatch;
  compact?: boolean;
}

/** One match: teams, score or kick-off time, and a status that never relies on colour alone. */
export function MatchCard({ view, index, match, compact = false }: Props) {
  const home = slotText(view, index, match, "home");
  const away = slotText(view, index, match, "away");
  const venue = view.venues.find((v) => v.id === match.venueId)?.name;
  const finished = match.status === "FINISHED";
  const walkover = isAutoDecided(match);
  const known = (teamId: string | null) => teamId !== null;

  return (
    <div
      className={`rounded-md border bg-white dark:bg-slate-900 ${match.status === "LIVE" ? "border-accent-500" : "border-slate-200 dark:border-slate-800"} ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{index.get(match.id)?.label}</span>
        <StatusLabel match={match} walkover={walkover} />
      </div>
      {[
        { name: home, teamId: match.homeTeamId, score: match.homeScore },
        { name: away, teamId: match.awayTeamId, score: match.awayScore },
      ].map((side, i) => {
        const won = finished && side.teamId !== null && side.teamId === match.winnerTeamId;
        return (
          <div key={i} className="flex items-center justify-between gap-2">
            <span
              className={`truncate ${won ? "font-bold" : ""} ${known(side.teamId) ? "" : "italic text-slate-400 dark:text-slate-500"}`}
            >
              {side.name}
              {won && <span className="sr-only"> (winner)</span>}
            </span>
            <span className={`tabular-nums ${won ? "font-bold" : ""}`}>{side.score ?? ""}</span>
          </div>
        );
      })}
      {!compact && !finished && match.scheduledAt && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          <time dateTime={match.scheduledAt}>{formatTime(match.scheduledAt)}</time>
          {venue && ` · ${venue}`}
        </p>
      )}
    </div>
  );
}

function StatusLabel({ match, walkover }: { match: PublicMatch; walkover: boolean }) {
  if (match.status === "LIVE") {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-accent-700 dark:text-accent-500">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-accent-600" />
        Live
      </span>
    );
  }
  if (walkover) return <span>{match.winnerTeamId ? "Bye" : "Not needed"}</span>;
  if (match.decidedBy === "WALKOVER") {
    return (
      <span>
        <abbr title="Walkover: the opponent forfeited">W/O</abbr>
      </span>
    );
  }
  if (match.decidedBy === "EXTRA_TIME") {
    return (
      <span>
        <abbr title="After extra time">AET</abbr>
      </span>
    );
  }
  if (match.decidedBy === "PENALTIES") {
    return (
      <span>
        <abbr title="Won on penalties">Pens</abbr>
      </span>
    );
  }
  if (match.status === "FINISHED") return <span>FT</span>;
  return null;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}
