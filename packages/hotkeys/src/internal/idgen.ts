/**
 * Monotonic source of registration ids.
 */
export interface IdGenerator {
  /** The next id in the sequence. Never repeats for a given generator. */
  next(): string;
}

/**
 * Creates an ID generator. Each `next()` returns `"<prefix>1"`, `"<prefix>2"`, etc.
 */
export function createIdGenerator(prefix: string): IdGenerator {
  let id = 0;
  return {
    next: () => `${prefix}${++id}`,
  };
}
