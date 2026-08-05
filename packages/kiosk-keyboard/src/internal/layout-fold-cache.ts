import Log from "sap/base/Log";
import type CustomLayout from "../CustomLayout";
import {
  describeDiagnostic,
  foldCustomLayouts,
  type CustomLayoutFold,
  type DiagnosticVocabulary,
  type LayoutDiagnostic,
} from "./custom-layout-fold";
import { getRegisteredLayoutNames, isBuiltInLayout } from "./layout-registry";

/** How this twin spells the surface names a fold diagnostic has to quote. */
const KIOSK_DIAGNOSTIC_VOCABULARY: DiagnosticVocabulary = {
  customLayouts: "customLayouts aggregation",
  customLayout: "<kiosk:CustomLayout>",
  builtInLayouts: getRegisteredLayoutNames(),
};

/** The slice of the control the cache reads its children from and reports back into. */
interface LayoutFoldCacheHost {
  getCustomLayouts(): CustomLayout[];
  /**
   * Run after a rebuild. The width tier resolves the counterpart through this
   * fold, so a rebuild can change its answer at an unchanged width - a
   * model-bound `rows` arriving after first paint is the ordinary case.
   */
  onRebuilt(): void;
}

/**
 * Owns the folded view of the `customLayouts` aggregation - the lookup maps
 * every resolution path reads - and the once-per-fault diagnostics it produces.
 *
 * Staleness arrives on two signals, one per axis. Structure - adds, inserts,
 * removals, reorders - is read off the element list in `get()`, because
 * `removeAggregation`, `removeAllAggregation` and `destroyAggregation`
 * invalidate without naming a child. Content - a property write inside a
 * parented custom layout - arrives as `invalidate(customLayout)` and drops the
 * cache through `drop()`.
 */
export default class LayoutFoldCache {
  private readonly _host: LayoutFoldCacheHost;
  /** The folded lookup maps, or `null` while the cache is cold or stale. */
  private _fold: CustomLayoutFold | null = null;
  /** The elements the cached fold was built from, compared element-wise on read. */
  private _children: readonly CustomLayout[] = [];
  /** Diagnostics already reported for the current configuration, keyed by content. */
  private readonly _reported = new Set<string>();

  constructor(host: LayoutFoldCacheHost) {
    this._host = host;
  }

  /** The lookup maps the resolution pipeline reads, rebuilding them if stale. */
  get(): CustomLayoutFold {
    const children = this._host.getCustomLayouts();
    if (this._fold && this._sameChildren(children)) return this._fold;
    // `getAggregation` hands back a fresh array each call, so this needs no copy.
    this._children = children;
    this._fold = foldCustomLayouts(
      children.map((child) => child.toSpec()),
      isBuiltInLayout,
    );
    this.report(this._fold.diagnostics);
    this._host.onRebuilt();
    return this._fold;
  }

  /**
   * Drops the cached fold so the next read rebuilds it.
   *
   * Never reports diagnostics, so it is safe to call from `invalidate`: a
   * re-fold driven by an invalidation would otherwise run during rendering.
   */
  drop(): void {
    this._fold = null;
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
      Log.warning(describeDiagnostic(d, KIOSK_DIAGNOSTIC_VOCABULARY), undefined, "ui5.kiosk.KioskKeyboard");
    }
  }

  private _sameChildren(children: readonly CustomLayout[]): boolean {
    const cached = this._children;
    if (children.length !== cached.length) return false;
    for (let i = 0; i < children.length; i++) {
      if (children[i] !== cached[i]) return false;
    }
    return true;
  }
}
