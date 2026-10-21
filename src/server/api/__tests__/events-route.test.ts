import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as eventsRoute } from "@/app/api/t/[slug]/events/route";
import { eventHub } from "@/server/events";
import { createTournament } from "@/server/services/tournaments";
import type { TestDb } from "@/server/__tests__/test-db";
import { ctx, request, useApiTestDb } from "./api-test-utils";

let t: TestDb;
beforeAll(async () => {
  t = await useApiTestDb();
});
afterAll(async () => t.cleanup());

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value } = await reader.read();
  return new TextDecoder().decode(value);
}

describe("GET /api/t/:slug/events", () => {
  it("streams published events and unsubscribes when the client goes away", async () => {
    const { slug } = await createTournament(t.db, {
      name: "Live",
      sport: "Go",
      config: { format: "ROUND_ROBIN" },
    });
    const abort = new AbortController();
    const req = new Request("http://localhost/api/t/x/events", { signal: abort.signal });
    const res = await eventsRoute(req, ctx({ slug }));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    expect(await readChunk(reader)).toContain("retry: 3000");
    expect(eventHub.subscriberCount(slug)).toBe(1);

    eventHub.publish(slug, { type: "match_updated", matchIds: ["m1"] });
    expect(await readChunk(reader)).toBe(
      'event: match_updated\ndata: {"type":"match_updated","matchIds":["m1"]}\n\n',
    );

    abort.abort();
    expect(eventHub.subscriberCount(slug)).toBe(0);
  });

  it("returns 404 for unknown tournaments", async () => {
    const res = await eventsRoute(request("GET"), ctx({ slug: "missing" }));
    expect(res.status).toBe(404);
  });
});
