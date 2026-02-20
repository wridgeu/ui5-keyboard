/**
 * Centralized listener bookkeeping for HotkeyManager.
 *
 * Handles:
 * - document capture keydown listener attach/detach
 * - ref-counted target-specific keydown listeners
 */
export default class ListenerRegistry {
  private readonly _targetListeners: Map<EventTarget, { handler: EventListener; count: number }>;

  constructor(
    private readonly _shouldIgnoreKeyEvent: (event: KeyboardEvent) => boolean,
    private readonly _processTargetKeyEvent: (event: KeyboardEvent, target: EventTarget) => void,
    targetListeners?: Map<EventTarget, { handler: EventListener; count: number }>,
  ) {
    this._targetListeners = targetListeners ?? new Map();
  }

  attachDocument(handler: (event: KeyboardEvent) => void): void {
    document.addEventListener("keydown", handler as EventListener, true);
  }

  detachDocument(handler: (event: KeyboardEvent) => void): void {
    document.removeEventListener("keydown", handler as EventListener, true);
  }

  attachTarget(target: EventTarget): void {
    const existing = this._targetListeners.get(target);
    if (existing) {
      existing.count++;
      return;
    }

    // Cast at the boundary: "keydown" always dispatches KeyboardEvent,
    // but EventTarget.addEventListener types callback as EventListener.
    const handler: EventListener = (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (this._shouldIgnoreKeyEvent(keyboardEvent)) return;
      this._processTargetKeyEvent(keyboardEvent, target);
    };

    target.addEventListener("keydown", handler, true);
    this._targetListeners.set(target, { handler, count: 1 });
  }

  detachTarget(target: EventTarget): void {
    const existing = this._targetListeners.get(target);
    if (!existing) return;

    existing.count--;
    if (existing.count <= 0) {
      target.removeEventListener("keydown", existing.handler, true);
      this._targetListeners.delete(target);
    }
  }

  detachAllTargets(): void {
    for (const [target, entry] of this._targetListeners) {
      target.removeEventListener("keydown", entry.handler, true);
    }
    this._targetListeners.clear();
  }
}
