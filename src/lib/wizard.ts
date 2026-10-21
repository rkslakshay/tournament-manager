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
  editPolicy: "RESET_DOWNSTREAM",
};

/** Formats with league tables, which use points and legs. */
export function usesLeagueRules(format: Format): boolean {
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
      ...(league && {
        legs: form.legs,
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
