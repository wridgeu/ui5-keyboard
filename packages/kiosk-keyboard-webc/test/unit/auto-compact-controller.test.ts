import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoCompactController } from "../../src/core/auto-compact-controller.js";

/** Resolve after one animation frame, so a callback queued for the next frame has run. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Stands in for the observer jsdom does not ship. It also gives the tests the one
 * thing a real observer cannot: an observation delivered at a moment of their
 * choosing, so "the tier is applied from a frame of its own, never from the
 * observation callback" is assertable rather than inferred.
 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly _callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  /** Delivers a border-box inline size the way the real observer reports one. */
  deliver(inlineSize: number): void {
    this._callback(
      [{ borderBoxSize: [{ inlineSize, blockSize: 0 }] }] as unknown as ResizeObserverEntry[],
      this as unknown as ResizeObserver,
    );
  }
}

/** The default threshold is 22rem, and jsdom's root font size is 16px. */
const THRESHOLD_PX = 22 * 16;

describe("AutoCompactController", () => {
  let root: HTMLElement;
  let enabled: boolean;
  let applyTier: ReturnType<typeof vi.fn<(narrow: boolean) => void>>;
  let controller: AutoCompactController;

  /** The observer the controller built for the current root. */
  const observer = (): FakeResizeObserver => {
    const last = FakeResizeObserver.instances.at(-1);
    if (!last) throw new Error("no observer was constructed");
    return last;
  };

  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    root = document.createElement("div");
    document.body.appendChild(root);
    enabled = true;
    applyTier = vi.fn<(narrow: boolean) => void>();
    controller = new AutoCompactController({ isEnabled: () => enabled, applyTier });
  });

  afterEach(() => {
    controller.teardown();
    root.remove();
    vi.unstubAllGlobals();
  });

  it("observes nothing while autoCompact is off", () => {
    enabled = false;
    controller.syncObserver(root);

    expect(FakeResizeObserver.instances, "no observer was constructed").toHaveLength(0);
  });

  it("observes the root it is handed once autoCompact is on", () => {
    controller.syncObserver(root);

    expect(FakeResizeObserver.instances).toHaveLength(1);
    expect(observer().observed).toEqual([root]);
  });

  it("re-syncing to the same root keeps the observer it already has", () => {
    controller.syncObserver(root);
    controller.syncObserver(root);

    expect(FakeResizeObserver.instances, "the observer was not rebuilt").toHaveLength(1);
  });

  // The re-entrancy guard of #180: the swap re-renders the very element under
  // observation. The frame coalesces several observations into one application;
  // it is not a guard against "ResizeObserver loop completed with undelivered
  // notifications", which H1 of the adversarial pass measured this swap never to
  // provoke (docs/specs/2026-08-04-autocompact-adversarial-hypotheses.md).
  it("applies the tier from a later frame, never from the observation callback", async () => {
    controller.syncObserver(root);
    observer().deliver(320);

    expect(applyTier, "nothing applied inside the callback").not.toHaveBeenCalled();

    await nextFrame();
    expect(applyTier.mock.calls).toEqual([[true, false]]);
  });

  it("coalesces several observations in one frame into a single tier application", async () => {
    controller.syncObserver(root);
    observer().deliver(500);
    observer().deliver(400);
    observer().deliver(300);

    await nextFrame();

    // The last width wins, and only it is applied.
    expect(applyTier.mock.calls).toEqual([[true, false]]);
  });

  it("tiers at the threshold itself and releases one pixel above it", async () => {
    controller.syncObserver(root);

    observer().deliver(THRESHOLD_PX);
    await nextFrame();
    expect(applyTier.mock.calls, "a width equal to the threshold is narrow").toEqual([[true, false]]);

    observer().deliver(THRESHOLD_PX + 1);
    await nextFrame();
    // The second verdict replaces a known first one, so it is a width that was crossed.
    expect(applyTier.mock.calls, "a width past the threshold is not").toEqual([
      [true, false],
      [false, true],
    ]);
  });

  it("drops an observation that does not cross the threshold", async () => {
    controller.syncObserver(root);

    observer().deliver(300);
    await nextFrame();
    expect(applyTier).toHaveBeenCalledTimes(1);

    observer().deliver(280);
    await nextFrame();
    expect(applyTier, "still narrow, so the verdict is unchanged").toHaveBeenCalledTimes(1);
  });

  it("reapply() re-tiers at an unchanged width", async () => {
    controller.syncObserver(root);
    observer().deliver(300);
    await nextFrame();
    expect(applyTier).toHaveBeenCalledTimes(1);

    // The host asks for this when the layout the tier resolves against changes,
    // which no resize reports.
    controller.reapply();
    await nextFrame();

    // Re-resolving against a new layout is not a width the user crossed.
    expect(applyTier.mock.calls).toEqual([
      [true, false],
      [true, false],
    ]);
  });

  it("drops a pending tier application when autoCompact goes off before the frame", async () => {
    controller.syncObserver(root);
    observer().deliver(300);

    enabled = false;
    await nextFrame();

    expect(applyTier).not.toHaveBeenCalled();
  });

  it("teardown drops a pending tier application and disconnects", async () => {
    controller.syncObserver(root);
    observer().deliver(300);

    controller.teardown();
    await nextFrame();

    expect(applyTier).not.toHaveBeenCalled();
    expect(observer().disconnected).toBe(true);
  });

  it("turning autoCompact off disconnects on the next sync", () => {
    controller.syncObserver(root);
    enabled = false;
    controller.syncObserver(root);

    expect(observer().disconnected).toBe(true);
  });

  it("a null root disconnects", () => {
    controller.syncObserver(root);
    controller.syncObserver(null);

    expect(observer().disconnected).toBe(true);
  });

  it("carries no verdict from one root to the next", async () => {
    controller.syncObserver(root);
    observer().deliver(300);
    await nextFrame();
    expect(applyTier.mock.calls).toEqual([[true, false]]);

    const replacement = document.createElement("div");
    document.body.appendChild(replacement);
    try {
      controller.syncObserver(replacement);
      observer().deliver(300);
      await nextFrame();

      // Same verdict, but on a box that has never been tiered, so it has to be applied,
      // and as that box's first verdict it crossed nothing.
      expect(applyTier.mock.calls).toEqual([
        [true, false],
        [true, false],
      ]);
    } finally {
      replacement.remove();
    }
  });
});
