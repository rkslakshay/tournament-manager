import type { Tally } from "./standings";
import { tallyStandings } from "./standings";
import type { Match, StandingsConfig, Team, TeamId, Tiebreaker } from "./types";

/** Values compared for one criterion, higher is better, compared left to right. */
type Score = number[];

interface RankContext {
  tallies: Map<TeamId, Tally>;
  teamsById: Map<TeamId, Team>;
  matches: readonly Match[];
  config: StandingsConfig;
}

/**
 * Order teams by the configured tiebreaker chain.
 *
 * Each criterion splits a tied group into tiers. When `headToHead` splits a group, it is
 * re-applied to each smaller tier using only that tier's matches (the recursive mini-table).
 * Any tie left after the chain is broken by team id, so the order is always total.
 *
 * `headToHead` compares a mini-table of only the tied teams' matches against each other:
 * points, then goal difference, then goals scored.
 *
 * @example
 * rankTeams(teams, tallyStandings(teams, matches, config), matches, config); // ["b", "a", "c"]
 */
export function rankTeams(
  teams: readonly Team[],
  tallies: Map<TeamId, Tally>,
  matches: readonly Match[],
  config: StandingsConfig,
): TeamId[] {
  const context: RankContext = {
    tallies,
    teamsById: new Map(teams.map((t) => [t.id, t])),
    matches,
    config,
  };
  return orderGroup(
    teams.map((t) => t.id),
    0,
    context,
  );
}

function orderGroup(group: TeamId[], criterionIndex: number, context: RankContext): TeamId[] {
  if (group.length <= 1) return group;
  const criterion = context.config.tiebreakers[criterionIndex];
  if (criterion === undefined) return [...group].sort();

  const tiers = splitIntoTiers(group, scorer(criterion, group, context));
  if (tiers.length === 1) return orderGroup(group, criterionIndex + 1, context);
  const nextIndex = criterion === "headToHead" ? criterionIndex : criterionIndex + 1;
  return tiers.flatMap((tier) => orderGroup(tier, nextIndex, context));
}

/** Group teams with equal scores, best tier first. */
function splitIntoTiers(group: TeamId[], score: (id: TeamId) => Score): TeamId[][] {
  const scored = group.map((id) => ({ id, score: score(id) }));
  scored.sort((a, b) => compareScores(b.score, a.score));
  const tiers: TeamId[][] = [];
  let previous: Score | null = null;
  for (const { id, score: s } of scored) {
    if (previous !== null && compareScores(previous, s) === 0) {
      (tiers[tiers.length - 1] as TeamId[]).push(id);
    } else {
      tiers.push([id]);
    }
    previous = s;
  }
  return tiers;
}

function compareScores(a: Score, b: Score): number {
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function scorer(
  criterion: Tiebreaker,
  group: TeamId[],
  context: RankContext,
): (id: TeamId) => Score {
  const tally = (id: TeamId) => context.tallies.get(id) as Tally;
  switch (criterion) {
    case "points":
      return (id) => [tally(id).points];
    case "goalDifference":
      return (id) => [tally(id).goalDifference];
    case "goalsFor":
      return (id) => [tally(id).goalsFor];
    case "wins":
      return (id) => [tally(id).won];
    case "seed":
      return (id) => [-(context.teamsById.get(id)?.seed ?? Number.MAX_SAFE_INTEGER)];
    case "alphabetical":
      return alphabeticalScorer(group, context);
    case "headToHead":
      return headToHeadScorer(group, context);
  }
}

/** Earlier names score higher. Scores are positions in the sorted list of lower-cased names. */
function alphabeticalScorer(group: TeamId[], context: RankContext): (id: TeamId) => Score {
  const nameOf = (id: TeamId) => (context.teamsById.get(id)?.name ?? id).toLowerCase();
  const names = [...new Set(group.map(nameOf))].sort();
  return (id) => [-names.indexOf(nameOf(id))];
}

function headToHeadScorer(group: TeamId[], context: RankContext): (id: TeamId) => Score {
  const members = new Set(group);
  const groupTeams = group.map((id) => context.teamsById.get(id) ?? { id, name: id, seed: 0 });
  const between = context.matches.filter(
    (m) =>
      m.homeTeamId !== null &&
      m.awayTeamId !== null &&
      members.has(m.homeTeamId) &&
      members.has(m.awayTeamId),
  );
  const mini = tallyStandings(groupTeams, between, context.config);
  return (id) => {
    const row = mini.get(id) as Tally;
    return [row.points, row.goalDifference, row.goalsFor];
  };
}
