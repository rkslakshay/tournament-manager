import { resultBody } from "@/lib/api-schemas";
import { requireAdmin } from "@/server/api/auth";
import { handle, json, parseBody } from "@/server/api/http";
import { getDb } from "@/server/db";
import { getPublicView } from "@/server/services/public-view";
import { recordResult } from "@/server/services/results";

/**
 * PUT /api/t/:slug/matches/:matchId/result (admin): record or edit a result.
 * Returns what changed plus the refreshed public view.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; matchId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug, matchId } = await params;
    const tournament = await requireAdmin(request, slug);
    const body = await parseBody(request, resultBody);
    const outcome = await recordResult(getDb(), tournament.id, matchId, body);
    return json({ ...outcome, view: await getPublicView(getDb(), slug) });
  });
}
