/**
 * Core domain types for the tournament engine.
 *
 * Every type here is a plain, serialisable object so engine functions can take and return
 * data without touching the database or the network.
 */

export type TeamId = string;
export type MatchId = string;
export type StageId = string;

/** A participant. `seed` is 1-based: seed 1 is the strongest team. */
export interface Team {
  id: TeamId;
  name: string;
  seed: number;
  groupLabel?: string | null;
}

export type MatchStatus = "PENDING" | "SCHEDULED" | "LIVE" | "FINISHED";

export type BracketSide = "WINNERS" | "LOSERS" | "GRAND_FINAL";

export type StageType = "ROUND_ROBIN" | "SINGLE_ELIM" | "DOUBLE_ELIM" | "GROUP" | "SWISS";

/**
 * Where a match participant comes from. Brackets are a DAG of matches linked by sources.
 *
 * @example
 * const fromSemi: Source = { type: "winner", matchId: "r2m1" };
 */
export type Source =
  | { type: "team"; teamId: TeamId }
  | { type: "winner"; matchId: MatchId }
  | { type: "loser"; matchId: MatchId }
  | { type: "groupRank"; group: string; rank: number }
  | { type: "bye" };

/**
 * A match in any format.
 *
 * Bye convention: a match that is FINISHED with exactly one known team and no scores is a bye
 * (that team advances). FINISHED with no teams means "no match needed" (a double bye, or a
 * grand-final reset that was not required).
 */
export interface Match {
  id: MatchId;
  stageId: StageId;
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
}

/** A single round-robin pairing before it becomes a persisted match. */
export interface Fixture {
  round: number;
  /** 1 or 2: second legs mirror the first with home and away swapped. */
  leg: number;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
}

/** A team sitting out a round-robin round because the team count is odd. */
export interface Bye {
  round: number;
  teamId: TeamId;
}

export type Tiebreaker =
  "points" | "headToHead" | "goalDifference" | "goalsFor" | "wins" | "seed" | "alphabetical";

export interface StandingsConfig {
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  /** Applied in order. Ties left after the chain are broken by team id. */
  tiebreakers: Tiebreaker[];
}

export interface StandingRow {
  teamId: TeamId;
  /** 1-based position in the table. Always unique (the tiebreaker chain is total). */
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/** A stage of a tournament with its matches, as produced by a generator. */
export interface Stage {
  id: StageId;
  order: number;
  type: StageType;
  /** Group label for GROUP stages ("A", "B", ...), otherwise null. */
  groupLabel: string | null;
  matches: Match[];
}

export const DEFAULT_TIEBREAKERS: readonly Tiebreaker[] = [
  "points",
  "headToHead",
  "goalDifference",
  "goalsFor",
  "wins",
  "seed",
  "alphabetical",
];

export const DEFAULT_STANDINGS_CONFIG: StandingsConfig = {
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  tiebreakers: [...DEFAULT_TIEBREAKERS],
};
