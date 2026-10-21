import { z } from "zod";
import { MAX_TEAMS, tournamentConfigSchema } from "./tournament-config";

/** Request bodies for every write endpoint. Shared by API routes and client forms. */

export const createTournamentBody = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  sport: z.string().trim().min(1, "Sport is required").max(50),
  config: tournamentConfigSchema,
});

export const teamName = z.string().trim().min(1, "Team name is required").max(60);

export const addTeamsBody = z.object({
  names: z.array(teamName).min(1, "Add at least one team").max(MAX_TEAMS),
});

export const reorderTeamsBody = z.object({
  teamIds: z.array(z.string().min(1)).min(1).max(MAX_TEAMS),
});

const score = z.number().int().min(0).max(999);

export const resultBody = z.object({
  homeScore: score,
  awayScore: score,
  confirmReset: z.boolean().optional(),
  expectedVersion: z.number().int().min(0).optional(),
});

export const scheduleBody = z.object({
  venues: z.array(z.string().trim().min(1).max(60)).min(1, "Add at least one venue").max(32),
  /** ISO date-time of the first slot. */
  startTime: z.string().datetime({ offset: true }),
  slotMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  minRestSlots: z.number().int().min(0).max(10).default(0),
});

export type CreateTournamentBody = z.infer<typeof createTournamentBody>;
export type ResultBody = z.infer<typeof resultBody>;
export type ScheduleBody = z.infer<typeof scheduleBody>;

/** Error body returned by every endpoint on failure. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
