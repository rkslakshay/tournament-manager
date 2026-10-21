import type { StandingRow } from "@/engine/types";

interface Props {
  title: string;
  rows: StandingRow[];
  teamName: (teamId: string) => string;
  /** Rows ranked at or above this qualify for the next stage (highlighted). 0 = none. */
  qualifyingPlaces: number;
}

const COLUMNS = [
  { key: "played", short: "P", long: "Played" },
  { key: "won", short: "W", long: "Won" },
  { key: "drawn", short: "D", long: "Drawn" },
  { key: "lost", short: "L", long: "Lost" },
  { key: "goalsFor", short: "F", long: "Scored" },
  { key: "goalsAgainst", short: "A", long: "Conceded" },
  { key: "goalDifference", short: "GD", long: "Difference" },
] as const;

/** League table with a sticky header; qualification places are marked by text and colour. */
export function StandingsTable({ title, rows, teamName, qualifyingPlaces }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="bg-slate-50 px-3 py-2 text-left font-semibold dark:bg-slate-900">
          {title}
        </caption>
        <thead className="sticky top-0 bg-white text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th scope="col" className="w-10 px-3 py-2 text-left">
              <abbr title="Position">#</abbr>
            </th>
            <th scope="col" className="px-3 py-2 text-left">
              Team
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="w-10 px-2 py-2 text-right">
                <abbr title={c.long}>{c.short}</abbr>
              </th>
            ))}
            <th scope="col" className="w-12 px-3 py-2 text-right">
              <abbr title="Points">Pts</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const qualifies = row.rank <= qualifyingPlaces;
            return (
              <tr
                key={row.teamId}
                className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${qualifies ? "bg-accent-50/70 dark:bg-accent-900/20" : ""}`}
              >
                <td className="px-3 py-2 tabular-nums">
                  <span
                    className={
                      qualifies ? "border-l-4 border-accent-600 pl-1.5 font-semibold" : "pl-2.5"
                    }
                  >
                    {row.rank}
                  </span>
                </td>
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  {teamName(row.teamId)}
                  {qualifies && (
                    <span className="ml-2 text-xs font-semibold text-accent-700 dark:text-accent-500">
                      Q
                    </span>
                  )}
                  {qualifies && <span className="sr-only"> (qualifies)</span>}
                </th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-2 text-right tabular-nums">
                    {c.key === "goalDifference" && row[c.key] > 0 ? `+${row[c.key]}` : row[c.key]}
                  </td>
                ))}
                <td className="px-3 py-2 text-right font-bold tabular-nums">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {qualifyingPlaces > 0 && (
        <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          Q = qualifies for the knockout.
        </p>
      )}
    </div>
  );
}
