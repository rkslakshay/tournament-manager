import type { Source, StageType } from "@/engine/types";

/** The parts of a match needed to label it. */
export interface LabelledMatch {
  id: string;
  round: number;
  position: number;
  bracket: "WINNERS" | "LOSERS" | "GRAND_FINAL" | null;
}

const KNOCKOUT_NAMES = ["Final", "Semi-finals", "Quarter-finals"];

/**
 * Human name of a round.
 *
 * @example
 * roundName("SINGLE_ELIM", { round: 3, bracket: null, ... }, 3); // "Final"
 * roundName("DOUBLE_ELIM", { round: 2, bracket: "LOSERS", ... }, 3); // "Losers round 2"
 */
export function roundName(stageType: StageType, match: LabelledMatch, lastRound: number): string {
  if (stageType === "ROUND_ROBIN" || stageType === "GROUP" || stageType === "SWISS")
    return `Round ${match.round}`;
  if (match.bracket === "GRAND_FINAL")
    return match.round === 1 ? "Grand final" : "Grand final (reset)";
  if (match.bracket === "LOSERS") return `Losers round ${match.round}`;
  const fromEnd = lastRound - match.round;
  const name = KNOCKOUT_NAMES[fromEnd] ?? `Round of ${2 ** (fromEnd + 1)}`;
  return match.bracket === "WINNERS" ? `Winners ${name.toLowerCase()}` : name;
}

/**
 * Short label for one match, used in "Winner of …" references.
 *
 * @example
 * shortMatchLabel("SINGLE_ELIM", { round: 2, position: 1, ... }, 3); // "SF 1"
 */
export function shortMatchLabel(
  stageType: StageType,
  match: LabelledMatch,
  lastRound: number,
): string {
  if (isThirdPlace(stageType, match, lastRound)) return "3rd place";
  if (match.bracket === "GRAND_FINAL") return match.round === 1 ? "GF" : "GF reset";
  if (match.bracket === "WINNERS") return `WB R${match.round} M${match.position}`;
  if (match.bracket === "LOSERS") return `LB R${match.round} M${match.position}`;
  if (stageType === "ROUND_ROBIN" || stageType === "GROUP")
    return `R${match.round} M${match.position}`;
  const short = ["F", "SF", "QF"][lastRound - match.round];
  return short
    ? short === "F"
      ? "Final"
      : `${short} ${match.position}`
    : `R${match.round} M${match.position}`;
}

/** The single-elimination third-place match: same round as the final, position 2. */
export function isThirdPlace(
  stageType: StageType,
  match: LabelledMatch,
  lastRound: number,
): boolean {
  return (
    stageType === "SINGLE_ELIM" &&
    match.bracket === null &&
    match.round === lastRound &&
    match.position === 2
  );
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11 → "11th". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/**
 * What a slot will be filled by, for matches whose participants are not known yet.
 *
 * @example
 * sourceLabel({ type: "groupRank", group: "A", rank: 1 }, () => "", () => ""); // "Group A 1st"
 */
export function sourceLabel(
  source: Source | null,
  matchLabel: (matchId: string) => string,
  teamName: (teamId: string) => string,
): string {
  if (source === null) return "TBD";
  switch (source.type) {
    case "team":
      return teamName(source.teamId);
    case "winner":
      return `Winner of ${matchLabel(source.matchId)}`;
    case "loser":
      return `Loser of ${matchLabel(source.matchId)}`;
    case "groupRank":
      return `Group ${source.group} ${ordinal(source.rank)}`;
    case "bye":
      return "Bye";
  }
}
