/**
 * Bracket size for a team count: the next power of two at or above it.
 *
 * @example
 * bracketSize(12); // 16
 */
export function bracketSize(teamCount: number): number {
  if (teamCount < 2) throw new Error("A bracket needs at least 2 teams");
  let size = 1;
  while (size < teamCount) size *= 2;
  return size;
}

/**
 * Standard seed order for a bracket of `size` slots, read top to bottom. Adjacent slots meet in
 * round one, and the top seeds are kept apart until the latest possible round.
 *
 * Built by repeatedly replacing each seed s with the pair (s, 2m + 1 - s) as the bracket
 * doubles to size 2m.
 *
 * @example
 * seedBracket(8); // [1, 8, 4, 5, 2, 7, 3, 6]
 */
export function seedBracket(size: number): number[] {
  if (size < 1 || (size & (size - 1)) !== 0) throw new Error("Bracket size must be a power of two");
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

/**
 * Round-one pairings by seed for `teamCount` teams. Seeds beyond the team count are byes (null),
 * so byes always go to the highest seeds. The home slot is never a bye.
 *
 * @example
 * firstRoundPairs(3); // [[1, null], [2, 3]]
 */
export function firstRoundPairs(teamCount: number): Array<[number, number | null]> {
  const order = seedBracket(bracketSize(teamCount));
  const pairs: Array<[number, number | null]> = [];
  for (let i = 0; i < order.length; i += 2) {
    const a = order[i] as number;
    const b = order[i + 1] as number;
    const [home, away] = a < b ? [a, b] : [b, a];
    pairs.push([home, away > teamCount ? null : away]);
  }
  return pairs;
}
