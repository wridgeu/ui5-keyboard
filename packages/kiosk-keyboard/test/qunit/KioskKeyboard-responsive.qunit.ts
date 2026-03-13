import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
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
  (kb as any)._applyResponsiveSizeClasses(dom, 300);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs class present at 300px");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm class absent at 300px");

  kb.destroy();
});

QUnit.test("Applies cq-sm class at narrow width (20rem < width <= 30rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 400);

  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs class absent at 400px");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm class present at 400px");

  kb.destroy();
});

QUnit.test("No responsive classes at wide width (> 30rem)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 800);

  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs class absent at 800px");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm class absent at 800px");

  kb.destroy();
});

QUnit.test("Boundary: exactly 20rem applies cq-xs", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  (kb as any)._applyResponsiveSizeClasses(dom, 20 * remPx);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs at exactly 20rem");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm absent at exactly 20rem");

  kb.destroy();
});

QUnit.test("Boundary: exactly 30rem applies cq-sm", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  const remPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  (kb as any)._applyResponsiveSizeClasses(dom, 30 * remPx);

  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs absent at exactly 30rem");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm at exactly 30rem");

  kb.destroy();
});

QUnit.test("Classes update when width changes across breakpoints", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;

  (kb as any)._applyResponsiveSizeClasses(dom, 300);
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "Starts compact");

  (kb as any)._applyResponsiveSizeClasses(dom, 400);
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs removed after resize");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm applied after resize");

  (kb as any)._applyResponsiveSizeClasses(dom, 800);
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "cq-xs removed at wide width");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--cq-sm"), "cq-sm removed at wide width");

  kb.destroy();
});

QUnit.test("Cleanup on exit() removes resize observer", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  (kb as any)._applyResponsiveSizeClasses(dom, 300);
  assert.ok(dom.classList.contains("ui5KioskKeyboard--cq-xs"), "Class applied before destroy");

  kb.destroy();

  assert.strictEqual((kb as any)._responsiveResizeHandlerId, null, "Resize handler deregistered");
  assert.strictEqual((kb as any)._responsiveObservedDom, null, "Observed DOM reference cleared");
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
  (kb as any)._applyResponsiveSizeClasses(dom, 400);
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
  (kb as any)._applyResponsiveSizeClasses(dom, 300);
  const fontSizeXs = Number.parseFloat(window.getComputedStyle(key).fontSize);
  assert.ok(
    Math.abs(fontSizeXs - expected) < 1.5,
    `Custom 0.75rem (${expected}px) preserved at cq-xs; got ${fontSizeXs}px`,
  );

  kb.destroy();
});
