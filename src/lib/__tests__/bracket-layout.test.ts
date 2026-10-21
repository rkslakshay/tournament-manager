import { describe, expect, it } from "vitest";
import { layoutBracket, type BracketNode } from "@/lib/bracket-layout";
import { generateDoubleElimination } from "@/engine/double-elimination";
import { generateSingleElimination } from "@/engine/single-elimination";
import type { Match } from "@/engine/types";

const teams = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `T${i}`, seed: i + 1 }));

/** Nodes for one bracket side, keeping only winner feeders from the same side. */
function nodes(matches: Match[], side: Match["bracket"]): BracketNode[] {
  const inSide = matches.filter((m) => m.bracket === side);
  const ids = new Set(inSide.map((m) => m.id));
  return inSide.map((m) => ({
    id: m.id,
    round: m.round,
    position: m.position,
    feeders: [m.homeSource, m.awaySource].flatMap((s) =>
      s?.type === "winner" && ids.has(s.matchId) ? [s.matchId] : [],
    ),
  }));
}

describe("layoutBracket", () => {
  it("centres each match between its feeders in a single-elimination bracket", () => {
    const layout = layoutBracket(nodes(generateSingleElimination(teams(8)), null));
    const at = (id: string) => layout.nodes.find((n) => n.id === id);
    expect([1, 2, 3, 4].map((p) => at(`r1m${p}`)?.y)).toEqual([0.5, 1.5, 2.5, 3.5]);
    expect(at("r2m1")).toEqual({ id: "r2m1", column: 1, y: 1 });
    expect(at("r2m2")?.y).toBe(3);
    expect(at("r3m1")).toEqual({ id: "r3m1", column: 2, y: 2 });
    expect(layout).toMatchObject({ columns: 3, rows: 4 });
    expect(layout.edges).toHaveLength(6);
  });

  it("puts the third-place match below the final", () => {
    const layout = layoutBracket(
      nodes(generateSingleElimination(teams(4), { thirdPlaceMatch: true }), null),
    );
    const final = layout.nodes.find((n) => n.id === "r2m1")!;
    const third = layout.nodes.find((n) => n.id === "3rd")!;
    expect(third.column).toBe(final.column);
    expect(third.y).toBeGreaterThan(final.y);
    expect(layout.rows).toBeGreaterThanOrEqual(third.y + 0.5);
  });

  it("keeps drop-down rounds level with their single feeder in the losers bracket", () => {
    const layout = layoutBracket(nodes(generateDoubleElimination(teams(8)), "LOSERS"));
    const at = (id: string) => layout.nodes.find((n) => n.id === id)!;
    expect(at("l2m1").y).toBe(at("l1m1").y);
    expect(at("l3m1").y).toBe((at("l2m1").y + at("l2m2").y) / 2);
    expect(at("l4m1").y).toBe(at("l3m1").y);
    expect(layout.columns).toBe(4);
  });

  it("handles empty input", () => {
    expect(layoutBracket([])).toEqual({ nodes: [], edges: [], columns: 0, rows: 0 });
  });
});
