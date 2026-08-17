import { isCustomLayout, type ICustomLayout } from "../CustomLayout.js";
import type { CustomLayoutSpec } from "../types.js";
import {
  describeDiagnostic,
  foldCustomLayouts,
  EMPTY_FOLD,
  type CustomLayoutFold,
  type DiagnosticVocabulary,
  type LayoutDiagnostic,
} from "./custom-layout-fold.js";
import { getRegisteredLayoutNames, isBuiltInLayout } from "./layout-registry.js";

/** How this twin spells the surface names a fold diagnostic has to quote. */
const WEBC_DIAGNOSTIC_VOCABULARY: DiagnosticVocabulary = {
  customLayouts: "customLayouts slot",
  customLayout: "<kiosk-keyboard-custom-layout>",
  builtInLayouts: getRegisteredLayoutNames(),
};

/** Element-wise identity comparison: `_updateSlots` assigns a new array on every run. */
const sameElements = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((el, i) => el === b[i]);

/** The slice of the host the cache reads its children from and reports back into. */
interface LayoutFoldCacheHost {
  getCustomLayouts(): readonly ICustomLayout[];
  /**
   * Run after a rebuild. The width tier resolves the counterpart through this
   * fold, so a rebuild can change its answer at an unchanged width - a
   * counterpart slotted after first paint is the ordinary case.
   */
  onRebuilt(): void;
}

/**
 * Owns the folded view of the `customLayouts` slot - the lookup maps every
 * resolution path reads - and the once-per-fault diagnostics it produces.
 *
 * Read on demand rather than assembled on invalidation: `_invalidate` is suppressed
 * until the first render completes while `_processChildren` populates the slot
 * before it, so an invalidation-driven fold would be empty for the whole first
 * frame. The slot array is populated by then, which is what makes a
 * `<kiosk-keyboard-custom-layout>` present at connect time honoured on first paint.
 *
 * Rebuilt only when the slotted elements change identity or one of them bumps its
 * revision, so diagnostics are emitted once per real change, not once per read. The
 * revision is read off the children rather than delivered to `onInvalidation`, which
 * a pending language change suppresses on a `languageAware` host.
 */
export class LayoutFoldCache {
  private readonly _host: LayoutFoldCacheHost;
  private _fold: CustomLayoutFold = EMPTY_FOLD;
  private _key: readonly ICustomLayout[] = [];
  private _revisions: readonly number[] = [];
  /** Diagnostics already reported for the current configuration, keyed by content. */
  private readonly _reported = new Set<string>();

  constructor(host: LayoutFoldCacheHost) {
    this._host = host;
  }

  /** The lookup maps the resolution pipeline reads, rebuilding them if stale. */
  get(): CustomLayoutFold {
    const children = this._host.getCustomLayouts();
    const revisions = children.map((child) => child.revision);
    if (sameElements(this._key, children) && sameElements(this._revisions, revisions)) return this._fold;
    this._key = children;
    this._revisions = revisions;

    const specs: CustomLayoutSpec[] = [];
    // SAFETY: the slot admits any element at runtime, so a foreign child is reachable
    // even though the declared type is narrower; every slotted child is an element, and
    // `isCustomLayout` decides which ones carry the custom-layout contract.
    for (const child of children as readonly HTMLElement[]) {
      if (isCustomLayout(child)) specs.push(child.toSpec());
      else
        console.warn(
          `[kiosk-keyboard] Ignoring <${child.localName}> in the customLayouts slot: not a <kiosk-keyboard-custom-layout>.`,
        );
    }
    this._fold = foldCustomLayouts(specs, isBuiltInLayout);
    this.report(this._fold.diagnostics);
    this._host.onRebuilt();
    return this._fold;
  }

  /** Logs what the fold rejected, once per distinct complaint per configuration. */
  report(diagnostics: readonly LayoutDiagnostic[]): void {
    if (diagnostics.length === 0) {
      // Everything resolves: a fault re-introduced later is reported again.
      this._reported.clear();
      return;
    }
    for (const d of diagnostics) {
      const key = `${d.code}|${d.layout}|${d.other ?? ""}|${d.value ?? ""}`;
      if (this._reported.has(key)) continue;
      this._reported.add(key);
      console.warn(`[kiosk-keyboard] ${describeDiagnostic(d, WEBC_DIAGNOSTIC_VOCABULARY)}`);
    }
  }
}
