import type {
  BracketSide,
  MatchStatus,
  Source,
  StageType,
  StandingRow,
  TeamId,
} from "@/engine/types";
import type { Format, TournamentStatus } from "./tournament-config";

/** Everything a viewer needs, safe to expose publicly (no admin token or hash). */
export interface PublicView {
  tournament: {
    slug: string;
    name: string;
    sport: string;
    status: TournamentStatus;
    format: Format;
    rules: {
      legs: number;
      pointsForWin: number;
      pointsForDraw: number;
      pointsForLoss: number;
      tiebreakers: string[];
      thirdPlaceMatch: boolean;
      grandFinalReset: boolean;
      groups: number | null;
      advancePerGroup: number | null;
    };
    createdAt: string;
  };
  teams: PublicTeam[];
  venues: Array<{ id: string; name: string }>;
  stages: PublicStage[];
  championTeamId: TeamId | null;
}

export interface PublicTeam {
  id: TeamId;
  name: string;
  seed: number;
  groupLabel: string | null;
}

export interface PublicStage {
  id: string;
  order: number;
  type: StageType;
  groupLabel: string | null;
  /** League table for ROUND_ROBIN and GROUP stages, derived from results; null otherwise. */
  standings: StandingRow[] | null;
  matches: PublicMatch[];
}

export interface PublicMatch {
  id: string;
  round: number;
  position: number;
  bracket: BracketSide | null;
  homeTeamId: TeamId | null;
  awayTeamId: TeamId | null;
  homeSource: Source | null;
  awaySource: Source | null;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: TeamId | null;
  scheduledAt: string | null;
  venueId: string | null;
  version: number;
}

/**
 * The champion once it is decided: the knockout final's winner (the grand-final reset's
 * winner if it was played, in double elimination), or the league leader of a completed
 * round robin.
 *
 * @example
 * championOf(view.stages, "COMPLETED"); // "team-id" or null
 */
export function championOf(
  stages: readonly PublicStage[],
  status: TournamentStatus,
): TeamId | null {
  const last = [...stages].sort((a, b) => b.order - a.order)[0];
  if (!last) return null;
  if (last.type === "ROUND_ROBIN") {
    return status === "COMPLETED" ? (last.standings?.[0]?.teamId ?? null) : null;
  }
  if (last.type === "DOUBLE_ELIM") {
    const reset = last.matches.find((m) => m.bracket === "GRAND_FINAL" && m.round === 2);
    if (reset?.winnerTeamId) return reset.winnerTeamId;
    const first = last.matches.find((m) => m.bracket === "GRAND_FINAL" && m.round === 1);
    const resetDecided = !reset || (reset.status === "FINISHED" && reset.homeTeamId === null);
    return resetDecided ? (first?.winnerTeamId ?? null) : null;
  }
  const finalRound = Math.max(...last.matches.map((m) => m.round));
  const final = last.matches.find((m) => m.round === finalRound && m.position === 1);
  return final?.winnerTeamId ?? null;
}
