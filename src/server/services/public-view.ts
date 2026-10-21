import { computeStandings } from "@/engine/standings";
import { swissStandings } from "@/engine/swiss";
import { championOf, type PublicMatch, type PublicStage, type PublicView } from "@/lib/public-view";
import { isLeagueStageType, standingsConfigOf } from "@/lib/tournament-config";
import type { Tx } from "../db";
import { ServiceError } from "../errors";
import {
  loadAggregate,
  type StoredMatch,
  type StoredStage,
  type TournamentAggregate,
} from "../repositories/tournament-repository";

/**
 * Read-only view of a tournament for the public page: matches plus standings derived from the
 * results. Contains no admin token hash and no internal tournament id.
 */
export async function getPublicView(db: Tx, slug: string): Promise<PublicView> {
  const row = await db.tournament.findUnique({ where: { slug }, select: { id: true } });
  if (!row) throw new ServiceError("NOT_FOUND", "Tournament not found");
  const aggregate = await loadAggregate(db, row.id);
  const venues = await db.venue.findMany({
    where: { tournamentId: row.id },
    orderBy: { name: "asc" },
  });
  return toPublicView(aggregate, venues);
}

export function toPublicView(
  aggregate: TournamentAggregate,
  venues: Array<{ id: string; name: string }>,
): PublicView {
  const { tournament, teams } = aggregate;
  const { config } = tournament;
  const stages = aggregate.stages.map((stage) => toPublicStage(stage, aggregate));
  return {
    tournament: {
      slug: tournament.slug,
      name: tournament.name,
      sport: tournament.sport,
      status: tournament.status,
      format: config.format,
      rules: {
        legs: config.legs,
        pointsForWin: config.pointsForWin,
        pointsForDraw: config.pointsForDraw,
        pointsForLoss: config.pointsForLoss,
        tiebreakers: [...config.tiebreakers],
        thirdPlaceMatch: config.thirdPlaceMatch,
        grandFinalReset: config.grandFinalReset,
        groups: config.groups ?? null,
        advancePerGroup: config.advancePerGroup ?? null,
      },
      createdAt: tournament.createdAt.toISOString(),
    },
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      seed: t.seed,
      groupLabel: t.groupLabel ?? null,
    })),
    venues: venues.map((v) => ({ id: v.id, name: v.name })),
    stages,
    championTeamId: championOf(stages, tournament.status),
  };
}

function toPublicStage(stage: StoredStage, aggregate: TournamentAggregate): PublicStage {
  const members =
    stage.type === "GROUP"
      ? aggregate.teams.filter((t) => t.groupLabel === stage.groupLabel)
      : aggregate.teams;
  return {
    id: stage.id,
    order: stage.order,
    type: stage.type,
    groupLabel: stage.groupLabel,
    standings: !isLeagueStageType(stage.type)
      ? null
      : stage.type === "SWISS"
        ? swissStandings(members, stage.matches, standingsConfigOf(aggregate.tournament.config))
        : computeStandings(members, stage.matches, standingsConfigOf(aggregate.tournament.config)),
    matches: stage.matches.map(toPublicMatch),
  };
}

function toPublicMatch(m: StoredMatch): PublicMatch {
  return {
    id: m.id,
    round: m.round,
    position: m.position,
    bracket: m.bracket,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeSource: m.homeSource,
    awaySource: m.awaySource,
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    winnerTeamId: m.winnerTeamId,
    decidedBy: m.decidedBy,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    venueId: m.venueId,
    version: m.version,
  };
}
