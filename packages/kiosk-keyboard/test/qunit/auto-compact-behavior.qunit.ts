import AutoCompactBehavior from "ui5/kiosk/internal/auto-compact-behavior";
import { rootRemPx } from "./test-helpers";

const fixture = document.getElementById("qunit-fixture")!;
const realResizeObserver = window.ResizeObserver;

/** Resolve after one animation frame, so a callback queued for the next frame has run. */
function nextFrame(): Promise<void> {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Stands in for the platform observer, and gives the tests the one thing the real
 * one cannot: an observation delivered at a moment of their choosing, so "the tier
 * is applied from a frame of its own, never from the observation callback" is
 * assertable rather than inferred.
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

  disconnect(): void {
    this.disconnected = true;
  }

  /** Delivers a border-box inline size the way the real observer reports one. */
  deliver(inlineSize: number): void {
    this.deliverEntries([{ borderBoxSize: [{ inlineSize, blockSize: 0 }] }] as unknown as ResizeObserverEntry[]);
  }

  /** Delivers entries verbatim, for shapes a border-box inline size cannot express. */
  deliverEntries(entries: ResizeObserverEntry[]): void {
    this._callback(entries, this as unknown as ResizeObserver);
  }
}

/** The element handed to `syncObserver`. */
let dom: HTMLElement;
/** What the host reports as its rendered element, which the tier resolves against. */
let hostDom: HTMLElement | null;
let enabled: boolean;
/** Every tier the behaviour applied, in order. */
let applied: boolean[];
let behavior: AutoCompactBehavior;

/** The observer the behaviour built for the current element. */
function observer(): FakeResizeObserver {
  const last = FakeResizeObserver.instances.at(-1);
  if (!last) throw new Error("no observer was constructed");
  return last;
}

function fixtureElement(): HTMLElement {
  const el = document.createElement("div");
  fixture.appendChild(el);
  return el;
}

/** Default threshold in px: 22rem against the page's live root font-size. */
function thresholdPx(): number {
  return 22 * rootRemPx();
}

QUnit.module("AutoCompactBehavior", {
  beforeEach() {
    FakeResizeObserver.instances = [];
    window.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    dom = fixtureElement();
    hostDom = dom;
    enabled = true;
    applied = [];
    behavior = new AutoCompactBehavior({
      getDomRef: () => hostDom,
      getAutoCompact: () => enabled,
      _applyCompactTier: (narrow: boolean) => applied.push(narrow),
    });
  },
  afterEach() {
    behavior.destroy();
    window.ResizeObserver = realResizeObserver;
    fixture.innerHTML = "";
  },
});

QUnit.test("Observes nothing while autoCompact is off", (assert) => {
  enabled = false;
  behavior.syncObserver(dom);

  assert.strictEqual(FakeResizeObserver.instances.length, 0, "no observer was constructed");
});

QUnit.test("Observes the element it is handed once autoCompact is on", (assert) => {
  behavior.syncObserver(dom);

  assert.strictEqual(FakeResizeObserver.instances.length, 1, "one observer");
  assert.deepEqual(observer().observed, [dom], "it observes the element it was handed");
});

QUnit.test("Re-syncing to the same element keeps the observer it already has", (assert) => {
  behavior.syncObserver(dom);
  behavior.syncObserver(dom);

  assert.strictEqual(FakeResizeObserver.instances.length, 1, "the observer was not rebuilt");
});

QUnit.test("Applies the tier from a later frame, never from the observation callback", async (assert) => {
  behavior.syncObserver(dom);
  observer().deliver(320);

  assert.deepEqual(applied, [], "nothing applied inside the callback");

  await nextFrame();
  assert.deepEqual(applied, [true], "applied from the frame the observation queued");
});

QUnit.test("Coalesces several observations in one frame into a single application", async (assert) => {
  behavior.syncObserver(dom);
  observer().deliver(500);
  observer().deliver(400);
  observer().deliver(300);

  await nextFrame();

  assert.deepEqual(applied, [true], "the last width wins, and only it is applied");
});

QUnit.test("Tiers at the threshold itself and releases one pixel above it", async (assert) => {
  behavior.syncObserver(dom);

  observer().deliver(thresholdPx());
  await nextFrame();
  assert.deepEqual(applied, [true], "a width equal to the threshold is narrow");

  observer().deliver(thresholdPx() + 1);
  await nextFrame();
  assert.deepEqual(applied, [true, false], "a width past the threshold is not");
});

QUnit.test("Drops an observation that does not cross the threshold", async (assert) => {
  behavior.syncObserver(dom);

  observer().deliver(300);
  await nextFrame();
  assert.deepEqual(applied, [true], "the first observation is applied");

  observer().deliver(280);
  await nextFrame();
  assert.deepEqual(applied, [true], "still narrow, so the verdict is unchanged");
});

QUnit.test("reapply() re-tiers at an unchanged width", async (assert) => {
  behavior.syncObserver(dom);
  observer().deliver(300);
  await nextFrame();
  assert.deepEqual(applied, [true], "the observation is applied");

  // The host asks for this when the layout the tier resolves against changes,
  // which no resize reports.
  behavior.reapply();
  await nextFrame();

  assert.deepEqual(applied, [true, true], "the same verdict is applied again");
});

QUnit.test("reapply() costs nothing before the first observation", async (assert) => {
  // The host wires this to every input the tier reads, most of which move while
  // autoCompact is off. With no width on record there is nothing to re-resolve:
  // the first observation still to come carries the verdict.
  enabled = false;
  behavior.syncObserver(dom);
  const booked = sinon.spy(window, "requestAnimationFrame");
  try {
    behavior.reapply();
    assert.strictEqual(booked.callCount, 0, "no frame was booked");
  } finally {
    booked.restore();
  }

  await nextFrame();
  assert.deepEqual(applied, [], "and no tier was applied");
});

QUnit.test("Drops a pending application when autoCompact goes off before the frame", async (assert) => {
  behavior.syncObserver(dom);
  observer().deliver(300);

  enabled = false;
  await nextFrame();

  assert.deepEqual(applied, [], "the frame found the feature off and applied nothing");
});

QUnit.test("destroy() drops a pending application and disconnects", async (assert) => {
  behavior.syncObserver(dom);
  observer().deliver(300);

  behavior.destroy();
  await nextFrame();

  assert.deepEqual(applied, [], "the pending frame was cancelled");
  assert.strictEqual(observer().disconnected, true, "the observer was disconnected");
});

QUnit.test("Turning autoCompact off disconnects on the next sync", (assert) => {
  behavior.syncObserver(dom);
  enabled = false;
  behavior.syncObserver(dom);

  assert.strictEqual(observer().disconnected, true, "the observer was disconnected");
});

QUnit.test("A null element disconnects", (assert) => {
  behavior.syncObserver(dom);
  behavior.syncObserver(null);

  assert.strictEqual(observer().disconnected, true, "the observer was disconnected");
});

QUnit.test("Carries no verdict from one element to the next", async (assert) => {
  behavior.syncObserver(dom);
  observer().deliver(300);
  await nextFrame();
  assert.deepEqual(applied, [true], "the first element was tiered");

  dom = fixtureElement();
  hostDom = dom;
  behavior.syncObserver(dom);
  observer().deliver(300);
  await nextFrame();

  assert.deepEqual(applied, [true, true], "a box that has never been tiered gets the verdict applied");
});

QUnit.test("A zero inline size is not a narrow keyboard", async (assert) => {
  behavior.syncObserver(dom);

  observer().deliver(0);
  await nextFrame();
  assert.deepEqual(applied, [], "an element that lost its layout is not tiered");

  observer().deliver(300);
  await nextFrame();
  assert.deepEqual(applied, [true], "and the zero left no verdict behind to suppress the next width");
});

QUnit.test("Switching autoCompact off restores the wide tier once", async (assert) => {
  behavior.syncObserver(dom);
  observer().deliver(300);
  await nextFrame();
  assert.deepEqual(applied, [true], "the narrow tier is on");

  enabled = false;
  behavior.syncObserver(dom);
  assert.deepEqual(applied, [true, false], "the restore is applied on the sync itself, without a frame");

  behavior.syncObserver(dom);
  assert.deepEqual(applied, [true, false], "a further sync while off has nothing left to restore");
});

QUnit.test("A host without a rendered element drops the pending application", async (assert) => {
  behavior.syncObserver(dom);
  observer().deliver(300);

  hostDom = null;
  await nextFrame();

  assert.deepEqual(applied, [], "a host that unrendered between the observation and the frame is not tiered");
});

QUnit.test("The threshold follows the custom property", async (assert) => {
  dom.style.setProperty("--ui5KioskKeyboard-autoCompactThreshold", "40rem");
  behavior.syncObserver(dom);

  observer().deliver(thresholdPx() + 100);
  await nextFrame();

  assert.deepEqual(applied, [true], "a width past 22rem but under the declared 40rem is narrow");
});

QUnit.test("An entry without a border box is ignored", async (assert) => {
  behavior.syncObserver(dom);

  observer().deliverEntries([{}] as unknown as ResizeObserverEntry[]);
  await nextFrame();
  assert.deepEqual(applied, [], "no width was reported, so no tier was evaluated");

  observer().deliver(300);
  await nextFrame();
  assert.deepEqual(applied, [true], "a later entry that does report one is");
});
