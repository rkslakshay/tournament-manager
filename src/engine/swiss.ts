import { createMatch, hasResult } from "./match";
import { orderBySeed } from "./seeding";
import { tallyStandings, type Tally } from "./standings";
import type { Match, MatchId, StageId, StandingRow, StandingsConfig, Team, TeamId } from "./types";

/** A Swiss standings row: the usual columns plus Buchholz. */
export interface SwissRow extends StandingRow {
  /** Sum of the points of every opponent actually played (byes add nothing). */
  buchholz: number;
}

export interface SwissRoundOptions {
  /** 1-based round to pair. */
  round: number;
  stageId: StageId;
  idPrefix: string;
}

export interface SwissRound {
  matches: Match[];
  /** Pairings that repeat an earlier meeting. 0 unless no rematch-free pairing exists. */
  rematches: number;
}

/** Upper bound on backtracking steps before settling for the fewest rematches. */
const SEARCH_BUDGET = 200_000;

/**
 * Default number of Swiss rounds: enough to separate a clear winner, ceil(log2 n), capped at
 * n - 1 so nobody runs out of new opponents.
 *
 * @example
 * defaultSwissRounds(16); // 4
 */
export function defaultSwissRounds(teamCount: number): number {
  return Math.max(1, Math.min(teamCount - 1, Math.ceil(Math.log2(teamCount))));
}

/**
 * Swiss standings: a bye counts as a win (no goals), and ties on points are broken by Buchholz,
 * then goal difference, goals scored, seed and id, so the order is total.
 *
 * @example
 * swissStandings(teams, matches, config)[0]; // { teamId, points, buchholz, rank: 1, ... }
 */
export function swissStandings(
  teams: readonly Team[],
  matches: readonly Match[],
  config: StandingsConfig,
): SwissRow[] {
  const tallies = tallyStandings(teams, matches, config);
  for (const m of matches) {
    const byeWinner = byeWinnerOf(m);
    const row = byeWinner === null ? undefined : tallies.get(byeWinner);
    if (!row) continue;
    row.played += 1;
    row.won += 1;
    row.points += config.pointsForWin;
  }

  const opponents = opponentsByTeam(matches);
  const seedOf = new Map(teams.map((t) => [t.id, t.seed]));
  const rows = [...tallies.values()].map((row: Tally) => ({
    ...row,
    buchholz: (opponents.get(row.teamId) ?? []).reduce(
      (sum, o) => sum + (tallies.get(o)?.points ?? 0),
      0,
    ),
  }));
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.buchholz - a.buchholz ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      (seedOf.get(a.teamId) ?? 0) - (seedOf.get(b.teamId) ?? 0) ||
      (a.teamId < b.teamId ? -1 : 1),
  );
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Pair one Swiss round (Monrad style): rank teams by the standings so far, give an odd team out
 * a bye (the lowest-ranked team that has not had one), then pair neighbours in the ranking so
 * teams meet others on similar scores. A depth-first search with backtracking avoids every
 * repeat meeting; if none is possible it falls back to the fewest rematches and reports them.
 * Home goes to the team with fewer home games so far (the higher-ranked team on a tie).
 *
 * @example
 * pairSwissRound(sixTeams, [], config, { round: 1, stageId: "sw", idPrefix: "" });
 * // round 1: seeds 1v2, 3v4, 5v6
 */
export function pairSwissRound(
  teams: readonly Team[],
  previous: readonly Match[],
  config: StandingsConfig,
  options: SwissRoundOptions,
): SwissRound {
  if (teams.length < 2) throw new Error("A Swiss tournament needs at least 2 teams");
  if (!Number.isInteger(options.round) || options.round < 1)
    throw new Error("The round must be a positive integer");

  const ordered = swissStandings(orderBySeed(teams), previous, config).map((r) => r.teamId);
  const met = new Set(
    previous
      .filter(isPlayedPair)
      .map((m) => pairKey(m.homeTeamId as TeamId, m.awayTeamId as TeamId)),
  );
  const hadBye = new Set(previous.map(byeWinnerOf).filter((t): t is TeamId => t !== null));

  let byeTeam: TeamId | null = null;
  if (ordered.length % 2 === 1) {
    byeTeam =
      [...ordered].reverse().find((t) => !hadBye.has(t)) ?? (ordered[ordered.length - 1] as TeamId);
  }
  const pool = ordered.filter((t) => t !== byeTeam);

  const budget = { steps: SEARCH_BUDGET };
  const strict = pairWithoutRematches(pool, met, budget);
  const pairs = strict ?? pairFewestRematches(pool, met);
  const rematches = pairs.filter(([a, b]) => met.has(pairKey(a, b))).length;

  const homeGames = countHomeGames(previous);
  const id = (position: number): MatchId => `${options.idPrefix}sw-r${options.round}m${position}`;
  const matches = pairs.map(([a, b], i) => {
    const [home, away] = (homeGames.get(b) ?? 0) < (homeGames.get(a) ?? 0) ? [b, a] : [a, b];
    return createMatch({
      id: id(i + 1),
      stageId: options.stageId,
      round: options.round,
      position: i + 1,
      homeTeamId: home,
      awayTeamId: away,
      homeSource: { type: "team", teamId: home },
      awaySource: { type: "team", teamId: away },
    });
  });
  if (byeTeam !== null) {
    const bye = createMatch({
      id: id(pairs.length + 1),
      stageId: options.stageId,
      round: options.round,
      position: pairs.length + 1,
      homeTeamId: byeTeam,
      homeSource: { type: "team", teamId: byeTeam },
      awaySource: { type: "bye" },
    });
    matches.push({ ...bye, status: "FINISHED", winnerTeamId: byeTeam });
  }
  return { matches, rematches };
}

/** Depth-first: pair the first team with the nearest unmet team, backtracking on dead ends. */
function pairWithoutRematches(
  pool: readonly TeamId[],
  met: Set<string>,
  budget: { steps: number },
): Array<[TeamId, TeamId]> | null {
  if (pool.length === 0) return [];
  const [first, ...rest] = pool as [TeamId, ...TeamId[]];
  for (let i = 0; i < rest.length; i++) {
    if (--budget.steps < 0) return null;
    const partner = rest[i] as TeamId;
    if (met.has(pairKey(first, partner))) continue;
    const remaining = pairWithoutRematches(
      [...rest.slice(0, i), ...rest.slice(i + 1)],
      met,
      budget,
    );
    if (remaining) return [[first, partner], ...remaining];
  }
  return null;
}

/** Greedy fallback: nearest unmet partner when there is one, otherwise the nearest team. */
function pairFewestRematches(pool: readonly TeamId[], met: Set<string>): Array<[TeamId, TeamId]> {
  const left = [...pool];
  const pairs: Array<[TeamId, TeamId]> = [];
  while (left.length >= 2) {
    const first = left.shift() as TeamId;
    const index = Math.max(
      0,
      left.findIndex((t) => !met.has(pairKey(first, t))),
    );
    const [partner] = left.splice(index, 1) as [TeamId];
    pairs.push([first, partner]);
  }
  return pairs;
}

function byeWinnerOf(m: Match): TeamId | null {
  if (m.status !== "FINISHED" || hasResult(m)) return null;
  if ((m.homeTeamId === null) === (m.awayTeamId === null)) return null;
  return m.winnerTeamId;
}

function isPlayedPair(m: Match): boolean {
  return m.homeTeamId !== null && m.awayTeamId !== null;
}

function opponentsByTeam(matches: readonly Match[]): Map<TeamId, TeamId[]> {
  const opponents = new Map<TeamId, TeamId[]>();
  for (const m of matches) {
    if (!isPlayedPair(m) || !hasResult(m)) continue;
    const home = m.homeTeamId as TeamId;
    const away = m.awayTeamId as TeamId;
    opponents.set(home, [...(opponents.get(home) ?? []), away]);
    opponents.set(away, [...(opponents.get(away) ?? []), home]);
  }
  return opponents;
}

function countHomeGames(matches: readonly Match[]): Map<TeamId, number> {
  const counts = new Map<TeamId, number>();
  for (const m of matches) {
    if (isPlayedPair(m))
      counts.set(m.homeTeamId as TeamId, (counts.get(m.homeTeamId as TeamId) ?? 0) + 1);
  }
  return counts;
}

function pairKey(a: TeamId, b: TeamId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
