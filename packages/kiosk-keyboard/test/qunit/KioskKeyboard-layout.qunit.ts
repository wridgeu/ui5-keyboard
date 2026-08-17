import CustomLayout from "ui5/kiosk/CustomLayout";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import { KeyboardType, LayoutRole } from "ui5/kiosk/library";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Input from "sap/m/Input";
import Localization from "sap/base/i18n/Localization";
import LanguageTag from "sap/base/i18n/LanguageTag";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  createFakeKeyElement,
  getKeyElement,
  getKeyElements,
  getRenderedKeyLabel,
  getRenderedLayoutKeys,
  getRowElements,
  getRowKeyValues,
  hasKeyboardClass,
  isShiftActive,
  placeAndWait,
  simulateTap,
  tapKey,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard layout management", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Layout resolution
// ──────────────────────────────────────────────

QUnit.test("Default layout renders QWERTY", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "QWERTY has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "1", "First key in number row is 1");
  kb.destroy();
});

QUnit.test("KeyboardType 'Numpad' renders numpad keys", async (assert) => {
  // The first-key check is the real distinguisher: both layouts render exactly
  // 5 rows, so a row count alone cannot tell them apart. The strict-equal on
  // row count still catches a future regression that adds or drops a row from
  // the numpad layout definition.
  const kb = new KioskKeyboard();
  kb.setKeyboardType(KeyboardType.Numpad);
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "Numpad has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "7", "Numpad row 0 starts with 7 (distinguishes from QWERTY)");
  kb.destroy();
});

QUnit.test("KeyboardType 'Numpad' renders numpad layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType(KeyboardType.Numpad);
  await placeAndWait(kb);

  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "Has numpad CSS class");

  const keys = getKeyElements(kb);
  assert.ok(keys.length > 0, "Numpad keys rendered");

  const keyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.notOk(keyValues.includes("q"), "No alphabetic keys in numpad");
  assert.ok(keyValues.includes("7"), "Numpad has 7");
  assert.ok(keyValues.includes("0"), "Numpad has 0");

  kb.destroy();
});

QUnit.test("Layout property switches full keyboard layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("numeric");
  await placeAndWait(kb);

  const firstKey = getRowKeyValues(kb, 0)[0];
  assert.strictEqual(firstKey, "1", "Numeric layout starts with 1");
  const allValues = getRenderedLayoutKeys(kb).flat();
  assert.notOk(allValues.includes("q"), "Numeric layout has no alphabetic keys");

  kb.destroy();
});

QUnit.test("KeyboardType 'Numeric' has numeric CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType(KeyboardType.Numeric);
  await placeAndWait(kb);

  assert.ok(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "Has numeric CSS class");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "No numpad class");

  kb.destroy();
});

QUnit.test("KeyboardType 'Numeric' filters out the {layout:base} key from the rendered surface", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setKeyboardType(KeyboardType.Numeric);
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.notOk(keys.includes("{layout:base}"), "ABC key not rendered in Numeric mode");
  assert.ok(keys.includes("0"), "Numeric digit keys still rendered");

  kb.destroy();
});

QUnit.test("KeyboardType 'Numeric' filter applies to overridden numeric layout too", async (assert) => {
  const customNumeric: LayoutDefinition = [
    [{ value: "1" }, { value: "2" }, { value: "3" }],
    [
      { value: "{layout:base}", label: "ABC", type: "modifier" },
      { value: "{enter}", type: "action" },
    ],
  ];
  const kb = new KioskKeyboard({ customLayouts: [new CustomLayout({ name: "numeric", rows: customNumeric })] });
  kb.setKeyboardType(KeyboardType.Numeric);
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.notOk(keys.includes("{layout:base}"), "Custom numeric override has ABC filtered out too");
  assert.ok(keys.includes("{enter}"), "Other action keys preserved");

  kb.destroy();
});

QUnit.test(
  "KeyboardType 'Numeric': the symbols layout reached via '#+=' also hides the dead ABC key",
  async (assert) => {
    // Regression (user feedback): a user tap on "#+=" set _layoutSource="user"
    // and un-gated the strip, so the dead "ABC" ({layout:base}) reappeared next
    // to "123" ({layout:numeric}) in the symbols view. It must stay hidden.
    const kb = new KioskKeyboard();
    kb.setKeyboardType(KeyboardType.Numeric);
    await placeAndWait(kb);

    let keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.notOk(keys.includes("{layout:base}"), "ABC hidden on the numeric base surface");

    // Switch to the symbols layout the same way the user did in the report.
    tapKey(kb, "{layout:special}");
    await waitForRender();

    keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("["), "Symbols layout is rendered (has '[')");
    assert.ok(keys.includes("{layout:numeric}"), "Keeps the '123' key to return to numbers");
    assert.notOk(keys.includes("{layout:base}"), "Dead ABC key is not rendered in the numeric symbols layout");

    kb.destroy();
  },
);

QUnit.test(
  "KeyboardType 'Numeric': a mixed-case {layout:Base} dead key is stripped (case-insensitive)",
  async (assert) => {
    // parseKeyAction lowercases the layout target, so a consumer-authored
    // mixed-case `{layout:Base}` dead duplicate is recognized and stripped just
    // like the canonical lowercase form; it must not linger as a misleading
    // "ABC" key.
    const customSpecial: LayoutDefinition = [
      [{ value: "[" }, { value: "{layout:numeric}", label: "123" }, { value: "{layout:Base}", label: "ABC" }],
    ];
    const kb = new KioskKeyboard({ customLayouts: [new CustomLayout({ name: "special", rows: customSpecial })] });
    kb.setKeyboardType(KeyboardType.Numeric);
    await placeAndWait(kb);

    tapKey(kb, "{layout:special}");
    await waitForRender();

    const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("{layout:numeric}"), "the '123' key remains the real way back to numbers");
    assert.notOk(keys.includes("{layout:Base}"), "the mixed-case dead ABC key is stripped");
    assert.notOk(keys.includes("{layout:base}"), "no lowercase base key either");

    kb.destroy();
  },
);

QUnit.test("KeyboardType 'Full': the symbols layout keeps the ABC key (letters stay reachable)", async (assert) => {
  // Guard against over-stripping: on a full keyboard the base IS alphabetic, so
  // "ABC" ({layout:base}) correctly returns to letters and must remain.
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{layout:numeric}");
  await waitForRender();
  tapKey(kb, "{layout:special}");
  await waitForRender();

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("["), "Symbols layout is rendered on the full keyboard");
  assert.ok(keys.includes("{layout:base}"), "ABC key present so letters remain reachable");
  assert.strictEqual(
    getRenderedKeyLabel(kb, "{layout:base}"),
    "ABC",
    "Full keeps the 'ABC' text: base is alphabetic, so the key is not relabeled",
  );

  kb.destroy();
});

QUnit.test(
  "KeyboardType 'Numpad': a user-reached symbols layout keeps the return key (relabeled) to the numpad",
  async (assert) => {
    // The symbols "123" ({layout:numeric}) reaches numeric, not numpad, so under
    // Numpad {layout:base} is the only way back: kept but relabeled to a back
    // icon, since it returns to numbers, not the letters "ABC" implies.
    const customNumpad: LayoutDefinition = [
      [{ value: "7" }, { value: "8" }, { value: "9" }],
      [
        { value: "{layout:special}", label: "#+=", type: "modifier" },
        { value: "{enter}", type: "action" },
      ],
    ];
    const kb = new KioskKeyboard({ customLayouts: [new CustomLayout({ name: "numpad", rows: customNumpad })] });
    kb.setKeyboardType(KeyboardType.Numpad);
    await placeAndWait(kb);

    tapKey(kb, "{layout:special}");
    await waitForRender();

    let keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("["), "Symbols layout is rendered");
    assert.ok(keys.includes("{layout:base}"), "the return key stays: it is the only way back to the numpad");
    assert.strictEqual(
      getRenderedKeyLabel(kb, "{layout:base}"),
      "",
      "the kept return key drops the misleading 'ABC' text (rendered as a back icon)",
    );
    assert.strictEqual(
      getKeyElement(kb, "{layout:base}")!.getAttribute("aria-label"),
      "Return to numbers",
      "its accessible name says it returns to numbers, not letters",
    );
    assert.ok(
      getKeyElement(kb, "{layout:base}")!.querySelector(`.${DOM.classes.keyIcon}`),
      "the kept return key renders a back icon, not a blank key",
    );

    tapKey(kb, "{layout:base}");
    await waitForRender();

    keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("{layout:special}"), "the return key re-engaged the constraint: the numpad renders again");
    assert.notOk(keys.includes("["), "Symbols layout left");
    assert.strictEqual(getRowKeyValues(kb, 0).length, 3, "back on the numpad surface (row 0 is 7/8/9), not numeric");

    kb.destroy();
  },
);

QUnit.test(
  "KeyboardType 'Numeric': a layout without a '123' key keeps the return key (relabeled) as its only escape (nav)",
  async (assert) => {
    // The nav layout's only route out is {layout:base} (its other switch goes
    // deeper, to fkeys), so it is kept (stripping would strand the user) but
    // relabeled to a back icon, since it returns to numbers, not letters.
    const customNumeric: LayoutDefinition = [
      [{ value: "1" }, { value: "2" }, { value: "3" }],
      [
        { value: "{layout:nav}", label: "Nav", type: "modifier" },
        { value: "{enter}", type: "action" },
      ],
    ];
    const kb = new KioskKeyboard({ customLayouts: [new CustomLayout({ name: "numeric", rows: customNumeric })] });
    kb.setKeyboardType(KeyboardType.Numeric);
    await placeAndWait(kb);

    tapKey(kb, "{layout:nav}");
    await waitForRender();

    let keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("{layout:fkeys}"), "Nav layout is rendered");
    assert.ok(keys.includes("{layout:base}"), "the return key stays: it is the nav layout's only way back");
    assert.strictEqual(
      getRenderedKeyLabel(kb, "{layout:base}"),
      "",
      "the kept return key drops the misleading 'ABC' text (rendered as a back icon)",
    );
    assert.strictEqual(
      getKeyElement(kb, "{layout:base}")!.getAttribute("aria-label"),
      "Return to numbers",
      "its accessible name says it returns to numbers, not letters",
    );
    assert.ok(
      getKeyElement(kb, "{layout:base}")!.querySelector(`.${DOM.classes.keyIcon}`),
      "the kept return key renders a back icon, not a blank key",
    );

    tapKey(kb, "{layout:base}");
    await waitForRender();

    keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("{layout:nav}"), "ABC re-engaged the constraint: the numeric override renders again");

    kb.destroy();
  },
);

QUnit.test("Full keyboardType has no type-specific CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numpad")), "No numpad class on Full");
  assert.notOk(hasKeyboardClass(kb, DOM.keyboardTypeClass("Numeric")), "No numeric class on Full");

  kb.destroy();
});

QUnit.test("setLayout with unregistered name is ignored and keeps current layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const before = kb.getLayout();
  kb.setLayout("nonexistent-layout");

  assert.strictEqual(kb.getLayout(), before, "getLayout() still returns the previous layout");
  const firstKey = getRowKeyValues(kb, 0)[0];
  assert.strictEqual(firstKey, "1", "QWERTY layout still rendered (number row starts with 1)");
  assert.strictEqual(getRowElements(kb).length, 5, "QWERTY layout has 5 rows");

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("q"), "QWERTY keys rendered - unregistered name had no effect");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Layout switching
// ──────────────────────────────────────────────

QUnit.test("Layout switch fires layoutChange event", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const done = assert.async();
  kb.attachLayoutChange((event) => {
    assert.strictEqual(event.getParameter("layout"), "numeric", "Layout changed to numeric");
    done();
  });

  tapKey(kb, "{layout:numeric}");
  kb.destroy();
});

QUnit.test("Layout switch updates rendered keys", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Initially QWERTY - has alphabetic keys
  let keys = getKeyElements(kb);
  const initialKeyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.ok(initialKeyValues.includes("q"), "QWERTY has 'q' key");

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");

  // Wait for re-render
  await waitForRender();

  keys = getKeyElements(kb);
  const numericKeyValues = Array.from(keys).map((k) => k.dataset.key);
  assert.notOk(numericKeyValues.includes("q"), "Numeric layout has no 'q' key");

  kb.destroy();
});

QUnit.test(
  "User {layout:X} switch fires layoutChange even when keyboardType is Numpad (webc parity)",
  async (assert) => {
    // Issue #98: prior behavior gated the whole {layout:*} branch on
    // keyboardType === Full, silently ignoring layout-switch keys in
    // Numeric/Numpad mode. After aligning with webc, a user-initiated
    // switch takes precedence and the resolved layout follows the pick.
    const kb = new KioskKeyboard();
    kb.setKeyboardType(KeyboardType.Numpad);
    await placeAndWait(kb);

    const events: string[] = [];
    kb.attachEvent("layoutChange", (e: { getParameter(name: string): string }) => {
      events.push(e.getParameter("layout"));
    });

    const switchToNumeric = createFakeKeyElement("{layout:numeric}", "fake-numeric");
    simulateTap(kb, switchToNumeric);
    await waitForRender();

    assert.deepEqual(events, ["numeric"], "Switch fires layoutChange in Numpad mode");
    assert.strictEqual(kb.getLayout(), "numeric", "Layout property reflects user pick");
    assert.strictEqual(
      getRowKeyValues(kb, 0)[0],
      "1",
      "Resolved surface follows the user pick (numeric row 0 starts at '1')",
    );

    // Return to base: re-engages the keyboardType constraint, surface goes back to Numpad
    const backToBase = createFakeKeyElement("{layout:base}", "fake-base");
    simulateTap(kb, backToBase);
    await waitForRender();

    // Numpad row 0 starts at "7" (vs numeric row 0 at "1"); checks the
    // constraint actually re-engaged rather than landing on either numeric digit layout.
    assert.strictEqual(
      getRowKeyValues(kb, 0)[0],
      "7",
      "After {layout:base} the constraint re-engages and the rendered surface is the numpad",
    );

    kb.destroy();
  },
);

QUnit.test("Same-name {layout:X} switch repaints cleared shift state (no-op property write)", async (assert) => {
  // Regression: a {layout:X} key that resolves to the already-active layout
  // makes setProperty("layout", X) a no-op, so UI5 skips the re-render. The
  // shift/caps reset that accompanies every layout switch must still reach
  // the DOM, not leave stale shift-active styling behind.
  const selfLayout: LayoutDefinition = [[{ value: "{shift}" }, { value: "a" }, { value: "{layout:self}" }]];
  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "self", rows: selfLayout })],
    layout: "self",
  });
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  assert.ok(isShiftActive(kb), "shift is active after tapping {shift}");

  tapKey(kb, "{layout:self}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "self", "layout property is unchanged (self-referential switch)");
  assert.notOk(
    isShiftActive(kb),
    "the cleared shift state is reflected in the DOM even though the layout property did not change",
  );

  kb.destroy();
});

QUnit.test("No-op {layout:X} tap keeps the keyboardType constraint (source not flipped to user)", async (assert) => {
  // A {layout:X} key naming the already-active layout is a no-op property write;
  // it must not mark the layout user-driven, which would override the keyboardType
  // constraint on the next render with no layoutChange event.
  const kb = new KioskKeyboard({ keyboardType: KeyboardType.Numpad });
  await placeAndWait(kb);
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "7", "Numpad constraint forces the numpad surface (row 0 '7')");

  // Tap a layout key that names the already-active layout property value.
  simulateTap(kb, createFakeKeyElement(`{layout:${kb.getLayout()}}`, "fake-noop"));
  // The flip is latent (the no-op write schedules no render); force the next one.
  kb.invalidate();
  await waitForRender();

  assert.strictEqual(getRowKeyValues(kb, 0)[0], "7", "No-op tap leaves the numpad constraint engaged");
  kb.destroy();
});

QUnit.test("Programmatic setKeyboardType resets a user-driven layout switch", async (assert) => {
  // Companion to the symmetry test above: changing keyboardType (explicit
  // or auto-detect) must invalidate any prior user layout pick, so the new
  // constraint context isn't silently overridden by stale state.
  // Distinguish numpad from numeric by the first key (numpad row 0 starts at
  // "7", numeric at "1"). An `includes('1')` check would match both.
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  simulateTap(kb, createFakeKeyElement("{layout:numeric}", "fake-numeric"));
  await waitForRender();
  assert.strictEqual(kb.getLayout(), "numeric", "User switch lands");
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "1", "Numeric layout actually renders before the reset");

  kb.setKeyboardType(KeyboardType.Numpad);
  await waitForRender();

  assert.strictEqual(
    getRowKeyValues(kb, 0)[0],
    "7",
    "After setKeyboardType the resolved surface is numpad (user switch cleared); numpad row 0 starts at '7'",
  );

  kb.destroy();
});

QUnit.test("resetKeyboardType round-trip lets the next keyboardType re-engage its constraint", async (assert) => {
  // End-to-end guard for the user-override → reset → re-constrain flow. A user
  // {layout:numeric} tap sets _layoutSource="user"; both setKeyboardType and
  // resetKeyboardType route through _setKeyboardTypeSource, which restores
  // _layoutSource="external". _layoutSource is private (CLAUDE.md §4), and when
  // keyboardType is Full the resolved surface ignores it, so resetKeyboardType's
  // reset has no surface-visible effect on its own; this test verifies the
  // end-to-end result that a later keyboardType change is not shadowed by the
  // stale "user" override.
  const kb = new KioskKeyboard();
  kb.setKeyboardType(KeyboardType.Numpad);
  await placeAndWait(kb);

  simulateTap(kb, createFakeKeyElement("{layout:numeric}", "fake-numeric"));
  await waitForRender();
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "1", "User switch to numeric lands while type=Numpad");

  kb.resetKeyboardType();
  await waitForRender();
  // Type returns to Full; the `layout` property stays "numeric" (kiosk mutates
  // it on a user tap, unlike webc's separate _currentLayout), so the Full
  // surface is numeric here regardless of _layoutSource.
  assert.strictEqual(kb.getKeyboardType(), KeyboardType.Full, "Type reset to Full");

  // A subsequent keyboardType engages its constraint cleanly: the numpad surface
  // (row 0 starts at "7") is not shadowed by the earlier user override.
  kb.setKeyboardType(KeyboardType.Numpad);
  await waitForRender();
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "7", "Numpad constraint re-engages after the reset round-trip");

  kb.destroy();
});

QUnit.test(
  "KeyboardType 'Numpad': a mixed-case {layout:BASE} key re-engages the constraint (twin parity)",
  async (assert) => {
    // {layout:base} is the base-return token regardless of case, matching the
    // case-insensitive registry and the webc twin: {layout:BASE} must re-engage
    // the keyboardType constraint (source "external"), not read as a user layout
    // named "BASE".
    const customNumpad: LayoutDefinition = [
      [{ value: "7" }, { value: "8" }, { value: "9" }],
      [
        { value: "{layout:special}", label: "#+=", type: "modifier" },
        { value: "{enter}", type: "action" },
      ],
    ];
    const kb = new KioskKeyboard({ customLayouts: [new CustomLayout({ name: "numpad", rows: customNumpad })] });
    kb.setKeyboardType(KeyboardType.Numpad);
    await placeAndWait(kb);

    tapKey(kb, "{layout:special}");
    await waitForRender();
    assert.ok(
      Array.from(getKeyElements(kb)).some((k) => k.dataset.key === "["),
      "user switch reached the symbols layout",
    );

    simulateTap(kb, createFakeKeyElement("{layout:BASE}", "fake-base-upper"));
    await waitForRender();

    const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("7"), "mixed-case {layout:BASE} re-engaged the constraint: numpad renders");
    assert.notOk(keys.includes("["), "left the symbols layout");

    kb.destroy();
  },
);

QUnit.test("Programmatic setLayout fires layoutChange when the layout actually changes", async (assert) => {
  // The layoutChange JSDoc documents firing for programmatic setLayout() too,
  // not only {layout:*} keys.
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const events: string[] = [];
  kb.attachEvent("layoutChange", (e: { getParameter(name: string): string }) => {
    events.push(e.getParameter("layout"));
  });

  kb.setLayout("numeric");
  assert.deepEqual(events, ["numeric"], "layoutChange fired for the programmatic switch");

  kb.setLayout("numeric");
  kb.setLayout("not-registered");
  assert.deepEqual(events, ["numeric"], "No event for a same-layout or unregistered setLayout call");

  kb.destroy();
});

QUnit.test("Layout switch does not fire layoutChange for invalid or unchanged layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const initialLayout = kb.getLayout();
  let changeCount = 0;
  kb.attachEvent("layoutChange", () => {
    changeCount++;
  });

  const invalidLayoutEl = createFakeKeyElement("{layout:not-registered}", "fake-layout-invalid");
  simulateTap(kb, invalidLayoutEl);

  const sameLayoutEl = createFakeKeyElement(`{layout:${initialLayout}}`, "fake-layout-same");
  simulateTap(kb, sameLayoutEl);

  assert.strictEqual(changeCount, 0, "No layoutChange event for invalid or unchanged layout");
  assert.strictEqual(kb.getLayout(), initialLayout, "Layout remains unchanged");

  kb.destroy();
});

// ──────────────────────────────────────────────
// German QWERTZ layout
// ──────────────────────────────────────────────

QUnit.test("QWERTZ-DE layout resolves correctly", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "QWERTZ-DE has 5 rows");

  const row2Values = getRowKeyValues(kb, 1);
  assert.ok(row2Values.includes("z"), "Row 2 contains 'z' (QWERTZ arrangement)");
  assert.notOk(row2Values.includes("y"), "Row 2 does not contain 'y'");

  assert.ok(row2Values.includes("\u00FC"), "Row 2 contains \u00FC");
  const row3Values = getRowKeyValues(kb, 2);
  assert.ok(row3Values.includes("\u00F6"), "Row 3 contains \u00F6");
  assert.ok(row3Values.includes("\u00E4"), "Row 3 contains \u00E4");

  const row4Values = getRowKeyValues(kb, 3);
  assert.ok(row4Values.includes("\u00DF"), "Row 4 contains \u00DF");

  kb.destroy();
});

QUnit.test("QWERTZ-DE renders correctly", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("z"), "Has z key");
  assert.ok(keys.includes("\u00FC"), "Has \u00FC key");
  assert.ok(keys.includes("\u00F6"), "Has \u00F6 key");
  assert.ok(keys.includes("\u00E4"), "Has \u00E4 key");
  assert.ok(keys.includes("\u00DF"), "Has \u00DF key");
  assert.notOk(keys.includes("y") && keys.indexOf("y") < keys.indexOf("z"), "Y not before Z (QWERTZ)");

  kb.destroy();
});

QUnit.test("QWERTZ-DE German number row shift symbols", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  kb.setControls([input.getId()]);
  await nextUIUpdate();

  // Shift+2 should produce " (double quote) in German layout
  tapKey(kb, "{shift}");

  const done = assert.async();
  kb.attachKeyPress((event) => {
    assert.strictEqual(event.getParameter("key"), '"', 'Shift+2 produces " in German layout');
    done();
  });

  tapKey(kb, "2");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Base layout tracking ({layout:base})
// ──────────────────────────────────────────────

QUnit.test("Switching to numeric and back returns to base layout", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "numeric", "Layout is now numeric");

  // Switch back via ABC (which uses {layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Layout returned to qwertz-de (not qwerty)");

  // Verify QWERTZ keys are present
  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("z"), "QWERTZ z key is back");
  assert.ok(keys.includes("\u00FC"), "\u00FC is back");

  kb.destroy();
});

QUnit.test("Base layout defaults to qwerty", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Switch back via ABC ({layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwerty", "Default base layout is qwerty");

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.ok(keys.includes("q"), "QWERTY q key is present");

  kb.destroy();
});

QUnit.test("getBaseLayout tracks last non-secondary layout", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(kb.getBaseLayout(), "qwerty", "Initial base layout is qwerty");

  kb.setLayout("qwertz-de");
  assert.strictEqual(kb.getBaseLayout(), "qwertz-de", "Base updates on non-secondary layout");

  kb.setLayout("numeric");
  assert.strictEqual(kb.getBaseLayout(), "qwertz-de", "Base is preserved when switching to secondary layout");

  kb.destroy();
});

QUnit.test("resetLayout returns from secondary layout to base", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  kb.setLayout("numeric");
  assert.strictEqual(kb.getLayout(), "numeric", "Secondary layout is active before reset");

  kb.resetLayout();
  assert.strictEqual(kb.getLayout(), "qwertz-de", "resetLayout restores the tracked base layout");

  kb.destroy();
});

QUnit.test("Base layout roundtrip: qwertz-de -> numeric -> special -> base", async (assert) => {
  const kb = new KioskKeyboard();
  kb.setLayout("qwertz-de");
  await placeAndWait(kb);

  // Go to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  // Go to special from numeric
  tapKey(kb, "{layout:special}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "special", "Now on special layout");

  // Go back via ABC ({layout:base})
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "qwertz-de", "Returned to qwertz-de after special");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Per-instance layout overrides
// ──────────────────────────────────────────────

QUnit.test("a customLayouts entry is usable by name", async (assert) => {
  const customLayout: LayoutDefinition = [[{ value: "x" }, { value: "y" }, { value: "z" }]];
  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "test-custom", rows: customLayout })],
    layout: "test-custom",
  });
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.deepEqual(keys, ["x", "y", "z"], "Custom layout keys rendered");

  kb.destroy();
});

QUnit.test("Custom layout works as base layout for {layout:base} roundtrip", async (assert) => {
  const customLayout: LayoutDefinition = [
    [
      { value: "m" },
      { value: "n" },
      {
        value: "{layout:numeric}",
        label: "123",
        type: "modifier",
      },
    ],
  ];

  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "test-roundtrip", rows: customLayout })],
    layout: "test-roundtrip",
  });
  await placeAndWait(kb);

  // Switch to numeric
  tapKey(kb, "{layout:numeric}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "numeric", "On numeric now");

  // Switch back via {layout:base}
  tapKey(kb, "{layout:base}");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "test-roundtrip", "Returned to custom layout");

  kb.destroy();
});

QUnit.test("customLayouts shadow built-in layouts for the controlling instance", async (assert) => {
  const custom: LayoutDefinition = [[{ value: "CUSTOM" }]];

  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "qwerty", rows: custom })],
    layout: "qwerty",
  });
  await placeAndWait(kb);

  const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
  assert.deepEqual(keys, ["CUSTOM"], "Built-in qwerty shadowed by instance override");

  kb.destroy();
});

QUnit.test("customLayouts accept formerly forbidden layout names (Map-safe)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x" }]];
  for (const name of ["__proto__", "prototype", "constructor"]) {
    const kb = new KioskKeyboard({ customLayouts: [new CustomLayout({ name, rows: layout })], layout: name });
    await placeAndWait(kb);

    const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.deepEqual(keys, ["x"], `Name "${name}" is accepted on a custom layout`);

    kb.destroy();
  }
});

// ──────────────────────────────────────────────
// Locale-based default layout
// ──────────────────────────────────────────────

QUnit.test("getLocaleLayout returns qwertz-de for German locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "German locale maps to qwertz-de");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout returns qwerty for English locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("en");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "English locale maps to qwerty");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout resolves ja to ja-romaji", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("ja");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "ja-romaji", "Japanese resolves to ja-romaji");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout resolves ar to arabic", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("ar");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "arabic", "Arabic resolves to arabic");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout falls back to qwerty for unmapped locale", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("zh");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwerty", "Chinese (unmapped) falls back to qwerty");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("a custom layout's locales extend the locale map for the controlling instance", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("xx");
    const kb = new KioskKeyboard({
      customLayouts: [new CustomLayout({ name: "test-locale-layout", rows: [[{ value: "x" }]], locales: ["xx"] })],
    });
    await placeAndWait(kb);

    assert.strictEqual(kb.getLayout(), "test-locale-layout", "Custom locale maps to custom layout via instance map");

    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

/**
 * A tag carrying a language no BCP-47 string can spell, so the parsing constructor
 * cannot produce it and its frozen instances cannot be edited into it. Locale
 * resolution reads `language` and `region`.
 */
function forbiddenLanguageTag(language: string): LanguageTag {
  const tag: LanguageTag = Object.create(LanguageTag.prototype);
  tag.language = language;
  tag.region = "";
  return tag;
}

QUnit.test("a custom layout's locales accept formerly forbidden prefixes (Map-safe)", async (assert) => {
  const originalGetLanguageTag = Localization.getLanguageTag;

  try {
    for (const locale of ["__proto__", "prototype", "constructor"]) {
      Localization.getLanguageTag = () => forbiddenLanguageTag(locale);

      const kb = new KioskKeyboard({
        customLayouts: [new CustomLayout({ name: "qwertz-de", locales: [locale] })],
      });
      await placeAndWait(kb);

      assert.strictEqual(kb.getLayout(), "qwertz-de", `Locale key "${locale}" resolves correctly`);
      kb.destroy();
    }
  } finally {
    Localization.getLanguageTag = originalGetLanguageTag;
  }
});

QUnit.test("Unknown locale mapping falls back to default layout", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("zz");
    const kb = new KioskKeyboard({
      customLayouts: [new CustomLayout({ name: "layout-does-not-exist", locales: ["zz"] })],
    });
    await placeAndWait(kb);

    assert.strictEqual(kb.getLayout(), "qwerty", "Unknown layout mapping falls back to default layout");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Unknown exact locale mapping falls back to valid language prefix", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de-CH");
    const kb = new KioskKeyboard({
      customLayouts: [new CustomLayout({ name: "layout-does-not-exist", locales: ["de-ch"] })],
    });
    await placeAndWait(kb);

    assert.strictEqual(
      kb.getLayout(),
      "qwertz-de",
      "Invalid exact de-ch mapping falls back to valid de prefix mapping",
    );
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

// ──────────────────────────────────────────────
// ja-kana layout
// ──────────────────────────────────────────────

QUnit.test("ja-kana layout renders 5 rows with correct key counts", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "ja-kana has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0).length, 12, "Row 1 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 1).length, 12, "Row 2 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 2).length, 12, "Row 3 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 3).length, 12, "Row 4 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 4).length, 7, "Row 5 has 7 keys");
  kb.destroy();
});

QUnit.test("ja-kana first key is ぬ (hiragana nu)", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "\u306C", "First key is ぬ");
  kb.destroy();
});

QUnit.test("ja-kana has dakuten and handakuten on base layer", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const allKeys = getRowKeyValues(kb, 1);
  assert.ok(allKeys.includes("\u309B"), "Row 2 contains dakuten ゛");
  assert.ok(allKeys.includes("\u309C"), "Row 2 contains handakuten ゜");
  kb.destroy();
});

QUnit.test("ja-kana has layout toggle to ja-romaji", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const row5Keys = getRowKeyValues(kb, 4);
  assert.ok(row5Keys.includes("{layout:ja-romaji}"), "Row 5 contains ja-romaji toggle");
  kb.destroy();
});

QUnit.test("ja-kana: all base values are hiragana, special keys, or punctuation", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const hiraganaRange = /^[\u3040-\u309F]$/;
  const specialKeys = new Set(["{backspace}", "{enter}", "{shift}", " "]);
  const punctuation = new Set(["\u309B", "\u309C", "\u30FC", "\u3002"]);
  const layoutKeys = new Set(["{layout:numeric}", "{layout:ja-romaji}", "{layout:fkeys}"]);

  for (let r = 0; r < 5; r++) {
    for (const val of getRowKeyValues(kb, r)) {
      const isValid = hiraganaRange.test(val) || specialKeys.has(val) || punctuation.has(val) || layoutKeys.has(val);
      assert.ok(isValid, `key "${val}" (U+${val.codePointAt(0)?.toString(16)}) is valid`);
    }
  }
  kb.destroy();
});

QUnit.test("ja-kana: small kana shift variants on correct keys", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  // Verify shift variants via data-shift-value attribute (renderer stores them on the DOM)
  const allKeys = Array.from(getKeyElements(kb));
  const expectedShifts = {
    "\u3042": "\u3041", // あ → ぁ
    "\u3046": "\u3045", // う → ぅ
    "\u3048": "\u3047", // え → ぇ
    "\u304A": "\u3049", // お → ぉ
    "\u3084": "\u3083", // や → ゃ
    "\u3086": "\u3085", // ゆ → ゅ
    "\u3088": "\u3087", // よ → ょ
    "\u308F": "\u3092", // わ → を
    "\u3044": "\u3043", // い → ぃ
    "\u3064": "\u3063", // つ → っ
    "\u307B": "\u3078", // ほ → へ
  } satisfies Record<string, string>;

  for (const [base, expectedSmall] of Object.entries(expectedShifts)) {
    const keyEl = allKeys.find((el) => el.dataset.key === base);
    assert.ok(keyEl, `key for ${base} exists`);
    assert.strictEqual(
      keyEl?.getAttribute(DOM.attributes.shiftValue),
      expectedSmall,
      `shift of ${base} should be ${expectedSmall}`,
    );
  }

  kb.destroy();
});

QUnit.test("ja-kana: row 4 punctuation shift variants", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  // Verify JIS punctuation shift variants via data-shift-value on row 4 keys
  const allKeys = Array.from(getKeyElements(kb));
  const ne = allKeys.find((el) => el.dataset.key === "\u306D"); // ね
  const ru = allKeys.find((el) => el.dataset.key === "\u308B"); // る
  const me = allKeys.find((el) => el.dataset.key === "\u3081"); // め

  assert.strictEqual(ne?.getAttribute(DOM.attributes.shiftValue), "\u3001", "ね shift is 、 (ideographic comma)");
  assert.strictEqual(ru?.getAttribute(DOM.attributes.shiftValue), "\u3002", "る shift is 。 (ideographic period)");
  assert.strictEqual(me?.getAttribute(DOM.attributes.shiftValue), "\u30FB", "め shift is ・ (middle dot)");

  kb.destroy();
});

QUnit.test("ja-kana: backspace, enter, shift, space have correct types", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);

  const allKeys = Array.from(getKeyElements(kb));
  const backspace = allKeys.find((el) => el.dataset.key === "{backspace}");
  const enter = allKeys.find((el) => el.dataset.key === "{enter}");
  const shift = allKeys.find((el) => el.dataset.key === "{shift}");
  const space = allKeys.find((el) => el.dataset.key === " ");

  assert.ok(backspace?.classList.contains(DOM.classes.keyAction), "Backspace has action type");
  assert.ok(enter?.classList.contains(DOM.classes.keyAction), "Enter has action type");
  assert.ok(shift?.classList.contains(DOM.classes.keyModifier), "Shift has modifier type");
  assert.strictEqual(space?.getAttribute(DOM.attributes.keySpan), "space", "Space has the space width span");
  assert.strictEqual(
    backspace?.getAttribute(DOM.attributes.keySpan),
    "1.5",
    "Backspace width span is carried verbatim",
  );

  kb.destroy();
});

QUnit.test("applySettings injects locale layout when no explicit layout", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    const kb = new KioskKeyboard();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Locale layout injected automatically");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Explicit layout overrides locale detection", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    const kb = new KioskKeyboard({ layout: "qwerty" });
    assert.strictEqual(kb.getLayout(), "qwerty", "Explicit layout takes priority over locale");
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("getLocaleLayout matches language prefix for regional variant", (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    // de-AT has no exact entry, should fall through to "de" → "qwertz-de"
    Localization.setLanguage("de-AT");
    assert.strictEqual(KioskKeyboard.getLocaleLayout(), "qwertz-de", "de-AT falls back to de prefix");
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("a custom layout's exact region locale takes priority over prefix", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de-AT");
    const kbAt = new KioskKeyboard({
      customLayouts: [new CustomLayout({ name: "test-de-at", rows: [[{ value: "a" }]], locales: ["de-at"] })],
    });
    await placeAndWait(kbAt);
    assert.strictEqual(kbAt.getLayout(), "test-de-at", "Exact de-at match wins over de prefix");
    kbAt.destroy();

    // de (no region) still uses the built-in prefix match
    Localization.setLanguage("de");
    const kbDe = new KioskKeyboard();
    await placeAndWait(kbDe);
    assert.strictEqual(kbDe.getLayout(), "qwertz-de", "de without region still maps to qwertz-de");
    kbDe.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Locale layout used as base layout for {layout:base} roundtrip", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");

    const kb = new KioskKeyboard();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Starts with locale layout");
    await placeAndWait(kb);

    // Switch to numeric
    tapKey(kb, "{layout:numeric}");
    await waitForRender();
    assert.strictEqual(kb.getLayout(), "numeric", "Switched to numeric");

    // Switch back via {layout:base}
    tapKey(kb, "{layout:base}");
    await waitForRender();
    assert.strictEqual(kb.getLayout(), "qwertz-de", "Returned to locale-detected qwertz-de");

    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

QUnit.test("Locale layout renders correct keys", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");

    const kb = new KioskKeyboard();
    await placeAndWait(kb);

    const keys = Array.from(getKeyElements(kb)).map((k) => k.dataset.key);
    assert.ok(keys.includes("z"), "German locale keyboard has z key (QWERTZ)");
    assert.ok(keys.includes("\u00FC"), "German locale keyboard has \u00FC key");

    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

// ──────────────────────────────────────────────
// customLayouts validation
// ──────────────────────────────────────────────

QUnit.test("customLayouts filters invalid rows and falls back to default", async (assert) => {
  const cases: Array<[string, unknown]> = [
    ["empty-array", []],
    ["empty-row", [[]]],
    ["missing-value", [[{ label: "x" }]]],
    ["non-string-value", [[{ value: 123 }]]],
  ];

  for (const [name, def] of cases) {
    const kb = new KioskKeyboard({
      customLayouts: [new CustomLayout({ name, rows: def as LayoutDefinition })],
      layout: name,
    });
    await placeAndWait(kb);
    assert.strictEqual(kb.getLayout(), "qwerty", `Invalid "${name}" entry rejected, falls back to qwerty`);
    kb.destroy();
  }
});

QUnit.test("a nameless custom layout is dropped whole, leaving the built-in locale mapping intact", async (assert) => {
  const currentLang = Localization.getLanguage();
  try {
    Localization.setLanguage("de");
    // Nothing resolves a custom layout with no name, so its locale claim never reaches
    // the map and `de` still resolves through the built-in mapping.
    const kb = new KioskKeyboard({
      customLayouts: [new CustomLayout({ locales: ["de"] })],
    });
    await placeAndWait(kb);
    assert.strictEqual(
      kb.getLayout(),
      "qwertz-de",
      "Built-in locale mapping remains intact when the custom layout is dropped",
    );
    kb.destroy();
  } finally {
    Localization.setLanguage(currentLang);
  }
});

// ──────────────────────────────────────────────
// ko-hangul layout
// ──────────────────────────────────────────────

QUnit.test("ko-hangul layout renders 5 rows with correct key counts", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "ko-hangul has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0).length, 11, "Row 1 has 11 keys (digits + backspace)");
  assert.strictEqual(getRowKeyValues(kb, 1).length, 10, "Row 2 has 10 keys (Q-P jamo)");
  assert.strictEqual(getRowKeyValues(kb, 2).length, 9, "Row 3 has 9 keys (A-L jamo)");
  assert.strictEqual(getRowKeyValues(kb, 3).length, 11, "Row 4 has 11 keys (shift + Z-M + , . + enter)");
  assert.strictEqual(getRowKeyValues(kb, 4).length, 5, "Row 5 has 5 keys");
  kb.destroy();
});

QUnit.test("ko-hangul home row contains standard Dubeolsik jamo", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const homeRow = getRowKeyValues(kb, 2);
  const expected = ["\u3141", "\u3134", "\u3147", "\u3139", "\u314E", "\u3157", "\u3153", "\u314F", "\u3163"];
  assert.deepEqual(homeRow, expected, "Home row matches A-L Dubeolsik positions");
  kb.destroy();
});

QUnit.test("ko-hangul has ABC toggle to qwerty", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const row5Keys = getRowKeyValues(kb, 4);
  assert.ok(row5Keys.includes("{layout:qwerty}"), "Row 5 contains qwerty toggle (ABC)");
  kb.destroy();
});

QUnit.test("ko-hangul has standard slash with ?-on-shift", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const row5 = getRowKeyValues(kb, 4);
  assert.ok(row5.includes("/"), "Row 5 contains / key");
  kb.destroy();
});

QUnit.test("ko-hangul: backspace, enter, shift, space have correct types", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ko-hangul" });
  await placeAndWait(kb);
  const root = kb.getDomRef()!;
  assert.ok(
    root.querySelector('[data-key="{backspace}"]')!.classList.contains(DOM.classes.keyAction),
    "Backspace is action",
  );
  assert.ok(root.querySelector('[data-key="{enter}"]')!.classList.contains(DOM.classes.keyAction), "Enter is action");
  assert.ok(
    root.querySelector('[data-key="{shift}"]')!.classList.contains(DOM.classes.keyModifier),
    "Shift is modifier",
  );
  assert.strictEqual(
    root.querySelector('[data-key=" "]')!.getAttribute(DOM.attributes.keySpan),
    "space",
    "Space is space",
  );
  kb.destroy();
});

// ──────────────────────────────────────────────
// qwerty-es layout
// ──────────────────────────────────────────────

QUnit.test("qwerty-es layout renders 5 rows with correct key counts", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-es" });
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "qwerty-es has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0).length, 11, "Row 1 has 11 keys (digits + backspace)");
  assert.strictEqual(getRowKeyValues(kb, 1).length, 10, "Row 2 has 10 keys (Q-P)");
  assert.strictEqual(getRowKeyValues(kb, 2).length, 10, "Row 3 has 10 keys (A-L + ñ)");
  assert.strictEqual(getRowKeyValues(kb, 3).length, 9, "Row 4 has 9 keys (shift + Z-M + enter)");
  assert.strictEqual(getRowKeyValues(kb, 4).length, 6, "Row 5 has 6 keys");
  kb.destroy();
});

QUnit.test("qwerty-es has dedicated ñ on home row", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-es" });
  await placeAndWait(kb);
  const homeRow = getRowKeyValues(kb, 2);
  assert.ok(homeRow.includes("\u00F1"), "Home row contains ñ");
  assert.strictEqual(homeRow[homeRow.length - 1], "\u00F1", "ñ is the last key in home row");
  kb.destroy();
});

QUnit.test("qwerty-es has inverted punctuation ¿ with ¡ on shift", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-es" });
  await placeAndWait(kb);
  const root = kb.getDomRef()!;
  const invQuestion = root.querySelector('[data-key="\u00BF"]');
  assert.ok(invQuestion, "¿ key exists");
  assert.strictEqual(invQuestion!.getAttribute("data-shift-value"), "\u00A1", "Shift of ¿ is ¡");
  kb.destroy();
});

QUnit.test("qwerty-es: backspace, enter, shift, space have correct types", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty-es" });
  await placeAndWait(kb);
  const root = kb.getDomRef()!;
  assert.ok(
    root.querySelector('[data-key="{backspace}"]')!.classList.contains(DOM.classes.keyAction),
    "Backspace is action",
  );
  assert.ok(root.querySelector('[data-key="{enter}"]')!.classList.contains(DOM.classes.keyAction), "Enter is action");
  assert.ok(
    root.querySelector('[data-key="{shift}"]')!.classList.contains(DOM.classes.keyModifier),
    "Shift is modifier",
  );
  assert.strictEqual(
    root.querySelector('[data-key=" "]')!.getAttribute(DOM.attributes.keySpan),
    "space",
    "Space is space",
  );
  kb.destroy();
});

QUnit.test("Numeric layout keys identical regardless of base layout (qwerty vs qwertz-de)", async (assert) => {
  const kbQwerty = new KioskKeyboard({ layout: "qwerty", keyboardType: KeyboardType.Numeric });
  const kbQwertz = new KioskKeyboard({ layout: "qwertz-de", keyboardType: KeyboardType.Numeric });
  await placeAndWait(kbQwerty);
  kbQwertz.placeAt("qunit-fixture");
  await waitForRender();

  const keysQwerty = Array.from(getKeyElements(kbQwerty)).map((el) => el.dataset.key);
  const keysQwertz = Array.from(getKeyElements(kbQwertz)).map((el) => el.dataset.key);

  assert.deepEqual(keysQwerty, keysQwertz, "Same key values in same order");

  kbQwerty.destroy();
  kbQwertz.destroy();
});

// ──────────────────────────────────────────────
// Composition middleware lifecycle across layout switches
// ──────────────────────────────────────────────

QUnit.test("setLayout with a non-normalized name keeps composition middleware active", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true });
  await placeAndWait(kb);

  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.focus();
  await nextUIUpdate();

  // Trailing space + mixed case: renders fine via the normalizing layout
  // registry, but must not silently disable the hangul composition middleware.
  kb.setLayout("Ko-Hangul ");
  await waitForRender();

  tapKey(kb, "ㅎ");
  tapKey(kb, "ㅏ");
  assert.strictEqual(dom.value, "하", "Jamo taps compose a syllable despite the non-normalized layout name");

  input.destroy();
  kb.destroy();
});

QUnit.test("Programmatic setLayout commits in-progress composition (no leak across layout switch)", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");

  const kb = new KioskKeyboard({ docked: true, autoShow: true, layout: "ko-hangul" });
  await placeAndWait(kb);

  const dom = input.getFocusDomRef() as HTMLInputElement;
  dom.focus();
  await nextUIUpdate();

  // Compose a partial syllable: ㅎ + ㅏ → 하 (still composing)
  tapKey(kb, "ㅎ");
  tapKey(kb, "ㅏ");
  assert.strictEqual(dom.value, "하", "Composing 하 in ko-hangul");

  // A programmatic layout switch must commit the preedit and drop the middleware.
  kb.setLayout("qwerty");
  await waitForRender();
  assert.strictEqual(dom.value, "하", "하 is committed to the input on programmatic setLayout");

  // Returning to ko-hangul, the next jamo starts a FRESH syllable - the old
  // composition state must not leak (the bug combined it into 한).
  kb.setLayout("ko-hangul");
  await waitForRender();
  tapKey(kb, "ㄴ");
  assert.strictEqual(dom.value, "하ᄂ", "Fresh composition after switch: 하 then leading ㄴ, not 한");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// Consumer-declared layout attributes (CustomLayout facets)
// ──────────────────────────────────────────────

/** An auxiliary surface a consumer registers, reachable only through customLayouts. */
const SYMBOL_SURFACE: LayoutDefinition = [
  [{ value: "\u00A7" }, { value: "\u00B6" }, { value: "{layout:base}", label: "ABC", type: "modifier" }],
];

QUnit.test("a custom layout marked secondary is never tracked as the base", async (assert) => {
  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "my-symbols", rows: SYMBOL_SURFACE, layoutRole: LayoutRole.Secondary })],
    layout: "qwertz-de",
  });
  await placeAndWait(kb);
  assert.strictEqual(kb.getBaseLayout(), "qwertz-de", "the alphabetic layout is the base to start with");

  kb.setLayout("my-symbols");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "my-symbols", "the auxiliary surface is active");
  assert.strictEqual(kb.getBaseLayout(), "qwertz-de", "it does not displace the base layout");

  tapKey(kb, "{layout:base}");
  await waitForRender();
  assert.strictEqual(kb.getLayout(), "qwertz-de", "{layout:base} returns to the alphabetic layout");

  kb.destroy();
});

QUnit.test("without a declared role the same layout does become the base", async (assert) => {
  // The negative control for the test above: bare rows declare no attributes, so
  // the surface is read as an alphabetic layout and strands {layout:base} on itself.
  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "my-symbols", rows: SYMBOL_SURFACE })],
    layout: "qwertz-de",
  });
  await placeAndWait(kb);

  kb.setLayout("my-symbols");
  await waitForRender();
  assert.strictEqual(kb.getBaseLayout(), "my-symbols", "an undeclared layout is tracked as the base");

  kb.resetLayout();
  assert.strictEqual(kb.getLayout(), "my-symbols", "so there is no way back to the alphabetic layout");

  kb.destroy();
});

QUnit.test("a custom layout shadowing a built-in keeps the attributes it does not declare", async (assert) => {
  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "numeric", rows: SYMBOL_SURFACE })],
    layout: "qwertz-de",
  });
  await placeAndWait(kb);

  kb.setLayout("numeric");
  await waitForRender();

  assert.strictEqual(kb.getLayout(), "numeric", "the shadowed name is active");
  assert.strictEqual(kb.getBaseLayout(), "qwertz-de", "the built-in secondary flag still applies");

  kb.destroy();
});

QUnit.test("a custom layout shadowing a built-in can un-mark its secondary role", async (assert) => {
  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "numeric", rows: SYMBOL_SURFACE, layoutRole: LayoutRole.Base })],
    layout: "qwertz-de",
  });
  await placeAndWait(kb);

  kb.setLayout("numeric");
  await waitForRender();

  assert.strictEqual(kb.getBaseLayout(), "numeric", "a declared Base role overrides the built-in secondary flag");

  kb.destroy();
});
