import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import RedisMock from "ioredis-mock";
import {
  createMemoryPubSub,
  createPubSub,
  type PubSub,
  type TournamentEvent,
} from "@/server/events";
import { createRedisPubSubFrom } from "@/server/redis-pubsub";

interface AdapterUnderTest {
  name: string;
  /** Two hubs as two server instances would see them. */
  instances: () => [PubSub, PubSub];
  /** Whether an event published on one instance reaches subscribers on the other. */
  sharedAcrossInstances: boolean;
}

function redisInstance(): PubSub {
  const connection = new RedisMock();
  return createRedisPubSubFrom({ publisher: connection, subscriber: connection.duplicate() });
}

const ADAPTERS: AdapterUnderTest[] = [
  {
    name: "in-memory",
    instances: () => [createMemoryPubSub(), createMemoryPubSub()],
    sharedAcrossInstances: false,
  },
  {
    name: "redis (ioredis-mock)",
    instances: () => [redisInstance(), redisInstance()],
    sharedAcrossInstances: true,
  },
];

const updated: TournamentEvent = { type: "match_updated", matchIds: ["m1"] };
const slug = () => `slug-${randomUUID()}`;
/** Long enough for an async adapter to have delivered anything it was going to deliver. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe.each(ADAPTERS)("pub/sub contract: $name", ({ instances, sharedAcrossInstances }) => {
  it("delivers to every subscriber of the slug and to no other slug", async () => {
    const [hub] = instances();
    const [a, b] = [slug(), slug()];
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    hub.subscribe(a, first);
    hub.subscribe(a, second);
    hub.subscribe(b, other);
    await settle();
    hub.publish(a, updated);
    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledWith(updated);
      expect(second).toHaveBeenCalledWith(updated);
    });
    await settle();
    expect(other).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
  });

  it("stops delivering after unsubscribe and tracks local subscribers", async () => {
    const [hub] = instances();
    const s = slug();
    const listener = vi.fn();
    const off = hub.subscribe(s, listener);
    expect(hub.subscriberCount(s)).toBe(1);
    off();
    expect(hub.subscriberCount(s)).toBe(0);
    await settle();
    hub.publish(s, updated);
    await settle();
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps delivering when a listener throws", async () => {
    const [hub] = instances();
    const s = slug();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const good = vi.fn();
    hub.subscribe(s, () => {
      throw new Error("boom");
    });
    hub.subscribe(s, good);
    await settle();
    hub.publish(s, { type: "tournament_updated" });
    await vi.waitFor(() => expect(good).toHaveBeenCalledWith({ type: "tournament_updated" }));
    spy.mockRestore();
  });

  it(
    sharedAcrossInstances
      ? "delivers events published on another instance"
      : "is single-process: another instance's events do not arrive",
    async () => {
      const [one, two] = instances();
      const s = slug();
      const listener = vi.fn();
      two.subscribe(s, listener);
      await settle();
      one.publish(s, updated);
      if (sharedAcrossInstances) {
        await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(updated));
      } else {
        await settle();
        expect(listener).not.toHaveBeenCalled();
      }
    },
  );
});

describe("redis adapter details", () => {
  it("ignores malformed messages and foreign channels", async () => {
    const connection = new RedisMock();
    const hub = createRedisPubSubFrom({
      publisher: connection,
      subscriber: connection.duplicate(),
    });
    const s = slug();
    const listener = vi.fn();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    hub.subscribe(s, listener);
    await settle();
    await connection.publish(`tm:events:${s}`, "{not json");
    await connection.publish("someone-else", JSON.stringify(updated));
    await settle();
    expect(listener).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith("Ignoring malformed event", expect.anything());
    spy.mockRestore();
  });
});

describe("createPubSub", () => {
  it("uses memory without REDIS_URL and Redis (connecting lazily) with it", () => {
    const memory = createPubSub(undefined);
    expect(memory.subscriberCount("x")).toBe(0);
    const redis = createPubSub("redis://localhost:6390");
    expect(redis.subscriberCount("x")).toBe(0);
    expect(redis).not.toBe(memory);
  });
});
