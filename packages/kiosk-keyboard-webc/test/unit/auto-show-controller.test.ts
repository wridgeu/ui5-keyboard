import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoShowController } from "../../src/core/auto-show-controller.js";
import type { AutoShowBridge, AutoShowHost } from "../../src/core/auto-show-controller.js";

/** Resolve after two animation frames so a queued rAF callback has run. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** The host state the controller reads, writable so a test can flip it mid-run. */
interface HostState {
  disabled: boolean;
  docked: boolean;
  autoShow: boolean;
  autoType: boolean;
  open: boolean;
  keyboardType: AutoShowHost["keyboardType"];
}

type MutableHost = HTMLDivElement & HostState;

function makeHost(): MutableHost {
  const el = Object.assign(document.createElement("div"), {
    disabled: false,
    docked: true,
    autoShow: true,
    autoType: false,
    open: true, // keyboard open, so a deferred close would actually call close()
    keyboardType: "Full",
  } satisfies HostState);
  document.body.appendChild(el);
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
    controller.teardown();
    controller.unregister();
    host.remove();
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

describe("AutoShowController auto-type detection vs. inputmode suppression", () => {
  let host: MutableHost;
  let bridge: AutoShowBridge;
  let controller: AutoShowController;
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.type = "text";
    input.setAttribute("inputmode", "numeric");
    document.body.appendChild(input);

    host = makeHost();
    host.autoType = true;

    let target: HTMLInputElement | HTMLTextAreaElement | null = null;
    bridge = {
      ...makeBridge(),
      getTargetElement: () => target,
      resolveInputFrom: (el) => (el === input ? input : null),
      setTarget: vi.fn((el) => {
        target = el;
      }),
      setKeyboardTypeInternal: vi.fn((value) => {
        host.keyboardType = value;
      }),
      // The real bridge delegates to NativeInputModeSuppression, which stamps
      // the live element - the mask an authored inputmode disappears behind.
      suppressInputMode: vi.fn(() => input.setAttribute("inputmode", "none")),
    };

    controller = new AutoShowController(host, bridge);
    controller.register();
    controller.sync();
  });

  afterEach(() => {
    // teardown() detaches the document focus listeners; unregister() only
    // leaves the claim registry, so without it every test keeps handling
    // focusin for the rest of the file.
    controller.teardown();
    controller.unregister();
    host.remove();
    input.remove();
  });

  it("keeps the detected type when the already-active target is refocused", () => {
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(bridge.setKeyboardTypeInternal).toHaveBeenCalledTimes(1);
    expect(bridge.setKeyboardTypeInternal).toHaveBeenCalledWith("Numpad");
    expect(input.getAttribute("inputmode"), "the open keyboard masks the authored inputmode").toBe("none");

    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(bridge.setKeyboardTypeInternal).toHaveBeenCalledTimes(1);
    expect(host.keyboardType).toBe("Numpad");
  });

  it("detects a target claimed before the first focus, since a closed keyboard masks nothing", () => {
    // What setTargetElement() leaves behind while the keyboard is closed: the
    // element is already the target, and its authored inputmode is intact.
    host.open = false;
    bridge.getTargetElement = () => input;

    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(input.getAttribute("inputmode"), "a closed keyboard has stamped nothing").toBe("numeric");
    expect(bridge.setKeyboardTypeInternal).toHaveBeenCalledWith("Numpad");
  });
});
