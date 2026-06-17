import type { HotkeyRegistration } from "./types";

/**
 * Per-scope index bucket for hotkey registrations, keyed by target mode.
 */
export interface ScopeRegistrationBucket {
  untargetedIds: Set<string>;
  targets: Map<EventTarget, Set<string>>;
  /**
   * Secondary index: element id → registration ids. Enables O(1) fallback
   * when DOM nodes are replaced during rerendering. The id key each
   * registration was indexed under is recorded in `targetIdKeyByRegId`, so
   * deindex removes the original entry even if the element's `id` is mutated
   * after registration.
   */
  targetIdIndex: Map<string, Set<string>>;
  /**
   * Reverse map (registration id → the element id it was indexed under) that
   * keeps the secondary index symmetric: deindex always removes the entry
   * under the id used at index time, never the element's (possibly mutated)
   * current id.
   */
  targetIdKeyByRegId: Map<string, string>;
  /** Registrations with callback-based targets, resolved lazily at dispatch time. */
  callbackTargetIds: Set<string>;
}

/**
 * Scope/target index over hotkey registrations.
 *
 * Maintains per-scope buckets of registration ids keyed by target mode
 * (untargeted, element target, callback target) plus a secondary element-id
 * index for rerender-safe target matching. The owning HotkeyManager keeps
 * the id → registration map; the index stores ids only and resolves them
 * through the lookup callback provided at construction.
 *
 * @internal - owned by HotkeyManager, not part of the public API.
 */
export default class RegistrationIndex {
  private _byScope: Map<string, ScopeRegistrationBucket> = new Map();
  private _lookup: (id: string) => HotkeyRegistration | undefined;

  constructor(lookup: (id: string) => HotkeyRegistration | undefined) {
    this._lookup = lookup;
  }

  /**
   * Get the bucket for a scope, or undefined if no registration is indexed there.
   */
  getBucket(scope: string): ScopeRegistrationBucket | undefined {
    return this._byScope.get(scope);
  }

  /**
   * Add a registration to its scope bucket.
   */
  index(registration: HotkeyRegistration): void {
    const bucket = this._getScopeBucket(registration.options.scope);
    const opts = registration.options;

    if (opts.targetCallback) {
      bucket.callbackTargetIds.add(registration.id);
      return;
    }

    if (opts.target) {
      let ids = bucket.targets.get(opts.target);
      if (!ids) {
        ids = new Set<string>();
        bucket.targets.set(opts.target, ids);
      }
      ids.add(registration.id);

      // Maintain secondary index by element id for stale-reference fallback
      if (opts.target instanceof Element && opts.target.id) {
        let idxIds = bucket.targetIdIndex.get(opts.target.id);
        if (!idxIds) {
          idxIds = new Set<string>();
          bucket.targetIdIndex.set(opts.target.id, idxIds);
        }
        idxIds.add(registration.id);
        // Record the id key used, so deindex removes this exact entry even if
        // the element's id is later mutated.
        bucket.targetIdKeyByRegId.set(registration.id, opts.target.id);
      }
      return;
    }

    bucket.untargetedIds.add(registration.id);
  }

  /**
   * Remove a registration from its scope bucket.
   */
  deindex(registration: HotkeyRegistration): void {
    const scope = registration.options.scope;
    const bucket = this._byScope.get(scope);
    if (!bucket) return;

    const opts = registration.options;

    if (opts.targetCallback) {
      bucket.callbackTargetIds.delete(registration.id);
    } else if (opts.target) {
      const ids = bucket.targets.get(opts.target);
      if (ids) {
        ids.delete(registration.id);
        if (ids.size === 0) {
          bucket.targets.delete(opts.target);
        }
      }

      // Remove from the secondary index using the id key recorded at index
      // time, so a post-registration id mutation cannot orphan the entry.
      const indexedKey = bucket.targetIdKeyByRegId.get(registration.id);
      if (indexedKey !== undefined) {
        const idxIds = bucket.targetIdIndex.get(indexedKey);
        if (idxIds) {
          idxIds.delete(registration.id);
          if (idxIds.size === 0) {
            bucket.targetIdIndex.delete(indexedKey);
          }
        }
        bucket.targetIdKeyByRegId.delete(registration.id);
      }
    } else {
      bucket.untargetedIds.delete(registration.id);
    }

    if (bucket.untargetedIds.size === 0 && bucket.targets.size === 0 && bucket.callbackTargetIds.size === 0) {
      this._byScope.delete(scope);
    }
  }

  /**
   * Resolve registration IDs for a composedPath node.
   *
   * Merges object-identity hits with id-based index hits so that both
   * fresh and stale DOM references for the same element id contribute
   * registrations. This handles partial rerenders where the new DOM
   * node already has its own registrations while the old (stale) node's
   * registrations are still indexed by id.
   */
  getTargetRegistrationIds(bucket: ScopeRegistrationBucket, node: EventTarget): Set<string> | null {
    const direct = bucket.targets.get(node);
    const indexed = node instanceof Element && node.id ? bucket.targetIdIndex.get(node.id) : undefined;

    if (!direct?.size) return indexed?.size ? indexed : null;
    if (!indexed?.size) return direct;
    return new Set([...direct, ...indexed]);
  }

  /**
   * Resolve the untargeted registrations of a scope.
   */
  getUntargetedRegistrations(scope: string): ReadonlyArray<HotkeyRegistration> {
    const ids = this._byScope.get(scope)?.untargetedIds;
    if (!ids || ids.size === 0) return [];

    return this.getRegistrationsFromIds(ids);
  }

  /**
   * Look up a single registration by its id.
   */
  getRegistration(id: string): HotkeyRegistration | undefined {
    return this._lookup(id);
  }

  /**
   * Look up registrations by their IDs.
   */
  getRegistrationsFromIds(ids: Set<string>): ReadonlyArray<HotkeyRegistration> {
    const registrations: HotkeyRegistration[] = [];
    for (const id of ids) {
      const registration = this.getRegistration(id);
      if (registration) registrations.push(registration);
    }
    return registrations;
  }

  /**
   * Drop all buckets.
   */
  clear(): void {
    this._byScope.clear();
  }

  private _getScopeBucket(scope: string): ScopeRegistrationBucket {
    let bucket = this._byScope.get(scope);
    if (!bucket) {
      bucket = {
        untargetedIds: new Set<string>(),
        targets: new Map<EventTarget, Set<string>>(),
        targetIdIndex: new Map<string, Set<string>>(),
        targetIdKeyByRegId: new Map<string, string>(),
        callbackTargetIds: new Set<string>(),
      };
      this._byScope.set(scope, bucket);
    }
    return bucket;
  }
}
