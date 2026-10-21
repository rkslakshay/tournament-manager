import { matchStatusBody } from "@/lib/api-schemas";
import { requireAdmin } from "@/server/api/auth";
import { handle, json, parseBody } from "@/server/api/http";
import { getDb } from "@/server/db";
import { setMatchStatus } from "@/server/services/match-status";

/** PUT /api/t/:slug/matches/:matchId/status (admin): mark a match LIVE or back to SCHEDULED. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; matchId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug, matchId } = await params;
    const tournament = await requireAdmin(request, slug);
    const body = await parseBody(request, matchStatusBody);
    return json(await setMatchStatus(getDb(), tournament.id, matchId, body));
  });
}
