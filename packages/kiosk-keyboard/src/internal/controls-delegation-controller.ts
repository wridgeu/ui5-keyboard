import Control from "sap/ui/core/Control";
import Element from "sap/ui/core/Element";
import Log from "sap/base/Log";
import type ManagedObject from "sap/ui/base/ManagedObject";
import View from "sap/ui/core/mvc/View";

type InputFocusDelegation = {
  onfocusin: () => void;
};

/**
 * Bridge to the host keyboard's public/property state and active-target
 * handling. Kept as callbacks (matching the sibling `FocusClaimService` /
 * `TargetInputSession` pattern) so the controls-reconciliation logic stays free
 * of UI5 control internals.
 */
interface ControlsDelegationHost {
  getControls(): string[];
  /** Parent of the host control, used to resolve view-local control ids. */
  getParent(): ManagedObject | null;
  /** Whether the host is in the DOM. */
  isRendered(): boolean;
  getEnabled(): boolean;
  getDocked(): boolean;
  getAutoShow(): boolean;
  /** Whether the (docked) keyboard is currently open. */
  isOpen(): boolean;
  show(): void;
  getActiveTargetId(): string;
  setActiveTarget(target?: string | Control): void;
  /**
   * Walks the UI5 parent chain of `candidate` and returns the first control
   * whose id matches a resolved controls entry, or null (composite-control
   * support, e.g. StepInput wrapping an inner Input).
   */
  resolveControlsAncestor(candidate: Control): Control | null;
}

/**
 * Owns the `controls` focus delegation: resolves the configured control ids to
 * live instances, attaches/detaches a focusin delegate on each so focusing one
 * makes it the active typing target, and auto-targets the sole resolved control.
 *
 * Reconciliation is diffed against the previously delegated instances so the
 * common focusin firehose (controls unchanged) short-circuits, and so an
 * instance swap under a stable id re-binds the delegate.
 */
export default class ControlsDelegationController {
  /** Resolved input-id -> canonical control-id map from the last sync. */
  private _registeredControlById = new Map<string, string>();
  /** Canonical control-ids currently claimed by this keyboard. */
  private _resolvedControlIds = new Set<string>();
  /** Live control instances the focus delegate is attached to, keyed by id. */
  private _delegatedInstances = new Map<string, Control>();
  /** Ids already reported as unresolvable, so the focusin firehose reports each once. */
  private readonly _reportedUnresolvedIds = new Set<string>();
  private readonly _delegate: InputFocusDelegation;

  constructor(private readonly _host: ControlsDelegationHost) {
    this._delegate = {
      onfocusin: () => {
        if (!this._host.getEnabled()) return;
        const active = Element.getActiveElement();
        if (!(active instanceof Control)) return;
        // For composite controls (e.g. StepInput), the active element is the
        // inner Input, but controls references the outer wrapper. Resolve the
        // registered ancestor so setActiveTarget gets the right control.
        const ancestor = this._host.resolveControlsAncestor(active);
        this._host.setActiveTarget(ancestor ?? active);
        // When docked with autoShow, show the keyboard for controls targets
        if (this._host.getDocked() && this._host.getAutoShow() && !this._host.isOpen()) {
          this._host.show();
        }
      },
    };
  }

  /** Canonical control-ids currently claimed by this keyboard (read-only). */
  getResolvedControlIds(): ReadonlySet<string> {
    return this._resolvedControlIds;
  }

  /**
   * Reconciles focus delegates against the currently resolved control
   * instances without forcing a re-render, because `controls` does not affect
   * renderer output directly.
   */
  sync(): void {
    const ids = this._host.getControls();
    const nextByInputId = new Map<string, string>();
    const prevControlIds = new Set(this._registeredControlById.values());
    const resolvedControlIds = new Set<string>();

    // Resolve current IDs to canonical control IDs.
    for (const inputId of ids) {
      const control = this._findControlById(inputId);
      if (!control) {
        this._reportUnresolved(inputId);
        continue;
      }

      // Forget the report, so an id that breaks again after resolving is reported again.
      this._reportedUnresolvedIds.delete(inputId);
      const controlId = control.getId();
      nextByInputId.set(inputId, controlId);
      resolvedControlIds.add(controlId);
    }

    // Fast path: if the resolved (inputId → controlId) map and all delegate
    // instances are unchanged, no DOM reconciliation is needed. This skips
    // the work on the common focusin firehose where the controls list stays
    // identical between events.
    if (this._isResolutionUnchanged(nextByInputId)) return;

    // Detach controls no longer referenced or whose instance changed.
    for (const controlId of prevControlIds) {
      const prev = this._delegatedInstances.get(controlId);
      if (!prev) continue;
      // Keep delegate if same controlId in next AND same Control instance
      if (resolvedControlIds.has(controlId) && Element.getElementById(controlId) === prev) continue;
      prev.removeEventDelegate(this._delegate);
    }

    // Attach controls newly referenced or whose instance changed.
    for (const controlId of resolvedControlIds) {
      const control = Element.getElementById(controlId);
      if (!(control instanceof Control)) continue;
      // Skip if same controlId in prev AND same Control instance
      if (prevControlIds.has(controlId) && this._delegatedInstances.get(controlId) === control) continue;
      control.addEventDelegate(this._delegate);
    }

    // Rebuild instance tracking
    this._delegatedInstances = new Map();
    for (const controlId of resolvedControlIds) {
      const control = Element.getElementById(controlId);
      if (control instanceof Control) {
        this._delegatedInstances.set(controlId, control);
      }
    }

    this._registeredControlById = nextByInputId;
    this._resolvedControlIds = resolvedControlIds;

    // Clear active target if it's no longer among the resolved controls
    const currentTargetId = this._host.getActiveTargetId();
    if (currentTargetId && resolvedControlIds.size > 0 && !resolvedControlIds.has(currentTargetId)) {
      this._host.setActiveTarget("");
    }

    // Auto-target when exactly one control is resolved and nothing is active yet
    if (resolvedControlIds.size === 1 && !this._host.getActiveTargetId()) {
      const [onlyId] = resolvedControlIds;
      if (onlyId) {
        const control = Element.getElementById(onlyId);
        if (control instanceof Control) {
          this._host.setActiveTarget(control);
        }
      }
    }
  }

  teardown(): void {
    for (const instance of this._delegatedInstances.values()) {
      instance.removeEventDelegate(this._delegate);
    }
    this._delegatedInstances.clear();
    this._registeredControlById.clear();
    this._resolvedControlIds.clear();
    this._reportedUnresolvedIds.clear();
  }

  /**
   * Reports a `controls` entry that names no control, once per id.
   *
   * Held back until the host has rendered, because any enclosing View is an ancestor by
   * then; earlier the view-local lookup may have nothing to walk and every id would look
   * wrong. A target built later remains indistinguishable from a typo, because the
   * element registry raises no event when one is added, so the message names both.
   */
  private _reportUnresolved(inputId: string): void {
    if (!this._host.isRendered()) return;
    if (this._reportedUnresolvedIds.has(inputId)) return;
    this._reportedUnresolvedIds.add(inputId);
    Log.warning(
      `"controls" entry "${inputId}" names no control, so focus is not delegated to it. ` +
        `IDs resolve against the enclosing View first, then globally, and must name a control; ` +
        `one created later is picked up on the next render or focus change.`,
      undefined,
      "ui5.kiosk.KioskKeyboard",
    );
  }

  /**
   * Returns true when {@link sync}'s freshly resolved (inputId → controlId) map
   * matches the cached one entry-for-entry AND every cached delegate instance
   * is still the same Control object.
   *
   * Used to skip reconciliation on document focusin events where the
   * controls property and resolved instances have not changed.
   */
  private _isResolutionUnchanged(nextByInputId: ReadonlyMap<string, string>): boolean {
    if (nextByInputId.size !== this._registeredControlById.size) return false;
    for (const [inputId, controlId] of nextByInputId) {
      if (this._registeredControlById.get(inputId) !== controlId) return false;
      if (this._delegatedInstances.get(controlId) !== Element.getElementById(controlId)) return false;
    }
    return true;
  }

  private _findControlById(targetId: string): Control | null {
    // Try view-local first (standard UI5 pattern - matches controller.byId())
    for (let parent: ManagedObject | null = this._host.getParent(); parent; parent = parent.getParent()) {
      if (parent instanceof View) {
        const found = parent.byId(targetId);
        if (found instanceof Control) return found;
      }
    }

    // Fall back to global registry
    const global = Element.getElementById(targetId);
    if (global instanceof Control) return global;

    return null;
  }
}
