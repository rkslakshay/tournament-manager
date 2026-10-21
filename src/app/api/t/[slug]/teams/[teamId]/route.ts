import { requireAdmin } from "@/server/api/auth";
import { handle, json } from "@/server/api/http";
import { getDb } from "@/server/db";
import { removeTeam } from "@/server/services/teams";

/** DELETE /api/t/:slug/teams/:teamId (admin): remove a team before the start. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string; teamId: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug, teamId } = await params;
    const tournament = await requireAdmin(request, slug);
    return json({ teams: await removeTeam(getDb(), tournament.id, teamId) });
  });
}
