import KioskKeyboard from "ui5/kiosk/KioskKeyboard";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

const RENDER_WAIT = 500;

function placeAndWait(control: KioskKeyboard): Promise<void> {
  control.placeAt("qunit-fixture");
  return new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));
}

function getDom(kb: KioskKeyboard): HTMLElement {
  const dom = kb.getDomRef();
  if (!dom) throw new Error("Keyboard not rendered");
  return dom as HTMLElement;
}

function simulateTap(kb: KioskKeyboard, el: HTMLElement): void {
  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: el, writable: false });
  kb.ontouchstart(start);

  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: el, writable: false });
  kb.ontouchend(end);
}

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("Visual Regression — DOM Structure", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// QWERTY Layout Structure
// ──────────────────────────────────────────────

QUnit.test("QWERTY: root has correct attributes and classes", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  assert.ok(dom.classList.contains("ui5KioskKeyboard"), "Root has ui5KioskKeyboard class");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--numpad"), "No numpad class on QWERTY");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--numeric"), "No numeric class on QWERTY");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--disabled"), "No disabled class");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--docked"), "No docked class");
  assert.strictEqual(dom.getAttribute("role"), "group", "role=group");
  assert.strictEqual(dom.getAttribute("aria-label"), "Virtual Keyboard", "Default aria-label");

  kb.destroy();
});

QUnit.test("QWERTY: has 5 rows with correct structure", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const rows = dom.querySelectorAll<HTMLElement>(":scope > .ui5KioskRow");
  assert.strictEqual(rows.length, 5, "5 rows rendered");

  // Each row has keys
  for (let i = 0; i < rows.length; i++) {
    const keys = rows[i].querySelectorAll(".ui5KioskKey");
    assert.ok(keys.length > 0, `Row ${i} has keys`);
  }

  kb.destroy();
});

QUnit.test("QWERTY: all keys have role=button and aria-label", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const keys = dom.querySelectorAll<HTMLElement>(".ui5KioskKey");
  assert.ok(keys.length > 0, "Keys rendered");

  for (const key of keys) {
    assert.strictEqual(key.getAttribute("role"), "button", `${key.dataset.key}: role=button`);
    assert.ok(key.getAttribute("aria-label"), `${key.dataset.key}: has aria-label`);
    assert.ok(key.hasAttribute("data-key"), `Key has data-key attribute`);
  }

  kb.destroy();
});

QUnit.test("QWERTY: first key is tabbable, rest are not", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const keys = dom.querySelectorAll<HTMLElement>(".ui5KioskKey");
  assert.strictEqual(keys[0].getAttribute("tabindex"), "0", "First key has tabindex=0");

  for (let i = 1; i < keys.length; i++) {
    assert.strictEqual(keys[i].getAttribute("tabindex"), "-1", `Key ${i} has tabindex=-1`);
  }

  kb.destroy();
});

QUnit.test("QWERTY: shift key has aria-pressed=false by default", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const shiftKey = dom.querySelector<HTMLElement>('[data-key="{shift}"]');
  assert.ok(shiftKey, "Shift key exists");
  assert.strictEqual(shiftKey!.getAttribute("aria-pressed"), "false", "Shift aria-pressed=false");

  kb.destroy();
});

QUnit.test("QWERTY: backspace key has action class and width class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const bsKey = dom.querySelector<HTMLElement>('[data-key="{backspace}"]');
  assert.ok(bsKey, "Backspace key exists");
  assert.ok(bsKey!.classList.contains("ui5KioskKey--action"), "Has action class");
  assert.ok(bsKey!.classList.contains("ui5KioskKey--w2"), "Has w2 width class");

  kb.destroy();
});

QUnit.test("QWERTY: space key has space width class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const spaceKey = dom.querySelector<HTMLElement>('[data-key=" "]');
  assert.ok(spaceKey, "Space key exists");
  assert.ok(spaceKey!.classList.contains("ui5KioskKey--space"), "Has space class");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Numpad Layout Structure
// ──────────────────────────────────────────────

QUnit.test("Numpad: has type-specific CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numpad" as any);
  await placeAndWait(kb);
  const dom = getDom(kb);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--numpad"), "Has numpad class");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--numeric"), "No numeric class");

  kb.destroy();
});

QUnit.test("Numeric: has type-specific CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType("Numeric" as any);
  await placeAndWait(kb);
  const dom = getDom(kb);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--numeric"), "Has numeric class");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--numpad"), "No numpad class");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Disabled State
// ──────────────────────────────────────────────

QUnit.test("Disabled: root has disabled class and aria-disabled", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setEnabled(false);
  await placeAndWait(kb);
  const dom = getDom(kb);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--disabled"), "Has disabled class");
  assert.strictEqual(dom.getAttribute("aria-disabled"), "true", "Root has aria-disabled=true");

  // All keys should also have aria-disabled
  const keys = dom.querySelectorAll<HTMLElement>(".ui5KioskKey");
  for (const key of keys) {
    assert.strictEqual(key.getAttribute("aria-disabled"), "true", `${key.dataset.key}: aria-disabled=true`);
  }

  kb.destroy();
});

// ──────────────────────────────────────────────
// Docked Mode
// ──────────────────────────────────────────────

QUnit.test("Docked: has docked and closed classes initially", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);
  const dom = getDom(kb);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--docked"), "Has docked class");
  assert.ok(dom.classList.contains("ui5KioskKeyboard--closed"), "Starts with closed class");

  kb.destroy();
});

QUnit.test("Docked: open removes closed class", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setDocked(true);
  await placeAndWait(kb);

  kb.show();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const dom = getDom(kb);

  assert.ok(dom.classList.contains("ui5KioskKeyboard--docked"), "Still has docked class");
  assert.notOk(dom.classList.contains("ui5KioskKeyboard--closed"), "Closed class removed");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Layout Switching
// ──────────────────────────────────────────────

QUnit.test("Layout switch: special layout renders different keys", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  // Capture QWERTY key count
  const qwertyKeys = dom.querySelectorAll(".ui5KioskKey").length;
  assert.ok(qwertyKeys > 0, `QWERTY has ${qwertyKeys} keys`);

  // Switch to special
  kb.setLayout("special");
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const specialKeys = dom.querySelectorAll(".ui5KioskKey").length;
  assert.ok(specialKeys > 0, `Special has ${specialKeys} keys`);

  // Keys should differ (special layout has different character set)
  const qwertyQ = dom.querySelector('[data-key="q"]');
  assert.notOk(qwertyQ, "q key no longer present after switching to special");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Shift State Visual
// ──────────────────────────────────────────────

QUnit.test("Shift key gets active class when shift is toggled", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const shiftKey = dom.querySelector<HTMLElement>('[data-key="{shift}"]');
  assert.ok(shiftKey, "Shift key rendered");
  assert.notOk(shiftKey!.classList.contains("ui5KioskKey--active"), "Not active initially");

  // Toggle shift
  const shiftEl = dom.querySelector<HTMLElement>('[data-key="{shift}"]')!;
  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: shiftEl, writable: false });
  kb.ontouchstart(start);
  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: shiftEl, writable: false });
  kb.ontouchend(end);

  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const updatedShift = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]');
  assert.ok(updatedShift!.classList.contains("ui5KioskKey--active"), "Shift key has active class");
  assert.strictEqual(updatedShift!.getAttribute("aria-pressed"), "true", "aria-pressed=true");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Key Labels
// ──────────────────────────────────────────────

QUnit.test("Key labels show lowercase by default, uppercase when shifted", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const qKey = dom.querySelector<HTMLElement>('[data-key="q"]');
  assert.ok(qKey, "q key exists");
  assert.strictEqual(qKey!.textContent!.trim(), "q", "Shows lowercase by default");

  // Activate shift
  const shiftEl = dom.querySelector<HTMLElement>('[data-key="{shift}"]')!;
  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: shiftEl, writable: false });
  kb.ontouchstart(start);
  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: shiftEl, writable: false });
  kb.ontouchend(end);

  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const qKeyShifted = getDom(kb).querySelector<HTMLElement>('[data-key="q"]');
  assert.strictEqual(qKeyShifted!.textContent!.trim(), "Q", "Shows uppercase when shifted");

  kb.destroy();
});

QUnit.test("Number keys show shift symbols when shifted", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  const oneKey = dom.querySelector<HTMLElement>('[data-key="1"]');
  assert.ok(oneKey, "1 key exists");
  assert.strictEqual(oneKey!.textContent!.trim(), "1", "Shows 1 by default");

  // Activate shift
  const shiftEl = dom.querySelector<HTMLElement>('[data-key="{shift}"]')!;
  const start = new Event("touchstart", { bubbles: true });
  Object.defineProperty(start, "target", { value: shiftEl, writable: false });
  kb.ontouchstart(start);
  const end = new Event("touchend", { bubbles: true });
  Object.defineProperty(end, "target", { value: shiftEl, writable: false });
  kb.ontouchend(end);

  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const oneKeyShifted = getDom(kb).querySelector<HTMLElement>('[data-key="1"]');
  assert.ok(oneKeyShifted!.hasAttribute("data-shift-value"), "Has shift value attribute");
  assert.strictEqual(oneKeyShifted!.textContent!.trim(), "!", "Shows ! when shifted");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Fast Navigation Group
// ──────────────────────────────────────────────

QUnit.test("Root has data-sap-ui-fastnavgroup for F6 navigation", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const dom = getDom(kb);

  assert.strictEqual(dom.getAttribute("data-sap-ui-fastnavgroup"), "true", "F6 fast nav group set");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Custom ariaLabel
// ──────────────────────────────────────────────

QUnit.test("Custom ariaLabel is rendered", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setAriaLabel("Kiosk Input Keyboard");
  await placeAndWait(kb);
  const dom = getDom(kb);

  assert.strictEqual(dom.getAttribute("aria-label"), "Kiosk Input Keyboard", "Custom aria-label rendered");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Caps Lock Visual State
// ──────────────────────────────────────────────

QUnit.test("Caps Lock: shift key gets capsLock class and lock icon", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Double-tap shift for caps lock
  const shiftEl = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]')!;
  simulateTap(kb, shiftEl);
  simulateTap(kb, shiftEl);
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const dom = getDom(kb);
  const updatedShift = dom.querySelector<HTMLElement>('[data-key="{shift}"]')!;
  assert.ok(updatedShift.classList.contains("ui5KioskKey--active"), "Has active class");
  assert.ok(updatedShift.classList.contains("ui5KioskKey--capsLock"), "Has capsLock class");
  assert.strictEqual(updatedShift.getAttribute("aria-label"), "Caps Lock", "aria-label is Caps Lock");

  const icon = updatedShift.querySelector(".sapUiIcon");
  assert.ok(icon, "Lock icon rendered");

  kb.destroy();
});

QUnit.test("Single shift: no capsLock class, text label", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftEl = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]')!;
  simulateTap(kb, shiftEl);
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const dom = getDom(kb);
  const updatedShift = dom.querySelector<HTMLElement>('[data-key="{shift}"]')!;
  assert.ok(updatedShift.classList.contains("ui5KioskKey--active"), "Has active class");
  assert.notOk(updatedShift.classList.contains("ui5KioskKey--capsLock"), "No capsLock class");
  assert.strictEqual(updatedShift.getAttribute("aria-label"), "Shift", "aria-label is Shift");

  const icon = updatedShift.querySelector(".sapUiIcon");
  assert.notOk(icon, "No lock icon for single shift");

  kb.destroy();
});

// ──────────────────────────────────────────────
// QWERTZ-DE Layout Visual Structure
// ──────────────────────────────────────────────

QUnit.test("QWERTZ-DE: has 5 rows with correct structure", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);
  const dom = getDom(kb);

  const rows = dom.querySelectorAll<HTMLElement>(":scope > .ui5KioskRow");
  assert.strictEqual(rows.length, 5, "5 rows rendered");

  // Row 2: should have z and \u00FC
  const row2Keys = Array.from(rows[1].querySelectorAll<HTMLElement>(".ui5KioskKey")).map((k) => k.dataset.key);
  assert.ok(row2Keys.includes("z"), "Row 2 has z (QWERTZ)");
  assert.ok(row2Keys.includes("\u00FC"), "Row 2 has \u00FC");

  // Row 3: should have \u00F6 and \u00E4
  const row3Keys = Array.from(rows[2].querySelectorAll<HTMLElement>(".ui5KioskKey")).map((k) => k.dataset.key);
  assert.ok(row3Keys.includes("\u00F6"), "Row 3 has \u00F6");
  assert.ok(row3Keys.includes("\u00E4"), "Row 3 has \u00E4");

  // Row 4: should have y, \u00DF, shift, enter
  const row4Keys = Array.from(rows[3].querySelectorAll<HTMLElement>(".ui5KioskKey")).map((k) => k.dataset.key);
  assert.ok(row4Keys.includes("y"), "Row 4 has y");
  assert.ok(row4Keys.includes("\u00DF"), "Row 4 has \u00DF");
  assert.ok(row4Keys.includes("{shift}"), "Row 4 has shift");
  assert.ok(row4Keys.includes("{enter}"), "Row 4 has enter");

  kb.destroy();
});

QUnit.test("QWERTZ-DE: Umlaute display uppercase when shifted", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  // Activate shift
  const shiftEl = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]')!;
  simulateTap(kb, shiftEl);
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const dom = getDom(kb);
  const ueKey = dom.querySelector<HTMLElement>('[data-key="\u00FC"]');
  assert.ok(ueKey, "\u00FC key exists");
  assert.strictEqual(ueKey!.textContent!.trim(), "\u00DC", "\u00FC shows \u00DC when shifted");

  const oeKey = dom.querySelector<HTMLElement>('[data-key="\u00F6"]');
  assert.strictEqual(oeKey!.textContent!.trim(), "\u00D6", "\u00F6 shows \u00D6 when shifted");

  const aeKey = dom.querySelector<HTMLElement>('[data-key="\u00E4"]');
  assert.strictEqual(aeKey!.textContent!.trim(), "\u00C4", "\u00E4 shows \u00C4 when shifted");

  kb.destroy();
});

// ──────────────────────────────────────────────
// E2E Workflow: Complete typing session
// ──────────────────────────────────────────────

QUnit.test("E2E: full typing workflow with shift, caps, backspace, layout switch", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Verify initial state
  assert.notOk(kb.isShiftActive(), "No shift initially");
  assert.notOk(kb.isCapsLock(), "No caps initially");
  assert.strictEqual(kb.getLayout(), "qwerty", "QWERTY layout initially");

  // 1. Tap a key
  const dom = getDom(kb);
  const qKey = dom.querySelector<HTMLElement>('[data-key="q"]')!;
  simulateTap(kb, qKey);
  assert.notOk(kb.isShiftActive(), "Still no shift after character");

  // 2. Activate shift, verify visual change
  const shiftEl = dom.querySelector<HTMLElement>('[data-key="{shift}"]')!;
  simulateTap(kb, shiftEl);
  assert.ok(kb.isShiftActive(), "Shift active after tap");

  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  let updatedShift = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]')!;
  assert.ok(updatedShift.classList.contains("ui5KioskKey--active"), "Shift key highlighted");

  // 3. Tap character — shift auto-releases
  const wKey = getDom(kb).querySelector<HTMLElement>('[data-key="w"]')!;
  simulateTap(kb, wKey);
  assert.notOk(kb.isShiftActive(), "Shift auto-released after character");

  // 4. Double-tap shift for caps lock
  const shiftEl2 = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]')!;
  simulateTap(kb, shiftEl2);

  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  const shiftEl3 = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]')!;
  simulateTap(kb, shiftEl3);
  assert.ok(kb.isCapsLock(), "Caps lock on after double-tap");

  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  updatedShift = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]')!;
  assert.ok(updatedShift.classList.contains("ui5KioskKey--capsLock"), "Caps lock CSS class present");

  // 5. Tap character — caps lock persists
  const eKey = getDom(kb).querySelector<HTMLElement>('[data-key="e"]')!;
  simulateTap(kb, eKey);
  assert.ok(kb.isCapsLock(), "Caps lock still on after character");

  // 6. Triple-tap shift to turn off
  const shiftEl4 = getDom(kb).querySelector<HTMLElement>('[data-key="{shift}"]')!;
  simulateTap(kb, shiftEl4);
  assert.notOk(kb.isShiftActive(), "Everything off after third tap");

  // 7. Switch layout
  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));
  const numKey = getDom(kb).querySelector<HTMLElement>('[data-key="{layout:numeric}"]')!;
  simulateTap(kb, numKey);
  assert.strictEqual(kb.getLayout(), "numeric", "Switched to numeric");

  await new Promise((resolve) => setTimeout(resolve, RENDER_WAIT));

  // 8. Switch back
  const backKey = getDom(kb).querySelector<HTMLElement>('[data-key="{layout:base}"]')!;
  simulateTap(kb, backKey);
  assert.strictEqual(kb.getLayout(), "qwerty", "Returned to qwerty");

  kb.destroy();
});
