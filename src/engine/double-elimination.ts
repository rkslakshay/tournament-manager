import { createMatch } from "./match";
import { bracketSize } from "./seeding";
import { buildBracketRounds } from "./single-elimination";
import type { Match, MatchId, StageId, Team } from "./types";

export interface DoubleEliminationOptions {
  /** Prepended to every match id. Default "". */
  idPrefix?: string;
  /** Default `${idPrefix}de`. */
  stageId?: StageId;
  /** Play a second grand final if the losers-bracket champion wins the first. Default true. */
  grandFinalReset?: boolean;
}

/**
 * Generate a double-elimination bracket.
 *
 * - Winners bracket (`w{r}m{p}`): a standard seeded knockout of size N (next power of two).
 * - Losers bracket (`l{r}m{p}`), 2(log2 N - 1) rounds: round 1 pairs the winners round-one
 *   losers; then each winners round r drops its losers into a "drop-down" round against the
 *   losers-bracket survivors, followed by a "consolidation" round where survivors play each
 *   other. Drop-down positions follow `losersDropPosition` to avoid early rematches.
 * - Grand final (`gf1`): winners champion (home) vs losers champion (away), plus the reset
 *   `gf2`, played only if the losers champion wins `gf1`.
 *
 * Byes flow through `propagate`: the loser of a bye is a bye, so odd team counts just work.
 *
 * @example
 * generateDoubleElimination(eightTeams).length; // 15 (7 winners + 6 losers + 2 grand final)
 */
export function generateDoubleElimination(
  teams: readonly Team[],
  options: DoubleEliminationOptions = {},
): Match[] {
  const prefix = options.idPrefix ?? "";
  const stageId = options.stageId ?? `${prefix}de`;
  const size = bracketSize(teams.length);
  const k = Math.log2(size);
  const w = (r: number, p: number): MatchId => `${prefix}w${r}m${p}`;
  const l = (r: number, p: number): MatchId => `${prefix}l${r}m${p}`;

  const bySeed = [...teams].sort((a, b) => a.seed - b.seed);
  const matches = buildBracketRounds(
    bySeed.map((t) => ({ type: "team", teamId: t.id })),
    { stageId, bracket: "WINNERS", idFor: w },
  );
  const losers = (
    round: number,
    position: number,
    home: Match["homeSource"],
    away: Match["awaySource"],
  ) =>
    matches.push(
      createMatch({
        id: l(round, position),
        stageId,
        round,
        position,
        bracket: "LOSERS",
        homeSource: home,
        awaySource: away,
      }),
    );

  for (let p = 1; p <= size / 4; p++) {
    losers(
      1,
      p,
      { type: "loser", matchId: w(1, 2 * p - 1) },
      { type: "loser", matchId: w(1, 2 * p) },
    );
  }
  for (let r = 2; r <= k; r++) {
    const dropRound = 2 * (r - 1);
    const count = size / 2 ** r;
    const dropped = new Map<number, MatchId>();
    for (let q = 1; q <= count; q++) dropped.set(losersDropPosition(q, count, r), w(r, q));
    for (let p = 1; p <= count; p++) {
      losers(
        dropRound,
        p,
        { type: "winner", matchId: l(dropRound - 1, p) },
        { type: "loser", matchId: dropped.get(p) as MatchId },
      );
    }
    if (r === k) continue;
    for (let p = 1; p <= count / 2; p++) {
      losers(
        dropRound + 1,
        p,
        { type: "winner", matchId: l(dropRound, 2 * p - 1) },
        { type: "winner", matchId: l(dropRound, 2 * p) },
      );
    }
  }

  const winnersFinal = w(k, 1);
  const losersChampion =
    k === 1
      ? { type: "loser" as const, matchId: winnersFinal }
      : { type: "winner" as const, matchId: l(2 * (k - 1), 1) };
  const gf1 = `${prefix}gf1`;
  matches.push(
    createMatch({
      id: gf1,
      stageId,
      round: 1,
      position: 1,
      bracket: "GRAND_FINAL",
      homeSource: { type: "winner", matchId: winnersFinal },
      awaySource: losersChampion,
    }),
  );
  if (options.grandFinalReset ?? true) {
    matches.push(
      createMatch({
        id: `${prefix}gf2`,
        stageId,
        round: 2,
        position: 1,
        bracket: "GRAND_FINAL",
        homeSource: { type: "loser", matchId: gf1 },
        awaySource: { type: "winner", matchId: gf1 },
      }),
    );
  }
  return matches;
}

/**
 * Losers-bracket position (1-based) for the loser of winners match `q` in winners round `r`
 * (r >= 2), where both rounds have `m` matches. The pattern cycles every four rounds: reverse,
 * swap halves, identity, reverse each half. In simulations this gave the fewest rematches of
 * the patterns tried, and the reversal guarantees no rematch in the first drop-down round.
 *
 * @example
 * [1, 2, 3, 4].map((q) => losersDropPosition(q, 4, 2)); // [4, 3, 2, 1]
 */
export function losersDropPosition(q: number, m: number, r: number): number {
  const half = m / 2;
  switch ((r - 2) % 4) {
    case 0:
      return m + 1 - q;
    case 1:
      return m === 1 ? 1 : ((q - 1 + half) % m) + 1;
    case 2:
      return q;
    default:
      return m === 1 ? 1 : q <= half ? half + 1 - q : m + half + 1 - q;
  }
}
