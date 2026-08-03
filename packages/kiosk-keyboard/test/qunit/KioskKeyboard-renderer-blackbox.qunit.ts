import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType } from "ui5/kiosk/library";
import type { LayoutDefinition } from "ui5/kiosk/types";
import { keyElementId } from "ui5/kiosk/internal/dom";
import {
  freezeDoubleClickWindow,
  getKeyboardDom,
  getKeyElement,
  getKeyElements,
  getRequiredKeyElement,
  getRowElements,
  hasKeyboardClass,
  hasKeyClass,
  placeAndWait,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

QUnit.module("KioskKeyboard renderer black-box", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// 1. Shift cycle render contract
// ──────────────────────────────────────────────

QUnit.test("Shift cycle: off → shift → caps → off (DOM state)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const getShift = () => getKeyElement(kb, "{shift}")!;
  const getLive = () => document.getElementById(`${kb.getId()}-liveState`)!;

  const clock = freezeDoubleClickWindow();
  try {
    // Initial state
    assert.strictEqual(getShift().getAttribute("aria-pressed"), "false", "Initially aria-pressed=false");
    assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "No active class initially");
    assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "No capsLock class initially");
    assert.strictEqual(getLive().textContent, "", "Live region empty initially");

    // 1st tap → Shift on
    tapKey(kb, "{shift}");
    await waitForRender();

    assert.strictEqual(getShift().getAttribute("aria-pressed"), "true", "After 1st tap: aria-pressed=true");
    assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "After 1st tap: active class present");
    assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "After 1st tap: no capsLock class");
    assert.strictEqual(getLive().textContent, "Shift on", "After 1st tap: live region announces Shift on");

    // 2nd tap → Caps Lock on
    tapKey(kb, "{shift}");
    await waitForRender();

    assert.strictEqual(getShift().getAttribute("aria-pressed"), "true", "After 2nd tap: aria-pressed=true");
    assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "After 2nd tap: active class present");
    assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "After 2nd tap: capsLock class present");
    assert.strictEqual(getLive().textContent, "Caps Lock on", "After 2nd tap: live region announces Caps Lock on");

    // 3rd tap → All off
    tapKey(kb, "{shift}");
    await waitForRender();

    assert.strictEqual(getShift().getAttribute("aria-pressed"), "false", "After 3rd tap: aria-pressed=false");
    assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "After 3rd tap: no active class");
    assert.notOk(hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock), "After 3rd tap: no capsLock class");
    assert.strictEqual(getLive().textContent, "", "After 3rd tap: live region cleared");
  } finally {
    clock.restore();
  }

  kb.destroy();
});

// ──────────────────────────────────────────────
// 1b. Shift feedback latency KPIs
// ──────────────────────────────────────────────

QUnit.test("Shift-active class appears synchronously after tap (before re-render)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Tap shift and check IMMEDIATELY - no waitForRender
  tapKey(kb, "{shift}");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive), "active class present synchronously after tap");

  await waitForRender(); // let render complete
  kb.destroy();
});

QUnit.test("Shift-active class removed synchronously when turning off from caps", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Tap 1: shift on
  tapKey(kb, "{shift}");
  await waitForRender();

  // Tap 2 (within 400ms): caps lock on
  tapKey(kb, "{shift}");
  await waitForRender();

  // Tap 3: off - check IMMEDIATELY (before waitForRender)
  tapKey(kb, "{shift}");
  assert.notOk(
    hasKeyClass(kb, "{shift}", DOM.classes.keyShiftActive),
    "active class removed synchronously after tap-off from caps",
  );
  assert.notOk(
    hasKeyClass(kb, "{shift}", DOM.classes.keyCapsLock),
    "capsLock class removed synchronously after tap-off from caps",
  );

  await waitForRender();
  kb.destroy();
});

QUnit.test("No forced layout reads (getComputedStyle) during shift toggle", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Let any pending responsive sync settle
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const origGCS = window.getComputedStyle;
  let gcsCount = 0;
  window.getComputedStyle = function (this: Window, ...args: Parameters<typeof origGCS>) {
    gcsCount++;
    return origGCS.apply(this, args);
  } as typeof origGCS;

  try {
    tapKey(kb, "{shift}");
    await waitForRender();

    assert.strictEqual(gcsCount, 0, "getComputedStyle should not be called during shift toggle");
  } finally {
    window.getComputedStyle = origGCS;
  }

  kb.destroy();
});

// ──────────────────────────────────────────────
// 2. Shifted labels update in DOM
// ──────────────────────────────────────────────

QUnit.test("Shifted visible labels update in DOM", async (assert) => {
  const layout: LayoutDefinition = [
    [
      { value: "1", shiftLabel: "!", shiftValue: "!" },
      { value: "a" },
      { value: "{shift}", label: "", type: "modifier", width: "1.5" },
    ],
  ];
  const kb = new KioskKeyboard({ layout: "bb-shift-test", instanceLayouts: { "bb-shift-test": layout } });
  await placeAndWait(kb);

  const getKey = (v: string) => getKeyElement(kb, v)!;

  // Unshifted state
  assert.strictEqual(getKey("1").textContent, "1", "Key '1' shows '1' unshifted");
  assert.strictEqual(
    getKey("1").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "1",
    "Key '1' visible label is '1'",
  );
  assert.strictEqual(getKey("a").textContent, "a", "Key 'a' shows 'a' unshifted");
  assert.strictEqual(
    getKey("a").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "a",
    "Key 'a' visible label is 'a'",
  );

  // Activate shift
  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(getKey("1").textContent, "!", "Key '1' shows '!' when shifted");
  assert.strictEqual(
    getKey("1").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "!",
    "Key '1' visible label is '!'",
  );
  assert.strictEqual(getKey("a").textContent, "A", "Key 'a' shows 'A' when shifted");
  assert.strictEqual(
    getKey("a").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "A",
    "Key 'a' visible label is 'A'",
  );

  // Typing a character auto-releases shift
  tapKey(kb, "a");
  await waitForRender();

  assert.strictEqual(getKey("1").textContent, "1", "Key '1' back to '1' after shift auto-release");
  assert.strictEqual(getKey("a").textContent, "a", "Key 'a' back to 'a' after shift auto-release");

  kb.destroy();
});

// ──────────────────────────────────────────────
// 3. Keyboard type render switching
// ──────────────────────────────────────────────

QUnit.test("Keyboard type switching: Full → Numpad → Numeric → Full", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const keyValues = () => Array.from(getKeyElements(kb)).map((k) => k.dataset.key);

  // Full
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Full: no numpad class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Full: no numeric class");
  assert.ok(keyValues().includes("q"), "Full: has alphabetic keys");

  // Switch to Numpad
  kb.setKeyboardType(KeyboardType.Numpad);
  await waitForRender();

  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Numpad: has numpad class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Numpad: no numeric class");
  const numpadKeys = keyValues();
  assert.notOk(numpadKeys.includes("q"), "Numpad: no alphabetic keys");
  assert.ok(numpadKeys.includes("7"), "Numpad: has '7'");

  // Switch to Numeric
  kb.setKeyboardType(KeyboardType.Numeric);
  await waitForRender();

  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Numeric: no numpad class");
  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Numeric: has numeric class");
  const numericKeys = keyValues();
  assert.notOk(numericKeys.includes("q"), "Numeric: no alphabetic keys");

  // Back to Full
  kb.setKeyboardType(KeyboardType.Full);
  await waitForRender();

  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Full again: no numpad class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Full again: no numeric class");
  assert.ok(keyValues().includes("q"), "Full again: has alphabetic keys");

  kb.destroy();
});

// ──────────────────────────────────────────────
// 4. Special key accessibility labels
// ──────────────────────────────────────────────

QUnit.test("Special keys render correct labels", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Backspace in qwerty has visible text label (icon+label dual)
  const backspace = getKeyElement(kb, "{backspace}");
  assert.ok(backspace, "Backspace key rendered");
  assert.strictEqual(
    backspace!.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Backspace",
    "Backspace visible label",
  );

  // Enter, Shift, Space have visible text labels (WCAG 2.5.3)
  const enter = getKeyElement(kb, "{enter}");
  assert.ok(enter, "Enter key rendered");
  assert.strictEqual(enter!.querySelector(`.${DOM.classes.keyLabel}`)?.textContent, "Enter", "Enter visible label");

  const shift = getKeyElement(kb, "{shift}");
  assert.ok(shift, "Shift key rendered");
  assert.strictEqual(shift!.querySelector(`.${DOM.classes.keyLabel}`)?.textContent, "Shift", "Shift visible label");

  const space = getKeyElement(kb, " ");
  assert.ok(space, "Space key rendered");
  assert.strictEqual(space!.querySelector(`.${DOM.classes.keyLabel}`)?.textContent, "Space", "Space visible label");

  kb.destroy();
});

// ──────────────────────────────────────────────
// 5. Layout switch rendering
// ──────────────────────────────────────────────

QUnit.test("Layout switch via {layout:numeric} changes rendered key matrix", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // QWERTY initially
  const qwertyKeys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(qwertyKeys.includes("q"), "QWERTY layout has 'q'");
  assert.ok(qwertyKeys.includes("{layout:numeric}"), "QWERTY layout has layout:numeric switch key");

  // Switch to numeric layout
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  const numericKeys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.notOk(numericKeys.includes("q"), "Numeric layout does not have 'q'");
  assert.notOk(numericKeys.includes("a"), "Numeric layout does not have 'a'");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Icon + Label permutation matrix
// ──────────────────────────────────────────────

type IconLabelCase = {
  title: string;
  keyDef: LayoutDefinition[number][number];
  expectIcon: boolean;
  expectLabel: boolean;
  expectLabelText?: string;
  expectDual: boolean;
};

const iconLabelCases: IconLabelCase[] = [
  {
    title: "icon omitted, label omitted: renders label from value",
    keyDef: { value: "a" },
    expectIcon: false,
    expectLabel: true,
    expectLabelText: "a",
    expectDual: false,
  },
  {
    title: "icon omitted, label set: renders custom label only",
    keyDef: { value: "x", label: "Custom" },
    expectIcon: false,
    expectLabel: true,
    expectLabelText: "Custom",
    expectDual: false,
  },
  {
    title: "icon omitted, label empty: renders blank key",
    keyDef: { value: "x", label: "" },
    expectIcon: false,
    expectLabel: false,
    expectDual: false,
  },
  {
    title: "SAP icon set, label omitted: renders both (dual)",
    keyDef: { value: "x", icon: "sap-icon://home" },
    expectIcon: true,
    expectLabel: true,
    expectLabelText: "x",
    expectDual: true,
  },
  {
    title: "SAP icon + custom label: renders both (dual)",
    keyDef: { value: "x", icon: "sap-icon://home", label: "Go" },
    expectIcon: true,
    expectLabel: true,
    expectLabelText: "Go",
    expectDual: true,
  },
  {
    title: "SAP icon set, label empty: renders icon only",
    keyDef: { value: "x", icon: "sap-icon://home", label: "" },
    expectIcon: true,
    expectLabel: false,
    expectDual: false,
  },
  {
    title: "icon empty, label omitted: renders label only (icon suppressed)",
    keyDef: { value: "x", icon: "" },
    expectIcon: false,
    expectLabel: true,
    expectDual: false,
  },
];

for (const { title, keyDef, expectIcon, expectLabel, expectLabelText, expectDual } of iconLabelCases) {
  QUnit.test(title, async (assert) => {
    const layout: LayoutDefinition = [[keyDef]];
    const kb = new KioskKeyboard({ instanceLayouts: { "test-icon-label": layout }, layout: "test-icon-label" });
    await placeAndWait(kb);

    const keyEl = getRequiredKeyElement(kb, keyDef.value);
    const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
    const labelEl = keyEl.querySelector(`.${DOM.classes.keyLabel}`);

    if (expectIcon) {
      assert.ok(iconEl, "Icon element present");
    } else {
      assert.notOk(iconEl, "No icon element");
    }

    if (expectLabel) {
      assert.ok(labelEl, "Label element present");
      if (expectLabelText !== undefined) {
        assert.strictEqual(labelEl!.textContent, expectLabelText, `Label text is '${expectLabelText}'`);
      }
    } else {
      assert.notOk(labelEl, "No label element");
    }

    if (expectDual) {
      assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");
    } else {
      assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");
    }

    kb.destroy();
  });
}

QUnit.test("Unicode icon renders as text span with icon class", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "\u21E7", label: "Shift" }]];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-icon-label": layout }, layout: "test-icon-label" });
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
  assert.ok(iconEl, "Icon element present");
  assert.strictEqual(iconEl!.tagName.toLowerCase(), "span", "Icon is a span (not sap icon)");
  assert.strictEqual(iconEl!.textContent, "\u21E7", "Icon text is \u21E7");
  assert.strictEqual(iconEl!.getAttribute("aria-hidden"), "true", "Icon is aria-hidden");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
});

QUnit.test("emoji icon renders as text span with icon class", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "\uD83D\uDD0D", label: "Search" }]];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-icon-label": layout }, layout: "test-icon-label" });
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
  assert.ok(iconEl, "Icon element present");
  assert.strictEqual(iconEl!.tagName.toLowerCase(), "span", "Icon is a span");
  assert.strictEqual(iconEl!.textContent, "\uD83D\uDD0D", "Icon text is emoji");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
});

QUnit.test("Shift key renders built-in icon + i18n label (dual)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "{shift}", type: "modifier", width: "2.25" }]];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-icon-label": layout }, layout: "test-icon-label" });
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(
    /shift/i.test(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent || ""),
    "Label contains 'Shift'",
  );
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
});

QUnit.test("Space bar renders visible i18n label, no icon", async (assert) => {
  const layout: LayoutDefinition = [[{ value: " ", type: "space", width: "space" }]];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-icon-label": layout }, layout: "test-icon-label" });
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, " ");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(
    /space/i.test(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent || ""),
    "Label contains 'Space'",
  );

  kb.destroy();
});

QUnit.test("Shift with label='' renders icon only (opt-out)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "{shift}", type: "modifier", width: "2.25", label: "" }]];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-icon-label": layout }, layout: "test-icon-label" });
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No label element");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");
  assert.ok(keyEl.getAttribute("aria-label"), "aria-label present for icon-only key");

  kb.destroy();
});

// ──────────────────────────────────────────────
// CapsLock property overrides
// ──────────────────────────────────────────────

QUnit.test("capsLockLabel overrides visible label during caps lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", capsLockLabel: "CL" }],
  ];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-capslock": layout }, layout: "test-capslock" });
  await placeAndWait(kb);

  // Activate caps lock (double-tap shift)
  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.strictEqual(
    keyEl.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "CL",
    "CapsLock label shows custom value",
  );
  assert.notOk(keyEl.getAttribute("aria-label"), "No redundant aria-label when visible capsLockLabel is present");

  kb.destroy();
});

QUnit.test("capsLockIcon overrides icon during caps lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", capsLockIcon: "\u21E7" }],
  ];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-capslock": layout }, layout: "test-capslock" });
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
  assert.ok(iconEl, "Icon element present");
  assert.strictEqual(iconEl!.textContent, "\u21E7", "CapsLock icon shows custom Unicode value");

  kb.destroy();
});

QUnit.test("capsLockIcon: '' suppresses icon during caps lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", capsLockIcon: "" }],
  ];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-capslock": layout }, layout: "test-capslock" });
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon during caps lock");

  kb.destroy();
});

QUnit.test("capsLockLabel: '' suppresses label, aria-label says Caps Lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", capsLockLabel: "" }],
  ];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-capslock": layout }, layout: "test-capslock" });
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No visible label during caps lock");
  assert.ok(/caps lock/i.test(keyEl.getAttribute("aria-label") ?? ""), "aria-label contains 'Caps Lock'");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Title tooltip for truncated labels
// ──────────────────────────────────────────────

QUnit.test("title attribute is present only for multi-character labels", async (assert) => {
  const titleCases: { value: string; label?: string; title: string | null }[] = [
    { value: "x", label: "Custom", title: "Custom" },
    { value: "a", title: null },
    { value: "x", label: "", title: null },
    { value: "{layout:alpha}", label: "ローマ字", title: "ローマ字" },
    { value: "x", label: "あ", title: null },
  ];

  for (const { value, label, title } of titleCases) {
    const keyDef: LayoutDefinition[number][number] = label === undefined ? { value } : { value, label };
    const layout: LayoutDefinition = [[keyDef]];
    const kb = new KioskKeyboard({ instanceLayouts: { "test-title": layout }, layout: "test-title" });
    await placeAndWait(kb);

    const keyEl = getRequiredKeyElement(kb, value);
    assert.strictEqual(
      keyEl.getAttribute("title"),
      title,
      `title ${title === null ? "absent" : `= ${title}`} for value=${JSON.stringify(value)} label=${JSON.stringify(label)}`,
    );

    kb.destroy();
  }
});

// ──────────────────────────────────────────────
// Responsive shrink for word labels
// ──────────────────────────────────────────────

QUnit.test("multi-character labels shrink responsively whatever the key type", async (assert) => {
  const layout: LayoutDefinition = [
    [
      { value: "{layout:numeric}", label: "123", type: "modifier" },
      { value: "{enter}", label: "Enter", type: "action" },
      { value: "x", label: "Custom" },
      { value: "y", label: "あ" },
    ],
  ];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-multi": layout }, layout: "test-multi" });
  await placeAndWait(kb);

  for (const value of ["{layout:numeric}", "{enter}", "x"]) {
    const label = getRequiredKeyElement(kb, value).querySelector(`.${DOM.classes.keyLabel}`)!;
    assert.ok(label.classList.contains(DOM.classes.keyLabelMulti), `${value} word label shrinks with key width`);
  }

  const glyph = getRequiredKeyElement(kb, "y").querySelector(`.${DOM.classes.keyLabel}`)!;
  assert.notOk(glyph.classList.contains(DOM.classes.keyLabelMulti), "single-glyph label keeps its own sizing");

  kb.destroy();
});

QUnit.test("layout-switch labels stay legible at the narrowest supported width", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  const dom = getKeyboardDom(kb);
  const wideKeyWidth = getKeyElements(kb)[0].getBoundingClientRect().width;
  dom.style.width = "320px";
  await waitForRender();

  const switchKeys = Array.from(getKeyElements(kb)).filter((k) =>
    (k.getAttribute("data-key") ?? "").startsWith("{layout:"),
  );
  assert.strictEqual(switchKeys.length, 3, "ja-kana renders its three layout-switch keys");

  // Non-vacuous: if the root stops sizing the rows the keys keep their full
  // width and every comparison below passes without testing the narrow case.
  const narrowKeyWidth = getKeyElements(kb)[0].getBoundingClientRect().width;
  assert.ok(
    narrowKeyWidth < wideKeyWidth,
    `the 320px root narrows the keys (${wideKeyWidth.toFixed(1)}px → ${narrowKeyWidth.toFixed(1)}px)`,
  );

  for (const keyEl of switchKeys) {
    const label = keyEl.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!;
    const name = `"${keyEl.getAttribute("data-key")}" label "${label.textContent}"`;

    // Theme-loaded canary: both widths are 0 on an unstyled inline span, so the
    // ellipsis check below would false-pass.
    assert.ok(label.clientWidth > 0, `${name} has a laid-out box`);

    assert.ok(
      label.scrollWidth <= label.clientWidth,
      `${name} is not ellipsized (needs ${label.scrollWidth}px, has ${label.clientWidth}px)`,
    );
  }

  kb.destroy();
});

QUnit.test("special key with i18n label gets title (e.g. Enter)", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const enter = getRequiredKeyElement(kb, "{enter}");
  assert.strictEqual(enter.getAttribute("title"), "Enter", "Enter key has title");

  const backspace = getRequiredKeyElement(kb, "{backspace}");
  assert.strictEqual(backspace.getAttribute("title"), "Backspace", "Backspace key has title");

  kb.destroy();
});

QUnit.test("icon: '' + capsLockIcon shows icon only during caps lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", icon: "", capsLockIcon: "\u{1F512}" }],
  ];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-capslock": layout }, layout: "test-capslock" });
  await placeAndWait(kb);

  // Normal state: no icon (icon: "" suppresses)
  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon in normal state");

  // Activate caps lock
  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  // CapsLock state: capsLockIcon renders independently
  assert.ok(
    getRequiredKeyElement(kb, "{shift}").querySelector(`.${DOM.classes.keyIcon}`),
    "Icon present during caps lock",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Keycap language (WCAG 2.2 SC 3.1.2)
// ──────────────────────────────────────────────

const keycapLangCases: { layout: string; characterKey: string; lang: string }[] = [
  { layout: "arabic", characterKey: "ض", lang: "ar" },
  { layout: "ja-kana", characterKey: "ぬ", lang: "ja" },
  { layout: "ko-hangul", characterKey: "ㅂ", lang: "ko" },
];

for (const { layout, characterKey, lang } of keycapLangCases) {
  QUnit.test(`${layout}: character key labels carry lang='${lang}'`, async (assert) => {
    const kb = new KioskKeyboard({ layout });
    await placeAndWait(kb);

    const labelOf = (value: string) =>
      getRequiredKeyElement(kb, value).querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!;

    assert.strictEqual(labelOf(characterKey).getAttribute("lang"), lang, `Character key label is lang='${lang}'`);

    // Special-key labels resolve through i18n, so they stay in the UI language.
    assert.strictEqual(labelOf("{enter}").getAttribute("lang"), null, "Action key label has no lang");
    assert.strictEqual(labelOf("{shift}").getAttribute("lang"), null, "Modifier key label has no lang");
    assert.strictEqual(labelOf(" ").getAttribute("lang"), null, "Space key label has no lang");

    // The declaration is scoped to the label span: the key's title / aria-label
    // and the keyboard chrome are UI-language text.
    assert.strictEqual(getRequiredKeyElement(kb, characterKey).getAttribute("lang"), null, "Key div has no lang");
    assert.strictEqual(getKeyboardDom(kb).getAttribute("lang"), null, "Keyboard root has no lang");

    kb.destroy();
  });
}

for (const layout of ["qwerty", "ja-romaji"]) {
  QUnit.test(`${layout}: no key label carries a lang attribute`, async (assert) => {
    const kb = new KioskKeyboard({ layout });
    await placeAndWait(kb);

    const dom = getKeyboardDom(kb);
    const labels = dom.querySelectorAll(`.${DOM.classes.keyLabel}`);
    assert.ok(labels.length > 0, "Label elements rendered");
    assert.strictEqual(dom.querySelectorAll(`.${DOM.classes.keyLabel}[lang]`).length, 0, "No label declares a lang");
    assert.strictEqual(dom.getAttribute("lang"), null, "Keyboard root has no lang");

    kb.destroy();
  });
}

QUnit.test("instanceLayouts descriptor lang lands on the character key labels", async (assert) => {
  const rows: LayoutDefinition = [
    [{ value: "א" }, { value: "{enter}", type: "action" }, { value: " ", width: "space", type: "space" }],
  ];
  const kb = new KioskKeyboard({ instanceLayouts: { "test-lang": { rows, lang: "he" } }, layout: "test-lang" });
  await placeAndWait(kb);

  const labelOf = (value: string) =>
    getRequiredKeyElement(kb, value).querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!;

  assert.strictEqual(labelOf("א").getAttribute("lang"), "he", "Character key label is lang='he'");
  assert.strictEqual(labelOf("{enter}").getAttribute("lang"), null, "Action key label has no lang");
  assert.strictEqual(labelOf(" ").getAttribute("lang"), null, "Space key label has no lang");
  assert.strictEqual(getRequiredKeyElement(kb, "א").getAttribute("lang"), null, "Key div has no lang");
  assert.strictEqual(getKeyboardDom(kb).getAttribute("lang"), null, "Keyboard root has no lang");

  kb.destroy();
});

QUnit.test("ja-kana: a modifier-typed key whose keycap is kana still declares the language", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  const labelOf = (value: string) =>
    getRequiredKeyElement(kb, value).querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!;

  // The dakuten / handakuten keys are typed `modifier` for their visual weight,
  // but they carry no i18n label: the keycap is the raw kana mark.
  assert.strictEqual(labelOf("゛").getAttribute("lang"), "ja", "dakuten keycap is lang='ja'");
  assert.strictEqual(labelOf("゜").getAttribute("lang"), "ja", "handakuten keycap is lang='ja'");

  // A layout-switch key is a control affordance, so its label stays in the UI language.
  assert.strictEqual(labelOf("{layout:ja-romaji}").getAttribute("lang"), null, "layout-switch key declares none");

  kb.destroy();
});

QUnit.test("switching to a UI-language layout clears the language from reused labels", async (assert) => {
  // Key ids are stable across layouts, so the semantic renderer patches the
  // existing label spans rather than replacing them. A left-behind lang=""
  // would read as "unknown language" and stop inheritance from <html lang>.
  const kb = new KioskKeyboard({ layout: "arabic" });
  await placeAndWait(kb);
  assert.strictEqual(
    getRequiredKeyElement(kb, "ض").querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!.getAttribute("lang"),
    "ar",
    "arabic keycap declares its language",
  );

  kb.setLayout("qwerty");
  await waitForRender();

  const labels = getKeyboardDom(kb).querySelectorAll(`.${DOM.classes.keyLabel}`);
  assert.ok(labels.length > 0, "labels rendered after the switch");
  assert.strictEqual(
    getKeyboardDom(kb).querySelectorAll(`.${DOM.classes.keyLabel}[lang]`).length,
    0,
    "no reused label kept a lang attribute",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Grid coordinate publication
// ──────────────────────────────────────────────

// Every key publishes its grid coordinate twice: in the element id, which
// arrow-key navigation parses to move, and in the two data attributes consumer
// CSS and tests select on. Either one disagreeing with the key's place in the
// DOM points at a key the user sees somewhere else, so both are checked, along
// with the `keyByPosition` selector consumers reach the attributes through.
QUnit.test("keys carry the grid coordinate they occupy", async (assert) => {
  for (const layout of KioskKeyboard.getRegisteredLayoutNames()) {
    const kb = new KioskKeyboard({ layout });
    await placeAndWait(kb);

    const rows = getRowElements(kb).map((row) => Array.from(row.querySelectorAll<HTMLElement>(DOM.selectors.key)));
    const published = rows.map((row) =>
      row.map((k) => `${k.getAttribute(DOM.attributes.rowIndex)},${k.getAttribute(DOM.attributes.keyIndex)}`),
    );
    const ids = rows.map((row) => row.map((k) => k.id.slice(kb.getId().length)));
    const renderedIds = rows.map((row) => row.map((k) => k.id));
    const selectedIds = rows.map((row, r) =>
      row.map((_, c) => getKeyboardDom(kb).querySelector<HTMLElement>(DOM.selectors.keyByPosition(r, c))?.id ?? null),
    );

    // Derived from the rendered shape, so each grid is asserted against where
    // its key actually sits rather than against itself.
    const occupied = rows.map((row, r) => row.map((_, c) => `${r},${c}`));
    const occupiedIds = rows.map((row, r) => row.map((_, c) => keyElementId("", r, c)));

    assert.ok(rows.length > 0, `"${layout}" renders rows`);
    assert.ok(rows.flat().length > 0, `"${layout}" renders keys`);
    assert.deepEqual(published, occupied, `"${layout}" attribute coordinates match DOM position`);
    assert.deepEqual(ids, occupiedIds, `"${layout}" key ids match DOM position`);
    assert.deepEqual(selectedIds, renderedIds, `"${layout}" keyByPosition selects the key rendered at that coordinate`);

    kb.destroy();
  }
});
