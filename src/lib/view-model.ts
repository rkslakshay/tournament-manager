import type { BracketSide } from "@/engine/types";
import { roundName, shortMatchLabel, sourceLabel } from "./match-labels";
import type { PublicMatch, PublicStage, PublicView } from "./public-view";
import { parseTournamentConfig, type TournamentConfig } from "./tournament-config";

/** A match with everything needed to display it. */
export interface MatchInfo {
  match: PublicMatch;
  stage: PublicStage;
  /** Short label such as "SF 1" or "WB R2 M1". */
  label: string;
  roundName: string;
}

/** Matches of one round (or one bracket round) in display order. */
export interface RoundGroup {
  key: string;
  title: string;
  matches: PublicMatch[];
}

/** Display title of a stage. */
export function stageTitle(stage: PublicStage): string {
  switch (stage.type) {
    case "GROUP":
      return `Group ${stage.groupLabel ?? ""}`.trim();
    case "ROUND_ROBIN":
      return "League";
    case "SWISS":
      return "Swiss standings";
    case "DOUBLE_ELIM":
      return "Bracket";
    default:
      return "Knockout";
  }
}

/** Highest round of a bracket side within a stage (null side = the whole stage). */
export function lastRound(stage: PublicStage, bracket: BracketSide | null): number {
  const rounds = stage.matches.filter((m) => m.bracket === bracket).map((m) => m.round);
  return rounds.length === 0 ? 0 : Math.max(...rounds);
}

/** Every match by id, labelled. */
export function indexMatches(view: PublicView): Map<string, MatchInfo> {
  const index = new Map<string, MatchInfo>();
  for (const stage of view.stages) {
    for (const match of stage.matches) {
      const last = lastRound(stage, match.bracket);
      index.set(match.id, {
        match,
        stage,
        label: shortMatchLabel(stage.type, match, last),
        roundName: roundName(stage.type, match, last),
      });
    }
  }
  return index;
}

/** Team name lookup with a fallback for unknown ids. */
export function teamNamer(view: PublicView): (teamId: string | null) => string {
  const names = new Map(view.teams.map((t) => [t.id, t.name]));
  return (teamId) => (teamId === null ? "TBD" : (names.get(teamId) ?? "Unknown team"));
}

/** What to show in a participant slot: the team, or where it will come from. */
export function slotText(
  view: PublicView,
  index: Map<string, MatchInfo>,
  match: PublicMatch,
  side: "home" | "away",
): string {
  const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
  const name = teamNamer(view);
  if (teamId !== null) return name(teamId);
  if (match.status === "FINISHED") return "Bye";
  const source = side === "home" ? match.homeSource : match.awaySource;
  return sourceLabel(
    source,
    (id) => index.get(id)?.label ?? "an earlier match",
    (id) => name(id),
  );
}

/** Group a stage's matches by bracket side and round, in playing order. */
export function roundsOf(stage: PublicStage): RoundGroup[] {
  const sides: Array<BracketSide | null> =
    stage.type === "DOUBLE_ELIM" ? ["WINNERS", "LOSERS", "GRAND_FINAL"] : [null];
  return sides
    .flatMap((side) => {
      const matches = stage.matches.filter((m) => m.bracket === side);
      const last = lastRound(stage, side);
      const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
      return rounds.map((round) => {
        const inRound = matches
          .filter((m) => m.round === round)
          .sort((a, b) => a.position - b.position);
        const title =
          side === "GRAND_FINAL"
            ? "Grand final"
            : roundName(stage.type, inRound[0] as PublicMatch, last);
        return { key: `${side ?? "main"}-${round}`, title, matches: inRound };
      });
    })
    .reduce<RoundGroup[]>((groups, group) => {
      // Grand final and its reset share one heading.
      const previous = groups[groups.length - 1];
      if (previous && previous.title === group.title) previous.matches.push(...group.matches);
      else groups.push(group);
      return groups;
    }, []);
}

/** True when a match was decided without being played (a bye, or a match that was not needed). */
export function isAutoDecided(match: PublicMatch): boolean {
  return match.status === "FINISHED" && match.homeScore === null;
}

/** The tournament config as far as the public view knows it, e.g. for previewing fixtures. */
export function configOf(view: PublicView): TournamentConfig {
  const { rules, format } = view.tournament;
  return parseTournamentConfig({
    format,
    legs: rules.legs,
    pointsForWin: rules.pointsForWin,
    pointsForDraw: rules.pointsForDraw,
    pointsForLoss: rules.pointsForLoss,
    tiebreakers: rules.tiebreakers,
    thirdPlaceMatch: rules.thirdPlaceMatch,
    grandFinalReset: rules.grandFinalReset,
    groups: rules.groups ?? undefined,
    advancePerGroup: rules.advancePerGroup ?? undefined,
  });
}

/**
 * The view with one result applied locally, shown while the save is in flight. The server's
 * response replaces it (including propagated bracket changes).
 */
export function withOptimisticResult(
  view: PublicView,
  matchId: string,
  homeScore: number,
  awayScore: number,
  /** Explicit winner, e.g. on penalties; otherwise the higher score. */
  winner?: string,
): PublicView {
  return {
    ...view,
    stages: view.stages.map((stage) => ({
      ...stage,
      matches: stage.matches.map((m) =>
        m.id !== matchId
          ? m
          : {
              ...m,
              status: "FINISHED" as const,
              homeScore,
              awayScore,
              winnerTeamId:
                winner ??
                (homeScore > awayScore
                  ? m.homeTeamId
                  : awayScore > homeScore
                    ? m.awayTeamId
                    : null),
            },
      ),
    })),
  };
}

/** Knockout stages need a winner, so draws are refused there. */
export function allowsDraws(stage: PublicStage): boolean {
  return stage.type === "ROUND_ROBIN" || stage.type === "GROUP";
}
