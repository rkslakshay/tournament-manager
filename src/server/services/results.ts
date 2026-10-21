import {
  forfeitBody,
  resultBody,
  type DecidedBy,
  type ForfeitBody,
  type ResultBody,
} from "@/lib/api-schemas";
import { resolveGroupRankings } from "@/engine/group-knockout";
import { isBye } from "@/engine/match";
import { propagate } from "@/engine/propagation";
import type { Match, MatchId, Stage } from "@/engine/types";
import { decideResult } from "@/lib/result-rules";
import {
  isLeagueStageType,
  standingsConfigOf,
  type TournamentConfig,
  type TournamentStatus,
} from "@/lib/tournament-config";
import type { Db, Tx } from "../db";
import { ServiceError } from "../errors";
import { eventHub } from "../events";
import { assertStatus } from "../lifecycle";
import { nextSwissRound } from "./swiss-rounds";
import {
  loadAggregate,
  toMatchCreateData,
  toMatchResultData,
  type StoredMatch,
  type StoredStage,
  type TournamentAggregate,
} from "../repositories/tournament-repository";

export type ResultInput = ResultBody;

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

/** The decided outcome of one match, computed once the match and its stage are loaded. */
interface Outcome {
  homeScore: number;
  awayScore: number;
  winnerTeamId: string | null;
  decidedBy: DecidedBy;
}

interface ApplyOptions {
  expectedVersion?: number;
  confirmReset?: boolean;
  decide: (match: StoredMatch, stage: StoredStage, config: TournamentConfig) => Outcome;
}

/**
 * Record a new result or edit an existing one.
 *
 * Runs in one transaction: validate, apply the score, re-resolve every bracket slot with
 * `propagate` (group rankings included), then persist each changed match and bump its version.
 * After the commit, live viewers are notified with a `match_updated` event.
 *
 * Edits that change the participants of matches that already have results follow the
 * tournament's edit policy. BLOCK_EDIT refuses them (EDIT_BLOCKED). RESET_DOWNSTREAM refuses
 * with CONFIRMATION_REQUIRED (listing the affected matches) unless `confirmReset` is set, in
 * which case those results are cleared. The tournament becomes COMPLETED when every match is
 * finished, and returns to IN_PROGRESS if an edit re-opens matches. In a Swiss event, completing
 * a round pairs the next one in the same transaction.
 */
export async function recordResult(
  db: Db,
  tournamentId: string,
  matchId: MatchId,
  input: ResultInput,
): Promise<ResultOutcome> {
  const parsed = resultBody.safeParse(input);
  if (!parsed.success)
    throw new ServiceError("VALIDATION", "Invalid score", parsed.error.flatten());
  const { homeScore, awayScore, decidedBy, winnerTeamId, confirmReset, expectedVersion } =
    parsed.data;

  return applyResult(db, tournamentId, matchId, {
    expectedVersion,
    confirmReset,
    decide: (match, stage) => {
      const decision = decideResult(
        { homeScore, awayScore, decidedBy, winnerTeamId },
        match,
        isLeagueStageType(stage.type),
      );
      if (!decision.ok) throw new ServiceError("VALIDATION", decision.message);
      return {
        homeScore,
        awayScore,
        winnerTeamId: decision.winnerTeamId,
        decidedBy: decision.decidedBy,
      };
    },
  });
}

/**
 * Record a forfeit: `teamId` gives up the match and the opponent wins by walkover with the
 * tournament's walkover score (3-0 by default). It is stored as an ordinary result marked
 * `WALKOVER`, so standings and brackets treat it exactly like a played match, and edits follow
 * the same edit policy.
 */
export async function forfeitMatch(
  db: Db,
  tournamentId: string,
  matchId: MatchId,
  input: ForfeitBody,
): Promise<ResultOutcome> {
  const parsed = forfeitBody.safeParse(input);
  if (!parsed.success)
    throw new ServiceError("VALIDATION", "Invalid forfeit", parsed.error.flatten());
  const { teamId, confirmReset, expectedVersion } = parsed.data;

  return applyResult(db, tournamentId, matchId, {
    expectedVersion,
    confirmReset,
    decide: (match, _stage, config) => {
      if (teamId !== match.homeTeamId && teamId !== match.awayTeamId) {
        throw new ServiceError("VALIDATION", "That team is not playing in this match");
      }
      const { winner, loser } = config.walkoverScore;
      const homeForfeits = teamId === match.homeTeamId;
      return {
        homeScore: homeForfeits ? loser : winner,
        awayScore: homeForfeits ? winner : loser,
        winnerTeamId: homeForfeits ? match.awayTeamId : match.homeTeamId,
        decidedBy: "WALKOVER",
      };
    },
  });
}

async function applyResult(
  db: Db,
  tournamentId: string,
  matchId: MatchId,
  options: ApplyOptions,
): Promise<ResultOutcome> {
  const { slug, outcome } = await db.$transaction(async (tx) => {
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
    assertCurrentVersion(match, options.expectedVersion);
    assertScorable(match);

    const scored: StoredMatch = {
      ...match,
      ...options.decide(match, stage, tournament.config),
      status: "FINISHED",
    };
    const before = aggregate.stages.flatMap((s) => s.matches);
    const withScore = before.map((m) => (m.id === matchId ? scored : m));
    const { matches: after, invalidated } = propagate(withScore, {
      groupRankings: groupRankings(aggregate, withScore),
    });

    if (invalidated.length > 0) {
      enforceEditPolicy(aggregate, invalidated, options.confirmReset === true);
    }

    const previous = new Map(before.map((m) => [m.id, m]));
    const changed = (after as StoredMatch[]).filter((m) =>
      resultChanged(previous.get(m.id) as StoredMatch, m),
    );
    for (const m of changed) {
      // The version condition catches a concurrent write that landed after we loaded the match.
      const { count } = await tx.match.updateMany({
        where: { id: m.id, version: (previous.get(m.id) as StoredMatch).version },
        data: { ...toMatchResultData(m), version: { increment: 1 } },
      });
      if (count === 0) throw versionConflict(m.id);
    }
    const nextRound = nextSwissRound(aggregate, after);
    if (nextRound.length > 0) await tx.match.createMany({ data: nextRound.map(toMatchCreateData) });
    const status = await updateCompletion(tx, tournamentId, tournament.status, [
      ...after,
      ...nextRound,
    ]);
    return {
      slug: tournament.slug,
      outcome: {
        changedMatchIds: [...changed, ...nextRound].map((m) => m.id),
        resetMatchIds: invalidated,
        status,
      },
    };
  });
  eventHub.publish(slug, { type: "match_updated", matchIds: outcome.changedMatchIds });
  return outcome;
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

function assertCurrentVersion(match: StoredMatch, expectedVersion: number | undefined): void {
  if (expectedVersion !== undefined && expectedVersion !== match.version) {
    throw versionConflict(match.id, match.version);
  }
}

function versionConflict(matchId: MatchId, currentVersion?: number): ServiceError {
  return new ServiceError(
    "VERSION_CONFLICT",
    "This match was changed by someone else. Reload to see the latest result.",
    { matchId, currentVersion },
  );
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

function resultChanged(before: StoredMatch, after: StoredMatch): boolean {
  return (
    before.decidedBy !== (after.homeScore === null ? null : after.decidedBy) ||
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
