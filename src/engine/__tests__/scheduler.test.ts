import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { scheduleMatches, type Assignment } from "@/engine/scheduler";
import { generateGroupKnockout } from "@/engine/group-knockout";
import { roundRobinMatches } from "@/engine/round-robin";
import { generateSingleElimination } from "@/engine/single-elimination";
import { propagate } from "@/engine/propagation";
import type { Match } from "@/engine/types";
import { seededTeams } from "./helpers";

const rr = (n: number) =>
  roundRobinMatches(
    seededTeams(n).map((t) => t.id),
    {},
    "rr",
    (r, p) => `r${r}m${p}`,
  );
const bracket = (n: number) => propagate(generateSingleElimination(seededTeams(n))).matches;
const slotOf = (as: Assignment[], id: string) => as.find((a) => a.matchId === id)?.slot;

function feeders(m: Match): string[] {
  return [m.homeSource, m.awaySource].flatMap((s) =>
    s && (s.type === "winner" || s.type === "loser") ? [s.matchId] : [],
  );
}

/** Check every hard constraint for a schedule. */
function assertValid(matches: Match[], assignments: Assignment[], minRestSlots: number) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const venueSlots = new Set<string>();
  const teamSlots = new Map<string, number[]>();
  for (const a of assignments) {
    const key = `${a.slot}@${a.venueId}`;
    expect(venueSlots.has(key)).toBe(false);
    venueSlots.add(key);
    const m = byId.get(a.matchId) as Match;
    for (const t of [m.homeTeamId, m.awayTeamId]) {
      if (t === null) continue;
      for (const other of teamSlots.get(t) ?? [])
        expect(Math.abs(other - a.slot)).toBeGreaterThan(minRestSlots);
      teamSlots.set(t, [...(teamSlots.get(t) ?? []), a.slot]);
    }
    for (const f of feeders(m)) {
      const fs = slotOf(assignments, f);
      if (fs !== undefined) expect(a.slot).toBeGreaterThan(fs + minRestSlots);
    }
  }
}

describe("scheduleMatches", () => {
  it("fills venues slot by slot for a round robin", () => {
    const { assignments, unscheduled } = scheduleMatches(rr(4), {
      venues: ["v1", "v2"],
      slots: 3,
      minRestSlots: 0,
    });
    expect(unscheduled).toEqual([]);
    expect(assignments).toHaveLength(6);
    for (let slot = 0; slot < 3; slot++)
      expect(assignments.filter((a) => a.slot === slot)).toHaveLength(2);
    assertValid(rr(4), assignments, 0);
  });

  it("keeps rest gaps between a team's matches", () => {
    const ms = rr(4);
    const { assignments, unscheduled } = scheduleMatches(ms, {
      venues: ["v1", "v2"],
      slots: 6,
      minRestSlots: 1,
    });
    expect(unscheduled).toEqual([]);
    assertValid(ms, assignments, 1);
  });

  it("schedules later rounds after their feeders", () => {
    const ms = bracket(8);
    const { assignments, unscheduled } = scheduleMatches(ms, {
      venues: ["v1", "v2", "v3", "v4"],
      slots: 10,
      minRestSlots: 1,
    });
    expect(unscheduled).toEqual([]);
    expect(slotOf(assignments, "r2m1")).toBeGreaterThan(
      (slotOf(assignments, "r1m1") as number) + 1,
    );
    expect(slotOf(assignments, "r3m1")).toBeGreaterThan(
      (slotOf(assignments, "r2m2") as number) + 1,
    );
    assertValid(ms, assignments, 1);
  });

  it("skips finished matches (byes and played games) and treats them as done", () => {
    const ms = bracket(6);
    const { assignments, unscheduled } = scheduleMatches(ms, {
      venues: ["v1"],
      slots: 10,
      minRestSlots: 0,
    });
    expect(unscheduled).toEqual([]);
    expect(assignments.map((a) => a.matchId).sort()).toEqual(
      ["r1m2", "r1m4", "r2m1", "r2m2", "r3m1"].sort(),
    );
  });

  it("reports matches that do not fit, including everything that depends on them", () => {
    const ms = bracket(8);
    const { assignments, unscheduled } = scheduleMatches(ms, {
      venues: ["v1"],
      slots: 4,
      minRestSlots: 0,
    });
    expect(assignments.map((a) => a.matchId)).toEqual(["r1m1", "r1m2", "r1m3", "r1m4"]);
    expect(unscheduled.sort()).toEqual(["r2m1", "r2m2", "r3m1"]);
  });

  it("schedules a knockout after the whole group it draws from", () => {
    const { stages } = generateGroupKnockout(seededTeams(8), { groups: 2, advancePerGroup: 2 });
    const all = stages.flatMap((s) => s.matches);
    const { assignments, unscheduled } = scheduleMatches(all, {
      venues: ["v1", "v2"],
      slots: 20,
      minRestSlots: 0,
      groupStageIds: { A: "group-A", B: "group-B" },
    });
    expect(unscheduled).toEqual([]);
    const lastGroupSlot = Math.max(
      ...assignments.filter((a) => a.matchId.startsWith("g")).map((a) => a.slot),
    );
    expect(slotOf(assignments, "r1m1")).toBeGreaterThan(lastGroupSlot);
  });

  it("places the most constrained matches first so a busy team's games all fit", () => {
    // Team p plays three times and must take one match in each of the three slots. Filling slots
    // in input order (d, e, f first) would leave no free slot for p's last match.
    const base = rr(2)[0] as Match;
    const m = (id: string, home: string, away: string): Match => ({
      ...base,
      id,
      homeTeamId: home,
      awayTeamId: away,
    });
    const ms = [
      m("d", "t", "u"),
      m("e", "v", "w"),
      m("f", "x", "y"),
      m("a", "p", "q"),
      m("b", "p", "r"),
      m("c", "p", "s"),
    ];
    const { assignments, unscheduled } = scheduleMatches(ms, {
      venues: ["v1", "v2"],
      slots: 3,
      minRestSlots: 0,
    });
    expect(unscheduled).toEqual([]);
    assertValid(ms, assignments, 0);
    expect(["a", "b", "c"].map((id) => slotOf(assignments, id)).sort()).toEqual([0, 1, 2]);
  });

  it("validates options", () => {
    expect(() => scheduleMatches(rr(4), { venues: [], slots: 3, minRestSlots: 0 })).toThrow(
      /venue/,
    );
    expect(() => scheduleMatches(rr(4), { venues: ["v"], slots: -1, minRestSlots: 0 })).toThrow(
      /slots/,
    );
    expect(() => scheduleMatches(rr(4), { venues: ["v"], slots: 3, minRestSlots: -1 })).toThrow(
      /minRestSlots/,
    );
  });

  // Regression: counting every option for every ready match made this take about 2 minutes. It now
  // takes about a second (a few under coverage); 20 s leaves headroom on slow CI runners.
  it("schedules a 32-team round robin (496 matches) quickly", { timeout: 20_000 }, () => {
    const ms = rr(32);
    const { assignments, unscheduled } = scheduleMatches(ms, {
      venues: ["v1", "v2", "v3", "v4"],
      slots: ms.length * 2 + 1,
      minRestSlots: 1,
    });
    expect(unscheduled).toEqual([]);
    expect(assignments).toHaveLength(496);
    assertValid(ms, assignments, 1);
  });

  describe("properties", () => {
    const opts = fc.record({
      venues: fc
        .integer({ min: 1, max: 4 })
        .map((n) => Array.from({ length: n }, (_, i) => `v${i}`)),
      slots: fc.integer({ min: 1, max: 40 }),
      minRestSlots: fc.integer({ min: 0, max: 2 }),
    });

    it("never breaks a hard constraint and accounts for every open match", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 16 }), fc.boolean(), opts, (n, useBracket, o) => {
          const ms = useBracket ? bracket(n) : rr(n);
          const { assignments, unscheduled } = scheduleMatches(ms, o);
          assertValid(ms, assignments, o.minRestSlots);
          const open = ms
            .filter((m) => m.status !== "FINISHED" && m.status !== "LIVE")
            .map((m) => m.id);
          expect([...assignments.map((a) => a.matchId), ...unscheduled].sort()).toEqual(
            open.sort(),
          );
          expect(scheduleMatches(ms, o)).toEqual({ assignments, unscheduled });
        }),
      );
    });

    it("schedules everything when there is plenty of room", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 12 }), fc.boolean(), (n, useBracket) => {
          const ms = useBracket ? bracket(n) : rr(n);
          expect(
            scheduleMatches(ms, { venues: ["v1", "v2"], slots: 200, minRestSlots: 1 }).unscheduled,
          ).toEqual([]);
        }),
      );
    });
  });
});
