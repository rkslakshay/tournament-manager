import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { moveItem, parseTeamList } from "@/lib/team-list";

describe("parseTeamList", () => {
  it("splits on lines, commas and tabs and drops blanks", () => {
    expect(parseTeamList("Ants\n  Bees \n\nCats")).toEqual(["Ants", "Bees", "Cats"]);
    expect(parseTeamList("A, B\tC\r\nD")).toEqual(["A", "B", "C", "D"]);
    expect(parseTeamList("  \n ")).toEqual([]);
  });
});

describe("moveItem", () => {
  it("moves items and clamps the target", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("property: always returns a permutation of the input", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer()),
        fc.integer({ min: -3, max: 30 }),
        fc.integer({ min: -3, max: 30 }),
        (xs, from, to) => {
          const out = moveItem(xs, from, to);
          expect([...out].sort()).toEqual([...xs].sort());
        },
      ),
    );
  });
});
