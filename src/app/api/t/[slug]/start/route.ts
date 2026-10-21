import { requireAdmin } from "@/server/api/auth";
import { handle, json } from "@/server/api/http";
import { getDb } from "@/server/db";
import { getPublicView } from "@/server/services/public-view";
import { startTournament } from "@/server/services/start-tournament";

/** POST /api/t/:slug/start (admin): generate fixtures and lock teams. Returns the new view. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const tournament = await requireAdmin(request, slug);
    await startTournament(getDb(), tournament.id);
    return json(await getPublicView(getDb(), slug));
  });
}
