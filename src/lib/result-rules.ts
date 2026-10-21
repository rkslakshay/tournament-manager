import type { DecidedBy } from "./api-schemas";

/** Ways an organizer can say a played match was decided (walkovers have their own action). */
export type PlayedDecision = Exclude<DecidedBy, "WALKOVER">;

export interface ResultClaim {
  homeScore: number;
  awayScore: number;
  decidedBy?: PlayedDecision;
  winnerTeamId?: string;
}

export type ResultDecision =
  | { ok: true; winnerTeamId: string | null; decidedBy: PlayedDecision }
  | { ok: false; message: string };

/**
 * Who won a played match, and how, or why the claim is invalid.
 *
 * - League stages (round robin, groups): regular time only; a level score is a draw.
 * - Knockout stages: the higher score wins (`REGULAR` or `EXTRA_TIME`). A level score needs
 *   `PENALTIES` plus the winner, who must be one of the two teams. A winner that contradicts the
 *   score is rejected.
 *
 * @example
 * decideResult({ homeScore: 1, awayScore: 1, decidedBy: "PENALTIES", winnerTeamId: "b" },
 *   { homeTeamId: "a", awayTeamId: "b" }, false); // { ok: true, winnerTeamId: "b", ... }
 */
export function decideResult(
  claim: ResultClaim,
  teams: { homeTeamId: string | null; awayTeamId: string | null },
  league: boolean,
): ResultDecision {
  const { homeScore, awayScore, winnerTeamId } = claim;
  const decidedBy =
    claim.decidedBy ?? (homeScore === awayScore && winnerTeamId ? "PENALTIES" : "REGULAR");
  const level = homeScore === awayScore;
  const byScore =
    homeScore > awayScore ? teams.homeTeamId : awayScore > homeScore ? teams.awayTeamId : null;

  if (league) {
    if (decidedBy !== "REGULAR" || winnerTeamId !== undefined) {
      return {
        ok: false,
        message: "League matches are decided in regular time; draws stand as draws",
      };
    }
    return { ok: true, winnerTeamId: byScore, decidedBy };
  }
  if (decidedBy === "PENALTIES") {
    if (!level)
      return {
        ok: false,
        message: "Penalties only decide matches that are level after extra time",
      };
    if (!winnerTeamId) return { ok: false, message: "Say who won the penalty shoot-out" };
    if (winnerTeamId !== teams.homeTeamId && winnerTeamId !== teams.awayTeamId) {
      return { ok: false, message: "The penalty winner is not playing in this match" };
    }
    return { ok: true, winnerTeamId, decidedBy };
  }
  if (level) {
    return {
      ok: false,
      message: "Knockout matches need a winner: draws are not allowed unless decided on penalties",
    };
  }
  if (winnerTeamId !== undefined && winnerTeamId !== byScore) {
    return { ok: false, message: "The winner must be the team with the higher score" };
  }
  return { ok: true, winnerTeamId: byScore, decidedBy };
}
