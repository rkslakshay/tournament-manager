import { scheduleBody } from "@/lib/api-schemas";
import { requireAdmin } from "@/server/api/auth";
import { handle, json, parseBody } from "@/server/api/http";
import { getDb } from "@/server/db";
import { scheduleTournament } from "@/server/services/schedule";

/** POST /api/t/:slug/schedule (admin): run the auto-scheduler over all open matches. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const tournament = await requireAdmin(request, slug);
    const body = await parseBody(request, scheduleBody);
    return json(await scheduleTournament(getDb(), tournament.id, body));
  });
}
