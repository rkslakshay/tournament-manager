import Redis from "ioredis";
import { ListenerRegistry, type PubSub, type TournamentEvent } from "./pubsub";

const CHANNEL_PREFIX = "tm:events:";

/** The two connections the adapter needs (a subscribed Redis connection cannot publish). */
export interface RedisConnections {
  publisher: Pick<Redis, "publish">;
  subscriber: Pick<Redis, "subscribe" | "unsubscribe" | "on">;
}

/**
 * Pub/sub over Redis so live updates reach viewers on every server instance. Each instance
 * subscribes to a tournament's channel only while it has local viewers for it; publishing goes
 * through Redis even for local viewers, so every instance behaves the same.
 */
export function createRedisPubSub(url: string): PubSub {
  const publisher = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  return createRedisPubSubFrom({ publisher, subscriber: publisher.duplicate() });
}

/** Build the adapter on existing connections (used by tests with ioredis-mock). */
export function createRedisPubSubFrom({ publisher, subscriber }: RedisConnections): PubSub {
  const registry = new ListenerRegistry();
  subscriber.on("message", (channel: string, message: string) => {
    if (!channel.startsWith(CHANNEL_PREFIX)) return;
    try {
      registry.deliver(
        channel.slice(CHANNEL_PREFIX.length),
        JSON.parse(message) as TournamentEvent,
      );
    } catch (error) {
      console.error("Ignoring malformed event", error);
    }
  });

  return {
    subscribe(slug, listener) {
      if (registry.add(slug, listener)) {
        subscriber
          .subscribe(CHANNEL_PREFIX + slug)
          .catch((error) => console.error("Redis subscribe failed", error));
      }
      return () => {
        if (registry.remove(slug, listener)) {
          subscriber
            .unsubscribe(CHANNEL_PREFIX + slug)
            .catch((error) => console.error("Redis unsubscribe failed", error));
        }
      };
    },
    publish(slug, event) {
      publisher.publish(CHANNEL_PREFIX + slug, JSON.stringify(event)).catch((error) => {
        // Viewers still re-sync on reconnect and every 30 s, so a lost event only delays them.
        console.error("Redis publish failed", error);
      });
    },
    subscriberCount: (slug) => registry.count(slug),
  };
}
