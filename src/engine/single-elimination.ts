import { createMatch } from "./match";
import { firstRoundPairs } from "./seeding";
import type { BracketSide, Match, MatchId, Source, StageId, Team } from "./types";

export interface EliminationOptions {
  /** Prepended to every match id so ids are unique across tournaments. Default "". */
  idPrefix?: string;
  /** Stage the matches belong to. Default `${idPrefix}ko`. */
  stageId?: StageId;
  /** Add a match between the semi-final losers. Ignored when there are no semi-finals. */
  thirdPlaceMatch?: boolean;
}

/**
 * Generate a single-elimination bracket for seeded teams.
 *
 * Teams are placed by standard seeding and byes go to the top seeds. A bye match is FINISHED
 * with the seeded team as winner. Later rounds reference their feeders through `winner`
 * sources and stay PENDING until `propagate` fills them in.
 *
 * @example
 * const matches = generateSingleElimination(eightTeams, { thirdPlaceMatch: true });
 * matches.length; // 8 (7 bracket matches plus the third-place match)
 */
export function generateSingleElimination(
  teams: readonly Team[],
  options: EliminationOptions = {},
): Match[] {
  const bySeed = [...teams].sort((a, b) => a.seed - b.seed);
  return buildSingleElimination(
    bySeed.map((t) => ({ type: "team", teamId: t.id })),
    options,
  );
}

/**
 * Build a single-elimination bracket from entrant sources listed in seed order (index 0 is
 * seed 1). Used directly when entrants are not known yet, e.g. group-stage qualifiers.
 *
 * @example
 * buildSingleElimination([{ type: "groupRank", group: "A", rank: 1 }, ...], {});
 */
export function buildSingleElimination(
  entrants: readonly Source[],
  options: EliminationOptions,
): Match[] {
  const prefix = options.idPrefix ?? "";
  const stageId = options.stageId ?? `${prefix}ko`;
  const matches = buildBracketRounds(entrants, {
    stageId,
    bracket: null,
    idFor: (round, position) => `${prefix}r${round}m${position}`,
  });
  const rounds = Math.max(...matches.map((m) => m.round));
  if (options.thirdPlaceMatch && rounds >= 2) {
    matches.push(
      createMatch({
        id: `${prefix}3rd`,
        stageId,
        round: rounds,
        position: 2,
        homeSource: { type: "loser", matchId: `${prefix}r${rounds - 1}m1` },
        awaySource: { type: "loser", matchId: `${prefix}r${rounds - 1}m2` },
      }),
    );
  }
  return matches;
}

export interface BracketRoundsOptions {
  stageId: StageId;
  bracket: BracketSide | null;
  idFor: (round: number, position: number) => MatchId;
}

/**
 * Build every round of a knockout bracket: round one from seeded entrants, then each later
 * match fed by the winners of two adjacent matches. Shared by single and double elimination.
 *
 * @example
 * buildBracketRounds(entrants, { stageId: "s", bracket: "WINNERS", idFor: (r, p) => `w${r}-${p}` });
 */
export function buildBracketRounds(
  entrants: readonly Source[],
  options: BracketRoundsOptions,
): Match[] {
  if (entrants.length < 2) throw new Error("A bracket needs at least 2 teams");
  const { stageId, bracket, idFor } = options;
  const entrant = (seed: number) => entrants[seed - 1] as Source;

  const matches = firstRoundPairs(entrants.length).map(([home, away], i) =>
    firstRoundMatch(
      { id: idFor(1, i + 1), stageId, round: 1, position: i + 1, bracket },
      entrant(home),
      away === null ? { type: "bye" } : entrant(away),
    ),
  );

  let previous = matches.length;
  for (let round = 2; previous > 1; round++) {
    const count = previous / 2;
    for (let p = 1; p <= count; p++) {
      matches.push(
        createMatch({
          id: idFor(round, p),
          stageId,
          round,
          position: p,
          bracket,
          homeSource: { type: "winner", matchId: idFor(round - 1, 2 * p - 1) },
          awaySource: { type: "winner", matchId: idFor(round - 1, 2 * p) },
        }),
      );
    }
    previous = count;
  }
  return matches;
}

type MatchKey = Pick<Match, "id" | "stageId" | "round" | "position" | "bracket">;

/** A round-one match. Team sources are filled in immediately and a known team facing a bye advances. */
function firstRoundMatch(key: MatchKey, homeSource: Source, awaySource: Source): Match {
  const teamOf = (s: Source) => (s.type === "team" ? s.teamId : null);
  const match = createMatch({
    ...key,
    homeSource,
    awaySource,
    homeTeamId: teamOf(homeSource),
    awayTeamId: teamOf(awaySource),
  });
  if (awaySource.type === "bye" && match.homeTeamId !== null) {
    return { ...match, status: "FINISHED", winnerTeamId: match.homeTeamId };
  }
  return match;
}
