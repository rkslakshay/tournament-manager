import { scheduleMatches } from "@/engine/scheduler";
import type { MatchId } from "@/engine/types";
import type { ScheduleBody } from "@/lib/api-schemas";
import type { Db } from "../db";
import { eventHub } from "../events";
import { assertStatus } from "../lifecycle";
import { loadAggregate } from "../repositories/tournament-repository";

export interface ScheduleOutcome {
  scheduled: number;
  unscheduled: MatchId[];
}

/**
 * Run the auto-scheduler: replace the tournament's venues, assign every open match a start time
 * (`startTime + slot * slotMinutes`) and a venue, and clear the schedule of matches that do not
 * fit. Finished and live matches keep their schedule. Runs in one transaction.
 */
export async function scheduleTournament(
  db: Db,
  tournamentId: string,
  input: ScheduleBody,
): Promise<ScheduleOutcome> {
  const { slug, outcome } = await db.$transaction(async (tx) => {
    const aggregate = await loadAggregate(tx, tournamentId);
    assertStatus(
      aggregate.tournament.status,
      ["IN_PROGRESS"],
      "Fixtures must be generated before scheduling",
    );

    await tx.venue.deleteMany({ where: { tournamentId } });
    const venues = [];
    for (const name of input.venues)
      venues.push(await tx.venue.create({ data: { tournamentId, name } }));

    const matches = aggregate.stages.flatMap((s) => s.matches);
    const open = matches.filter((m) => m.status !== "FINISHED" && m.status !== "LIVE");
    const groupStageIds = Object.fromEntries(
      aggregate.stages
        .filter((s) => s.groupLabel !== null)
        .map((s) => [s.groupLabel as string, s.id]),
    );
    const { assignments, unscheduled } = scheduleMatches(matches, {
      venues: venues.map((v) => v.id),
      slots: open.length * (input.minRestSlots + 1) + 1,
      minRestSlots: input.minRestSlots,
      groupStageIds,
    });

    const start = new Date(input.startTime).getTime();
    for (const a of assignments) {
      await tx.match.update({
        where: { id: a.matchId },
        data: {
          scheduledAt: new Date(start + a.slot * input.slotMinutes * 60_000),
          venueId: a.venueId,
          version: { increment: 1 },
        },
      });
    }
    await tx.match.updateMany({
      where: { id: { in: unscheduled } },
      data: { scheduledAt: null, venueId: null, version: { increment: 1 } },
    });
    return {
      slug: aggregate.tournament.slug,
      outcome: { scheduled: assignments.length, unscheduled },
    };
  });
  eventHub.publish(slug, { type: "tournament_updated" });
  return outcome;
}
