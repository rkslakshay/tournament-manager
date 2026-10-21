import { handle, json } from "@/server/api/http";
import { getDb } from "@/server/db";
import { getPublicView } from "@/server/services/public-view";

export const dynamic = "force-dynamic";

/** GET /api/t/:slug: the public, read-only view of a tournament. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    return json(await getPublicView(getDb(), slug), 200, { "Cache-Control": "no-store" });
  });
}
