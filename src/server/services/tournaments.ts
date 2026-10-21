import { Prisma } from "@prisma/client";
import { slugify } from "@/lib/slug";
import { createTournamentBody } from "@/lib/api-schemas";
import type { TournamentConfigInput } from "@/lib/tournament-config";
import type { Db, Tx } from "../db";
import { ServiceError } from "../errors";
import { toTournamentRecord, type TournamentRecord } from "../repositories/tournament-repository";
import { generateAdminToken, hashToken, randomSuffix, tokenMatchesHash } from "../security";

export type CreateTournamentInput = {
  name: string;
  sport: string;
  config: TournamentConfigInput;
};

export interface CreatedTournament {
  tournament: TournamentRecord;
  slug: string;
  /** Returned once; only its hash is stored. */
  adminToken: string;
}

const SLUG_ATTEMPTS = 5;

/**
 * Create a tournament in REGISTRATION with a unique slug and a fresh admin token.
 * The token is returned once and stored only as a SHA-256 hash.
 */
export async function createTournament(
  db: Db,
  input: CreateTournamentInput,
): Promise<CreatedTournament> {
  const parsed = createTournamentBody.safeParse(input);
  if (!parsed.success) {
    throw new ServiceError("VALIDATION", "Invalid tournament", parsed.error.flatten());
  }
  const { name, sport, config } = parsed.data;
  const adminToken = generateAdminToken();
  const base = slugify(name);

  for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
    const slug = `${base}-${randomSuffix()}`;
    try {
      const row = await db.tournament.create({
        data: {
          slug,
          name,
          sport,
          status: "REGISTRATION",
          adminTokenHash: hashToken(adminToken),
          config,
        },
      });
      return { tournament: toTournamentRecord(row), slug, adminToken };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new ServiceError("INTERNAL", "Could not generate a unique slug");
}

/**
 * Load a tournament by slug and check the admin token in constant time.
 * Missing or wrong tokens get the same UNAUTHORIZED error.
 */
export async function authorizeAdmin(
  db: Tx,
  slug: string,
  token: string | null | undefined,
): Promise<TournamentRecord> {
  const row = await db.tournament.findUnique({ where: { slug } });
  if (!row) throw new ServiceError("NOT_FOUND", "Tournament not found");
  if (!token || !tokenMatchesHash(token, row.adminTokenHash)) {
    throw new ServiceError("UNAUTHORIZED", "A valid admin token is required");
  }
  return toTournamentRecord(row);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
