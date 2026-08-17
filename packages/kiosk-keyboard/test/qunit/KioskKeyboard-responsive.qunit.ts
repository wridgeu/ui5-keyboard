import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType } from "ui5/kiosk/library";
import { setMeasuredHeight, placeAndWait, waitForRender, rootRemPx } from "./test-helpers";

const DOM = KioskKeyboard.DOM;
const sandbox = sinon.createSandbox();

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard responsive sizing", {
  afterEach() {
    sandbox.restore();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) {
      fixture.classList.remove("sapUiSizeCompact");
      fixture.innerHTML = "";
    }
  },
});

// ──────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────

QUnit.test("Cleanup on exit() disconnects the ResizeObserver", async (assert) => {
  const observeSpy = sandbox.spy(ResizeObserver.prototype, "observe");
  const disconnectSpy = sandbox.spy(ResizeObserver.prototype, "disconnect");

  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const observation = observeSpy.getCalls().find((call) => call.args[0] === dom);
  assert.ok(observation, "the keyboard root was observed during initial render");

  const disconnectsBefore = disconnectSpy.callCount;
  kb.destroy();

  assert.ok(disconnectSpy.callCount > disconnectsBefore, "ResizeObserver.disconnect called on destroy");
  assert.ok(
    disconnectSpy.getCalls().some((call) => call.thisValue === observation!.thisValue),
    "the observer that observed the root is the one disconnected",
  );
});

QUnit.test("Observer recomputes on a width-only change but skips a repeat of the applied box", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "14rem";
  dom.style.overflow = "hidden";
  await setMeasuredHeight(kb, dom, 14 * remPx);

  // The controller records the box it last measured; an observation reporting
  // that same box is redundant, but a width change is not (container queries
  // wrap rows, so the natural height depends on width).
  const controller = kb["_responsiveSizing"];
  const applied = controller["_appliedBox"]!;
  // The observation is read for its border box alone, so that is all a stand-in carries.
  const entry = (blockSize: number, inlineSize: number): ResizeObserverEntry[] => {
    const observation: Pick<ResizeObserverEntry, "borderBoxSize"> = { borderBoxSize: [{ blockSize, inlineSize }] };
    return [observation as ResizeObserverEntry];
  };

  assert.ok(
    controller["_reportsAppliedBox"](entry(applied.blockSize, applied.inlineSize)),
    "the applied box is treated as redundant",
  );
  assert.notOk(
    controller["_reportsAppliedBox"](entry(applied.blockSize, applied.inlineSize + 40)),
    "a width-only change is not treated as redundant",
  );

  // The 0.1px tolerance absorbs the float-serialisation gap between the recorded
  // getComputedStyle box and the entry's internal double, but no more: a delta
  // past it must still recompute.
  assert.ok(
    controller["_reportsAppliedBox"](entry(applied.blockSize + 0.05, applied.inlineSize)),
    "a sub-0.1px delta is absorbed as redundant",
  );
  assert.notOk(
    controller["_reportsAppliedBox"](entry(applied.blockSize + 0.2, applied.inlineSize)),
    "a delta past the 0.1px tolerance is not treated as redundant",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Height-responsive breakpoint classes
// ──────────────────────────────────────────────

QUnit.test("Threshold tiers on the granted border box, so the root border counts", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  // A thick, self-contained border so the granted border box exceeds the
  // padding box by a margin the tier comparison must not ignore (independent
  // of the theme's default 1px border).
  dom.style.border = "8px solid";
  dom.style.overflow = "hidden";

  // Granted border box exactly at the 16rem short threshold => cqShort.
  await setMeasuredHeight(kb, dom, 16 * remPx, 40 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "granted box at 16rem applies cqShort");

  // Push the granted box just past the threshold: a border-blind comparison
  // (padding box only) would still see "short"; the granted box does not.
  await setMeasuredHeight(kb, dom, 16 * remPx + 4, 40 * remPx);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "granted box over 16rem drops cqShort");

  kb.destroy();
});

QUnit.test("Height tier by granted height (boundaries, interiors, unconstrained)", async (assert) => {
  // Table over the tier decision. Each row stubs the granted height (and, for
  // the unconstrained row, a natural height below it). Both boundary-equality
  // rows (exactly 16rem, exactly 12rem) are kept so a `<=`-vs-`<` regression at
  // either threshold still goes red.
  const cases: { h: number; natural?: number; expect: "short" | "tiny" | "none"; note: string }[] = [
    { h: 16, expect: "short", note: "granted exactly 16rem" },
    { h: 14, expect: "short", note: "granted interior 12rem < h <= 16rem" },
    { h: 12, expect: "tiny", note: "granted exactly 12rem" },
    { h: 10, expect: "tiny", note: "granted interior h <= 12rem" },
    { h: 16, natural: 8, expect: "none", note: "natural 8rem fits granted 16rem (unconstrained)" },
  ];

  for (const { h, natural, expect, note } of cases) {
    const kb = new KioskKeyboard();
    await placeAndWait(kb);

    const dom = kb.getDomRef()! as HTMLElement;
    const remPx = rootRemPx();

    dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
    dom.style.height = `${h}rem`;
    dom.style.overflow = "hidden";

    await setMeasuredHeight(kb, dom, h * remPx, natural === undefined ? undefined : natural * remPx);

    const short = dom.classList.contains(DOM.classes.rootCqShort);
    const tiny = dom.classList.contains(DOM.classes.rootCqTiny);
    assert.strictEqual(short, expect === "short", `cqShort ${expect === "short" ? "present" : "absent"}: ${note}`);
    assert.strictEqual(tiny, expect === "tiny", `cqTiny ${expect === "tiny" ? "present" : "absent"}: ${note}`);

    kb.destroy();
  }
});

QUnit.test("No height classes for docked keyboards", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "12rem";
  dom.style.overflow = "hidden";

  await setMeasuredHeight(kb, dom, 12 * remPx);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort absent for docked");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent for docked");

  kb.destroy();
});

QUnit.test("Toggling docked mode clears stale height classes after render cycle", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  dom.style.height = `${10 * remPx}px`;
  dom.style.overflow = "hidden";
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  await setMeasuredHeight(kb, dom, 10 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny applied before docking");

  kb.setDocked(true);
  await waitForRender();
  // setDocked suppresses invalidation and relies on the ResizeObserver for responsive
  // sync; drive the recompute explicitly so the test does not depend on layout timing.
  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort cleared when docked=true");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny cleared when docked=true");

  kb.destroy();
});

QUnit.test("Switching to Numpad clears height classes after re-render", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  let dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  dom.style.height = `${10 * remPx}px`;
  dom.style.overflow = "hidden";
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  await setMeasuredHeight(kb, dom, 10 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny applied before keyboardType switch");

  kb.setKeyboardType(KeyboardType.Numpad);
  await waitForRender();
  // Responsive class update is deferred to rAF in onAfterRendering
  await new Promise((resolve) => requestAnimationFrame(resolve));

  dom = kb.getDomRef()! as HTMLElement;
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort cleared after re-render");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny cleared after re-render");

  // Manually re-applying responsive classes should not re-add height classes for numpad
  dom.style.height = `${10 * remPx}px`;
  dom.style.overflow = "hidden";
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  await setMeasuredHeight(kb, dom, 10 * remPx);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort still absent after manual re-apply");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny still absent after manual re-apply");

  kb.destroy();
});

QUnit.test("Intrinsic content height growth updates height classes on refresh", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();
  dom.style.overflow = "hidden";

  // Heights are stubbed (rendered fixed at 15rem) so the natural-vs-rendered
  // decision is deterministic across platforms. Intrinsic content shorter than
  // the rendered height is unconstrained -> no classes.
  await setMeasuredHeight(kb, dom, 15 * remPx, 8 * remPx);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "No cqShort while intrinsic content fits");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "No cqTiny while intrinsic content fits");

  // Intrinsic content grows past the rendered height (e.g. taller keys); a
  // refresh applies cqShort since 15rem is within the short range.
  await setMeasuredHeight(kb, dom, 15 * remPx, 24 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort applied after intrinsic growth");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent at 15rem");

  kb.destroy();
});

QUnit.test("Intrinsic content height shrink clears height classes on refresh", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();
  dom.style.overflow = "hidden";

  // Intrinsic content (24rem) taller than the 16rem rendered height -> constrained.
  await setMeasuredHeight(kb, dom, 16 * remPx, 24 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "Starts constrained (cqShort)");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent at 16rem");

  // Intrinsic content shrinks below the rendered height -> unconstrained.
  await setMeasuredHeight(kb, dom, 16 * remPx, 8 * remPx);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort cleared after intrinsic shrink");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny cleared after intrinsic shrink");

  kb.destroy();
});

QUnit.test("Height classes update when constraint changes", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = rootRemPx();

  (dom as HTMLElement).style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  (dom as HTMLElement).style.overflow = "hidden";

  // Start constrained (tiny)
  await setMeasuredHeight(kb, dom, 10 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "Starts as tiny");

  // Grow to short
  await setMeasuredHeight(kb, dom, 15 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "Transitions to short");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny removed");

  // Grow to unconstrained
  await setMeasuredHeight(kb, dom, 400);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort removed at full height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny removed at full height");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Custom responsive threshold CSS variables
// ──────────────────────────────────────────────

QUnit.test("Custom height threshold: cqShort triggers at overridden short threshold", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.overflow = "hidden";

  // At 17rem height with default 16rem threshold, cqShort should NOT apply.
  await setMeasuredHeight(kb, dom, 17 * remPx);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort absent at 17rem with default threshold");

  // Override short threshold to 18rem. Now 17rem should trigger cqShort.
  dom.style.setProperty("--ui5KioskKeyboard-cqShortThreshold", "18rem");
  await setMeasuredHeight(kb, dom, 17 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort present at 17rem with 18rem threshold");

  kb.destroy();
});

QUnit.test("Custom height threshold: cqTiny triggers at overridden tiny threshold", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.overflow = "hidden";

  // At 13rem height with default 12rem threshold, cqShort expected (not cqTiny).
  await setMeasuredHeight(kb, dom, 13 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort present at 13rem with default threshold");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent at 13rem with default threshold");

  // Override tiny threshold to 14rem. Now 13rem should trigger cqTiny.
  dom.style.setProperty("--ui5KioskKeyboard-cqTinyThreshold", "14rem");
  await setMeasuredHeight(kb, dom, 13 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny present at 13rem with 14rem threshold");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort absent when cqTiny applies");

  kb.destroy();
});

QUnit.test("Repeated recomputes converge on a stable class set", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  // Real layout, no measurement stubs: recomputing must be idempotent, so the
  // class set at a fixed constraint stays put across repeated passes.
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = `${15 * remPx}px`;
  dom.style.overflow = "hidden";

  const settle = async () => {
    kb.refreshResponsiveState();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return `${dom.classList.contains(DOM.classes.rootCqShort)}/${dom.classList.contains(DOM.classes.rootCqTiny)}`;
  };

  const first = await settle();
  assert.strictEqual(first, "true/false", "cqShort applied on the first pass at 15rem");

  for (let pass = 2; pass <= 4; pass++) {
    assert.strictEqual(await settle(), first, `class set unchanged on pass ${pass}`);
  }

  kb.destroy();
});

QUnit.test("Natural height is measured with the tier classes cleared, so the tier cannot oscillate", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();
  dom.style.overflow = "hidden";

  // scrollHeight here depends on the applied tier, which a constant stub cannot
  // express: 20rem with no tier (constrained at the 15rem grant) but 10rem once
  // tiered (unconstrained). The measurement must clear the tier first, or a
  // stale tier flips the constrained verdict.
  Object.defineProperty(dom, "clientHeight", { value: 15 * remPx, configurable: true });
  Object.defineProperty(dom, "scrollHeight", {
    get() {
      const tiered = dom.classList.contains(DOM.classes.rootCqShort) || dom.classList.contains(DOM.classes.rootCqTiny);
      return (tiered ? 10 : 20) * remPx;
    },
    configurable: true,
  });

  try {
    // Seed a stale wrong tier: clearing before measuring re-derives cqShort at
    // 15rem; measuring first reads 10rem and bails, leaving the stale tier.
    dom.classList.add(DOM.classes.rootCqTiny);

    kb.refreshResponsiveState();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "corrected to cqShort: measured with the tier cleared");
    assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "stale cqTiny not read into the measurement");
  } finally {
    Reflect.deleteProperty(dom, "scrollHeight");
    Reflect.deleteProperty(dom, "clientHeight");
  }

  kb.destroy();
});

QUnit.test("Breakpoints measure layout pixels: ancestor transform scale does not shift them", async (assert) => {
  const wrapper = document.createElement("div");
  wrapper.style.transform = "scale(0.5)";
  wrapper.style.transformOrigin = "top left";
  document.getElementById("qunit-fixture")!.appendChild(wrapper);

  const kb = new KioskKeyboard();
  kb.placeAt(wrapper);
  await waitForRender();

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  // 15rem of layout height inside a scale(0.5) wrapper renders visually at
  // 7.5rem. CSS sizing responds to layout pixels, so cqShort (<= 16rem) is
  // correct and cqTiny (<= 12rem, the visual height) would be a misread.
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = `${15 * remPx}px`;
  dom.style.overflow = "hidden";

  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort applied from the 15rem layout height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "the 7.5rem visual height does not trigger cqTiny");

  kb.destroy();
  wrapper.remove();
});

QUnit.test("Height breakpoints adapt when container constrains the keyboard", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  // Force key height to make the keyboard naturally taller than 16rem
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  // Unconstrained: no height classes
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "Not short when unconstrained");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Not tiny when unconstrained");

  // Constrain to 15rem (below short threshold of 16rem)
  dom.style.height = `${15 * remPx}px`;
  dom.style.overflow = "hidden";
  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort applied in constrained container");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Not tiny at 15rem");

  // Constrain further to 11rem (below tiny threshold of 12rem)
  dom.style.height = `${11 * remPx}px`;
  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny applied at 11rem");

  // Release constraint
  dom.style.height = "";
  dom.style.overflow = "";
  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort cleared when unconstrained");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny cleared when unconstrained");

  kb.destroy();
});

QUnit.test("Height breakpoints still fire when root has extra consumer padding", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = rootRemPx();

  // Force tall keys so the keyboard is naturally taller than 16rem
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  // Add extra consumer padding (the root already has its default padding,
  // this adds more). getBoundingClientRect().height includes this padding,
  // so the threshold comparison accounts for it.
  dom.style.padding = "1.5rem";
  dom.style.height = `${15 * remPx}px`;
  dom.style.overflow = "hidden";

  // Guard: the keyboard must be naturally taller than the constraint for
  // height classes to activate (otherwise the test passes for the wrong reason).
  assert.ok(dom.scrollHeight > 15 * remPx, "keyboard naturally exceeds constrained height");

  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort applied despite extra padding");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Not tiny at 15rem with padding");

  kb.destroy();
});
