/** A match as the layout sees it: where it sits and which matches in the same section feed it. */
export interface BracketNode {
  id: string;
  round: number;
  position: number;
  /** Matches in the same section whose winner plays in this one. */
  feeders: string[];
}

export interface PlacedNode {
  id: string;
  /** 0-based column (one per round). */
  column: number;
  /** Vertical centre, in rows (one row = one card plus spacing). */
  y: number;
}

export interface BracketLayout {
  nodes: PlacedNode[];
  edges: Array<{ from: string; to: string }>;
  columns: number;
  /** Total height in rows. */
  rows: number;
}

/**
 * Place bracket matches in columns by round. First-round matches stack one per row; every
 * later match is centred on the matches that feed it (one feeder keeps the same height, as in
 * losers-bracket drop-down rounds). Matches with no feeder in the section, such as a
 * third-place match, go below the column's lowest match.
 *
 * @example
 * layoutBracket(eightTeamSingleElimination).nodes.find((n) => n.id === "r3m1"); // { column: 2, y: 2 }
 */
export function layoutBracket(matches: readonly BracketNode[]): BracketLayout {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const columnOf = new Map(rounds.map((r, i) => [r, i]));
  const ids = new Set(matches.map((m) => m.id));
  const y = new Map<string, number>();
  const nodes: PlacedNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];

  for (const round of rounds) {
    const column = columnOf.get(round) as number;
    const inRound = matches
      .filter((m) => m.round === round)
      .sort((a, b) => a.position - b.position);
    const orphans: BracketNode[] = [];
    for (const match of inRound) {
      const feeders = match.feeders.filter((f) => ids.has(f) && y.has(f));
      if (column === 0) {
        y.set(match.id, inRound.indexOf(match) + 0.5);
      } else if (feeders.length > 0) {
        y.set(match.id, feeders.reduce((sum, f) => sum + (y.get(f) as number), 0) / feeders.length);
        feeders.forEach((f) => edges.push({ from: f, to: match.id }));
      } else {
        orphans.push(match);
      }
    }
    let bottom = Math.max(
      0,
      ...inRound.filter((m) => y.has(m.id)).map((m) => y.get(m.id) as number),
    );
    for (const orphan of orphans) {
      bottom += 1.25;
      y.set(orphan.id, bottom);
    }
    inRound.forEach((m) => nodes.push({ id: m.id, column, y: y.get(m.id) as number }));
  }

  return {
    nodes,
    edges,
    columns: rounds.length,
    rows: nodes.length === 0 ? 0 : Math.max(...nodes.map((n) => n.y)) + 0.5,
  };
}
