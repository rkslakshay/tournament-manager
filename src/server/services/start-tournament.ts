import { defaultSwissRounds } from "@/engine/swiss";
import { MIN_TEAMS } from "@/lib/tournament-config";
import { planStages, type StagePlan } from "@/lib/plan-stages";
import type { Db } from "../db";
import { ServiceError } from "../errors";
import { eventHub } from "../events";
import { assertTransition } from "../lifecycle";
import {
  loadAggregate,
  toMatchCreateData,
  type TournamentAggregate,
} from "../repositories/tournament-repository";

/**
 * Generate fixtures and lock the teams: runs the generator for the configured format,
 * persists stages and matches, stores group labels and moves the tournament to IN_PROGRESS,
 * all in one transaction. Swiss events get round 1 now and their round count fixed; later
 * rounds are paired as results come in (see `recordResult`).
 */
export async function startTournament(db: Db, tournamentId: string): Promise<TournamentAggregate> {
  const started = await db.$transaction(async (tx) => {
    const { tournament, teams } = await loadAggregate(tx, tournamentId);
    assertTransition(tournament.status, "IN_PROGRESS");
    if (teams.length < MIN_TEAMS) {
      throw new ServiceError("VALIDATION", `At least ${MIN_TEAMS} teams are needed to start`);
    }

    if (tournament.config.format === "SWISS") {
      const rounds = tournament.config.swissRounds ?? defaultSwissRounds(teams.length);
      if (rounds > teams.length - 1) {
        throw new ServiceError(
          "VALIDATION",
          `A Swiss event with ${teams.length} teams can have at most ${teams.length - 1} rounds`,
        );
      }
      // Fix the round count now, so later pairing knows when the event ends.
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { config: { ...tournament.config, swissRounds: rounds } },
      });
    }

    const plan = generatePlan(() => planStages(tournament.config, teams, `${tournament.id}-`));
    for (const stage of plan.stages) {
      await tx.stage.create({
        data: {
          id: stage.id,
          tournamentId,
          order: stage.order,
          type: stage.type,
          config: { groupLabel: stage.groupLabel },
        },
      });
      await tx.match.createMany({ data: stage.matches.map(toMatchCreateData) });
    }
    for (const [teamId, groupLabel] of Object.entries(plan.groupOf)) {
      await tx.team.update({ where: { id: teamId }, data: { groupLabel } });
    }
    await tx.tournament.update({ where: { id: tournamentId }, data: { status: "IN_PROGRESS" } });
    return loadAggregate(tx, tournamentId);
  });
  eventHub.publish(started.tournament.slug, { type: "tournament_updated" });
  return started;
}

/** Engine generators throw plain errors for impossible configurations; surface them as 400s. */
function generatePlan(generate: () => StagePlan): StagePlan {
  try {
    return generate();
  } catch (error) {
    throw new ServiceError(
      "VALIDATION",
      error instanceof Error ? error.message : "Could not generate fixtures",
    );
  }
}
