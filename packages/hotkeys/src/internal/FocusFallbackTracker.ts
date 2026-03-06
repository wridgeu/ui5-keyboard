import Log from "sap/base/Log";
import { getEventTarget } from "./dom";

const LOG_COMPONENT = "ui5.hotkeys.FocusFallbackTracker";

/**
 * Maximum elapsed time (ms) between a blur event and a subsequent Escape
 * keydown for the focus-fallback path to activate. Covers the typical UI5
 * rerender cycle (~200-800ms) plus browser task-scheduling jitter. Values
 * below 800ms miss slow rerenders; values above 2000ms risk stale matches
 * after the user has mentally moved on.
 */
/** @internal — exported for testing only */
export const FOCUS_PATH_FALLBACK_TTL_MS = 1200;

/**
 * Tracks focus/blur state and augments keyboard event paths for
 * target-scoped matching when the browser dispatches events from
 * generic root nodes (body, UIArea) after focus transitions.
 *
 * @internal - owned by HotkeyManager, not part of the public API.
 */
export default class FocusFallbackTracker {
  private _lastFocusedElement: WeakRef<Element> | null = null;
  private _lastFocusedAt = 0;
  private _lastBlurredElement: WeakRef<Element> | null = null;
  private _lastBlurredAt = 0;
  private _blurSeq = 0;
  private _consumedBlurSeq = 0;
  private _genericRootIds = new Set<string>();

  private readonly _focusInHandler = this._onFocusIn.bind(this);
  private readonly _focusOutHandler = this._onFocusOut.bind(this);

  constructor() {
    document.addEventListener("focusin", this._focusInHandler, true);
    document.addEventListener("focusout", this._focusOutHandler, true);
  }

  /**
   * Main entry point - augments the event path with activeElement ancestry
   * and focus fallback when needed.
   *
   * Order matters: activeElement augmentation must run first so that
   * the focus fallback's `resolvedPath.includes(lastFocusedElement)` guard
   * can detect elements already injected by the activeElement pass.
   */
  augmentPath(event: KeyboardEvent, resolvedPath: EventTarget[]): void {
    this._augmentPathWithActiveElement(resolvedPath);
    this._augmentPathWithFocusFallback(event, resolvedPath);
  }

  addGenericRootId(id: string): void {
    const trimmed = this._validateId(id, "addGenericRootId");
    if (!trimmed) return;
    this._genericRootIds.add(trimmed);
  }

  removeGenericRootId(id: string): void {
    const trimmed = this._validateId(id, "removeGenericRootId");
    if (!trimmed) return;
    this._genericRootIds.delete(trimmed);
  }

  destroy(): void {
    document.removeEventListener("focusin", this._focusInHandler, true);
    document.removeEventListener("focusout", this._focusOutHandler, true);
    this._lastFocusedElement = null;
    this._lastFocusedAt = 0;
    this._lastBlurredElement = null;
    this._lastBlurredAt = 0;
    this._blurSeq = 0;
    this._consumedBlurSeq = 0;
    this._genericRootIds.clear();
  }

  // ──────────────────────────────────────────────
  // Private: focus event handlers
  // ──────────────────────────────────────────────

  private _onFocusIn(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    // Skip generic root containers - focus bounces there as a side-effect of
    // rendering and does not represent a meaningful user focus target.  Keeping
    // the previous value ensures the fallback in augmentPath still points at
    // the real element the user was interacting with.
    if (this._isGenericRootNode(target)) {
      return;
    }
    this._lastFocusedElement = new WeakRef(target);
    this._lastFocusedAt = Date.now();
  }

  private _onFocusOut(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (this._isGenericRootNode(target)) {
      return;
    }
    this._lastBlurredElement = new WeakRef(target);
    this._lastBlurredAt = Date.now();
    this._blurSeq++;
  }

  // ──────────────────────────────────────────────
  // Private: path augmentation
  // ──────────────────────────────────────────────

  /**
   * Include the active-element ancestry in the path. Some environments
   * dispatch keyboard events on document/window even while an input
   * still has focus.
   *
   * Nodes are inserted before the first generic root entry so that
   * innermost-wins ordering is preserved during target matching.
   */
  private _augmentPathWithActiveElement(resolvedPath: EventTarget[]): void {
    const activeElement = document.activeElement;
    if (!activeElement || !activeElement.isConnected || resolvedPath.includes(activeElement)) {
      return;
    }

    const newNodes = this._getActiveElementPath(activeElement).filter((node) => !resolvedPath.includes(node));
    if (newNodes.length === 0) {
      return;
    }

    this._insertBeforeGenericRoot(resolvedPath, newNodes);
  }

  /**
   * Some browsers/extensions dispatch Escape after focus has already moved to
   * body/content. Inject the most recently focused element's ancestry as a
   * short-lived, one-shot fallback to preserve target-scoped matching.
   */
  private _augmentPathWithFocusFallback(event: KeyboardEvent, resolvedPath: EventTarget[]): void {
    if (!this._shouldUseFocusPathFallback(event, resolvedPath)) {
      return;
    }

    const lastFocusedElement = this._lastFocusedElement?.deref();
    if (!lastFocusedElement || !lastFocusedElement.isConnected || resolvedPath.includes(lastFocusedElement)) {
      return;
    }

    const now = Date.now();
    const hasRecentFocus = now - this._lastFocusedAt <= FOCUS_PATH_FALLBACK_TTL_MS;
    const hasRecentBlur =
      this._areElementsRelated(this._lastBlurredElement?.deref() ?? null, lastFocusedElement) &&
      now - this._lastBlurredAt <= FOCUS_PATH_FALLBACK_TTL_MS;
    const hasUnconsumedBlur = hasRecentBlur && this._consumedBlurSeq !== this._blurSeq;
    // Augment when:
    // (a) focus is recent and no related blur occurred yet - element is still focused, or
    // (b) a related blur happened but hasn't been consumed - one-shot Escape fallback.
    const shouldAugment = (hasRecentFocus && !hasRecentBlur) || hasUnconsumedBlur;

    if (!shouldAugment) {
      return;
    }

    const newNodes = this._getActiveElementPath(lastFocusedElement).filter((node) => !resolvedPath.includes(node));
    if (newNodes.length > 0) {
      this._insertBeforeGenericRoot(resolvedPath, newNodes);
    }
    if (hasUnconsumedBlur) {
      this._consumedBlurSeq = this._blurSeq;
    }
  }

  /**
   * Detect generic root-target keyboard dispatches where composedPath lacks
   * concrete focus ancestry (for example only #content/document/window).
   */
  private _shouldUseFocusPathFallback(event: KeyboardEvent, eventPath: EventTarget[]): boolean {
    if (event.key !== "Escape") {
      return false;
    }

    const eventTarget = getEventTarget(event);
    if (this._isGenericRootNode(eventTarget)) {
      return true;
    }

    return eventPath.every((node) => this._isGenericRootNode(node));
  }

  // ──────────────────────────────────────────────
  // Private: DOM helpers
  // ──────────────────────────────────────────────

  /**
   * Insert `newNodes` into `path` before the first generic root entry.
   * Falls back to appending if no generic root is found.
   */
  private _insertBeforeGenericRoot(path: EventTarget[], newNodes: EventTarget[]): void {
    const insertIdx = path.findIndex((node) => this._isGenericRootNode(node));
    if (insertIdx >= 0) {
      path.splice(insertIdx, 0, ...newNodes);
    } else {
      path.push(...newNodes);
    }
  }

  private _validateId(id: string, method: string): string | null {
    if (!id || !id.trim()) {
      Log.warning(`${method}: ignoring empty or whitespace-only id`, undefined, LOG_COMPONENT);
      return null;
    }
    return id.trim();
  }

  /**
   * Whether a node is a generic top-level dispatch target.
   *
   * Matches document, window, html, body, UI5 UIArea root nodes, and
   * any ID registered via {@link addGenericRootId}.
   *
   * **UI5 dependency:** UIArea roots are detected via the
   * `data-sap-ui-area` attribute that `sap.ui.core.UIArea` stamps on
   * its root DOM element. This is a stable, public-facing attribute
   * used by UI5's own CSS selectors and test infrastructure.
   */
  private _isGenericRootNode(node: EventTarget | null): boolean {
    if (!node) {
      return true;
    }
    if (node === document || node === window) {
      return true;
    }
    if (!(node instanceof Element)) {
      return false;
    }
    return (
      node === document.documentElement ||
      node === document.body ||
      node.hasAttribute("data-sap-ui-area") ||
      this._genericRootIds.has(node.id)
    );
  }

  /**
   * Whether the two elements are equal or in any ancestor/descendant relationship.
   */
  private _areElementsRelated(a: Element | null, b: Element | null): boolean {
    if (!a || !b) {
      return false;
    }
    return a === b || a.contains(b) || b.contains(a);
  }

  /**
   * Build a composed-like ancestry path for document.activeElement.
   */
  private _getActiveElementPath(activeElement: Element): EventTarget[] {
    const path: EventTarget[] = [];
    let current: Node | null = activeElement;
    let depth = 0;
    const MAX_DEPTH = 1000;

    while (current && depth < MAX_DEPTH) {
      depth++;
      path.push(current);

      if (current.parentNode) {
        current = current.parentNode;
        continue;
      }

      const root = current.getRootNode?.();
      if (root instanceof ShadowRoot && root.host) {
        current = root.host;
        continue;
      }

      current = null;
    }

    if (depth >= MAX_DEPTH) {
      console.warn("[ui5-lib-hotkeys] FocusFallbackTracker: MAX_DEPTH reached while building active-element path.");
    }

    if (!path.includes(document)) {
      path.push(document);
    }
    if (!path.includes(window)) {
      path.push(window);
    }

    return path;
  }
}
