import type { PublicView } from "./public-view";
import { indexMatches, roundsOf, slotText, stageTitle, teamNamer } from "./view-model";

type Cell = string | number | null | undefined;

const BOM = "﻿";
const NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * One CSV cell (RFC 4180). Cells containing commas, quotes, line breaks or edge spaces are
 * quoted, with quotes doubled. Text starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with
 * an apostrophe so spreadsheets never run it as a formula; plain numbers such as `-2` are left alone.
 *
 * @example
 * csvCell('Lions, "FC"'); // "\"Lions, \"\"FC\"\"\""
 * csvCell("=SUM(A1)");    // "'=SUM(A1)"
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !NUMBER.test(text)) text = `'${text}`;
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to CSV text with CRLF line endings (no byte-order mark). */
export function toCsv(rows: readonly (readonly Cell[])[]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * Every league table of the tournament (one block of rows per stage, labelled in the first
 * column). Starts with a byte-order mark so Excel reads accented names correctly.
 */
export function standingsCsv(view: PublicView): string {
  const name = teamNamer(view);
  const header = [
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
  ];
  const rows: Cell[][] = [header];
  for (const stage of view.stages) {
    for (const r of stage.standings ?? []) {
      rows.push([
        stageTitle(stage),
        r.rank,
        name(r.teamId),
        r.played,
        r.won,
        r.drawn,
        r.lost,
        r.goalsFor,
        r.goalsAgainst,
        r.goalDifference,
        r.points,
      ]);
    }
  }
  return BOM + toCsv(rows);
}

/** Every match in playing order, with scores, status and schedule (times in UTC). */
export function fixturesCsv(view: PublicView): string {
  const index = indexMatches(view);
  const venues = new Map(view.venues.map((v) => [v.id, v.name]));
  const header = [
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
  ];
  const rows: Cell[][] = [header];
  for (const stage of view.stages) {
    for (const round of roundsOf(stage)) {
      for (const m of round.matches) {
        rows.push([
          stageTitle(stage),
          round.title,
          index.get(m.id)?.label,
          slotText(view, index, m, "home"),
          slotText(view, index, m, "away"),
          m.homeScore,
          m.awayScore,
          m.status,
          m.decidedBy,
          m.scheduledAt,
          m.venueId ? venues.get(m.venueId) : null,
        ]);
      }
    }
  }
  return BOM + toCsv(rows);
}
