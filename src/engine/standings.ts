import { hasResult } from "./match";
import type { Match, StandingRow, StandingsConfig, Team, TeamId } from "./types";

/** A standings row before it has a rank. */
export type Tally = Omit<StandingRow, "rank">;

/**
 * Tally played/won/drawn/lost, goals and points for each team from finished matches.
 * Matches without a result (pending, live, byes) and matches against teams outside `teams`
 * are ignored.
 *
 * @example
 * tallyStandings(teams, [finished("a", "b", 2, 0)], config).get("a")?.points; // 3
 */
export function tallyStandings(
  teams: readonly Team[],
  matches: readonly Match[],
  config: StandingsConfig,
): Map<TeamId, Tally> {
  const rows = new Map<TeamId, Tally>(teams.map((t) => [t.id, emptyTally(t.id)]));
  for (const match of matches) {
    if (match.status !== "FINISHED" || !hasResult(match)) continue;
    const home = match.homeTeamId === null ? undefined : rows.get(match.homeTeamId);
    const away = match.awayTeamId === null ? undefined : rows.get(match.awayTeamId);
    if (!home || !away) continue;
    record(home, match.homeScore as number, match.awayScore as number, config);
    record(away, match.awayScore as number, match.homeScore as number, config);
  }
  return rows;
}

/**
 * Compute a ranked league table. Standings are always derived from results, never stored.
 *
 * @example
 * computeStandings(teams, matches, DEFAULT_STANDINGS_CONFIG)[0]?.teamId; // the leader
 */
export function computeStandings(
  teams: readonly Team[],
  matches: readonly Match[],
  config: StandingsConfig,
): StandingRow[] {
  const tallies = tallyStandings(teams, matches, config);
  const seedOf = new Map(teams.map((t) => [t.id, t.seed]));
  const ordered = [...tallies.values()].sort(
    (a, b) => b.points - a.points || (seedOf.get(a.teamId) ?? 0) - (seedOf.get(b.teamId) ?? 0),
  );
  return ordered.map((row, i) => ({ ...row, rank: i + 1 }));
}

function emptyTally(teamId: TeamId): Tally {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

function record(row: Tally, scored: number, conceded: number, config: StandingsConfig): void {
  row.played += 1;
  row.goalsFor += scored;
  row.goalsAgainst += conceded;
  row.goalDifference = row.goalsFor - row.goalsAgainst;
  if (scored > conceded) {
    row.won += 1;
    row.points += config.pointsForWin;
  } else if (scored < conceded) {
    row.lost += 1;
    row.points += config.pointsForLoss;
  } else {
    row.drawn += 1;
    row.points += config.pointsForDraw;
  }
}
