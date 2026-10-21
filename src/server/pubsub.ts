/** Event types, the pub/sub contract, and the local listener registry both adapters share. */

export type TournamentEvent =
  { type: "match_updated"; matchIds: string[] } | { type: "tournament_updated" };

export type Listener = (event: TournamentEvent) => void;

export interface PubSub {
  /** Listen to one tournament's events. Returns the unsubscribe function. */
  subscribe(slug: string, listener: Listener): () => void;
  /** Send an event to every subscriber of the tournament (on every instance, for Redis). */
  publish(slug: string, event: TournamentEvent): void;
  /** Open subscriptions on this instance (for tests and diagnostics). */
  subscriberCount(slug: string): number;
}

/** Local listener registry shared by both adapters. A failing listener never blocks the others. */
export class ListenerRegistry {
  private readonly listeners = new Map<string, Set<Listener>>();

  /** Returns true when this is the first listener for the slug. */
  add(slug: string, listener: Listener): boolean {
    const set = this.listeners.get(slug) ?? new Set<Listener>();
    const first = set.size === 0;
    set.add(listener);
    this.listeners.set(slug, set);
    return first;
  }

  /** Returns true when the slug has no listeners left. */
  remove(slug: string, listener: Listener): boolean {
    const set = this.listeners.get(slug);
    if (!set) return false;
    set.delete(listener);
    if (set.size > 0) return false;
    this.listeners.delete(slug);
    return true;
  }

  deliver(slug: string, event: TournamentEvent): void {
    for (const listener of [...(this.listeners.get(slug) ?? [])]) {
      try {
        listener(event);
      } catch (error) {
        console.error("Event listener failed", error);
      }
    }
  }

  count(slug: string): number {
    return this.listeners.get(slug)?.size ?? 0;
  }
}
