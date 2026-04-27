import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType } from "ui5/kiosk/library";
import { applyResponsiveHeightClasses, placeAndWait, waitForRender } from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard responsive sizing", {
  afterEach() {
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

QUnit.test("Cleanup on exit() removes resize observer", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb.destroy();

  // @ts-expect-error Accessing private field for cleanup verification
  assert.strictEqual(kb._responsiveResizeHandlerId, null, "Resize handler deregistered");
  // @ts-expect-error Accessing private field for cleanup verification
  assert.strictEqual(kb._responsiveObservedDom, null, "Observed DOM reference cleared");
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

  applyResponsiveHeightClasses(kb, dom, 16 * remPx);

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

  applyResponsiveHeightClasses(kb, dom, 12 * remPx);

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
  applyResponsiveHeightClasses(kb, dom, 14 * remPx);

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

  applyResponsiveHeightClasses(kb, dom, 12 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny applied at 12rem height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort absent when cqTiny");

  kb.destroy();
});

QUnit.test("No height classes when keyboard is not externally constrained", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "1.5rem");
  dom.style.height = "16rem";
  dom.style.overflow = "hidden";

  applyResponsiveHeightClasses(kb, dom, dom.getBoundingClientRect().height);

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

  applyResponsiveHeightClasses(kb, dom, 12 * remPx);

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
  applyResponsiveHeightClasses(kb, dom, 10 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny applied before docking");

  kb.setDocked(true);
  await waitForRender();
  // Responsive class update is deferred to rAF to avoid forced reflow
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
  applyResponsiveHeightClasses(kb, dom, 10 * remPx);

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
  applyResponsiveHeightClasses(kb, dom, 10 * remPx);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort still absent after manual re-apply");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny still absent after manual re-apply");

  kb.destroy();
});

QUnit.test("Intrinsic height changes from CSS vars update height classes without outer resize", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "1.5rem");
  dom.style.height = "15rem";
  dom.style.overflow = "hidden";

  applyResponsiveHeightClasses(kb, dom, dom.getBoundingClientRect().height);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "No cqShort before intrinsic growth");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "No cqTiny before intrinsic growth");

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "Still stale before refresh");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Still non-tiny before refresh");
  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort applied at 15rem after key height grows");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent at 15rem");

  kb.destroy();
});

QUnit.test("Intrinsic height shrink clears height classes without outer resize", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "16rem";
  dom.style.overflow = "hidden";

  applyResponsiveHeightClasses(kb, dom, dom.getBoundingClientRect().height);
  assert.ok(
    dom.classList.contains(DOM.classes.rootCqShort),
    "Starts constrained (cqShort) at 4rem keys in 16rem container",
  );
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent at 16rem");

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "1.5rem");
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "Still stale before refresh");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Still non-tiny before refresh");
  kb.refreshResponsiveState();
  await new Promise((resolve) => requestAnimationFrame(resolve));

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort cleared after intrinsic height shrinks");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny cleared after intrinsic height shrinks");

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
  applyResponsiveHeightClasses(kb, dom, 10 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "Starts as tiny");

  // Grow to short
  applyResponsiveHeightClasses(kb, dom, 15 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "Transitions to short");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny removed");

  // Grow to unconstrained
  applyResponsiveHeightClasses(kb, dom, 400);
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
  applyResponsiveHeightClasses(kb, dom, 17 * remPx);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cqShort absent at 17rem with default threshold");

  // Override short threshold to 18rem. Now 17rem should trigger cqShort.
  dom.style.setProperty("--ui5KioskKeyboard-cqShortThreshold", "18rem");
  applyResponsiveHeightClasses(kb, dom, 17 * remPx);
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
  applyResponsiveHeightClasses(kb, dom, 13 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cqShort present at 13rem with default threshold");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cqTiny absent at 13rem with default threshold");

  // Override tiny threshold to 14rem. Now 13rem should trigger cqTiny.
  dom.style.setProperty("--ui5KioskKeyboard-cqTinyThreshold", "14rem");
  applyResponsiveHeightClasses(kb, dom, 13 * remPx);
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
