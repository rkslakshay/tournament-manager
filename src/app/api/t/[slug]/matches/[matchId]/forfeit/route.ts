import { forfeitBody } from "@/lib/api-schemas";
import { requireAdmin } from "@/server/api/auth";
import { handle, json, parseBody } from "@/server/api/http";
import { getDb } from "@/server/db";
import { getPublicView } from "@/server/services/public-view";
import { forfeitMatch } from "@/server/services/results";

/**
 * PUT /api/t/:slug/matches/:matchId/forfeit (admin): `teamId` forfeits and the opponent wins by
 * walkover. Same response and edit-policy behaviour as the result route.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string; matchId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug, matchId } = await params;
    const tournament = await requireAdmin(request, slug);
    const body = await parseBody(request, forfeitBody);
    const outcome = await forfeitMatch(getDb(), tournament.id, matchId, body);
    return json({ ...outcome, view: await getPublicView(getDb(), slug) });
  });
}
