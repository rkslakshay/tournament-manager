import { pairSwissRound } from "@/engine/swiss";
import type { Match } from "@/engine/types";
import { standingsConfigOf } from "@/lib/tournament-config";
import type { TournamentAggregate } from "../repositories/tournament-repository";

/**
 * The next Swiss round's matches, if the latest round has just been completed and rounds remain;
 * otherwise an empty list. Pairing uses the standings including the results just saved.
 * Pairings already made are never redone, even if an earlier result is edited later.
 */
export function nextSwissRound(aggregate: TournamentAggregate, matches: readonly Match[]): Match[] {
  const stage = aggregate.stages.find((s) => s.type === "SWISS");
  const totalRounds = aggregate.tournament.config.swissRounds;
  if (!stage || totalRounds === undefined) return [];
  const swissMatches = matches.filter((m) => m.stageId === stage.id);
  const latest = Math.max(0, ...swissMatches.map((m) => m.round));
  if (latest >= totalRounds) return [];
  if (!swissMatches.every((m) => m.status === "FINISHED")) return [];
  return pairSwissRound(
    aggregate.teams,
    swissMatches,
    standingsConfigOf(aggregate.tournament.config),
    {
      round: latest + 1,
      stageId: stage.id,
      idPrefix: `${aggregate.tournament.id}-`,
    },
  ).matches;
}
