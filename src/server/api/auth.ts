import type { TournamentRecord } from "../repositories/tournament-repository";
import { getDb } from "../db";
import { authorizeAdmin } from "../services/tournaments";
import { bearerToken } from "./http";
import { enforceRateLimit } from "./rate-limit";

/**
 * Guard for admin write routes. Rate-limits the client first (so token guessing is throttled
 * too), then requires `Authorization: Bearer <admin token>` for this tournament.
 * Throws RATE_LIMITED (429), UNAUTHORIZED (401) or NOT_FOUND (404).
 */
export async function requireAdmin(request: Request, slug: string): Promise<TournamentRecord> {
  enforceRateLimit(request);
  return authorizeAdmin(getDb(), slug, bearerToken(request));
}
