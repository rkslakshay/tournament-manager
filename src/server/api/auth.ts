import type { TournamentRecord } from "../repositories/tournament-repository";
import { getDb } from "../db";
import { authorizeAdmin } from "../services/tournaments";
import { bearerToken } from "./http";

/**
 * Admin guard for write routes: the request must carry `Authorization: Bearer <admin token>`
 * for this tournament. Throws UNAUTHORIZED (401) or NOT_FOUND (404).
 */
export async function requireAdmin(request: Request, slug: string): Promise<TournamentRecord> {
  return authorizeAdmin(getDb(), slug, bearerToken(request));
}
