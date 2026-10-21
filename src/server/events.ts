/**
 * Publish/subscribe for live updates, keyed by tournament slug.
 *
 * Services publish after their transaction commits; the SSE endpoint forwards events to public
 * viewers, who then refetch the full view. Two adapters implement the same contract:
 * - in memory (default): one process only;
 * - Redis (when `REDIS_URL` is set): events reach viewers connected to any server instance.
 */
import { ListenerRegistry, type PubSub } from "./pubsub";
import { createRedisPubSub } from "./redis-pubsub";

export type { Listener, PubSub, TournamentEvent } from "./pubsub";

/** Single-process hub: publish delivers synchronously to local listeners. */
export function createMemoryPubSub(): PubSub {
  const registry = new ListenerRegistry();
  return {
    subscribe(slug, listener) {
      registry.add(slug, listener);
      return () => void registry.remove(slug, listener);
    },
    publish: (slug, event) => registry.deliver(slug, event),
    subscriberCount: (slug) => registry.count(slug),
  };
}

/** Redis when `redisUrl` is given, otherwise in memory. */
export function createPubSub(redisUrl: string | undefined): PubSub {
  return redisUrl ? createRedisPubSub(redisUrl) : createMemoryPubSub();
}

const globalForHub = globalThis as unknown as { eventHub?: PubSub };

/** The process-wide hub (kept across dev hot reloads). */
export const eventHub: PubSub =
  globalForHub.eventHub ?? (globalForHub.eventHub = createPubSub(process.env.REDIS_URL));
