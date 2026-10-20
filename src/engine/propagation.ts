import { hasResult, loserOf } from "./match";
import type { Match, MatchId, Source, TeamId } from "./types";

export interface PropagateOptions {
  /**
   * Final rankings of groups that have finished, best first, keyed by group label.
   * `groupRank` sources for groups missing here stay unresolved.
   */
  groupRankings?: Readonly<Record<string, readonly TeamId[]>>;
}

export interface PropagationResult {
  /** All matches, in input order, with participants resolved. */
  matches: Match[];
  /**
   * Matches that had a result (or were LIVE) but whose participants changed. They are returned
   * reset (no score, no winner); the service decides whether to accept that or block the edit.
   */
  invalidated: MatchId[];
}

/** What a participant slot resolves to. */
type Slot = { kind: "team"; teamId: TeamId } | { kind: "bye" } | { kind: "unknown" };

const UNKNOWN: Slot = { kind: "unknown" };
const BYE: Slot = { kind: "bye" };

/**
 * Resolve every match's participants from its sources, walking the match DAG in topological
 * order so upstream results are settled first.
 *
 * - A slot facing a bye advances automatically (FINISHED, no score). Two byes give a match that
 *   is not needed (FINISHED, no teams). The loser of a bye is itself a bye.
 * - A grand-final reset (`GRAND_FINAL`, round 2) is not needed when the first final was won by
 *   its home side, the winners-bracket champion.
 * - When participants of a match change, an unplayed match is simply re-resolved; one with a
 *   result (or LIVE) is reset and reported in `invalidated`.
 * - Matches without sources keep the teams they already have.
 *
 * Pure and idempotent: `propagate(propagate(m).matches)` changes nothing.
 *
 * @example
 * const { matches, invalidated } = propagate(bracketWithEditedResult);
 * invalidated; // ["r2m1"] if the semi-final had already been played with the old winner
 */
export function propagate(
  matches: readonly Match[],
  options: PropagateOptions = {},
): PropagationResult {
  const resolved = new Map<MatchId, Match>(matches.map((m) => [m.id, m]));
  const invalidated: MatchId[] = [];

  for (const match of topologicalOrder(matches)) {
    if (match.homeSource === null && match.awaySource === null) continue;
    const slots: [Slot, Slot] = isUnneededReset(match, resolved)
      ? [BYE, BYE]
      : [
          resolveSource(match.homeSource, match.homeTeamId, resolved, options),
          resolveSource(match.awaySource, match.awayTeamId, resolved, options),
        ];
    const next = applySlots(match, slots);
    if (wasInvalidated(match, next)) invalidated.push(match.id);
    resolved.set(match.id, next);
  }

  return {
    matches: matches.map((m) => resolved.get(m.id) as Match),
    invalidated: matches.filter((m) => invalidated.includes(m.id)).map((m) => m.id),
  };
}

function resolveSource(
  source: Source | null,
  currentTeam: TeamId | null,
  resolved: Map<MatchId, Match>,
  options: PropagateOptions,
): Slot {
  if (source === null) return currentTeam === null ? UNKNOWN : team(currentTeam);
  switch (source.type) {
    case "team":
      return team(source.teamId);
    case "bye":
      return BYE;
    case "winner":
      return winnerSlot(resolved.get(source.matchId) as Match);
    case "loser":
      return loserSlot(resolved.get(source.matchId) as Match);
    case "groupRank": {
      const ranking = options.groupRankings?.[source.group];
      if (ranking === undefined) return UNKNOWN;
      const teamId = ranking[source.rank - 1];
      return teamId === undefined ? BYE : team(teamId);
    }
  }
}

function winnerSlot(feeder: Match): Slot {
  if (feeder.status !== "FINISHED") return UNKNOWN;
  if (hasResult(feeder)) return feeder.winnerTeamId === null ? UNKNOWN : team(feeder.winnerTeamId);
  return feeder.winnerTeamId === null ? BYE : team(feeder.winnerTeamId);
}

function loserSlot(feeder: Match): Slot {
  if (feeder.status !== "FINISHED") return UNKNOWN;
  if (!hasResult(feeder)) return BYE;
  const loser = loserOf(feeder);
  return loser === null ? UNKNOWN : team(loser);
}

function isUnneededReset(match: Match, resolved: Map<MatchId, Match>): boolean {
  if (match.bracket !== "GRAND_FINAL" || match.round !== 2 || match.awaySource?.type !== "winner")
    return false;
  const first = resolved.get(match.awaySource.matchId) as Match;
  return first.status === "FINISHED" && hasResult(first) && first.winnerTeamId === first.homeTeamId;
}

/** The match as it should be given its resolved slots. */
function applySlots(match: Match, [home, away]: [Slot, Slot]): Match {
  const homeTeamId = home.kind === "team" ? home.teamId : null;
  const awayTeamId = away.kind === "team" ? away.teamId : null;
  const cleared = {
    ...match,
    homeTeamId,
    awayTeamId,
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
  };

  if (home.kind === "unknown" || away.kind === "unknown") return { ...cleared, status: "PENDING" };
  if (home.kind === "bye" || away.kind === "bye") {
    return { ...cleared, status: "FINISHED", winnerTeamId: homeTeamId ?? awayTeamId };
  }
  const unchanged = match.homeTeamId === homeTeamId && match.awayTeamId === awayTeamId;
  const wasAutoFinished = match.status === "FINISHED" && !hasResult(match);
  if (unchanged && match.status !== "PENDING" && !wasAutoFinished) return match;
  return { ...cleared, status: "SCHEDULED" };
}

/** A result (or a live game) was thrown away because the participants changed. */
function wasInvalidated(before: Match, after: Match): boolean {
  if (after === before) return false;
  return hasResult(before) || before.status === "LIVE";
}

function team(teamId: TeamId): Slot {
  return { kind: "team", teamId };
}

function feederIds(match: Match): MatchId[] {
  return [match.homeSource, match.awaySource].flatMap((s) =>
    s !== null && (s.type === "winner" || s.type === "loser") ? [s.matchId] : [],
  );
}

/** Kahn's algorithm; ties keep input order. Throws on unknown references and cycles. */
function topologicalOrder(matches: readonly Match[]): Match[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const pending = new Map<MatchId, number>();
  const dependents = new Map<MatchId, MatchId[]>();
  for (const match of matches) {
    const feeders = feederIds(match);
    for (const feeder of feeders) {
      if (!byId.has(feeder))
        throw new Error(`Match ${match.id} references unknown match ${feeder}`);
      dependents.set(feeder, [...(dependents.get(feeder) ?? []), match.id]);
    }
    pending.set(match.id, feeders.length);
  }

  const ready = matches.filter((m) => pending.get(m.id) === 0).map((m) => m.id);
  const order: Match[] = [];
  while (ready.length > 0) {
    const id = ready.shift() as MatchId;
    order.push(byId.get(id) as Match);
    for (const dependent of dependents.get(id) ?? []) {
      const left = (pending.get(dependent) as number) - 1;
      pending.set(dependent, left);
      if (left === 0) ready.push(dependent);
    }
  }
  if (order.length !== matches.length) throw new Error("Match sources contain a cycle");
  return order;
}
