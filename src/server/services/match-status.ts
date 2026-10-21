import type { MatchId } from "@/engine/types";
import type { MatchStatusBody } from "@/lib/api-schemas";
import type { TournamentStatus } from "@/lib/tournament-config";
import type { Db } from "../db";
import { ServiceError } from "../errors";
import { eventHub } from "../events";
import { assertStatus } from "../lifecycle";

/**
 * Mark a match as being played (LIVE) or back to not started (SCHEDULED). Only matches with both
 * participants known and no result can change. Uses the same optimistic version check as
 * results, and notifies live viewers after the commit.
 */
export async function setMatchStatus(
  db: Db,
  tournamentId: string,
  matchId: MatchId,
  input: MatchStatusBody,
): Promise<{ status: "SCHEDULED" | "LIVE"; version: number }> {
  const { slug, version } = await db.$transaction(async (tx) => {
    const tournament = await tx.tournament.findUnique({ where: { id: tournamentId } });
    if (!tournament) throw new ServiceError("NOT_FOUND", "Tournament not found");
    assertStatus(
      tournament.status as TournamentStatus,
      ["IN_PROGRESS"],
      "The tournament is not in progress",
    );

    const match = await tx.match.findFirst({ where: { id: matchId, stage: { tournamentId } } });
    if (!match) throw new ServiceError("NOT_FOUND", "Match not found");
    if (input.expectedVersion !== undefined && input.expectedVersion !== match.version) {
      throw new ServiceError(
        "VERSION_CONFLICT",
        "This match was changed by someone else. Reload to see the latest result.",
        { matchId, currentVersion: match.version },
      );
    }
    if (match.status !== "SCHEDULED" && match.status !== "LIVE") {
      throw new ServiceError(
        "INVALID_STATE",
        "Only scheduled matches without a result can go live",
      );
    }

    const { count } = await tx.match.updateMany({
      where: { id: matchId, version: match.version },
      data: { status: input.status, version: { increment: 1 } },
    });
    if (count === 0) {
      throw new ServiceError(
        "VERSION_CONFLICT",
        "This match was changed by someone else. Reload to see the latest result.",
        {
          matchId,
        },
      );
    }
    return { slug: tournament.slug, version: match.version + 1 };
  });
  eventHub.publish(slug, { type: "match_updated", matchIds: [matchId] });
  return { status: input.status, version };
}
