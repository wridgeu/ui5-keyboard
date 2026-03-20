import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { applyResponsiveSizeClasses, placeAndWait, waitForRender } from "./test-helpers";

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
// Class toggling at breakpoint boundaries
// ──────────────────────────────────────────────

QUnit.test("Applies cq-xs class at compact width (<= 20rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  applyResponsiveSizeClasses(kb, dom, 300, 600);

  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs class present at 300px");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm class absent at 300px");

  kb.destroy();
});

QUnit.test("Applies cq-sm class at narrow width (20rem < width <= 30rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  applyResponsiveSizeClasses(kb, dom, 400, 600);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs class absent at 400px");
  assert.ok(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm class present at 400px");

  kb.destroy();
});

QUnit.test("No responsive classes at wide width (> 30rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  applyResponsiveSizeClasses(kb, dom, 800, 600);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs class absent at 800px");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm class absent at 800px");

  kb.destroy();
});

QUnit.test("Boundary: exactly 20rem applies cq-xs", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  applyResponsiveSizeClasses(kb, dom, 20 * remPx, 600);

  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs at exactly 20rem");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm absent at exactly 20rem");

  kb.destroy();
});

QUnit.test("Boundary: exactly 30rem applies cq-sm", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  applyResponsiveSizeClasses(kb, dom, 30 * remPx, 600);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs absent at exactly 30rem");
  assert.ok(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm at exactly 30rem");

  kb.destroy();
});

QUnit.test("Classes update when width changes across breakpoints", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;

  applyResponsiveSizeClasses(kb, dom, 300, 600);
  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "Starts compact");

  applyResponsiveSizeClasses(kb, dom, 400, 600);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs removed after resize");
  assert.ok(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm applied after resize");

  applyResponsiveSizeClasses(kb, dom, 800, 600);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs removed at wide width");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm removed at wide width");

  kb.destroy();
});

QUnit.test("Cleanup on exit() removes resize observer", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  applyResponsiveSizeClasses(kb, dom, 300, 600);
  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "Class applied before destroy");

  kb.destroy();

  // @ts-expect-error Accessing private field for cleanup verification
  assert.strictEqual(kb._responsiveResizeHandlerId, null, "Resize handler deregistered");
  // @ts-expect-error Accessing private field for cleanup verification
  assert.strictEqual(kb._responsiveObservedDom, null, "Observed DOM reference cleared");
});

// ──────────────────────────────────────────────
// Font-size capping (min() preserves smaller consumer values)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Height-responsive breakpoint classes
// ──────────────────────────────────────────────

QUnit.test("Boundary: exactly 16rem applies cq-short", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "16rem";
  dom.style.overflow = "hidden";

  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 16 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cq-short at exactly 16rem");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny absent at exactly 16rem");

  kb.destroy();
});

QUnit.test("Boundary: exactly 12rem applies cq-tiny", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "12rem";
  dom.style.overflow = "hidden";

  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 12 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny at exactly 12rem");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short absent at exactly 12rem");

  kb.destroy();
});

QUnit.test("Applies cq-short class when externally constrained (height <= 16rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "16rem";
  dom.style.overflow = "hidden";

  // Constrained to 16rem -- triggers cq-short
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 16 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cq-short applied at 16rem height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny absent at 16rem height");

  kb.destroy();
});

QUnit.test("Applies cq-tiny class when severely constrained (height <= 12rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "12rem";
  dom.style.overflow = "hidden";

  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 12 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny applied at 12rem height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short absent when cq-tiny");

  kb.destroy();
});

QUnit.test("No height classes when keyboard is not externally constrained", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "1.5rem");
  dom.style.height = "16rem";
  dom.style.overflow = "hidden";

  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, dom.getBoundingClientRect().height);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short absent when unconstrained");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny absent when unconstrained");

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

  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 12 * remPx);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short absent for docked");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny absent for docked");

  kb.destroy();
});

QUnit.test("Toggling docked mode clears stale height classes immediately", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.height = `${10 * remPx}px`;
  dom.style.overflow = "hidden";
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 10 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny applied before docking");

  kb.setDocked(true);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short cleared when docked=true");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny cleared when docked=true");

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
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 10 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny applied before keyboardType switch");

  kb.setKeyboardType("Numpad");
  await waitForRender();

  dom = kb.getDomRef()! as HTMLElement;
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short cleared after re-render");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny cleared after re-render");

  // Manually re-applying responsive classes should not re-add height classes for numpad
  dom.style.height = `${10 * remPx}px`;
  dom.style.overflow = "hidden";
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 10 * remPx);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short still absent after manual re-apply");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny still absent after manual re-apply");

  kb.destroy();
});

QUnit.test("Intrinsic height changes from CSS vars update height classes without outer resize", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "1.5rem");
  dom.style.height = "15rem";
  dom.style.overflow = "hidden";

  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, dom.getBoundingClientRect().height);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "No cq-short before intrinsic growth");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "No cq-tiny before intrinsic growth");

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "Still stale before refresh");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Still non-tiny before refresh");
  kb.refreshResponsiveState();

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cq-short applied at 15rem after key height grows");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny absent at 15rem");

  kb.destroy();
});

QUnit.test("Intrinsic height shrink clears height classes without outer resize", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "16rem";
  dom.style.overflow = "hidden";

  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, dom.getBoundingClientRect().height);
  assert.ok(
    dom.classList.contains(DOM.classes.rootCqShort),
    "Starts constrained (cq-short) at 4rem keys in 16rem container",
  );
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny absent at 16rem");

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "1.5rem");
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "Still stale before refresh");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Still non-tiny before refresh");
  kb.refreshResponsiveState();

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short cleared after intrinsic height shrinks");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny cleared after intrinsic height shrinks");

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
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 10 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "Starts as tiny");

  // Grow to short
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 15 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "Transitions to short");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny removed");

  // Grow to unconstrained
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 400);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short removed at full height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny removed at full height");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Compound width + height breakpoints
// ──────────────────────────────────────────────

QUnit.test("Compound: narrow width + short height applies both cq-xs and cq-short", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.overflow = "hidden";

  // 18rem wide (< 20rem = cq-xs) and 15rem tall (< 16rem = cq-short)
  applyResponsiveSizeClasses(kb, dom, 18 * remPx, 15 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs applied at narrow width");
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cq-short applied at short height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm absent when cq-xs applies");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny absent at short (not tiny) height");

  kb.destroy();
});

QUnit.test("Compound: narrow width + tiny height applies both cq-xs and cq-tiny", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.overflow = "hidden";

  // 18rem wide (< 20rem = cq-xs) and 10rem tall (< 12rem = cq-tiny)
  applyResponsiveSizeClasses(kb, dom, 18 * remPx, 10 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs applied at narrow width");
  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny applied at tiny height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm absent when cq-xs applies");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short absent when cq-tiny applies");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Font-size capping (min() preserves smaller consumer values)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Custom responsive threshold CSS variables
// ──────────────────────────────────────────────

QUnit.test("Custom width threshold: cq-sm triggers at overridden narrow threshold", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;

  // Default narrow threshold is 30rem (480px). At 500px, no cq-sm expected.
  applyResponsiveSizeClasses(kb, dom, 500, 600);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm absent at 500px with default threshold");

  // Override narrow threshold to 35rem (560px). Now 500px should trigger cq-sm.
  dom.style.setProperty("--ui5KioskKeyboard-cqNarrowThreshold", "35rem");
  applyResponsiveSizeClasses(kb, dom, 500, 600);
  assert.ok(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm present at 500px with 35rem threshold");

  kb.destroy();
});

QUnit.test("Custom width threshold: cq-xs triggers at overridden compact threshold", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;

  // Default compact threshold is 20rem (320px). At 350px, cq-sm expected, not cq-xs.
  applyResponsiveSizeClasses(kb, dom, 350, 600);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs absent at 350px with default threshold");
  assert.ok(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm present at 350px with default threshold");

  // Override compact threshold to 25rem (400px). Now 350px should trigger cq-xs.
  dom.style.setProperty("--ui5KioskKeyboard-cqCompactThreshold", "25rem");
  applyResponsiveSizeClasses(kb, dom, 350, 600);
  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs present at 350px with 25rem threshold");

  kb.destroy();
});

QUnit.test("Custom height threshold: cq-short triggers at overridden short threshold", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.overflow = "hidden";

  // At 17rem height with default 16rem threshold, cq-short should NOT apply.
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 17 * remPx);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short absent at 17rem with default threshold");

  // Override short threshold to 18rem. Now 17rem should trigger cq-short.
  dom.style.setProperty("--ui5KioskKeyboard-cqShortThreshold", "18rem");
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 17 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cq-short present at 17rem with 18rem threshold");

  kb.destroy();
});

QUnit.test("Custom height threshold: cq-tiny triggers at overridden tiny threshold", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.overflow = "hidden";

  // At 13rem height with default 12rem threshold, cq-short expected (not cq-tiny).
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 13 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cq-short present at 13rem with default threshold");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny absent at 13rem with default threshold");

  // Override tiny threshold to 14rem. Now 13rem should trigger cq-tiny.
  dom.style.setProperty("--ui5KioskKeyboard-cqTinyThreshold", "14rem");
  applyResponsiveSizeClasses(kb, dom, dom.getBoundingClientRect().width, 13 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny present at 13rem with 14rem threshold");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short absent when cq-tiny applies");

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

  // Unconstrained: no height classes
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "Not short when unconstrained");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Not tiny when unconstrained");

  // Constrain to 15rem (below short threshold of 16rem)
  dom.style.height = `${15 * remPx}px`;
  dom.style.overflow = "hidden";
  kb.refreshResponsiveState();

  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "cq-short applied in constrained container");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "Not tiny at 15rem");

  // Constrain further to 11rem (below tiny threshold of 12rem)
  dom.style.height = `${11 * remPx}px`;
  kb.refreshResponsiveState();

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny applied at 11rem");

  // Release constraint
  dom.style.height = "";
  dom.style.overflow = "";
  kb.refreshResponsiveState();

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short cleared when unconstrained");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny cleared when unconstrained");

  kb.destroy();
});

QUnit.test("Responsive class preserves custom font-size below the cap", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  // Set a custom font-size smaller than both caps (1rem, 0.875rem)
  dom.style.setProperty("--ui5KioskKeyboard-keyFontSize", "0.75rem");

  // Apply cq-sm (cap = 1rem) - 0.75rem should be preserved
  applyResponsiveSizeClasses(kb, dom, 400, 600);
  const key = dom.querySelector(DOM.selectors.key) as HTMLElement;
  assert.ok(key, "Key element found");

  const fontSize = Number.parseFloat(window.getComputedStyle(key).fontSize);
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const expected = 0.75 * remPx;

  assert.ok(
    Math.abs(fontSize - expected) < 1.5,
    `Custom 0.75rem (${expected}px) preserved at cq-sm; got ${fontSize}px`,
  );

  // Apply cq-xs (cap = 0.875rem) - 0.75rem should still be preserved
  applyResponsiveSizeClasses(kb, dom, 300, 600);
  const fontSizeXs = Number.parseFloat(window.getComputedStyle(key).fontSize);
  assert.ok(
    Math.abs(fontSizeXs - expected) < 1.5,
    `Custom 0.75rem (${expected}px) preserved at cq-xs; got ${fontSizeXs}px`,
  );

  kb.destroy();
});
