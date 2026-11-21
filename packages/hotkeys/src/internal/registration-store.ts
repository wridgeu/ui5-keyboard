import type { HotkeyRegistration, ResolvedTarget } from "./types";

/**
 * Per-scope index bucket for hotkey registrations, keyed by target mode.
 * Each set iterates in registration order.
 */
interface ScopeRegistrationBucket {
  untargeted: Set<HotkeyRegistration>;
  targets: Map<EventTarget, Set<HotkeyRegistration>>;
  /** Secondary index: element id → registrations, for nodes replaced by a rerender. */
  targetIdIndex: Map<string, Set<HotkeyRegistration>>;
  /** Registrations with callback-based targets, resolved lazily at dispatch time. */
  callbackTargets: Set<HotkeyRegistration>;
}

/**
 * The single owner of which hotkey registrations are live.
 *
 * A registration is live from `add()` until `remove()` or `clear()`: while
 * live it is `active`, listed by `values()` and filed in exactly one section
 * of its scope's bucket (untargeted, element target, callback target), plus
 * the element-id index for rerender-safe target matching. `retarget()` is the
 * only way to change a live registration's target.
 *
 * @internal - owned by HotkeyManager, not part of the public API.
 */
export default class RegistrationStore {
  private _live: Set<HotkeyRegistration> = new Set();
  private _byScope: Map<string, ScopeRegistrationBucket> = new Map();

  /** Live registrations in registration order. */
  values(): IterableIterator<HotkeyRegistration> {
    return this._live.values();
  }

  add(registration: HotkeyRegistration): void {
    this._live.add(registration);
    this._index(registration);
  }

  /**
   * Mark the registration inactive and drop it from every index. Returns
   * `false` (a no-op) when it is not live.
   */
  remove(registration: HotkeyRegistration): boolean {
    if (!this._live.delete(registration)) return false;
    registration.active = false;
    this._deindex(registration);
    return true;
  }

  /** Move a live registration to `target`; a registration that is not live stays unindexed. */
  retarget(registration: HotkeyRegistration, target: ResolvedTarget): void {
    if (!this._live.has(registration)) return;
    this._deindex(registration);
    registration.options.target = target;
    this._index(registration);
  }

  /** Mark every registration inactive and drop them all. */
  clear(): void {
    for (const reg of this._live) {
      reg.active = false;
    }
    this._live.clear();
    this._byScope.clear();
  }

  /**
   * Get the bucket for a scope, or undefined if no registration is indexed there.
   */
  getBucket(scope: string): ScopeRegistrationBucket | undefined {
    return this._byScope.get(scope);
  }

  /**
   * Resolve the target registrations for a composedPath node.
   *
   * Merges object-identity hits with id-based index hits so that both
   * fresh and stale DOM references for the same element id contribute
   * registrations. This handles partial rerenders where the new DOM
   * node already has its own registrations while the old (stale) node's
   * registrations are still indexed by id.
   */
  getTargetRegistrations(bucket: ScopeRegistrationBucket, node: EventTarget): ReadonlySet<HotkeyRegistration> | null {
    const direct = bucket.targets.get(node);
    const indexed = node instanceof Element && node.id ? bucket.targetIdIndex.get(node.id) : undefined;

    if (!direct?.size) return indexed?.size ? indexed : null;
    if (!indexed?.size) return direct;
    return new Set([...direct, ...indexed]);
  }

  /**
   * Snapshot the untargeted registrations of a scope.
   */
  getUntargetedRegistrations(scope: string): ReadonlyArray<HotkeyRegistration> {
    return [...(this._byScope.get(scope)?.untargeted ?? [])];
  }

  private _index(registration: HotkeyRegistration): void {
    const bucket = this._getScopeBucket(registration.options.scope);
    const target = registration.options.target;

    if (target === null) {
      bucket.untargeted.add(registration);
      return;
    }

    if (target.kind === "callback") {
      bucket.callbackTargets.add(registration);
      return;
    }

    const el = target.el;
    let regs = bucket.targets.get(el);
    if (!regs) {
      regs = new Set<HotkeyRegistration>();
      bucket.targets.set(el, regs);
    }
    regs.add(registration);

    if (el.id) {
      let idxRegs = bucket.targetIdIndex.get(el.id);
      if (!idxRegs) {
        idxRegs = new Set<HotkeyRegistration>();
        bucket.targetIdIndex.set(el.id, idxRegs);
      }
      idxRegs.add(registration);
    }
  }

  private _deindex(registration: HotkeyRegistration): void {
    const scope = registration.options.scope;
    const bucket = this._byScope.get(scope);
    if (!bucket) return;

    const target = registration.options.target;

    if (target === null) {
      bucket.untargeted.delete(registration);
    } else if (target.kind === "callback") {
      bucket.callbackTargets.delete(registration);
    } else {
      const regs = bucket.targets.get(target.el);
      if (regs) {
        regs.delete(registration);
        if (regs.size === 0) {
          bucket.targets.delete(target.el);
        }
      }

      // Remove from the secondary index by locating the registration by value:
      // the element's id may have changed since _index() recorded it, and a
      // registration appears under at most one id key. Deindexing is not a hot
      // path, so the small scan beats maintaining a reverse map.
      for (const [idKey, idxRegs] of bucket.targetIdIndex) {
        if (idxRegs.delete(registration)) {
          if (idxRegs.size === 0) bucket.targetIdIndex.delete(idKey);
          break;
        }
      }
    }

    if (bucket.untargeted.size === 0 && bucket.targets.size === 0 && bucket.callbackTargets.size === 0) {
      this._byScope.delete(scope);
    }
  }

  private _getScopeBucket(scope: string): ScopeRegistrationBucket {
    let bucket = this._byScope.get(scope);
    if (!bucket) {
      bucket = {
        untargeted: new Set<HotkeyRegistration>(),
        targets: new Map<EventTarget, Set<HotkeyRegistration>>(),
        targetIdIndex: new Map<string, Set<HotkeyRegistration>>(),
        callbackTargets: new Set<HotkeyRegistration>(),
      };
      this._byScope.set(scope, bucket);
    }
    return bucket;
  }
}
