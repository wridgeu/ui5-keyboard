/**
 * Creates an ID generator. Each `next()` returns `"<prefix>1"`, `"<prefix>2"`, etc.
 */
export function createIdGenerator(prefix: string): { next(): string } {
  let id = 0;
  return {
    next: () => `${prefix}${++id}`,
  };
}
