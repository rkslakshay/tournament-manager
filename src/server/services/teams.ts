import { z } from "zod";
import type { Team } from "@/engine/types";
import { MAX_TEAMS } from "@/lib/tournament-config";
import type { Db, Tx } from "../db";
import { ServiceError } from "../errors";
import { assertStatus, TEAM_EDITABLE } from "../lifecycle";
import { toTeam, toTournamentRecord } from "../repositories/tournament-repository";

export const teamNameSchema = z.string().trim().min(1, "Team name is required").max(60);

const STARTED_MESSAGE =
  "Teams cannot change after the tournament has started. Record a forfeit instead.";

/**
 * Add teams (in order) with the next free seeds. Names are trimmed. Duplicates, compared
 * case-insensitively within the batch and against existing teams, are rejected. Only allowed
 * before the tournament starts.
 */
export async function addTeams(
  db: Db,
  tournamentId: string,
  names: readonly string[],
): Promise<Team[]> {
  const cleaned = names.map((n) => teamNameSchema.safeParse(n));
  const invalid = cleaned.findIndex((r) => !r.success);
  if (invalid !== -1) throw new ServiceError("VALIDATION", `Team name #${invalid + 1} is invalid`);
  const newNames = cleaned.map((r) => r.data as string);
  if (newNames.length === 0) throw new ServiceError("VALIDATION", "Provide at least one team");

  return db.$transaction(async (tx) => {
    await loadEditable(tx, tournamentId);
    const existing = await tx.team.findMany({ where: { tournamentId }, orderBy: { seed: "asc" } });
    if (existing.length + newNames.length > MAX_TEAMS) {
      throw new ServiceError("VALIDATION", `A tournament can have at most ${MAX_TEAMS} teams`);
    }
    const duplicates = findDuplicates([...existing.map((t) => t.name), ...newNames]);
    if (duplicates.length > 0) {
      throw new ServiceError("DUPLICATE", `Duplicate team name: ${duplicates.join(", ")}`, {
        names: duplicates,
      });
    }
    const nextSeed = existing.length + 1;
    await tx.team.createMany({
      data: newNames.map((name, i) => ({
        tournamentId,
        name,
        nameKey: nameKey(name),
        seed: nextSeed + i,
      })),
    });
    return listTeams(tx, tournamentId);
  });
}

/** Remove a team before the start and close the gap in the seeds. */
export async function removeTeam(db: Db, tournamentId: string, teamId: string): Promise<Team[]> {
  return db.$transaction(async (tx) => {
    await loadEditable(tx, tournamentId);
    const deleted = await tx.team.deleteMany({ where: { id: teamId, tournamentId } });
    if (deleted.count === 0) throw new ServiceError("NOT_FOUND", "Team not found");
    const remaining = await tx.team.findMany({ where: { tournamentId }, orderBy: { seed: "asc" } });
    await writeSeeds(
      tx,
      remaining.map((t) => t.id),
    );
    return listTeams(tx, tournamentId);
  });
}

/** Reseed: `teamIds` must list every team exactly once, strongest first. */
export async function reorderTeams(
  db: Db,
  tournamentId: string,
  teamIds: readonly string[],
): Promise<Team[]> {
  return db.$transaction(async (tx) => {
    await loadEditable(tx, tournamentId);
    const existing = await tx.team.findMany({ where: { tournamentId }, select: { id: true } });
    const known = new Set(existing.map((t) => t.id));
    const isPermutation =
      teamIds.length === known.size &&
      new Set(teamIds).size === teamIds.length &&
      teamIds.every((id) => known.has(id));
    if (!isPermutation) {
      throw new ServiceError("VALIDATION", "The new order must list every team exactly once");
    }
    await writeSeeds(tx, teamIds);
    return listTeams(tx, tournamentId);
  });
}

export async function listTeams(db: Tx, tournamentId: string): Promise<Team[]> {
  const rows = await db.team.findMany({ where: { tournamentId }, orderBy: { seed: "asc" } });
  return rows.map(toTeam);
}

/** Case- and whitespace-insensitive key used for duplicate detection. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function findDuplicates(names: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    const key = nameKey(name);
    if (seen.has(key)) duplicates.add(name);
    seen.add(key);
  }
  return [...duplicates];
}

async function writeSeeds(tx: Tx, orderedIds: readonly string[]): Promise<void> {
  for (const [i, id] of orderedIds.entries()) {
    await tx.team.update({ where: { id }, data: { seed: i + 1 } });
  }
}

async function loadEditable(tx: Tx, tournamentId: string) {
  const row = await tx.tournament.findUnique({ where: { id: tournamentId } });
  if (!row) throw new ServiceError("NOT_FOUND", "Tournament not found");
  const tournament = toTournamentRecord(row);
  assertStatus(tournament.status, TEAM_EDITABLE, STARTED_MESSAGE);
  return tournament;
}
