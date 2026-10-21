import { roundRobinMatches } from "./round-robin";
import { firstRoundPairs, orderBySeed } from "./seeding";
import { buildSingleElimination } from "./single-elimination";
import { computeStandings } from "./standings";
import type { Source, Stage, StandingsConfig, Team, TeamId } from "./types";

export interface GroupKnockoutOptions {
  groups: number;
  advancePerGroup: number;
  /** Legs in the group round robins. Default 1. */
  legs?: 1 | 2;
  thirdPlaceMatch?: boolean;
  idPrefix?: string;
}

export interface GroupKnockoutPlan {
  /** One GROUP stage per group, in label order, followed by the SINGLE_ELIM knockout stage. */
  stages: Stage[];
  /** Group label for every team. */
  groupOf: Record<TeamId, string>;
}

/**
 * Spreadsheet-style group label for a 0-based index.
 *
 * @example
 * groupLabel(0);  // "A"
 * groupLabel(26); // "AA"
 */
export function groupLabel(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  return index < 26 ? letter : groupLabel(Math.floor(index / 26) - 1) + letter;
}

/**
 * Snake-draft teams into groups by seed: A, B, C, then C, B, A, and so on.
 *
 * @example
 * assignGroups(eightSeededTeams, 2); // { A: [1, 4, 5, 8], B: [2, 3, 6, 7] } (by seed)
 */
export function assignGroups(teams: readonly Team[], groupCount: number): Record<string, Team[]> {
  const groups: Record<string, Team[]> = {};
  for (let g = 0; g < groupCount; g++) groups[groupLabel(g)] = [];
  orderBySeed(teams).forEach((team, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    const g = row % 2 === 0 ? col : groupCount - 1 - col;
    (groups[groupLabel(g)] as Team[]).push(team);
  });
  return groups;
}

/**
 * Generate a group stage (one round robin per group) followed by a single-elimination knockout.
 *
 * Knockout entrants are `groupRank` sources, resolved once each group has finished (see
 * `resolveGroupRankings`). Group winners take the top knockout seeds, and lower-ranked
 * qualifiers are placed so teams from the same group do not meet in round one
 * (with two groups: A1 vs B2, B1 vs A2).
 *
 * @example
 * const { stages } = generateGroupKnockout(sixteenTeams, { groups: 4, advancePerGroup: 2 });
 * stages.length; // 5 (groups A-D plus the knockout)
 */
export function generateGroupKnockout(
  teams: readonly Team[],
  options: GroupKnockoutOptions,
): GroupKnockoutPlan {
  validate(teams.length, options);
  const prefix = options.idPrefix ?? "";
  const groups = assignGroups(teams, options.groups);
  const labels = Object.keys(groups);

  const groupOf: Record<TeamId, string> = {};
  const stages: Stage[] = labels.map((label, i) => {
    const members = groups[label] as Team[];
    members.forEach((t) => (groupOf[t.id] = label));
    const stageId = `${prefix}group-${label}`;
    return {
      id: stageId,
      order: i + 1,
      type: "GROUP",
      groupLabel: label,
      matches: roundRobinMatches(
        members.map((t) => t.id),
        { legs: options.legs ?? 1 },
        stageId,
        (round, position) => `${prefix}g${label}-r${round}m${position}`,
      ),
    };
  });

  const knockoutId = `${prefix}ko`;
  stages.push({
    id: knockoutId,
    order: labels.length + 1,
    type: "SINGLE_ELIM",
    groupLabel: null,
    matches: buildSingleElimination(knockoutEntrants(labels, options.advancePerGroup), {
      idPrefix: prefix,
      stageId: knockoutId,
      thirdPlaceMatch: options.thirdPlaceMatch,
    }),
  });
  return { stages, groupOf };
}

/**
 * Final rankings of every group whose matches are all finished, keyed by group label. Teams
 * must carry their `groupLabel`. Groups still in progress are omitted.
 *
 * @example
 * resolveGroupRankings(groupStages, teams, config); // { A: ["s1", "s4", "s5", "s8"] }
 */
export function resolveGroupRankings(
  groupStages: readonly Stage[],
  teams: readonly Team[],
  config: StandingsConfig,
): Record<string, TeamId[]> {
  const rankings: Record<string, TeamId[]> = {};
  for (const stage of groupStages) {
    if (stage.groupLabel === null || !stage.matches.every((m) => m.status === "FINISHED")) continue;
    const members = teams.filter((t) => t.groupLabel === stage.groupLabel);
    rankings[stage.groupLabel] = computeStandings(members, stage.matches, config).map(
      (r) => r.teamId,
    );
  }
  return rankings;
}

/**
 * Knockout entrants in seed order: all group winners first (A1, B1, ...), then each lower rank.
 * Each lower tier uses the first rotation of the group order that avoids same-group pairs in
 * round one.
 */
function knockoutEntrants(labels: string[], advancePerGroup: number): Source[] {
  const total = labels.length * advancePerGroup;
  const pairs = firstRoundPairs(total);
  const entrants: Source[] = labels.map((group) => ({ type: "groupRank", group, rank: 1 }));

  for (let rank = 2; rank <= advancePerGroup; rank++) {
    const rotations = labels.map((_, k) => [...labels.slice(k), ...labels.slice(0, k)]);
    const tier = (order: string[]): Source[] =>
      order.map((group) => ({ type: "groupRank", group, rank }));
    const fits = (order: string[]) => !hasSameGroupPair([...entrants, ...tier(order)], pairs);
    const chosen = rotations.find(fits) ?? labels;
    entrants.push(...tier(chosen));
  }
  return entrants;
}

/** True if any round-one pair with both entrants placed comes from the same group. */
function hasSameGroupPair(entrants: Source[], pairs: Array<[number, number | null]>): boolean {
  const groupOfSeed = (seed: number) => {
    const s = entrants[seed - 1];
    return s?.type === "groupRank" ? s.group : undefined;
  };
  return pairs.some(([home, away]) => {
    if (away === null) return false;
    const a = groupOfSeed(home);
    return a !== undefined && a === groupOfSeed(away);
  });
}

function validate(teamCount: number, options: GroupKnockoutOptions): void {
  const { groups, advancePerGroup } = options;
  if (!Number.isInteger(groups) || groups < 1) throw new Error("Need at least 1 group");
  if (teamCount < groups * 2) throw new Error("Each group needs at least 2 teams");
  const smallestGroup = Math.floor(teamCount / groups);
  if (
    !Number.isInteger(advancePerGroup) ||
    advancePerGroup < 1 ||
    advancePerGroup > smallestGroup
  ) {
    throw new Error(`advancePerGroup must be between 1 and ${smallestGroup}`);
  }
  if (groups * advancePerGroup < 2) throw new Error("The knockout needs at least 2 qualifiers");
}
