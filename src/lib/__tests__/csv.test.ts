import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { csvCell, fixturesCsv, standingsCsv, toCsv } from "@/lib/csv";
import type { PublicView } from "@/lib/public-view";

/** Minimal RFC 4180 parser, used to check that escaping round-trips. */
function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

describe("csvCell", () => {
  it("quotes commas, quotes, line breaks and edge spaces", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("Lions, FC")).toBe('"Lions, FC"');
    expect(csvCell('The "Best"')).toBe('"The ""Best"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(" padded ")).toBe('" padded "');
    expect(csvCell(null)).toBe("");
    expect(csvCell(-2)).toBe("-2");
  });

  it("neutralises spreadsheet formulas in text but not in numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2")).toBe("-2");
    expect(csvCell("-team")).toBe("'-team");
  });

  it("property: any text survives a round trip (apart from the formula guard)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.array(fc.string(), { minLength: 1, maxLength: 4 }), {
          minLength: 1,
          maxLength: 4,
        }),
        (rows) => {
          const safe = rows.map((r) => r.map((c) => c.replace(/^[=+\-@\t\r]/, "x")));
          expect(parseCsv(toCsv(safe))).toEqual(safe);
        },
      ),
    );
  });
});

const view: PublicView = {
  tournament: {
    slug: "cup",
    name: "Cup",
    sport: "Football",
    status: "IN_PROGRESS",
    format: "GROUP_KNOCKOUT",
    rules: {
      legs: 1,
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0,
      tiebreakers: [],
      thirdPlaceMatch: false,
      grandFinalReset: true,
      groups: 1,
      advancePerGroup: 2,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  teams: [
    { id: "a", name: "Lions, FC", seed: 1, groupLabel: "A" },
    { id: "b", name: "=Sharks", seed: 2, groupLabel: "A" },
  ],
  venues: [{ id: "v", name: "Main Field" }],
  stages: [
    {
      id: "g",
      order: 1,
      type: "GROUP",
      groupLabel: "A",
      standings: [
        {
          teamId: "a",
          rank: 1,
          played: 1,
          won: 1,
          drawn: 0,
          lost: 0,
          goalsFor: 2,
          goalsAgainst: 0,
          goalDifference: 2,
          points: 3,
        },
        {
          teamId: "b",
          rank: 2,
          played: 1,
          won: 0,
          drawn: 0,
          lost: 1,
          goalsFor: 0,
          goalsAgainst: 2,
          goalDifference: -2,
          points: 0,
        },
      ],
      matches: [
        {
          id: "m1",
          round: 1,
          position: 1,
          bracket: null,
          homeTeamId: "a",
          awayTeamId: "b",
          homeSource: null,
          awaySource: null,
          status: "FINISHED",
          homeScore: 2,
          awayScore: 0,
          winnerTeamId: "a",
          decidedBy: "REGULAR",
          scheduledAt: "2026-06-06T10:00:00.000Z",
          venueId: "v",
          version: 1,
        },
      ],
    },
  ],
  championTeamId: null,
};

describe("standingsCsv and fixturesCsv", () => {
  it("exports every league table with a stage column", () => {
    const rows = parseCsv(standingsCsv(view));
    expect(rows[0]).toEqual([
      "Stage",
      "Rank",
      "Team",
      "Played",
      "Won",
      "Drawn",
      "Lost",
      "For",
      "Against",
      "Difference",
      "Points",
    ]);
    expect(rows[1]).toEqual(["Group A", "1", "Lions, FC", "1", "1", "0", "0", "2", "0", "2", "3"]);
    expect(rows[2]).toEqual(["Group A", "2", "'=Sharks", "1", "0", "0", "1", "0", "2", "-2", "0"]);
  });

  it("exports fixtures with round, teams, score, status and schedule", () => {
    const rows = parseCsv(fixturesCsv(view));
    expect(rows[0]).toEqual([
      "Stage",
      "Round",
      "Match",
      "Home",
      "Away",
      "Home score",
      "Away score",
      "Status",
      "Decided by",
      "Kick-off (UTC)",
      "Venue",
    ]);
    expect(rows[1]).toEqual([
      "Group A",
      "Round 1",
      "R1 M1",
      "Lions, FC",
      "'=Sharks",
      "2",
      "0",
      "FINISHED",
      "REGULAR",
      "2026-06-06T10:00:00.000Z",
      "Main Field",
    ]);
  });

  it("starts with a byte-order mark and uses CRLF line endings", () => {
    const csv = standingsCsv(view);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(4);
  });
});
