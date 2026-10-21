import type { BracketSide } from "@/engine/types";
import { layoutBracket } from "@/lib/bracket-layout";
import type { PublicMatch, PublicStage, PublicView } from "@/lib/public-view";
import type { MatchInfo } from "@/lib/view-model";
import { MatchCard } from "./match-card";

const CARD_WIDTH = 200;
const CARD_HEIGHT = 72;
const ROW_HEIGHT = 88;
const COLUMN_GAP = 40;
const HEADER = 28;

const SECTION_TITLES: Record<string, string> = {
  WINNERS: "Winners bracket",
  LOSERS: "Losers bracket",
  GRAND_FINAL: "Grand final",
};

interface Props {
  view: PublicView;
  index: Map<string, MatchInfo>;
  stage: PublicStage;
}

/** Visual knockout tree: one column per round, connector lines between feeders and matches. */
export function Bracket({ view, index, stage }: Props) {
  const sides: Array<BracketSide | null> =
    stage.type === "DOUBLE_ELIM" ? ["WINNERS", "LOSERS", "GRAND_FINAL"] : [null];
  return (
    <div className="space-y-8">
      {sides.map((side) => {
        const matches = stage.matches.filter((m) => m.bracket === side);
        if (matches.length === 0) return null;
        return (
          <section key={side ?? "main"} aria-label={side ? SECTION_TITLES[side] : "Bracket"}>
            {side && <h3 className="mb-2 font-semibold">{SECTION_TITLES[side]}</h3>}
            <BracketSection view={view} index={index} matches={matches} />
          </section>
        );
      })}
    </div>
  );
}

function BracketSection({
  view,
  index,
  matches,
}: {
  view: PublicView;
  index: Map<string, MatchInfo>;
  matches: PublicMatch[];
}) {
  const ids = new Set(matches.map((m) => m.id));
  const layout = layoutBracket(
    matches.map((m) => ({
      id: m.id,
      round: m.round,
      position: m.position,
      feeders: [m.homeSource, m.awaySource].flatMap((s) =>
        s?.type === "winner" && ids.has(s.matchId) ? [s.matchId] : [],
      ),
    })),
  );
  const byId = new Map(matches.map((m) => [m.id, m]));
  const placed = new Map(layout.nodes.map((n) => [n.id, n]));
  const width = layout.columns * CARD_WIDTH + (layout.columns - 1) * COLUMN_GAP;
  const height = layout.rows * ROW_HEIGHT + HEADER;
  const x = (column: number) => column * (CARD_WIDTH + COLUMN_GAP);
  const cy = (y: number) => HEADER + y * ROW_HEIGHT;
  const rounds = [...new Set(layout.nodes.map((n) => n.column))];

  return (
    <div
      className="overflow-x-auto pb-2"
      tabIndex={0}
      aria-label="Bracket, scroll sideways for later rounds"
    >
      <div className="relative" style={{ width, height }}>
        <svg
          aria-hidden
          width={width}
          height={height}
          className="absolute inset-0 text-slate-300 dark:text-slate-700"
        >
          {layout.edges.map(({ from, to }) => {
            const a = placed.get(from);
            const b = placed.get(to);
            if (!a || !b) return null;
            const x1 = x(a.column) + CARD_WIDTH;
            const x2 = x(b.column);
            const mid = (x1 + x2) / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${cy(a.y)} H ${mid} V ${cy(b.y)} H ${x2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              />
            );
          })}
        </svg>
        {rounds.map((column) => {
          const first = layout.nodes.find((n) => n.column === column);
          const title = first ? index.get(first.id)?.roundName : "";
          return (
            <div
              key={`h-${column}`}
              className="absolute top-0 truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              style={{ left: x(column), width: CARD_WIDTH }}
            >
              {title}
            </div>
          );
        })}
        {layout.nodes.map((node) => (
          <div
            key={node.id}
            className="absolute"
            style={{
              left: x(node.column),
              top: cy(node.y) - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
            }}
          >
            <MatchCard view={view} index={index} match={byId.get(node.id) as PublicMatch} compact />
          </div>
        ))}
      </div>
    </div>
  );
}
