import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import { placeAndWait } from "./test-helpers";

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard responsive sizing", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
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

  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs class present at 300px");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm class absent at 300px");

  kb.destroy();
});

QUnit.test("Applies cq-sm class at narrow width (20rem < width <= 30rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 400, 600);

  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs class absent at 400px");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm class present at 400px");

  kb.destroy();
});

QUnit.test("No responsive classes at wide width (> 30rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 800, 600);

  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs class absent at 800px");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm class absent at 800px");

  kb.destroy();
});

QUnit.test("Boundary: exactly 20rem applies cq-xs", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  (kb as any)._applyResponsiveSizeClasses(dom, 20 * remPx, 600);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs at exactly 20rem");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm absent at exactly 20rem");

  kb.destroy();
});

QUnit.test("Boundary: exactly 30rem applies cq-sm", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  (kb as any)._applyResponsiveSizeClasses(dom, 30 * remPx, 600);

  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs absent at exactly 30rem");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm at exactly 30rem");

  kb.destroy();
});

QUnit.test("Classes update when width changes across breakpoints", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;

  (kb as any)._applyResponsiveSizeClasses(dom, 300, 600);
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "Starts compact");

  (kb as any)._applyResponsiveSizeClasses(dom, 400, 600);
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs removed after resize");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm applied after resize");

  (kb as any)._applyResponsiveSizeClasses(dom, 800, 600);
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs removed at wide width");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm removed at wide width");

  kb.destroy();
});

QUnit.test("Cleanup on exit() removes resize observer", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 300, 600);
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "Class applied before destroy");

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

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  // Simulate measured natural height (large enough to count as constrained)
  (kb as any)._naturalContentHeight = 400;

  // Constrained to 16rem — triggers cq-short
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 16 * remPx);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-short"), "cq-short applied at 16rem height");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-tiny"), "cq-tiny absent at 16rem height");

  kb.destroy();
});

QUnit.test("Applies cq-tiny class when severely constrained (height <= 12rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  (kb as any)._naturalContentHeight = 400;

  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 12 * remPx);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-tiny"), "cq-tiny applied at 12rem height");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-short"), "cq-short absent when cq-tiny");

  kb.destroy();
});

QUnit.test("No height classes when keyboard is not externally constrained", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;

  // Natural height equals actual height — not constrained
  (kb as any)._naturalContentHeight = 300;
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 300);

  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-short"), "cq-short absent when unconstrained");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-tiny"), "cq-tiny absent when unconstrained");

  kb.destroy();
});

QUnit.test("No height classes for docked keyboards", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  (kb as any)._naturalContentHeight = 400;
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 12 * remPx);

  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-short"), "cq-short absent for docked");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-tiny"), "cq-tiny absent for docked");

  kb.destroy();
});

QUnit.test("resetKeyboardType() clears cached natural height", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Simulate cached natural height
  (kb as any)._naturalContentHeight = 350;
  assert.strictEqual((kb as any)._naturalContentHeight, 350, "Natural height cached");

  kb.resetKeyboardType();
  assert.strictEqual((kb as any)._naturalContentHeight, null, "Natural height reset after resetKeyboardType()");

  kb.destroy();
});

QUnit.test("Auto-type detection resets cached natural height", async (assert) => {
  const input = new Input({ type: "Number" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({
    docked: true,
    autoShow: true,
    autoType: true,
  });
  await placeAndWait(kb);

  // Simulate cached natural height from a previous Full keyboard render
  (kb as any)._naturalContentHeight = 400;

  // Focus numeric input — auto-type detects Numpad
  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getKeyboardType(), "Numpad", "Auto-detected Numpad");
  assert.strictEqual((kb as any)._naturalContentHeight, null, "Natural height reset by auto-type detection path");

  input.destroy();
  kb.destroy();
});

QUnit.test("Height classes update when constraint changes", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;

  (kb as any)._naturalContentHeight = 400;

  // Start constrained (tiny)
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 10 * remPx);
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-tiny"), "Starts as tiny");

  // Grow to short
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 15 * remPx);
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-short"), "Transitions to short");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-tiny"), "cq-tiny removed");

  // Grow to unconstrained
  (kb as any)._applyResponsiveSizeClasses(dom, dom.getBoundingClientRect().width, 400);
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-short"), "cq-short removed at full height");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-tiny"), "cq-tiny removed at full height");

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
  const key = dom.querySelector(".ui5KioskKey") as HTMLElement;
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
