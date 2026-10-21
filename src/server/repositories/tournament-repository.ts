import { Prisma } from "@prisma/client";
import type {
  Match as MatchRow,
  Stage as StageRow,
  Team as TeamRow,
  Tournament as TournamentRow,
} from "@prisma/client";
import { z } from "zod";
import type { BracketSide, Match, MatchStatus, Source, StageType, Team } from "@/engine/types";
import {
  parseTournamentConfig,
  type TournamentConfig,
  type TournamentStatus,
} from "@/lib/tournament-config";
import type { Tx } from "../db";
import { notFound } from "../errors";

export interface TournamentRecord {
  id: string;
  slug: string;
  name: string;
  sport: string;
  status: TournamentStatus;
  config: TournamentConfig;
  createdAt: Date;
}

/** An engine match plus the persistence-only fields. */
export interface StoredMatch extends Match {
  version: number;
  scheduledAt: Date | null;
  venueId: string | null;
}

export interface StoredStage {
  id: string;
  order: number;
  type: StageType;
  groupLabel: string | null;
  matches: StoredMatch[];
}

export interface TournamentAggregate {
  tournament: TournamentRecord;
  teams: Team[];
  stages: StoredStage[];
}

const sourceSchema: z.ZodType<Source> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("team"), teamId: z.string() }),
  z.object({ type: z.literal("winner"), matchId: z.string() }),
  z.object({ type: z.literal("loser"), matchId: z.string() }),
  z.object({ type: z.literal("groupRank"), group: z.string(), rank: z.number().int() }),
  z.object({ type: z.literal("bye") }),
]);

const stageConfigSchema = z
  .object({ groupLabel: z.string().nullable().default(null) })
  .passthrough();

export function toTournamentRecord(row: TournamentRow): TournamentRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sport: row.sport,
    status: row.status as TournamentStatus,
    config: parseTournamentConfig(row.config),
    createdAt: row.createdAt,
  };
}

export function toTeam(row: TeamRow): Team {
  return { id: row.id, name: row.name, seed: row.seed, groupLabel: row.groupLabel };
}

export function toStoredMatch(row: MatchRow): StoredMatch {
  return {
    id: row.id,
    stageId: row.stageId,
    round: row.round,
    position: row.position,
    bracket: row.bracket as BracketSide | null,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    homeSource: row.homeSource === null ? null : sourceSchema.parse(row.homeSource),
    awaySource: row.awaySource === null ? null : sourceSchema.parse(row.awaySource),
    status: row.status as MatchStatus,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    winnerTeamId: row.winnerTeamId,
    version: row.version,
    scheduledAt: row.scheduledAt,
    venueId: row.venueId,
  };
}

export function toStoredStage(row: StageRow & { matches: MatchRow[] }): StoredStage {
  return {
    id: row.id,
    order: row.order,
    type: row.type as StageType,
    groupLabel: stageConfigSchema.parse(row.config).groupLabel,
    matches: [...row.matches].sort(compareMatches).map(toStoredMatch),
  };
}

/** Prisma data for creating a match row from an engine match. */
export function toMatchCreateData(match: Match): Prisma.MatchCreateManyInput {
  return {
    id: match.id,
    stageId: match.stageId,
    round: match.round,
    position: match.position,
    bracket: match.bracket,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeSource: jsonOrNull(match.homeSource),
    awaySource: jsonOrNull(match.awaySource),
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    winnerTeamId: match.winnerTeamId,
  };
}

/** Prisma data for the result-related fields of an existing match. */
export function toMatchResultData(match: Match): Prisma.MatchUpdateInput {
  return {
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    winnerTeamId: match.winnerTeamId,
  };
}

export async function findTournamentBySlug(db: Tx, slug: string): Promise<TournamentRecord> {
  const row = await db.tournament.findUnique({ where: { slug } });
  if (!row) throw notFound("Tournament");
  return toTournamentRecord(row);
}

/** Load a tournament with its teams (by seed) and stages (by order) with their matches. */
export async function loadAggregate(db: Tx, tournamentId: string): Promise<TournamentAggregate> {
  const row = await db.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: { orderBy: { seed: "asc" } },
      stages: { orderBy: { order: "asc" }, include: { matches: true } },
    },
  });
  if (!row) throw notFound("Tournament");
  return {
    tournament: toTournamentRecord(row),
    teams: row.teams.map(toTeam),
    stages: row.stages.map(toStoredStage),
  };
}

function compareMatches(a: MatchRow, b: MatchRow): number {
  const bracketOrder = (m: MatchRow) =>
    ["WINNERS", "LOSERS", "GRAND_FINAL"].indexOf(m.bracket ?? "WINNERS");
  return bracketOrder(a) - bracketOrder(b) || a.round - b.round || a.position - b.position;
}

function jsonOrNull(source: Source | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return source === null ? Prisma.DbNull : (source as Prisma.InputJsonValue);
}
