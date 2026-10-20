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

/** Seeded teams s1..sn. */
export function seededTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i + 1}`,
    name: `Seed ${i + 1}`,
    seed: i + 1,
  }));
}

/** Set a result on one match; the winner comes from the score (null on a draw). */
export function withScore(
  matches: Match[],
  id: string,
  homeScore: number,
  awayScore: number,
): Match[] {
  return matches.map((m) => {
    if (m.id !== id) return m;
    if (m.homeTeamId === null || m.awayTeamId === null) {
      throw new Error(`Match ${id} has no participants yet`);
    }
    const winnerTeamId =
      homeScore > awayScore ? m.homeTeamId : awayScore > homeScore ? m.awayTeamId : null;
    return { ...m, status: "FINISHED" as const, homeScore, awayScore, winnerTeamId };
  });
}

/** Numeric seed of an "s<n>" team id; unknown teams sort last. */
export function seedOf(teamId: string | null): number {
  return teamId === null ? Number.MAX_SAFE_INTEGER : Number(teamId.slice(1));
}
