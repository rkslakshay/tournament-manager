import type { TournamentStatus } from "@/lib/tournament-config";
import { ServiceError } from "./errors";

/**
 * Legal tournament status transitions (ARCHITECTURE.md section 2). COMPLETED may go back to
 * IN_PROGRESS when an organizer edits a result after the end. Any non-archived state may be
 * archived.
 */
const TRANSITIONS: Record<TournamentStatus, readonly TournamentStatus[]> = {
  DRAFT: ["REGISTRATION", "ARCHIVED"],
  REGISTRATION: ["IN_PROGRESS", "ARCHIVED"],
  IN_PROGRESS: ["COMPLETED", "ARCHIVED"],
  COMPLETED: ["IN_PROGRESS", "ARCHIVED"],
  ARCHIVED: [],
};

/** True if a tournament may move from `from` to `to`. */
export function canTransition(from: TournamentStatus, to: TournamentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Throw INVALID_STATE unless the transition is legal. */
export function assertTransition(from: TournamentStatus, to: TournamentStatus): void {
  if (!canTransition(from, to)) {
    throw new ServiceError("INVALID_STATE", `Cannot move a tournament from ${from} to ${to}`);
  }
}

/** Throw INVALID_STATE unless the tournament is in one of the allowed states. */
export function assertStatus(
  status: TournamentStatus,
  allowed: readonly TournamentStatus[],
  message: string,
): void {
  if (!allowed.includes(status)) {
    throw new ServiceError("INVALID_STATE", message, { status });
  }
}

/** Teams can only change before fixtures are generated. */
export const TEAM_EDITABLE: readonly TournamentStatus[] = ["DRAFT", "REGISTRATION"];
