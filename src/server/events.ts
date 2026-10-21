/**
 * In-memory publish/subscribe hub for live updates, keyed by tournament slug.
 *
 * Services publish after their transaction commits; the SSE endpoint forwards events to public
 * viewers, who then refetch the full view. One process only: with several server instances this
 * hub would be replaced by Redis pub/sub (ARCHITECTURE.md section 5, Stretch S.2).
 */

export type TournamentEvent =
  { type: "match_updated"; matchIds: string[] } | { type: "tournament_updated" };

type Listener = (event: TournamentEvent) => void;

class EventHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  /** Listen to one tournament's events. Returns the unsubscribe function. */
  subscribe(slug: string, listener: Listener): () => void {
    const set = this.listeners.get(slug) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(slug, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(slug);
    };
  }

  /** Deliver an event to every current subscriber. A failing listener never blocks the others. */
  publish(slug: string, event: TournamentEvent): void {
    for (const listener of [...(this.listeners.get(slug) ?? [])]) {
      try {
        listener(event);
      } catch (error) {
        console.error("Event listener failed", error);
      }
    }
  }

  /** Number of open subscriptions for a tournament (for tests and diagnostics). */
  subscriberCount(slug: string): number {
    return this.listeners.get(slug)?.size ?? 0;
  }
}

const globalForHub = globalThis as unknown as { eventHub?: EventHub };

/** The process-wide hub (kept across dev hot reloads). */
export const eventHub: EventHub = globalForHub.eventHub ?? (globalForHub.eventHub = new EventHub());
