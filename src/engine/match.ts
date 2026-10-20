import type { BracketSide, Match, MatchId, Source, StageId, TeamId } from "./types";

/**
 * Build a match with sensible defaults: no teams, no result, PENDING.
 *
 * @example
 * createMatch({ id: "r1m1", stageId: "s1", round: 1, position: 1 }).status; // "PENDING"
 */
export function createMatch(fields: {
  id: MatchId;
  stageId: StageId;
  round: number;
  position: number;
  bracket?: BracketSide | null;
  homeTeamId?: TeamId | null;
  awayTeamId?: TeamId | null;
  homeSource?: Source | null;
  awaySource?: Source | null;
}): Match {
  const homeTeamId = fields.homeTeamId ?? null;
  const awayTeamId = fields.awayTeamId ?? null;
  return {
    id: fields.id,
    stageId: fields.stageId,
    round: fields.round,
    position: fields.position,
    bracket: fields.bracket ?? null,
    homeTeamId,
    awayTeamId,
    homeSource: fields.homeSource ?? null,
    awaySource: fields.awaySource ?? null,
    status: homeTeamId !== null && awayTeamId !== null ? "SCHEDULED" : "PENDING",
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
  };
}

/**
 * True when the match has a real, entered result (as opposed to a bye or an auto-finished slot).
 *
 * @example
 * hasResult({ ...match, homeScore: 2, awayScore: 1 }); // true
 */
export function hasResult(match: Match): boolean {
  return match.homeScore !== null && match.awayScore !== null;
}

/**
 * True when the match was finished automatically because a participant slot is empty (a bye).
 *
 * @example
 * isBye({ ...match, status: "FINISHED", homeTeamId: "a", awayTeamId: null }); // true
 */
export function isBye(match: Match): boolean {
  return (
    match.status === "FINISHED" &&
    !hasResult(match) &&
    (match.homeTeamId === null || match.awayTeamId === null)
  );
}

/**
 * The losing team of a finished match with a real result, or null otherwise.
 *
 * @example
 * loserOf({ ...match, homeTeamId: "a", awayTeamId: "b", winnerTeamId: "a", ... }); // "b"
 */
export function loserOf(match: Match): TeamId | null {
  if (match.status !== "FINISHED" || match.winnerTeamId === null) return null;
  if (match.homeTeamId === null || match.awayTeamId === null) return null;
  return match.winnerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
}
