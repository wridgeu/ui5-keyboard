import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoShowController } from "../../src/core/auto-show-controller.js";
import type { AutoShowBridge, AutoShowHost } from "../../src/core/auto-show-controller.js";

/** Resolve after two animation frames so a queued rAF callback has run. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

type MutableHost = AutoShowHost & {
  disabled: boolean;
  docked: boolean;
  autoShow: boolean;
  autoType: boolean;
  open: boolean;
  keyboardType: AutoShowHost["keyboardType"];
};

function makeHost(): MutableHost {
  const el = document.createElement("div") as unknown as MutableHost;
  el.disabled = false;
  el.docked = true;
  el.autoShow = true;
  el.autoType = false;
  el.open = true; // keyboard open, so a deferred close would actually call close()
  el.keyboardType = "Full";
  document.body.appendChild(el as unknown as HTMLElement);
  return el;
}

function makeBridge(): AutoShowBridge {
  return {
    getTargetElement: () => null,
    getTargetSource: () => "autoShow",
    getControlsList: () => [],
    getKeyboardTypeSource: () => "unset",
    resolveInputFrom: () => null,
    setKeyboardTypeInternal: vi.fn(),
    setTarget: vi.fn(),
    resetTargetContext: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    restoreInputMode: vi.fn(),
    suppressInputMode: vi.fn(),
    syncPhysicalKeyHighlight: vi.fn(),
    fireActiveControlChange: vi.fn(),
  };
}

describe("AutoShowController teardown vs. pending deferred close", () => {
  let host: MutableHost;
  let bridge: AutoShowBridge;
  let controller: AutoShowController;

  beforeEach(() => {
    host = makeHost();
    bridge = makeBridge();
    controller = new AutoShowController(host, bridge);
    controller.register();
    controller.sync();
  });

  afterEach(() => {
    controller.unregister();
    (host as unknown as HTMLElement).remove();
  });

  it("does not close the keyboard after autoShow is turned off in the same frame as a focusout", async () => {
    // A focusout schedules the one-frame-deferred close.
    document.dispatchEvent(new FocusEvent("focusout"));

    // The consumer disables auto-show before that frame elapses; the host
    // re-syncs, which tears the controller down.
    host.autoShow = false;
    controller.sync();

    await nextFrame();

    // Auto-show is off, so the deferred close must have been dropped.
    expect(bridge.close).not.toHaveBeenCalled();
  });

  it("still performs the deferred close while auto-show stays enabled", async () => {
    document.dispatchEvent(new FocusEvent("focusout"));
    await nextFrame();

    expect(bridge.close).toHaveBeenCalledTimes(1);
  });
});
