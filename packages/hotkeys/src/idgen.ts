/**
 * Creates a resettable ID generator backed by a generator function.
 *
 * Each call to `next()` returns a unique string like `"hk_1"`, `"hk_2"`, etc.
 * Call `reset()` to restart the counter (used in singleton `destroy()`).
 */
export function createIdGenerator(prefix: string): { next(): string; reset(): void } {
  function* ids(): Generator<string, never> {
    let id = 0;
    while (true) {
      yield `${prefix}${++id}`;
    }
  }

  let gen = ids();

  return {
    next: () => gen.next().value,
    reset: () => {
      gen = ids();
    },
  };
}
