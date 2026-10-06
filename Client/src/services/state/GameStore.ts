import type { GameState, Listener, ReadonlyStore } from './types';

/**
 * The single writable store (AD-5). Only services/ and the app/ composition root
 * may import this module (dependency-cruiser rule game-store-writes-only-in-services).
 */
export class GameStore implements ReadonlyStore {
  private state: GameState;
  private readonly listeners = new Set<Listener>();

  constructor(initial: GameState) {
    this.state = initial;
  }

  get(): GameState {
    return this.state;
  }

  commit(next: GameState): void {
    if (next === this.state) return;
    const previous = this.state;
    this.state = next;
    for (const listener of [...this.listeners]) listener(next, previous);
  }

  update(change: (s: GameState) => GameState): void {
    this.commit(change(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  select<T>(selector: (s: GameState) => T, onChange: (value: T) => void): () => void {
    let current = selector(this.state);
    return this.subscribe((s) => {
      const next = selector(s);
      if (!Object.is(next, current)) {
        current = next;
        onChange(next);
      }
    });
  }

  /** A read-only facade for presentation. */
  readonly(): ReadonlyStore {
    return { get: () => this.get(), subscribe: (l) => this.subscribe(l), select: (s, c) => this.select(s, c) };
  }
}
