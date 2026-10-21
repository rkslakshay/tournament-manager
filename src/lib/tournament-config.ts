import { z } from "zod";
import type { StandingsConfig } from "@/engine/types";

export const FORMATS = ["ROUND_ROBIN", "SINGLE_ELIM", "DOUBLE_ELIM", "GROUP_KNOCKOUT"] as const;
export type Format = (typeof FORMATS)[number];

export const FORMAT_LABELS: Record<Format, string> = {
  ROUND_ROBIN: "Round robin (league)",
  SINGLE_ELIM: "Single elimination",
  DOUBLE_ELIM: "Double elimination",
  GROUP_KNOCKOUT: "Groups + knockout",
};

export const TIEBREAKERS = [
  "points",
  "headToHead",
  "goalDifference",
  "goalsFor",
  "wins",
  "seed",
  "alphabetical",
] as const;

export const EDIT_POLICIES = ["RESET_DOWNSTREAM", "BLOCK_EDIT"] as const;
export type EditPolicy = (typeof EDIT_POLICIES)[number];

export const TOURNAMENT_STATUSES = [
  "DRAFT",
  "REGISTRATION",
  "IN_PROGRESS",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 128;

const points = z.number().int().min(-10).max(10);

/** Format and rules of a tournament, stored in the `config` JSON column. */
export const tournamentConfigSchema = z
  .object({
    format: z.enum(FORMATS),
    legs: z.union([z.literal(1), z.literal(2)]).default(1),
    pointsForWin: points.default(3),
    pointsForDraw: points.default(1),
    pointsForLoss: points.default(0),
    tiebreakers: z
      .array(z.enum(TIEBREAKERS))
      .max(TIEBREAKERS.length)
      .refine((list) => new Set(list).size === list.length, "Tiebreakers must not repeat")
      .default([...TIEBREAKERS]),
    thirdPlaceMatch: z.boolean().default(false),
    grandFinalReset: z.boolean().default(true),
    groups: z.number().int().min(1).max(32).optional(),
    advancePerGroup: z.number().int().min(1).max(8).optional(),
    editPolicy: z.enum(EDIT_POLICIES).default("RESET_DOWNSTREAM"),
  })
  .refine(
    (c) =>
      c.format !== "GROUP_KNOCKOUT" || (c.groups !== undefined && c.advancePerGroup !== undefined),
    {
      message: "Groups + knockout needs `groups` and `advancePerGroup`",
      path: ["groups"],
    },
  );

export type TournamentConfig = z.infer<typeof tournamentConfigSchema>;
export type TournamentConfigInput = z.input<typeof tournamentConfigSchema>;

/** Parse stored or submitted config, filling defaults. Throws a ZodError when invalid. */
export function parseTournamentConfig(value: unknown): TournamentConfig {
  return tournamentConfigSchema.parse(value);
}

/** The engine's standings settings taken from a tournament config. */
export function standingsConfigOf(config: TournamentConfig): StandingsConfig {
  return {
    pointsForWin: config.pointsForWin,
    pointsForDraw: config.pointsForDraw,
    pointsForLoss: config.pointsForLoss,
    tiebreakers: [...config.tiebreakers],
  };
}

/** True for formats that produce league tables (and therefore allow draws). */
export function isLeagueStageType(stageType: string): boolean {
  return stageType === "ROUND_ROBIN" || stageType === "GROUP";
}
