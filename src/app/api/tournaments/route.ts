import { createTournamentBody } from "@/lib/api-schemas";
import { handle, json, parseBody } from "@/server/api/http";
import { createLimiter, enforceRateLimit } from "@/server/api/rate-limit";
import { getDb } from "@/server/db";
import { createTournament } from "@/server/services/tournaments";

/**
 * POST /api/tournaments: create a tournament (rate-limited per client).
 * Returns the slug and the one-time admin token.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    enforceRateLimit(request, createLimiter);
    const body = await parseBody(request, createTournamentBody);
    const { slug, adminToken } = await createTournament(getDb(), body);
    return json({ slug, adminToken }, 201);
  });
}
