import { shuffle } from "./random";
import type { Bye, Fixture, TeamId } from "./types";

export interface RoundRobinOptions {
  /** 1 = everyone meets once, 2 = home and away. Default 1. */
  legs?: 1 | 2;
  /** When given, team order is shuffled deterministically before pairing. */
  seed?: number;
}

export interface RoundRobinSchedule {
  fixtures: Fixture[];
  byes: Bye[];
  rounds: number;
}

/** A slot in the circle: a real team, or null for the bye slot added when the count is odd. */
type Slot = TeamId | null;

/**
 * Generate a round-robin schedule with the circle method.
 *
 * The last slot stays fixed while the others rotate. Home advantage alternates so no team has
 * more than two home (or away) games in a row, which gives the minimum n-2 "breaks". With an odd
 * team count a bye slot is added, and pairings against it become byes.
 *
 * @example
 * const { fixtures, rounds } = generateRoundRobin(["a", "b", "c", "d"]);
 * rounds;          // 3
 * fixtures.length; // 6
 */
export function generateRoundRobin(
  teamIds: readonly TeamId[],
  options: RoundRobinOptions = {},
): RoundRobinSchedule {
  assertValidTeams(teamIds);
  const legs = options.legs ?? 1;
  const ordered = options.seed === undefined ? [...teamIds] : shuffle(teamIds, options.seed);
  const slots: Slot[] = ordered.length % 2 === 0 ? ordered : [...ordered, null];
  const roundsPerLeg = slots.length - 1;

  const fixtures: Fixture[] = [];
  const byes: Bye[] = [];
  for (let leg = 1; leg <= legs; leg++) {
    for (let r = 0; r < roundsPerLeg; r++) {
      const round = (leg - 1) * roundsPerLeg + r + 1;
      for (const [home, away] of pairingsForRound(slots, r)) {
        const [h, a] = leg === 1 ? [home, away] : [away, home];
        if (h === null || a === null) {
          byes.push({ round, teamId: (h ?? a) as TeamId });
        } else {
          fixtures.push({ round, leg, homeTeamId: h, awayTeamId: a });
        }
      }
    }
  }
  return { fixtures, byes, rounds: roundsPerLeg * legs };
}

/** Home/away pairs of round `r` (0-based) for an even number of slots. */
function pairingsForRound(slots: readonly Slot[], r: number): Array<[Slot, Slot]> {
  const n = slots.length;
  const fixed = slots[n - 1] as Slot;
  const rotating = slots.slice(0, n - 1);
  const at = (i: number): Slot => rotating[(i + r) % (n - 1)] as Slot;

  const pairs: Array<[Slot, Slot]> = [r % 2 === 0 ? [fixed, at(0)] : [at(0), fixed]];
  for (let i = 1; i < n / 2; i++) {
    const a = at(i);
    const b = at(n - 1 - i);
    pairs.push(i % 2 === 1 ? [b, a] : [a, b]);
  }
  return pairs;
}

function assertValidTeams(teamIds: readonly TeamId[]): void {
  if (teamIds.length < 2) throw new Error("A round robin needs at least 2 teams");
  if (new Set(teamIds).size !== teamIds.length) throw new Error("Duplicate team ids");
}
