import { createTournamentBody, type CreateTournamentBody } from "./api-schemas";
import type { EditPolicy, Format } from "./tournament-config";

/** Raw state of the create wizard, as typed by the organizer. */
export interface WizardForm {
  name: string;
  sport: string;
  format: Format;
  legs: 1 | 2;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  thirdPlaceMatch: boolean;
  grandFinalReset: boolean;
  groups: number;
  advancePerGroup: number;
  /** Swiss rounds; NaN means "decide from the team count at start". */
  swissRounds: number;
  editPolicy: EditPolicy;
}

export const DEFAULT_WIZARD_FORM: WizardForm = {
  name: "",
  sport: "",
  format: "ROUND_ROBIN",
  legs: 1,
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  thirdPlaceMatch: false,
  grandFinalReset: true,
  groups: 2,
  advancePerGroup: 2,
  swissRounds: Number.NaN,
  editPolicy: "RESET_DOWNSTREAM",
};

/** Sports scored in games or frames, where a forfeit is recorded as 1-0 rather than 3-0. */
const ONE_NIL_WALKOVER_SPORTS = [
  "chess",
  "tennis",
  "table tennis",
  "badminton",
  "esports",
  "squash",
];

/**
 * Default walkover score for a sport: 1-0 for game-scored sports, 3-0 otherwise.
 *
 * @example
 * defaultWalkoverScore("Chess"); // { winner: 1, loser: 0 }
 */
export function defaultWalkoverScore(sport: string): { winner: number; loser: number } {
  return ONE_NIL_WALKOVER_SPORTS.includes(sport.trim().toLowerCase())
    ? { winner: 1, loser: 0 }
    : { winner: 3, loser: 0 };
}

/** Formats with league tables, which use points. */
export function usesLeagueRules(format: Format): boolean {
  return format === "ROUND_ROBIN" || format === "GROUP_KNOCKOUT" || format === "SWISS";
}

/** Formats where every pairing can be played over one or two legs. */
export function usesLegs(format: Format): boolean {
  return format === "ROUND_ROBIN" || format === "GROUP_KNOCKOUT";
}

/**
 * Turn wizard state into a validated create request, keeping only the settings that apply to
 * the chosen format. Returns field errors keyed by form field instead of throwing.
 *
 * @example
 * buildCreateRequest({ ...DEFAULT_WIZARD_FORM, name: "Cup", sport: "Chess" }).ok; // true
 */
export function buildCreateRequest(
  form: WizardForm,
): { ok: true; body: CreateTournamentBody } | { ok: false; errors: Record<string, string> } {
  const league = usesLeagueRules(form.format);
  const knockout = form.format === "SINGLE_ELIM" || form.format === "GROUP_KNOCKOUT";
  const candidate = {
    name: form.name,
    sport: form.sport,
    config: {
      format: form.format,
      editPolicy: form.editPolicy,
      walkoverScore: defaultWalkoverScore(form.sport),
      ...(usesLegs(form.format) && { legs: form.legs }),
      ...(form.format === "SWISS" &&
        Number.isFinite(form.swissRounds) && { swissRounds: form.swissRounds }),
      ...(league && {
        pointsForWin: form.pointsForWin,
        pointsForDraw: form.pointsForDraw,
        pointsForLoss: form.pointsForLoss,
      }),
      ...(knockout && { thirdPlaceMatch: form.thirdPlaceMatch }),
      ...(form.format === "DOUBLE_ELIM" && { grandFinalReset: form.grandFinalReset }),
      ...(form.format === "GROUP_KNOCKOUT" && {
        groups: form.groups,
        advancePerGroup: form.advancePerGroup,
      }),
    },
  };
  const parsed = createTournamentBody.safeParse(candidate);
  if (parsed.success) return { ok: true, body: parsed.data };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[issue.path.length - 1] ?? "form");
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

/** The organizer's private admin URL. */
export function adminUrl(origin: string, slug: string, token: string): string {
  return `${origin}/t/${slug}/admin?token=${encodeURIComponent(token)}`;
}
