import { createRng } from "@/engine/random";
import { DEMO_TOURNAMENTS } from "@/lib/demo";
import type { TournamentConfigInput } from "@/lib/tournament-config";
import type { Db } from "./db";
import { loadAggregate } from "./repositories/tournament-repository";
import { setMatchStatus } from "./services/match-status";
import { recordResult } from "./services/results";
import { scheduleTournament } from "./services/schedule";
import { startTournament } from "./services/start-tournament";
import { addTeams } from "./services/teams";
import { createTournament } from "./services/tournaments";

interface DemoSpec {
  slug: string;
  name: string;
  sport: string;
  config: TournamentConfigInput;
  teams: string[];
  /** How many matches to play, in playing order. */
  playMatches: number;
  /** Mark the next open match as live. */
  oneLive: boolean;
}

const CLUBS = [
  "Red Lions",
  "Blue Sharks",
  "Green Eagles",
  "Black Wolves",
  "Golden Bears",
  "Silver Hawks",
  "Orange Tigers",
  "White Owls",
  "Purple Foxes",
  "Grey Falcons",
  "Scarlet Bulls",
  "Navy Dolphins",
  "Amber Panthers",
  "Teal Ravens",
  "Crimson Stags",
  "Ivory Cobras",
];

const SPECS: DemoSpec[] = [
  {
    slug: DEMO_TOURNAMENTS[0].slug,
    name: "City Sunday League",
    sport: "Football",
    config: { format: "ROUND_ROBIN" },
    teams: CLUBS.slice(0, 8),
    playMatches: 20,
    oneLive: true,
  },
  {
    slug: DEMO_TOURNAMENTS[1].slug,
    name: "Spring Knockout Cup",
    sport: "Basketball",
    config: { format: "SINGLE_ELIM", thirdPlaceMatch: true },
    teams: CLUBS.slice(0, 12),
    playMatches: 6,
    oneLive: true,
  },
  {
    slug: DEMO_TOURNAMENTS[2].slug,
    name: "Summer World Cup",
    sport: "Football",
    config: { format: "GROUP_KNOCKOUT", groups: 4, advancePerGroup: 2, thirdPlaceMatch: true },
    teams: CLUBS.slice(0, 16),
    playMatches: 28,
    oneLive: false,
  },
];

export interface SeededDemo {
  slug: string;
  adminToken: string;
}

/**
 * Create the demo tournaments linked from the landing page, replacing any earlier copies.
 * Results are generated from a fixed seed so every run produces the same tournaments, and they
 * go through the real services, so brackets and standings are exactly what users would get.
 */
export async function seedDemo(
  db: Db,
  startTime = new Date("2026-06-06T10:00:00Z"),
): Promise<SeededDemo[]> {
  await db.tournament.deleteMany({ where: { slug: { in: SPECS.map((s) => s.slug) } } });
  const seeded: SeededDemo[] = [];
  for (const [i, spec] of SPECS.entries()) {
    seeded.push(await seedOne(db, spec, i + 1, startTime));
  }
  return seeded;
}

async function seedOne(db: Db, spec: DemoSpec, seed: number, startTime: Date): Promise<SeededDemo> {
  const { tournament, adminToken } = await createTournament(db, {
    name: spec.name,
    sport: spec.sport,
    config: spec.config,
  });
  await db.tournament.update({ where: { id: tournament.id }, data: { slug: spec.slug } });
  await addTeams(db, tournament.id, spec.teams);
  await startTournament(db, tournament.id);
  await scheduleTournament(db, tournament.id, {
    venues: ["Main Field", "Field 2"],
    startTime: startTime.toISOString(),
    slotMinutes: 60,
    minRestSlots: 0,
  });

  const random = createRng(seed);
  const score = () => Math.floor(random() * 4);
  for (let played = 0; played < spec.playMatches; played++) {
    const next = await nextOpenMatch(db, tournament.id);
    if (!next) break;
    let home = score();
    let away = score();
    if (!next.allowsDraws && home === away) home += 1;
    if (random() < 0.15) [home, away] = [away, home];
    await recordResult(db, tournament.id, next.id, { homeScore: home, awayScore: away });
  }
  if (spec.oneLive) {
    const next = await nextOpenMatch(db, tournament.id);
    if (next) await setMatchStatus(db, tournament.id, next.id, { status: "LIVE" });
  }
  return { slug: spec.slug, adminToken };
}

/** The next match to play in a realistic order. */
async function nextOpenMatch(
  db: Db,
  tournamentId: string,
): Promise<{ id: string; allowsDraws: boolean } | null> {
  const { stages } = await loadAggregate(db, tournamentId);
  const open = stages.flatMap((stage) =>
    stage.matches
      .filter((m) => m.status === "SCHEDULED")
      .map((m) => ({
        id: m.id,
        at: m.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
        round: m.round,
        allowsDraws: stage.type === "ROUND_ROBIN" || stage.type === "GROUP",
      })),
  );
  // League stages first, then knockout rounds in order, each by kick-off time.
  const phase = (m: { allowsDraws: boolean; round: number }) => (m.allowsDraws ? 0 : m.round);
  open.sort((a, b) => phase(a) - phase(b) || a.at - b.at || a.round - b.round);
  return open[0] ?? null;
}
