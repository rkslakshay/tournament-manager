import type { Match, MatchId, StageId, TeamId } from "./types";

export interface ScheduleOptions {
  /** Venue ids. Each venue hosts at most one match per slot. */
  venues: readonly string[];
  /** Number of time slots, numbered 0..slots-1. The service maps them to real times. */
  slots: number;
  /** Slots a team must sit out between two of its matches (0 = back-to-back allowed). */
  minRestSlots: number;
  /** Group label to GROUP stage id, so knockout `groupRank` sources wait for their whole group. */
  groupStageIds?: Readonly<Record<string, StageId>>;
}

export interface Assignment {
  matchId: MatchId;
  slot: number;
  venueId: string;
}

export interface ScheduleResult {
  /** Sorted by slot, then venue order. */
  assignments: Assignment[];
  /** Open matches that could not be placed (or depend on one that could not). */
  unscheduled: MatchId[];
}

interface Candidate {
  match: Match;
  index: number;
  options: Array<{ slot: number; venueId: string }>;
}

/**
 * Assign open matches to (slot, venue) pairs with a greedy, most-constrained-first heuristic.
 *
 * Hard constraints:
 * - a venue hosts one match per slot;
 * - a team plays at most once per slot, with `minRestSlots` free slots between its matches;
 * - a match comes after its feeders (`winner`/`loser` sources, or every match of the group a
 *   `groupRank` source draws from), with the same rest gap.
 *
 * FINISHED and LIVE matches are not scheduled and count as already played. At each step, among
 * matches whose feeders are placed, the one with the fewest feasible options goes first (ties:
 * busiest teams, then lower round, then input order) into its earliest option. Matches that do
 * not fit are reported, never dropped silently.
 *
 * @example
 * scheduleMatches(matches, { venues: ["Court 1", "Court 2"], slots: 8, minRestSlots: 1 });
 * // { assignments: [{ matchId: "r1m1", slot: 0, venueId: "Court 1" }, ...], unscheduled: [] }
 */
export function scheduleMatches(
  matches: readonly Match[],
  options: ScheduleOptions,
): ScheduleResult {
  validate(options);
  const open = matches.filter((m) => m.status !== "FINISHED" && m.status !== "LIVE");
  const openIds = new Set(open.map((m) => m.id));
  const dependencies = new Map(
    open.map((m) => [m.id, dependenciesOf(m, matches, options).filter((d) => openIds.has(d))]),
  );

  const slotOf = new Map<MatchId, number>();
  const failed = new Set<MatchId>();
  const venueBusy = new Set<string>();
  const teamSlots = new Map<TeamId, number[]>();
  const remainingLoad = countTeamLoad(open);
  const assignments: Assignment[] = [];

  let waiting = open.map((match, index) => ({ match, index }));
  while (waiting.length > 0) {
    const decided = (id: MatchId) => slotOf.has(id) || failed.has(id);
    const ready = waiting.filter(({ match }) =>
      (dependencies.get(match.id) as MatchId[]).every(decided),
    );
    const blocked = ready.filter(({ match }) =>
      (dependencies.get(match.id) as MatchId[]).some((d) => failed.has(d)),
    );
    if (blocked.length > 0) {
      blocked.forEach(({ match }) => failed.add(match.id));
      waiting = waiting.filter((w) => !failed.has(w.match.id));
      continue;
    }

    const candidates: Candidate[] = ready.map(({ match, index }) => ({
      match,
      index,
      options: feasibleOptions(
        match,
        earliestSlot(match, dependencies, slotOf, options),
        options,
        venueBusy,
        teamSlots,
      ),
    }));
    const next = candidates.sort((a, b) => compareCandidates(a, b, remainingLoad))[0] as Candidate;
    const choice = next.options[0];
    if (choice === undefined) {
      failed.add(next.match.id);
    } else {
      slotOf.set(next.match.id, choice.slot);
      venueBusy.add(`${choice.slot}@${choice.venueId}`);
      for (const team of teamsOf(next.match)) {
        teamSlots.set(team, [...(teamSlots.get(team) ?? []), choice.slot]);
        remainingLoad.set(team, (remainingLoad.get(team) ?? 1) - 1);
      }
      assignments.push({ matchId: next.match.id, ...choice });
    }
    waiting = waiting.filter((w) => w.match.id !== next.match.id);
  }

  const venueOrder = (v: string) => options.venues.indexOf(v);
  assignments.sort((a, b) => a.slot - b.slot || venueOrder(a.venueId) - venueOrder(b.venueId));
  return { assignments, unscheduled: open.filter((m) => failed.has(m.id)).map((m) => m.id) };
}

function compareCandidates(a: Candidate, b: Candidate, load: Map<TeamId, number>): number {
  const busiest = (m: Match) => Math.max(0, ...teamsOf(m).map((t) => load.get(t) ?? 0));
  return (
    a.options.length - b.options.length ||
    busiest(b.match) - busiest(a.match) ||
    a.match.round - b.match.round ||
    a.index - b.index
  );
}

function feasibleOptions(
  match: Match,
  earliest: number,
  options: ScheduleOptions,
  venueBusy: Set<string>,
  teamSlots: Map<TeamId, number[]>,
): Array<{ slot: number; venueId: string }> {
  const teams = teamsOf(match);
  const result: Array<{ slot: number; venueId: string }> = [];
  for (let slot = earliest; slot < options.slots; slot++) {
    const rested = teams.every((t) =>
      (teamSlots.get(t) ?? []).every((s) => Math.abs(s - slot) > options.minRestSlots),
    );
    if (!rested) continue;
    for (const venueId of options.venues) {
      if (!venueBusy.has(`${slot}@${venueId}`)) result.push({ slot, venueId });
    }
  }
  return result;
}

function earliestSlot(
  match: Match,
  dependencies: Map<MatchId, MatchId[]>,
  slotOf: Map<MatchId, number>,
  options: ScheduleOptions,
): number {
  const after = (dependencies.get(match.id) as MatchId[]).map(
    (d) => (slotOf.get(d) as number) + options.minRestSlots + 1,
  );
  return Math.max(0, ...after);
}

/** Matches that must be played before this one can start. */
function dependenciesOf(match: Match, all: readonly Match[], options: ScheduleOptions): MatchId[] {
  return [match.homeSource, match.awaySource].flatMap((source) => {
    if (source === null) return [];
    if (source.type === "winner" || source.type === "loser") return [source.matchId];
    if (source.type === "groupRank") {
      const stageId = options.groupStageIds?.[source.group];
      return all.filter((m) => m.stageId === stageId).map((m) => m.id);
    }
    return [];
  });
}

function teamsOf(match: Match): TeamId[] {
  return [match.homeTeamId, match.awayTeamId].filter((t): t is TeamId => t !== null);
}

function countTeamLoad(matches: readonly Match[]): Map<TeamId, number> {
  const load = new Map<TeamId, number>();
  for (const m of matches) for (const t of teamsOf(m)) load.set(t, (load.get(t) ?? 0) + 1);
  return load;
}

function validate(options: ScheduleOptions): void {
  if (options.venues.length === 0) throw new Error("Need at least one venue");
  if (!Number.isInteger(options.slots) || options.slots < 0)
    throw new Error("slots must be a non-negative integer");
  if (!Number.isInteger(options.minRestSlots) || options.minRestSlots < 0) {
    throw new Error("minRestSlots must be a non-negative integer");
  }
}
