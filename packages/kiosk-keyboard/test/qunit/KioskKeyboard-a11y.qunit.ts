import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import InvisibleText from "sap/ui/core/InvisibleText";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";
import {
  announcedText,
  destroyKeyboards,
  freezeDoubleClickWindow,
  getKeyElement,
  getKeyElements,
  getRequiredKeyElement,
  getKeyAttr,
  hasKeyClass,
  placeAndWait,
  resetAnnouncements,
  tapKey,
  waitForAnnouncement,
  waitForRender,
} from "./test-helpers";

const DOM = KioskKeyboard.DOM;

// ──────────────────────────────────────────────
// Module
// ──────────────────────────────────────────────

QUnit.module("KioskKeyboard accessibility", {
  afterEach() {
    destroyKeyboards();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

// ──────────────────────────────────────────────
// Key roles and ARIA
// ──────────────────────────────────────────────

QUnit.test("Each key has role=button and either visible label or aria-label", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const keys = getKeyElements(kb);
  keys.forEach((key) => {
    assert.strictEqual(key.getAttribute("role"), "button", `Key ${key.dataset.key} has role=button`);
    const visibleLabel = key.querySelector(`.${DOM.classes.keyLabel}`)?.textContent;
    const ariaLabel = key.getAttribute("aria-label");
    assert.ok(
      (visibleLabel && visibleLabel.length > 0) || (ariaLabel && ariaLabel.length > 0),
      `Key ${key.dataset.key} has visible label or aria-label`,
    );
  });

  kb.destroy();
});

QUnit.test("Shift key has aria-pressed", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.ok(shiftKey, "Shift key exists");
  assert.strictEqual(shiftKey!.getAttribute("aria-pressed"), "false", "Initially aria-pressed=false");

  tapKey(kb, "{shift}");
  await waitForRender();

  const updatedShift = getKeyElement(kb, "{shift}");
  assert.strictEqual(updatedShift!.getAttribute("aria-pressed"), "true", "After shift: aria-pressed=true");

  kb.destroy();
});

QUnit.test("getAccessibilityInfo returns correct data", (assert) => {
  const kb = new KioskKeyboard();
  const info = kb.getAccessibilityInfo();

  assert.strictEqual(info.role, "group", "Role is group");
  assert.strictEqual(info.type, "Virtual Keyboard", "Type is Virtual Keyboard (from i18n)");
  assert.strictEqual(info.description, "Virtual Keyboard", "Description resolves from i18n when ariaLabel is empty");
  assert.strictEqual(info.focusable, true, "Is focusable");
  assert.strictEqual(info.enabled, true, "Is enabled");

  kb.destroy();
});

// ──────────────────────────────────────────────
// Modifier / Action / Width styling
// ──────────────────────────────────────────────

QUnit.test("Modifier keys have modifier CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.ok(shiftKey, "Shift key found");
  assert.ok(hasKeyClass(kb, "{shift}", DOM.classes.keyModifier), "Shift has modifier class");

  const layoutKey = getKeyElement(kb, "{layout:numeric}");
  assert.ok(layoutKey, "Layout switch key found");
  assert.ok(hasKeyClass(kb, "{layout:numeric}", DOM.classes.keyModifier), "Layout switch has modifier class");

  kb.destroy();
});

QUnit.test("Action keys have action CSS class", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const enterKey = getKeyElement(kb, "{enter}");
  assert.ok(enterKey, "Enter key found");
  assert.ok(hasKeyClass(kb, "{enter}", DOM.classes.keyAction), "Enter has action class");

  const backspaceKey = getKeyElement(kb, "{backspace}");
  assert.ok(backspaceKey, "Backspace key found");
  assert.ok(hasKeyClass(kb, "{backspace}", DOM.classes.keyAction), "Backspace has action class");

  kb.destroy();
});

QUnit.test("Space key has the space width span", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const spaceKey = getKeyElement(kb, " ");
  assert.ok(spaceKey, "Space key found");
  assert.strictEqual(getKeyAttr(kb, " ", DOM.attributes.keySpan), "space", "Space has the space width span");

  kb.destroy();
});

// ──────────────────────────────────────────────
// ARIA live region
// ──────────────────────────────────────────────

QUnit.test("Live region announces Shift state", async (assert) => {
  // Cleared before the keyboard exists, so first paint is inside what is asserted on.
  resetAnnouncements();
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.strictEqual(announcedText(), "", "Empty when shift is off");

  const clock = freezeDoubleClickWindow();
  try {
    // Activate shift
    tapKey(kb, "{shift}");
    await waitForRender();

    assert.strictEqual(announcedText(), "Shift on", "Announces Shift on");

    // Activate caps lock. The double-tap lands close behind the tap that turned Shift
    // on, so its announcement waits for the queue's gap.
    tapKey(kb, "{shift}");
    await waitForRender();
    await waitForAnnouncement();

    assert.strictEqual(announcedText(), "Caps Lock on", "Announces Caps Lock on");

    // Deactivate
    tapKey(kb, "{shift}");
    await waitForRender();
    await waitForAnnouncement();

    assert.strictEqual(announcedText(), "Caps Lock off", "Announces Caps Lock off");
  } finally {
    clock.restore();
  }

  kb.destroy();
});

QUnit.test("Live region reports Caps Lock ending even when Shift takes over", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  const shiftState = kb["_shiftState"];

  // "Caps Lock off" is what the preceding test leaves standing in the page-global
  // region, and it is what this one ends on, so it starts from silence.
  resetAnnouncements();

  shiftState.syncFromPhysical(false, true);
  assert.strictEqual(announcedText(), "Caps Lock on", "Announces Caps Lock on");

  // `isShifted` is true on both sides of this step, so the mode that ended is the
  // only thing that changed.
  shiftState.syncFromPhysical(true, false);
  await waitForAnnouncement();

  assert.strictEqual(announcedText(), "Caps Lock off", "Announces Caps Lock off");

  kb.destroy();
});

QUnit.test("Announcements raised while the keyboard has no DOM are dropped, not banked", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  const shiftState = kb["_shiftState"];

  // setVisible(false) renders the invisible placeholder, so getDomRef() is null while
  // the control is still alive and its physical-key delegate still reaches the
  // announcement path.
  kb.setVisible(false);
  await waitForRender();

  for (let press = 0; press < 6; press++) {
    shiftState.syncFromPhysical(press % 2 === 0, false);
  }

  kb.setVisible(true);
  await waitForRender();
  kb.show();
  await waitForAnnouncement();

  // Banking the detached ones would make the screen reader read a backlog before
  // reaching the announcement the user actually just caused.
  assert.strictEqual(
    announcedText(),
    "Virtual keyboard opened",
    "the open announcement is not queued behind a backlog",
  );

  kb.destroy();
});

QUnit.test("Open and close announcements are spoken in turn, not collapsed", async (assert) => {
  const kb = new KioskKeyboard({ docked: true });
  await placeAndWait(kb);

  // The region is page-global, so an earlier test's identical text would otherwise
  // stand in for the one this test is checking for.
  resetAnnouncements();

  // Both land in the same task. A single-slot live region would hold only the
  // second, and assistive tech would never speak the first.
  kb.show();
  kb.close();

  assert.strictEqual(announcedText(), "Virtual keyboard opened", "the first announcement holds the region");

  await waitForAnnouncement();
  assert.strictEqual(announcedText(), "Virtual keyboard closed", "the second follows once the first has been read");

  // Far enough behind the last write that the gap is already spent, so this one
  // reaches the region in the task that raised it.
  await waitForAnnouncement();
  kb.show();
  assert.strictEqual(
    announcedText(),
    "Virtual keyboard opened",
    "an announcement clear of the gap is written straight away",
  );

  kb.destroy();
});

QUnit.test("Two keyboards on one page share the live region's cadence", async (assert) => {
  const first = new KioskKeyboard({ docked: true });
  const second = new KioskKeyboard();
  await placeAndWait(first);
  await placeAndWait(second);

  // The region is page-global, so an earlier test's identical text would otherwise
  // stand in for the one this test is checking for.
  resetAnnouncements();

  // Both land in the same task, from different controls. A per-instance cadence would
  // let the second write straight over the first, and the first would never be spoken.
  first.show();
  second["_shiftState"].syncFromPhysical(true, false);

  assert.strictEqual(announcedText(), "Virtual keyboard opened", "the first keyboard's announcement holds the region");

  await waitForAnnouncement();
  assert.strictEqual(announcedText(), "Shift on", "the second keyboard's follows once the first has been read");

  first.destroy();
  second.destroy();
});

QUnit.test("Live region stays silent for a requested layout switch", async (assert) => {
  // Cleared before the keyboard exists, so first paint is inside what is asserted on.
  resetAnnouncements();
  const kb = new KioskKeyboard({ layout: "qwerty" });
  await placeAndWait(kb);

  assert.strictEqual(announcedText(), "", "nothing is announced on first paint");

  kb.setLayout("numeric");
  await waitForRender();

  // A switch the user asked for is its own feedback, and it moves focus onto the
  // key it followed, which announces itself.
  assert.strictEqual(announcedText(), "", "a requested switch adds no announcement");

  kb.destroy();
});

// `sap.m.InputBase.exit` calls `destroy()` on the InvisibleMessage singleton, which
// is shared with every other control on the page - and this keyboard exists to type
// into Inputs, which a navigation destroys routinely. The singleton has no `exit`, so
// its spans stay in the static area and `announce` (which reads no instance state)
// keeps working; that is a reading of the framework, and this asserts it.
QUnit.test("announcements survive an Input being destroyed", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ docked: true, controls: [input.getId()] });
  await placeAndWait(kb);

  resetAnnouncements();
  kb.show();
  await waitForAnnouncement();
  assert.strictEqual(announcedText(), "Virtual keyboard opened", "precondition: announcements work");

  // Exactly what a navigation away from the form does.
  input.destroy();
  await waitForRender();

  resetAnnouncements();
  kb.close();
  await waitForAnnouncement();
  assert.strictEqual(announcedText(), "Virtual keyboard closed", "still announcing after the target is gone");

  kb.destroy();
});

// Being in the DOM is not enough: every other assertion here reads `textContent`,
// which survives `display: none`, an inherited `visibility: hidden` and an
// `aria-hidden` ancestor, each of which keeps the text out of the accessibility tree.
// The region is a `<body>`-level sibling in the static area, so the keyboard's own
// hidden state cannot reach it; the docked mid-close setup is there to raise an
// announcement from the state that used to swallow one, not to expose the node.
QUnit.test("the announced text lands in a node assistive tech can reach", async (assert) => {
  const docked = new KioskKeyboard({ docked: true });
  await placeAndWait(docked);
  assert.ok(
    docked.getDomRef()!.classList.contains("ui5KioskKeyboard--closed"),
    "precondition: a docked keyboard renders closed",
  );

  resetAnnouncements();
  docked.show();
  docked.close();
  await waitForAnnouncement();
  assert.strictEqual(announcedText(), "Virtual keyboard closed", "the close announcement reached the region");

  // Whatever node ended up holding the text is the one that has to be reachable, so
  // it is found BY that text. Selecting it by `.sapUiInvisibleMessagePolite` would
  // pin the framework's own markup instead: that span exists, empty and exposed, no
  // matter where this control writes, so a region rendered back into the keyboard -
  // `sapUiInvisibleText`, which is `display: none !important` - would read as a pass
  // beside it. No assertion on `aria-live`: InvisibleMessage writes the class and
  // `aria-live="polite"` in one hardcoded markup string, so they cannot disagree.
  const carrying = [...document.querySelectorAll("body *")].filter(
    (el) => el.childElementCount === 0 && el.textContent === "Virtual keyboard closed",
  );
  assert.ok(carrying.length > 0, "precondition: some node in the page carries the announcement");
  for (const node of carrying) {
    // Walks the ancestors, which reading the node's own computed style does not:
    // `display: none` on a parent leaves the child computing to `inline`, and the
    // region this control used to own was hidden by exactly that - its own class
    // inside the keyboard's root, both gone from the tree with a closed keyboard.
    assert.ok(
      node.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true }),
      "it is not hidden by display, visibility or skipped content",
    );
    // `aria-hidden` takes a node out of the tree while display, visibility and
    // textContent all still read as exposed. UI5's modal `Popup` puts it on the static
    // area's `<body>` siblings, so this is a live path rather than a hypothetical.
    assert.notOk(node.closest("[aria-hidden='true']"), "and sits under no aria-hidden ancestor");
  }

  docked.destroy();
});

// ──────────────────────────────────────────────
// Focus order across a layout switch
// ──────────────────────────────────────────────

QUnit.test("A layout switch follows the focused key to its new seat", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty" });
  await placeAndWait(kb);

  const backspace = getRequiredKeyElement(kb, "{backspace}");
  assert.strictEqual(backspace.id, `${kb.getId()}-key-0-10`, "qwerty seats Backspace at the end of the number row");
  backspace.focus();

  kb.setLayout("numeric");
  await waitForRender();

  const focused = document.activeElement as HTMLElement;
  assert.strictEqual(focused.dataset.key, "{backspace}", "focus is still on Backspace");
  assert.strictEqual(focused.id, `${kb.getId()}-key-2-6`, "at the seat the numeric layout gives it");

  kb.destroy();
});

QUnit.test("A layout switch that drops the focused key anchors on the first key", async (assert) => {
  const kb = new KioskKeyboard({ layout: "qwerty" });
  await placeAndWait(kb);

  // The numeric layout has no "q", but it does have a key at q's seat (1,0),
  // where focus would otherwise come back meaning "-".
  tapKey(kb, "q");
  getRequiredKeyElement(kb, "q").focus();

  kb.setLayout("numeric");
  await waitForRender();

  const focused = document.activeElement as HTMLElement;
  assert.notStrictEqual(focused, document.body, "focus was not dumped to the document");
  assert.strictEqual(focused.dataset.key, "1", "it anchored on the first key");

  kb.destroy();
});

QUnit.test("A layout switch leaves focus outside the keyboard alone", async (assert) => {
  const input = new Input();
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ layout: "qwerty" });
  await placeAndWait(kb);

  // Tap a key first, so the keyboard remembers a tab stop: a remembered tab stop
  // is not focus, and must not pull focus back off the input.
  tapKey(kb, "q");
  const inputDom = input.getFocusDomRef() as HTMLElement;
  inputDom.focus();

  kb.setLayout("numeric");
  await waitForRender();

  assert.strictEqual(document.activeElement, inputDom, "the target input keeps focus through the switch");

  kb.destroy();
  input.destroy();
});

// ──────────────────────────────────────────────
// ARIA Associations
// ──────────────────────────────────────────────

QUnit.test("ariaLabelledBy renders aria-labelledby attribute on root DOM", async (assert) => {
  const label = new InvisibleText({ text: "My Keyboard" });
  label.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaLabelledBy(label);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.getAttribute("aria-labelledby")?.includes(label.getId()), "aria-labelledby contains label ID");

  label.destroy();
  kb.destroy();
});

QUnit.test("ariaDescribedBy renders aria-describedby attribute", async (assert) => {
  const desc = new InvisibleText({ text: "Use arrow keys to navigate" });
  desc.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaDescribedBy(desc);
  await placeAndWait(kb);

  const dom = kb.getDomRef()!;
  assert.ok(dom.getAttribute("aria-describedby")?.includes(desc.getId()), "aria-describedby contains description ID");

  desc.destroy();
  kb.destroy();
});

QUnit.test("Root aria-label defers to ariaLabelledBy but honors an explicit ariaLabel", async (assert) => {
  // No ariaLabelledBy: the default fallback names the group.
  const kbDefault = new KioskKeyboard();
  await placeAndWait(kbDefault);
  assert.strictEqual(
    kbDefault.getDomRef()!.getAttribute("aria-label"),
    "Virtual Keyboard",
    "default aria-label is present when nothing else names the group",
  );
  kbDefault.destroy();

  const label = new InvisibleText({ text: "External label" });
  label.placeAt("qunit-fixture");

  // ariaLabelledBy set, no explicit ariaLabel: the default is suppressed so it
  // does not compete with aria-labelledby (which wins per WAI-ARIA).
  const kbLabelledBy = new KioskKeyboard();
  kbLabelledBy.addAriaLabelledBy(label);
  await placeAndWait(kbLabelledBy);
  const domLabelledBy = kbLabelledBy.getDomRef()!;
  assert.ok(domLabelledBy.getAttribute("aria-labelledby")?.includes(label.getId()), "aria-labelledby names the group");
  assert.notOk(domLabelledBy.hasAttribute("aria-label"), "default aria-label is suppressed when ariaLabelledBy is set");
  kbLabelledBy.destroy();

  // An explicit ariaLabel is still honored even with ariaLabelledBy present.
  const kbBoth = new KioskKeyboard({ ariaLabel: "PIN entry" });
  kbBoth.addAriaLabelledBy(label);
  await placeAndWait(kbBoth);
  assert.strictEqual(kbBoth.getDomRef()!.getAttribute("aria-label"), "PIN entry", "explicit ariaLabel is preserved");
  kbBoth.destroy();

  label.destroy();
});

QUnit.test("removeAriaLabelledBy restores the default aria-label after re-render", async (assert) => {
  const label = new InvisibleText({ text: "Removable label" });
  label.placeAt("qunit-fixture");
  const kb = new KioskKeyboard();
  kb.addAriaLabelledBy(label);
  await placeAndWait(kb);

  assert.notOk(kb.getDomRef()!.hasAttribute("aria-label"), "precondition: the label suppresses the default aria-label");

  kb.removeAriaLabelledBy(label);
  await waitForRender();

  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-label"),
    "Virtual Keyboard",
    "the default aria-label is back once nothing else names the group",
  );

  label.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────
// aria-controls
// ──────────────────────────────────────────────

QUnit.test("aria-controls points to active target on initial render", async (assert) => {
  const input = new Input("a11y-target");
  input.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ controls: [input.getId()] });
  await placeAndWait(kb);

  input.focus();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    input.getId(),
    "aria-controls set to target input ID",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("aria-controls absent when no active target", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  assert.notOk(kb.getDomRef()!.hasAttribute("aria-controls"), "No aria-controls without target");

  kb.destroy();
});

QUnit.test("aria-controls updates when active target changes via focus", async (assert) => {
  const input1 = new Input("a11y-input1");
  const input2 = new Input("a11y-input2");
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  await nextUIUpdate();

  const kb = new KioskKeyboard({ controls: [input1.getId(), input2.getId()] });
  await placeAndWait(kb);

  input1.focus();
  await nextUIUpdate();

  assert.strictEqual(kb.getDomRef()!.getAttribute("aria-controls"), input1.getId(), "Initially points to input1");

  input2.focus();
  await nextUIUpdate();
  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    input2.getId(),
    "Updated to input2 without re-render",
  );

  input1.destroy();
  input2.destroy();
  kb.destroy();
});

QUnit.test("aria-controls survives re-render for a non-Control target", async (assert) => {
  // A target whose id does not resolve to a UI5 Control (a plain DOM input, or
  // an association left transiently dangling by aggregation churn) makes
  // getActiveControl() return null while _getActiveTargetId() still holds the id.
  // The renderer must emit the raw association id so it does not diverge from the
  // aria-controls that _setActiveTarget writes imperatively.
  const domInput = document.createElement("input");
  domInput.id = "plain-dom-target";
  document.getElementById("qunit-fixture")!.appendChild(domInput);

  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  kb._setActiveTarget("plain-dom-target");
  await nextUIUpdate();

  // Precondition: the target is a non-Control DOM element.
  assert.strictEqual(kb.getActiveControl(), null, "target does not resolve to a Control");
  assert.strictEqual(kb._getActiveTargetId(), "plain-dom-target", "association holds the raw id");
  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    "plain-dom-target",
    "imperative path set aria-controls to the raw id",
  );

  // Force a full re-render: the renderer, not the imperative path, now owns aria-controls.
  kb.invalidate();
  await nextUIUpdate();

  assert.strictEqual(
    kb.getDomRef()!.getAttribute("aria-controls"),
    "plain-dom-target",
    "aria-controls retained after re-render (renderer reads _getActiveTargetId, not getActiveControl)",
  );

  kb.destroy();
});

// ──────────────────────────────────────────────
// Static API: getKeyIcon
// ──────────────────────────────────────────────

QUnit.test("getKeyIcon: maps icon keys and returns undefined for plain characters", (assert) => {
  const cases: [string, string | undefined][] = [
    ["{shift}", "sap-icon://arrow-top"],
    ["{enter}", "sap-icon://accept"],
    ["{backspace}", "sap-icon://arrow-left"],
    ["a", undefined],
    [" ", undefined],
  ];

  cases.forEach(([input, expected]) => {
    assert.strictEqual(KioskKeyboard.getKeyIcon(input), expected, `getKeyIcon(${JSON.stringify(input)})`);
  });
});

// ──────────────────────────────────────────────
// Rendered labels for Keys (visible text or aria-label)
// ──────────────────────────────────────────────

QUnit.test("Rendered visible labels for special and plain keys", async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  try {
    const cases: [string, string][] = [
      ["{backspace}", "Backspace"],
      ["{enter}", "Enter"],
      ["{shift}", "Shift"],
      [" ", "Space"],
      ["a", "a"],
    ];

    cases.forEach(([keyValue, expectedLabel]) => {
      assert.strictEqual(
        getRequiredKeyElement(kb, keyValue).querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
        expectedLabel,
        `key ${JSON.stringify(keyValue)} renders label "${expectedLabel}"`,
      );
    });
  } finally {
    kb.destroy();
  }
});

QUnit.test('Rendered visible label after shift: "a" \u2192 "A", "1" \u2192 "!"', async (assert) => {
  const kb = new KioskKeyboard();
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();

  assert.strictEqual(
    getRequiredKeyElement(kb, "a").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "A",
    "'a' becomes 'A' with shift",
  );
  assert.strictEqual(
    getRequiredKeyElement(kb, "1").querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "!",
    "'1' with shiftLabel '!' becomes '!' with shift",
  );

  kb.destroy();
});
