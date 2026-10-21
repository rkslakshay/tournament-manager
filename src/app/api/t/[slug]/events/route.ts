import { handle } from "@/server/api/http";
import { getDb } from "@/server/db";
import { ServiceError } from "@/server/errors";
import { eventHub, type TournamentEvent } from "@/server/events";

export const dynamic = "force-dynamic";
// Serverless hosts cap function duration. When the stream ends, EventSource reconnects on its own
// and the client refetches the full view, so nothing is missed.
export const maxDuration = 60;

const HEARTBEAT_MS = 25_000;

/**
 * GET /api/t/:slug/events: Server-Sent Events stream of `match_updated` and
 * `tournament_updated` events. Viewers refetch the public view when one arrives. A comment
 * heartbeat keeps proxies from closing idle connections.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  return handle(async () => {
    const { slug } = await params;
    const exists = await getDb().tournament.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) throw new ServiceError("NOT_FOUND", "Tournament not found");

    const encoder = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (text: string) => {
          try {
            controller.enqueue(encoder.encode(text));
          } catch {
            cleanup();
          }
        };
        send("retry: 3000\n: connected\n\n");
        const unsubscribe = eventHub.subscribe(slug, (event: TournamentEvent) => {
          send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        });
        const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        };
        request.signal.addEventListener("abort", () => cleanup());
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });
}
