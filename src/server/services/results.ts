import { z } from "zod";
import { resolveGroupRankings } from "@/engine/group-knockout";
import { isBye } from "@/engine/match";
import { propagate } from "@/engine/propagation";
import type { Match, MatchId, Stage } from "@/engine/types";
import {
  isLeagueStageType,
  standingsConfigOf,
  type TournamentStatus,
} from "@/lib/tournament-config";
import type { Db, Tx } from "../db";
import { ServiceError } from "../errors";
import { assertStatus } from "../lifecycle";
import {
  loadAggregate,
  toMatchResultData,
  type StoredMatch,
  type TournamentAggregate,
} from "../repositories/tournament-repository";

const score = z.number().int().min(0).max(999);

export const resultInputSchema = z.object({
  homeScore: score,
  awayScore: score,
  /** Required to apply an edit that resets downstream matches (RESET_DOWNSTREAM policy). */
  confirmReset: z.boolean().optional(),
});

export type ResultInput = z.infer<typeof resultInputSchema>;

export interface InvalidatedMatch {
  id: MatchId;
  round: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

export interface ResultOutcome {
  /** Every match whose row changed, including the one that was scored. */
  changedMatchIds: MatchId[];
  /** Downstream matches whose results were reset by this edit. */
  resetMatchIds: MatchId[];
  status: TournamentStatus;
}

const RESULT_STATES: readonly TournamentStatus[] = ["IN_PROGRESS", "COMPLETED"];

/**
 * Record a new result or edit an existing one.
 *
 * Runs in one transaction: validate, apply the score, re-resolve every bracket slot with
 * `propagate` (group rankings included), then persist each changed match and bump its version.
 *
 * Edits that change the participants of matches that already have results follow the
 * tournament's edit policy. BLOCK_EDIT refuses them (EDIT_BLOCKED). RESET_DOWNSTREAM refuses
 * with CONFIRMATION_REQUIRED (listing the affected matches) unless `confirmReset` is set, in
 * which case those results are cleared. The tournament becomes COMPLETED when every match is
 * finished, and returns to IN_PROGRESS if an edit re-opens matches.
 */
export async function recordResult(
  db: Db,
  tournamentId: string,
  matchId: MatchId,
  input: ResultInput,
): Promise<ResultOutcome> {
  const parsed = resultInputSchema.safeParse(input);
  if (!parsed.success)
    throw new ServiceError("VALIDATION", "Invalid score", parsed.error.flatten());
  const { homeScore, awayScore, confirmReset } = parsed.data;

  return db.$transaction(async (tx) => {
    const aggregate = await loadAggregate(tx, tournamentId);
    const { tournament } = aggregate;
    assertStatus(
      tournament.status,
      RESULT_STATES,
      "Results can only be entered once the tournament has started",
    );

    const stage = aggregate.stages.find((s) => s.matches.some((m) => m.id === matchId));
    const match = stage?.matches.find((m) => m.id === matchId);
    if (!stage || !match) throw new ServiceError("NOT_FOUND", "Match not found");
    assertScorable(match);
    if (homeScore === awayScore && !isLeagueStageType(stage.type)) {
      throw new ServiceError("VALIDATION", "Knockout matches need a winner: draws are not allowed");
    }

    const scored: StoredMatch = {
      ...match,
      status: "FINISHED",
      homeScore,
      awayScore,
      winnerTeamId:
        homeScore > awayScore ? match.homeTeamId : awayScore > homeScore ? match.awayTeamId : null,
    };
    const before = aggregate.stages.flatMap((s) => s.matches);
    const withScore = before.map((m) => (m.id === matchId ? scored : m));
    const { matches: after, invalidated } = propagate(withScore, {
      groupRankings: groupRankings(aggregate, withScore),
    });

    if (invalidated.length > 0) enforceEditPolicy(aggregate, invalidated, confirmReset === true);

    const previous = new Map(before.map((m) => [m.id, m]));
    const changed = after.filter((m) => resultChanged(previous.get(m.id) as StoredMatch, m));
    for (const m of changed) {
      await tx.match.update({
        where: { id: m.id },
        data: { ...toMatchResultData(m), version: { increment: 1 } },
      });
    }
    const status = await updateCompletion(tx, tournamentId, tournament.status, after);
    return { changedMatchIds: changed.map((m) => m.id), resetMatchIds: invalidated, status };
  });
}

/**
 * Same as `recordResult`, but only for a match that already has a result. Kept separate so
 * callers can state their intent; the edit policy is applied either way.
 */
export async function editResult(
  db: Db,
  tournamentId: string,
  matchId: MatchId,
  input: ResultInput,
): Promise<ResultOutcome> {
  const match = await db.match.findFirst({ where: { id: matchId, stage: { tournamentId } } });
  if (!match) throw new ServiceError("NOT_FOUND", "Match not found");
  if (match.homeScore === null || match.awayScore === null) {
    throw new ServiceError("INVALID_STATE", "This match has no result to edit yet");
  }
  return recordResult(db, tournamentId, matchId, input);
}

function assertScorable(match: Match): void {
  if (isBye(match))
    throw new ServiceError("INVALID_STATE", "This match is a bye and has no result");
  if (match.homeTeamId === null || match.awayTeamId === null) {
    throw new ServiceError(
      "INVALID_STATE",
      "Both participants must be known before entering a result",
    );
  }
}

function groupRankings(aggregate: TournamentAggregate, matches: readonly Match[]) {
  const byStage = new Map<string, Match[]>();
  for (const m of matches) byStage.set(m.stageId, [...(byStage.get(m.stageId) ?? []), m]);
  const groupStages: Stage[] = aggregate.stages
    .filter((s) => s.type === "GROUP")
    .map((s) => ({ ...s, matches: byStage.get(s.id) ?? [] }));
  return resolveGroupRankings(
    groupStages,
    aggregate.teams,
    standingsConfigOf(aggregate.tournament.config),
  );
}

function enforceEditPolicy(
  aggregate: TournamentAggregate,
  invalidated: MatchId[],
  confirmed: boolean,
): void {
  const before = new Map(aggregate.stages.flatMap((s) => s.matches).map((m) => [m.id, m]));
  const details: { invalidated: InvalidatedMatch[] } = {
    invalidated: invalidated.map((id) => {
      const m = before.get(id) as Match;
      return { id, round: m.round, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId };
    }),
  };
  if (aggregate.tournament.config.editPolicy === "BLOCK_EDIT") {
    throw new ServiceError(
      "EDIT_BLOCKED",
      "This edit would change matches that already have results",
      details,
    );
  }
  if (!confirmed) {
    throw new ServiceError(
      "CONFIRMATION_REQUIRED",
      `This edit resets ${invalidated.length} later result(s). Confirm to continue.`,
      details,
    );
  }
}

function resultChanged(before: Match, after: Match): boolean {
  return (
    before.status !== after.status ||
    before.homeTeamId !== after.homeTeamId ||
    before.awayTeamId !== after.awayTeamId ||
    before.homeScore !== after.homeScore ||
    before.awayScore !== after.awayScore ||
    before.winnerTeamId !== after.winnerTeamId
  );
}

async function updateCompletion(
  tx: Tx,
  tournamentId: string,
  current: TournamentStatus,
  matches: readonly Match[],
): Promise<TournamentStatus> {
  const next: TournamentStatus = matches.every((m) => m.status === "FINISHED")
    ? "COMPLETED"
    : "IN_PROGRESS";
  if (next !== current)
    await tx.tournament.update({ where: { id: tournamentId }, data: { status: next } });
  return next;
}
