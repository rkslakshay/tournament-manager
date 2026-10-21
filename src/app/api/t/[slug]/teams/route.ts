import { addTeamsBody } from "@/lib/api-schemas";
import { requireAdmin } from "@/server/api/auth";
import { handle, json, parseBody } from "@/server/api/http";
import { getDb } from "@/server/db";
import { addTeams } from "@/server/services/teams";

/** POST /api/t/:slug/teams (admin): add one or more teams. Returns every team by seed. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const tournament = await requireAdmin(request, slug);
    const { names } = await parseBody(request, addTeamsBody);
    return json({ teams: await addTeams(getDb(), tournament.id, names) }, 201);
  });
}
