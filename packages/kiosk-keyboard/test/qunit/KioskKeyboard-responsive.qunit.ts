import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType } from "ui5/kiosk/library";
import ResizeHandler from "sap/ui/core/ResizeHandler";
import { setMeasuredHeight, placeAndWait, waitForRender } from "./test-helpers";

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

QUnit.test("Cleanup on exit() deregisters the ResizeHandler", async (assert) => {
  const registerSpy = sandbox.spy(ResizeHandler, "register");
  const deregisterSpy = sandbox.spy(ResizeHandler, "deregister");

  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const registration = registerSpy.getCalls().find((call) => call.returnValue);
  assert.ok(registration, "ResizeHandler.register was called during initial render");
  const handlerId = registration!.returnValue as string;

  kb.destroy();

  assert.ok(deregisterSpy.calledWith(handlerId), "ResizeHandler.deregister called with the registered id");
});

// ──────────────────────────────────────────────
// Height-responsive breakpoint classes
// ──────────────────────────────────────────────

QUnit.test("Boundary: exactly 16rem applies cqShort", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "16rem";
  dom.style.overflow = "hidden";

  await setMeasuredHeight(kb, dom, 16 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort at exactly 16rem");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent at exactly 16rem");

  kb.destroy();
});

QUnit.test("Boundary: exactly 12rem applies cqTiny", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "12rem";
  dom.style.overflow = "hidden";

  await setMeasuredHeight(kb, dom, 12 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny at exactly 12rem");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort absent at exactly 12rem");

  kb.destroy();
});

QUnit.test("Applies cqShort class when externally constrained (height between 12rem and 16rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "14rem";
  dom.style.overflow = "hidden";

  // Constrained to 14rem -- within cqShort range (12rem < 14rem <= 16rem)
  await setMeasuredHeight(kb, dom, 14 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort applied at 14rem height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent at 14rem height");

  kb.destroy();
});

QUnit.test("Applies cqTiny class when severely constrained (height <= 12rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "12rem";
  dom.style.overflow = "hidden";

  await setMeasuredHeight(kb, dom, 12 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny applied at 12rem height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort absent when cqTiny");

  kb.destroy();
});

QUnit.test("No height classes when keyboard is not externally constrained", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  dom.style.overflow = "hidden";

  // Natural content (8rem) fits within the 16rem rendered height -> unconstrained.
  // Both heights are stubbed so the result does not depend on platform font
  // metrics (real key-label height differs between local and CI rendering).
  await setMeasuredHeight(kb, dom, 16 * remPx, 8 * remPx);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort absent when unconstrained");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent when unconstrained");

  kb.destroy();
});

QUnit.test("No height classes for docked keyboards", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

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
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.height = `${10 * remPx}px`;
  dom.style.overflow = "hidden";
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  await setMeasuredHeight(kb, dom, 10 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny applied before docking");

  kb.setDocked(true);
  await waitForRender();
  // setDocked suppresses invalidation and relies on ResizeHandler for responsive sync;
  // drive the recompute explicitly so the test does not depend on browser layout timing.
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
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

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
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
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
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
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
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

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
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

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
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

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

QUnit.test("Height breakpoints adapt when container constrains the keyboard", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

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
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

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
