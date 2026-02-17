/**
 * Creates an ID generator backed by a generator function.
 *
 * Each call to `next()` returns a unique string like `"hk_1"`, `"hk_2"`, etc.
 */
export function createIdGenerator(prefix: string): { next(): string } {
  function* ids(): Generator<string, never> {
    let id = 0;
    while (true) {
      yield `${prefix}${++id}`;
    }
  }

  const gen = ids();

  return {
    next: () => gen.next().value,
  };
}
