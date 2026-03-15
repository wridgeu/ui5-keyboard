import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { placeAndWait } from "./test-helpers";

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
  (kb as any)._applyResponsiveSizeClasses(dom, 300, 600);

  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs class present at 300px");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm class absent at 300px");

  kb.destroy();
});

QUnit.test("Applies cq-sm class at narrow width (20rem < width <= 30rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 400, 600);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs class absent at 400px");
  assert.ok(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm class present at 400px");

  kb.destroy();
});

QUnit.test("No responsive classes at wide width (> 30rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 800, 600);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs class absent at 800px");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm class absent at 800px");

  kb.destroy();
});

QUnit.test("Boundary: exactly 20rem applies cq-xs", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  (kb as any)._applyResponsiveSizeClasses(dom, 20 * remPx, 600);

  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs at exactly 20rem");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm absent at exactly 20rem");

  kb.destroy();
});

QUnit.test("Boundary: exactly 30rem applies cq-sm", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  (kb as any)._applyResponsiveSizeClasses(dom, 30 * remPx, 600);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs absent at exactly 30rem");
  assert.ok(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm at exactly 30rem");

  kb.destroy();
});

QUnit.test("Classes update when width changes across breakpoints", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;

  (kb as any)._applyResponsiveSizeClasses(dom, 300, 600);
  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "Starts compact");

  (kb as any)._applyResponsiveSizeClasses(dom, 400, 600);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs removed after resize");
  assert.ok(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm applied after resize");

  (kb as any)._applyResponsiveSizeClasses(dom, 800, 600);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqXs), "cq-xs removed at wide width");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqSm), "cq-sm removed at wide width");

  kb.destroy();
});

QUnit.test("Cleanup on exit() removes resize observer", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 300, 600);
  assert.ok(dom.classList.contains(DOM.classes.rootCqXs), "Class applied before destroy");

  kb.destroy();

  assert.strictEqual((kb as any)._responsiveResizeHandlerId, null, "Resize handler deregistered");
  assert.strictEqual((kb as any)._responsiveObservedDom, null, "Observed DOM reference cleared");
});

// ──────────────────────────────────────────────
// Font-size capping (min() preserves smaller consumer values)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Height-responsive breakpoint classes
// ──────────────────────────────────────────────

QUnit.test("Applies cq-short class when externally constrained (height <= 16rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "4rem");
  dom.style.height = "16rem";
  dom.style.overflow = "hidden";

  // Constrained to 16rem — triggers cq-short
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 16 * remPx);

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

  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 12 * remPx);

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

  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, dom.getBoundingClientRect().height);

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

  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 12 * remPx);

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
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 10 * remPx);

  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny applied before docking");

  kb.setDocked(true);

  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short cleared when docked=true");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny cleared when docked=true");

  kb.destroy();
});

QUnit.test("Intrinsic height changes from CSS vars update height classes without outer resize", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  dom.style.setProperty("--ui5KioskKeyboard-keyHeight", "1.5rem");
  dom.style.height = "15rem";
  dom.style.overflow = "hidden";

  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, dom.getBoundingClientRect().height);
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

  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, dom.getBoundingClientRect().height);
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
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 10 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqTiny), "Starts as tiny");

  // Grow to short
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 15 * remPx);
  assert.ok(dom.classList.contains(DOM.classes.rootCqShort), "Transitions to short");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny removed");

  // Grow to unconstrained
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 400);
  assert.notOk(dom.classList.contains(DOM.classes.rootCqShort), "cq-short removed at full height");
  assert.notOk(dom.classList.contains(DOM.classes.rootCqTiny), "cq-tiny removed at full height");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Font-size capping (min() preserves smaller consumer values)
// ──────────────────────────────────────────────

QUnit.test("Responsive class preserves custom font-size below the cap", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()! as HTMLElement;
  // Set a custom font-size smaller than both caps (1rem, 0.875rem)
  dom.style.setProperty("--ui5KioskKeyboard-keyFontSize", "0.75rem");

  // Apply cq-sm (cap = 1rem) - 0.75rem should be preserved
  (kb as any)._applyResponsiveSizeClasses(dom, 400, 600);
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
  (kb as any)._applyResponsiveSizeClasses(dom, 300, 600);
  const fontSizeXs = Number.parseFloat(window.getComputedStyle(key).fontSize);
  assert.ok(
    Math.abs(fontSizeXs - expected) < 1.5,
    `Custom 0.75rem (${expected}px) preserved at cq-xs; got ${fontSizeXs}px`,
  );

  kb.destroy();
});
