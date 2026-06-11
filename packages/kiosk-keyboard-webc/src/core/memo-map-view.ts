/**
 * Memoized `Map` view over a per-instance `Record` property.
 *
 * The render pass and lookup helpers read these views on every invocation,
 * so the Map is rebuilt only when the source object identity changes.
 * Consumers that want a fresh resolution should assign a new object (the
 * standard React/Lit pattern) rather than mutating in place.
 *
 * Entry names mirror the lookup-side normalization (trim + lowercase);
 * names that normalize to the empty string are skipped. Entries the
 * validator rejects (returns `undefined`) are skipped - the validator may
 * also transform the value (e.g. normalize it) and owns any warning. An
 * empty result is reported as `undefined` so callers treat "no instance
 * map" and "no valid entries" alike.
 */
export class MemoMapView<T> {
  private _key: object | null = null;
  private _map: ReadonlyMap<string, T> | undefined = undefined;

  /**
   * @param _validate Per-entry validator: returns the (possibly transformed)
   *   value to store, or `undefined` to skip the entry.
   */
  constructor(private readonly _validate: (name: string, value: unknown) => T | undefined) {}

  /** Returns the memoized Map view of `source`, or `undefined` when empty. */
  get(source: Record<string, unknown> | null): ReadonlyMap<string, T> | undefined {
    if (!source || typeof source !== "object") {
      this._key = null;
      this._map = undefined;
      return undefined;
    }
    if (this._key === source) return this._map;
    const entries: [string, T][] = [];
    for (const [name, value] of Object.entries(source)) {
      const validated = this._validate(name, value);
      if (validated === undefined) continue;
      const key = name.trim().toLowerCase();
      if (!key) continue;
      entries.push([key, validated]);
    }
    this._key = source;
    this._map = entries.length === 0 ? undefined : new Map(entries);
    return this._map;
  }
}
