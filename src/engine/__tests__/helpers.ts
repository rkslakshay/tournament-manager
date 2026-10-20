import { createMatch } from "@/engine/match";
import type { Match, Team } from "@/engine/types";

/** Teams named after the given ids, seeded in the given order. */
export function makeTeams(...ids: string[]): Team[] {
  return ids.map((id, i) => ({ id, name: id.toUpperCase(), seed: i + 1 }));
}

let counter = 0;

/** A finished match with a result. The winner is derived from the score (null on a draw). */
export function played(home: string, away: string, homeScore: number, awayScore: number): Match {
  counter += 1;
  return {
    ...createMatch({
      id: `p${counter}`,
      stageId: "s",
      round: 1,
      position: counter,
      homeTeamId: home,
      awayTeamId: away,
    }),
    status: "FINISHED",
    homeScore,
    awayScore,
    winnerTeamId: homeScore > awayScore ? home : awayScore > homeScore ? away : null,
  };
}
