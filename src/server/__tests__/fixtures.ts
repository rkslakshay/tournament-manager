import type { TournamentConfigInput } from "@/lib/tournament-config";
import type { Db } from "@/server/db";
import { loadAggregate, type StoredMatch } from "@/server/repositories/tournament-repository";
import { startTournament } from "@/server/services/start-tournament";
import { addTeams } from "@/server/services/teams";
import { createTournament } from "@/server/services/tournaments";

/** Create a tournament with teams "T1".."Tn" (T1 is seed 1), optionally started. */
export async function makeTournament(
  db: Db,
  config: TournamentConfigInput,
  teamCount: number,
  options: { start?: boolean } = {},
) {
  const created = await createTournament(db, { name: "Fixture Cup", sport: "Football", config });
  await addTeams(
    db,
    created.tournament.id,
    Array.from({ length: teamCount }, (_, i) => `T${i + 1}`),
  );
  if (options.start ?? true) await startTournament(db, created.tournament.id);
  return { id: created.tournament.id, slug: created.slug, adminToken: created.adminToken };
}

/** All matches of a tournament keyed by their id without the tournament prefix. */
export async function matchesOf(
  db: Db,
  tournamentId: string,
): Promise<Record<string, StoredMatch>> {
  const { stages } = await loadAggregate(db, tournamentId);
  return Object.fromEntries(
    stages.flatMap((s) => s.matches).map((m) => [m.id.slice(tournamentId.length + 1), m]),
  );
}

/** Team id by name. */
export async function teamIds(db: Db, tournamentId: string): Promise<Record<string, string>> {
  const teams = await db.team.findMany({ where: { tournamentId } });
  return Object.fromEntries(teams.map((t) => [t.name, t.id]));
}
