import { reorderTeamsBody } from "@/lib/api-schemas";
import { requireAdmin } from "@/server/api/auth";
import { handle, json, parseBody } from "@/server/api/http";
import { getDb } from "@/server/db";
import { reorderTeams } from "@/server/services/teams";

/** PUT /api/t/:slug/teams/order (admin): reseed teams, strongest first. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const tournament = await requireAdmin(request, slug);
    const { teamIds } = await parseBody(request, reorderTeamsBody);
    return json({ teams: await reorderTeams(getDb(), tournament.id, teamIds) });
  });
}
