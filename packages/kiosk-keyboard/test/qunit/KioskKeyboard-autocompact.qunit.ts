import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { $KioskKeyboardSettings } from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
import { KeyboardType } from "ui5/kiosk/library";
import type { LayoutDefinition } from "ui5/kiosk/types";
import Log from "sap/base/Log";
import JSONModel from "sap/ui/model/json/JSONModel";
import {
  announcedText,
  getRenderedLayoutKeys,
  getRequiredKeyElement,
  resetAnnouncements,
  tapKey,
  waitForAnnouncement,
  waitForRender,
} from "./test-helpers";

// The default threshold is 22rem, so 320px is narrow and 600px is not at any
// root font-size this suite runs at.
const NARROW_PX = 320;
const WIDE_PX = 600;

const sandbox = sinon.createSandbox();

/** Both fields are optional on the event, so a missing one shows up in the comparison. */
interface LayoutChange {
  layout: string | undefined;
  autoDetected: boolean | undefined;
}

interface Mounted {
  kb: KioskKeyboard;
  /** Every `layoutChange` fired since the keyboard was placed, in order. */
  changes: LayoutChange[];
  /** Resizes the box the keyboard fills and lets the tier settle. */
  resize(width: number): Promise<void>;
  /** Takes the keyboard's box away the way a collapsed panel does, and lets it settle. */
  hide(): Promise<void>;
}

/**
 * Lets a width change work through the observer, the frame the tier is applied
 * from, the re-render the swap triggers, and the gap the announcement queue keeps
 * between writes. Generous enough that a settled keyboard stays settled, so a
 * negative assertion after it is meaningful.
 */
async function settle(): Promise<void> {
  for (let frame = 0; frame < 4; frame++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await waitForRender();
  }
  await waitForAnnouncement();
}

const mounted: KioskKeyboard[] = [];

/** Places a keyboard inside a box of a fixed width, which is what the tier measures. */
async function mount(width: number, settings: $KioskKeyboardSettings): Promise<Mounted> {
  const box = document.createElement("div");
  box.style.width = `${width}px`;
  document.getElementById("qunit-fixture")!.appendChild(box);

  const kb = new KioskKeyboard(settings);
  mounted.push(kb);
  const changes: LayoutChange[] = [];
  kb.attachLayoutChange((event) => {
    changes.push({ layout: event.getParameter("layout"), autoDetected: event.getParameter("autoDetected") });
  });

  kb.placeAt(box);
  await settle();

  return {
    kb,
    changes,
    async resize(next: number) {
      box.style.width = `${next}px`;
      await settle();
    },
    async hide() {
      box.style.display = "none";
      await settle();
    },
  };
}

const away: LayoutDefinition = [[{ value: "a" }]];
const home: LayoutDefinition = [[{ value: "{layout:away}" }, { value: "h" }]];
const homeCompact: LayoutDefinition = [[{ value: "hc" }]];

/** The `home` / `home-c` pair plus the unrelated `away`, as declared custom layouts. */
function pair(): CustomLayout[] {
  return [
    new CustomLayout({ name: "home", rows: home, compact: "home-c" }),
    new CustomLayout({ name: "home-c", rows: homeCompact }),
    new CustomLayout({ name: "away", rows: away }),
  ];
}

QUnit.module("KioskKeyboard autoCompact", {
  afterEach() {
    sandbox.restore();
    for (const kb of mounted.splice(0)) kb.destroy();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Off by default, and nothing is observed while it is off", async (assert) => {
  // Spied before construction, so the behaviour's own observer would be counted
  // if it were built. The responsive-sizing controller observes the same root, so
  // the assertion is on how many distinct observers watch it.
  const observeSpy = sandbox.spy(ResizeObserver.prototype, "observe");
  const { kb } = await mount(NARROW_PX, { layout: "ja-kana" });

  assert.strictEqual(kb.getAutoCompact(), false, "autoCompact defaults to off");

  const dom = kb.getDomRef() as HTMLElement;
  const watchers = () =>
    new Set(
      observeSpy
        .getCalls()
        .filter((c) => c.args[0] === dom)
        .map((c) => c.thisValue),
    ).size;
  assert.strictEqual(watchers(), 1, "only the responsive-sizing observer watches the root");

  kb.setAutoCompact(true);
  await settle();

  assert.strictEqual(watchers(), 2, "turning the property on adds an observer of its own");
});

QUnit.test("A layout with a compact counterpart swaps below the threshold and back above it", async (assert) => {
  const { kb, changes, resize } = await mount(WIDE_PX, { layout: "ja-kana", autoCompact: true });
  const wideKeys = getRenderedLayoutKeys(kb);
  assert.deepEqual(changes, [], "a keyboard with room to spare does not swap");

  await resize(NARROW_PX);
  assert.strictEqual(kb.getLayout(), "ja-kana-compact", "the compact counterpart took over");
  assert.deepEqual(changes, [{ layout: "ja-kana-compact", autoDetected: true }], "one auto-detected change");
  assert.notDeepEqual(getRenderedLayoutKeys(kb), wideKeys, "the compact rows replaced the wide ones");

  await resize(WIDE_PX);
  // Not the locale default and not the compact form: the layout that was asked for.
  assert.strictEqual(kb.getLayout(), "ja-kana", "the requested layout returned");
  assert.deepEqual(
    changes,
    [
      { layout: "ja-kana-compact", autoDetected: true },
      { layout: "ja-kana", autoDetected: true },
    ],
    "the way back is auto-detected too",
  );
  assert.deepEqual(getRenderedLayoutKeys(kb), wideKeys, "the requested layout is back key for key");
});

QUnit.test("A swap does not become the base layout a {layout:base} key returns to", async (assert) => {
  const { kb, resize } = await mount(WIDE_PX, { layout: "home", autoCompact: true, customLayouts: pair() });
  await resize(NARROW_PX);
  assert.strictEqual(kb.getLayout(), "home-c", "the tier swapped");
  assert.strictEqual(kb.getBaseLayout(), "home", "the arrangement a width picked is not the base");

  kb.resetLayout();
  await settle();
  assert.strictEqual(kb.getLayout(), "home-c", "returning to base re-tiers to the compact form");

  await resize(WIDE_PX);
  // Regression: the tier used to promote its own target to the base layout, so the
  // round trip through base made the compact form the request and stranded it there.
  assert.strictEqual(kb.getLayout(), "home", "the requested layout is still what widening restores");
});

QUnit.test("Switching autoCompact off gives the requested layout back", async (assert) => {
  const { kb, resize } = await mount(WIDE_PX, { layout: "home", autoCompact: true, customLayouts: pair() });
  await resize(NARROW_PX);
  assert.strictEqual(kb.getLayout(), "home-c", "the tier swapped");

  kb.setAutoCompact(false);
  await settle();
  // Regression: teardown used to leave the compact form applied with no observer
  // left to undo it, so disabling the feature stranded its own result.
  assert.strictEqual(kb.getLayout(), "home", "disabling restores what was asked for");
});

// ───────────────────────────────────────────────────
// Two-way write-back of the tier
// ───────────────────────────────────────────────────

/** A keyboard whose `layout` is bound to `/layout` of its own model in the given mode. */
async function mountBound(width: number, mode: "TwoWay" | "OneWay"): Promise<Mounted & { model: JSONModel }> {
  const model = new JSONModel({ layout: "home" });
  const mounted = await mount(width, {
    layout: { path: "/layout", mode },
    autoCompact: true,
    customLayouts: pair(),
    models: model,
  });
  return { ...mounted, model };
}

QUnit.test("A tier written through a two-way binding is reported once", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const { kb, resize, model } = await mountBound(WIDE_PX, "TwoWay");

  await resize(NARROW_PX);
  assert.strictEqual(kb.getLayout(), "home-c", "the tier applied");
  // The write-back itself is the UI5 contract `sap.f.DynamicPage` follows for
  // `headerExpanded`, and it stays. What it must not be is silent: two-way is every
  // JSONModel's default, so an app binding a stored preference never asked for it.
  assert.strictEqual(model.getProperty("/layout"), "home-c", "the model took the detected value");
  const hits = () => warn.getCalls().filter((call) => String(call.args[0]).includes("bound two-way"));
  assert.strictEqual(hits().length, 1, "and the write-back is reported");
  assert.ok(String(hits()[0]!.args[0]).includes('mode: "OneWay"'), "naming the remedy");

  await resize(WIDE_PX);
  await resize(NARROW_PX);
  assert.strictEqual(hits().length, 1, "once per control, not once per crossing");
});

QUnit.test("A one-way binding takes no write-back and is not reported", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const { kb, resize, model } = await mountBound(WIDE_PX, "OneWay");

  await resize(NARROW_PX);
  assert.strictEqual(kb.getLayout(), "home-c", "the tier still applies");
  assert.strictEqual(model.getProperty("/layout"), "home", "the stored preference is untouched");
  assert.strictEqual(
    warn.getCalls().filter((call) => String(call.args[0]).includes("bound two-way")).length,
    0,
    "and there is nothing to report",
  );
});

QUnit.test("An unbound layout is not reported", async (assert) => {
  const warn = sandbox.stub(Log, "warning");
  const { resize } = await mount(WIDE_PX, { layout: "home", autoCompact: true, customLayouts: pair() });

  await resize(NARROW_PX);
  assert.strictEqual(
    warn.getCalls().filter((call) => String(call.args[0]).includes("bound two-way")).length,
    0,
    "no binding, no write-back, no warning",
  );
});

QUnit.test("A keyboardType constraint suppresses the tier", async (assert) => {
  const { kb, changes, resize } = await mount(WIDE_PX, {
    layout: "ja-kana",
    autoCompact: true,
    keyboardType: KeyboardType.Numpad,
  });
  await resize(NARROW_PX);
  // Numpad pins the rendered surface, so a swap would announce a layout nobody can see.
  assert.deepEqual(changes, [], "no layout change is announced while the surface is constrained");
  assert.strictEqual(kb.getLayout(), "ja-kana", "and the layout under the constraint is untouched");
});

QUnit.test("Lifting a keyboardType constraint re-tiers the layout that surfaces", async (assert) => {
  const { kb } = await mount(NARROW_PX, {
    layout: "ja-kana",
    autoCompact: true,
    keyboardType: KeyboardType.Numpad,
  });
  assert.strictEqual(kb.getLayout(), "ja-kana", "the constrained keyboard did not tier");

  kb.resetKeyboardType();
  await settle();

  // The constraint was the only thing holding the swap back, and lifting it is a
  // change no resize reports - the box never moved.
  assert.strictEqual(kb.getLayout(), "ja-kana-compact", "the layout tiers as soon as it surfaces");
});

QUnit.test("A counterpart whose rows arrive from a model re-tiers on arrival", async (assert) => {
  const model = new JSONModel({});
  const { kb, changes } = await mount(NARROW_PX, {
    layout: "home",
    autoCompact: true,
    customLayouts: [
      new CustomLayout({ name: "home", rows: home, compact: "home-c" }),
      new CustomLayout({ name: "home-c", rows: "{/rows}" }),
    ],
    models: model,
  });
  assert.deepEqual(changes, [], "the counterpart has no rows yet, so there is nothing to swap to");

  model.setProperty("/rows", homeCompact);
  await settle();

  // The rows arriving is a change to what the tier resolves through, and the box
  // never moved, so no resize reports it.
  assert.deepEqual(changes, [{ layout: "home-c", autoDetected: true }], "the counterpart took over on arrival");
  assert.deepEqual(getRenderedLayoutKeys(kb), [["hc"]], "the compact rows render");
});

QUnit.test("A keyboard that loses its box does not tier", async (assert) => {
  const { kb, changes, hide } = await mount(WIDE_PX, { layout: "ja-kana", autoCompact: true });
  await hide();
  // A zero inline size is an element without layout, not a narrow keyboard.
  assert.deepEqual(changes, [], "being hidden is not a width");
  assert.strictEqual(kb.getLayout(), "ja-kana", "the layout is unchanged");
});

QUnit.test("A layout that declares no counterpart never swaps", async (assert) => {
  const { kb, changes } = await mount(NARROW_PX, { layout: "qwertz-de", autoCompact: true });

  assert.strictEqual(kb.getLayout(), "qwertz-de", "qwertz-de is still the layout");
  assert.deepEqual(changes, [], "no layout change was fired");
});

QUnit.test("A custom layout tiers by the counterpart it declares itself", async (assert) => {
  const { kb, changes, resize } = await mount(WIDE_PX, {
    layout: "home",
    autoCompact: true,
    customLayouts: pair(),
  });
  assert.deepEqual(getRenderedLayoutKeys(kb), [["{layout:away}", "h"]], "the wide form renders first");

  await resize(NARROW_PX);
  assert.deepEqual(changes, [{ layout: "home-c", autoDetected: true }], "the declared counterpart took over");
  assert.deepEqual(getRenderedLayoutKeys(kb), [["hc"]], "the compact rows render");

  await resize(WIDE_PX);
  assert.deepEqual(getRenderedLayoutKeys(kb), [["{layout:away}", "h"]], "the wide form returned");
});

QUnit.test("An unregistered counterpart resolves to no swap, not to the default layout", async (assert) => {
  const { kb, changes } = await mount(NARROW_PX, {
    layout: "lonely",
    autoCompact: true,
    customLayouts: [new CustomLayout({ name: "lonely", rows: [[{ value: "l" }]], compact: "nowhere" })],
  });

  assert.deepEqual(changes, [], "an unresolvable counterpart is not a layout change");
  // Specifically not the locale default: a consumer who names a missing layout
  // keeps the one they asked for.
  assert.deepEqual(getRenderedLayoutKeys(kb), [["l"]], "the requested layout still renders");
});

QUnit.test("An explicit request while narrow wins, and the tier resolves from that request", async (assert) => {
  const { kb, changes, resize } = await mount(NARROW_PX, {
    layout: "away",
    autoCompact: true,
    customLayouts: pair(),
  });
  assert.deepEqual(getRenderedLayoutKeys(kb), [["a"]], "away declares no counterpart, so nothing swapped");

  kb.setLayout("home");
  await settle();

  assert.deepEqual(
    changes,
    [
      { layout: "home", autoDetected: false },
      { layout: "home-c", autoDetected: true },
    ],
    "the request applied, then the tier resolved against it",
  );
  assert.deepEqual(getRenderedLayoutKeys(kb), [["hc"]], "the counterpart of the NEW request renders");

  await resize(WIDE_PX);
  assert.deepEqual(getRenderedLayoutKeys(kb), [["{layout:away}", "h"]], "the room returns to the new request");
});

QUnit.test("A swap follows the focused key to the seat the compact form gives it", async (assert) => {
  const { kb, resize } = await mount(WIDE_PX, { layout: "ja-kana", autoCompact: true });
  const backspace = getRequiredKeyElement(kb, "{backspace}");
  assert.strictEqual(
    backspace.id,
    `${kb.getId()}-key-0-11`,
    "the wide form seats Backspace at the end of the digit row",
  );
  backspace.focus();

  await resize(NARROW_PX);

  // Key elements are identified by their grid position, so without the follow the
  // browser would leave focus on (0,11), which the compact form gives to the
  // prolonged sound mark.
  const focused = document.activeElement as HTMLElement;
  assert.strictEqual(focused.dataset.key, "{backspace}", "focus is still on Backspace");
  assert.strictEqual(focused.id, `${kb.getId()}-key-4-5`, "at the seat the compact form gives it");
  assert.strictEqual(focused.getAttribute("tabindex"), "0", "and it is the key that carries the tab stop");
});

QUnit.test("A swap that drops the focused key falls back to the first key", async (assert) => {
  const { kb, resize } = await mount(WIDE_PX, { layout: "ja-kana", autoCompact: true });
  // 。 has a key of its own only in the wide form, and the seat it holds there
  // (4,5) belongs to Backspace in the compact one.
  const period = getRequiredKeyElement(kb, "。");
  tapKey(kb, "。");
  period.focus();

  await resize(NARROW_PX);

  const focused = document.activeElement as HTMLElement;
  assert.notStrictEqual(focused, document.body, "focus was not dumped to the document");
  assert.strictEqual(focused.id, `${kb.getId()}-key-0-0`, "it anchored on the first key");
  assert.strictEqual(focused.getAttribute("tabindex"), "0", "which carries the tab stop");
});

QUnit.test("The live region announces which way each width crossing moved the layout", async (assert) => {
  // Cleared before the keyboard exists, so first paint is inside what is asserted on.
  resetAnnouncements();
  const { resize } = await mount(WIDE_PX, { layout: "ja-kana", autoCompact: true });
  assert.strictEqual(announcedText(), "", "a keyboard with room to spare announces nothing");

  const spoken: string[] = [];
  for (const width of [NARROW_PX, WIDE_PX, NARROW_PX, WIDE_PX]) {
    await resize(width);
    spoken.push(announcedText());
  }

  // A distinct text every time: the two crossings are opposite moves, so one shared
  // wording would not say which way this one went. The tier reports a verdict only
  // when it differs from the last, which is what keeps the two texts alternating
  // rather than repeating.
  assert.deepEqual(
    spoken,
    [
      "Switched to the compact keyboard layout",
      "Switched back to the standard keyboard layout",
      "Switched to the compact keyboard layout",
      "Switched back to the standard keyboard layout",
    ],
    "every crossing says which way it went, and none repeats the text before it",
  );
});

QUnit.test("A keyboard that was always narrow announces nothing on first paint", async (assert) => {
  // Cleared before the keyboard exists, so first paint is inside what is asserted on.
  resetAnnouncements();
  const { kb, resize } = await mount(NARROW_PX, { layout: "ja-kana", autoCompact: true });

  assert.strictEqual(kb.getLayout(), "ja-kana-compact", "the compact form is what mounted");
  // Nothing was rearranged under the user: this is the arrangement they first saw.
  assert.strictEqual(announcedText(), "", "the first resolution is not a change to announce");

  await resize(WIDE_PX);
  assert.strictEqual(
    announcedText(),
    "Switched back to the standard keyboard layout",
    "a width they crossed is announced",
  );
});

QUnit.test("A request drops a tier announcement that has not reached the live region yet", async (assert) => {
  resetAnnouncements();
  const { kb } = await mount(WIDE_PX, { layout: "ja-kana", autoCompact: true });

  // The tier writes its announcement for the next render. Driving it directly is
  // what puts a request in the same frame, which a resize cannot do: the observer
  // and the frame it applies from settle before the test regains control.
  kb._applyCompactTier(true, true);
  assert.strictEqual(kb.getLayout(), "ja-kana-compact", "the tier swapped");

  kb.setLayout("qwerty");
  await settle();
  // The pending text names the layout the request just replaced, so announcing it
  // would tell a screen reader user the keyboard is on a layout it has left.
  assert.strictEqual(kb.getLayout(), "qwerty", "the request took effect");
  assert.strictEqual(announcedText(), "", "the superseded announcement never reaches the region");
});

QUnit.test("The tier follows the threshold custom property, not a fixed width", async (assert) => {
  const { kb, changes, resize } = await mount(WIDE_PX, {
    layout: "home",
    autoCompact: true,
    customLayouts: pair(),
  });
  assert.deepEqual(changes, [], "600px clears the 22rem default");

  // Unlayered, so it beats the layered theme declaration whatever its specificity,
  // and it survives the re-render an inline style on the root would not.
  const override = document.createElement("style");
  override.textContent = `#qunit-fixture .${KioskKeyboard.DOM.classes.root} { --ui5KioskKeyboard-autoCompactThreshold: 40rem; }`;
  document.head.appendChild(override);
  try {
    // A threshold move alone does not re-observe, so it lands with the next
    // observation the box delivers.
    await resize(WIDE_PX - 1);

    assert.deepEqual(changes, [{ layout: "home-c", autoDetected: true }], "599px is narrow against a 40rem threshold");
    assert.deepEqual(getRenderedLayoutKeys(kb), [["hc"]], "the compact rows render");
  } finally {
    override.remove();
  }
});
