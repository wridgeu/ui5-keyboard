import LayoutState from "ui5/kiosk/internal/layout-state";
import { EMPTY_FOLD, foldCustomLayouts } from "ui5/kiosk/internal/custom-layout-fold";
import { isBuiltInLayout } from "ui5/kiosk/internal/layout-registry";
import { KeyboardType } from "ui5/kiosk/library";
import type { CustomLayoutSpec } from "ui5/kiosk/types";

/** A host over a local `layout` variable and a keyboardType box, recording every `layoutChange`. */
function createHost() {
  const box = { layout: "qwerty", keyboardType: KeyboardType.Full, changes: [] as string[] };
  const state = new LayoutState({
    getLayout: () => box.layout,
    setLayoutProperty: (name) => {
      box.layout = name;
    },
    getKeyboardType: () => box.keyboardType,
    getFold: () => EMPTY_FOLD,
    fireLayoutChange: (p) => {
      box.changes.push(p.layout);
    },
    resetShiftState: () => {},
    endComposition: () => {},
    focusAnchorValue: () => null,
    reseatFocusAnchor: () => {},
    warnTierWriteBack: () => {},
  });
  state.seed("qwerty");
  return { box, state };
}

QUnit.module("LayoutState.clearUserOverride");

QUnit.test("a user pick of a primary layout still returns to the base under the constraint", (assert) => {
  const { box, state } = createHost();
  state.perform("qwertz-de", "user", "referenced by a {layout:*} key");
  assert.strictEqual(box.layout, "qwertz-de", "precondition: the user pick landed");

  box.keyboardType = KeyboardType.Numpad;
  state.clearUserOverride();
  assert.strictEqual(state.resolvedName(), "numpad", "the constraint pins the surface");
  assert.deepEqual(box.changes, ["qwertz-de"], "a pick that is already the base fires no second change");
});

QUnit.test("clearUserOverride leaves a programmatic layout alone", (assert) => {
  const { box, state } = createHost();
  state.perform("numeric", "external", "passed to setLayout()");
  state.clearUserOverride();
  assert.strictEqual(box.layout, "numeric", "the programmatic layout stays");
  assert.strictEqual(state.resolvedName(), "numeric", "and still resolves");
});

interface Change {
  layout: string;
  requestedLayout: string;
  autoDetected: boolean;
}

/** Rows are irrelevant here: only the names, counterparts and roles are read. */
const rows = [[{ value: "x" }]];
const goldenSpecs: CustomLayoutSpec[] = [
  { name: "home", rows, compact: "home-c" },
  { name: "home-c", rows },
  { name: "away", rows, compact: "away-c" },
  { name: "away-c", rows },
  { name: "pick", rows, secondary: true },
  { name: "solo", rows, compact: "solo-c" },
];

/**
 * A host whose width tier behaves like `AutoCompactBehavior`: a verdict reaches the
 * state only when it differs from the last one.
 */
function createGoldenHost() {
  const box = {
    layout: "qwerty",
    keyboardType: KeyboardType.Full,
    fold: foldCustomLayouts(goldenSpecs, isBuiltInLayout, () => false),
    changes: [] as Change[],
    shiftResets: 0,
  };
  let applied: boolean | null = null;
  const state = new LayoutState({
    getLayout: () => box.layout,
    setLayoutProperty: (name) => {
      box.layout = name;
    },
    getKeyboardType: () => box.keyboardType,
    getFold: () => box.fold,
    fireLayoutChange: (p) => {
      box.changes.push(p);
    },
    resetShiftState: () => {
      box.shiftResets++;
    },
    endComposition: () => {},
    focusAnchorValue: () => null,
    reseatFocusAnchor: () => {},
    warnTierWriteBack: () => {},
  });
  const resize = (narrow: boolean): void => {
    if (narrow === applied) return;
    const crossed = applied !== null;
    applied = narrow;
    state.applyTier(narrow, crossed);
  };
  /** What the control's `_setKeyboardTypeSource` does once the type is set. */
  const setKeyboardType = (type: KeyboardType): void => {
    box.keyboardType = type;
    state.clearUserOverride();
    state.refresh();
  };
  /** What the fold cache does when a declared layout arrives. */
  const declare = (spec: CustomLayoutSpec): void => {
    box.fold = foldCustomLayouts([...goldenSpecs, spec], isBuiltInLayout, () => false);
    state.refresh();
  };
  state.seed("qwerty");
  resize(false);
  return { box, state, resize, setKeyboardType, declare };
}

const COMPACTED = "Switched to the compact keyboard layout";
const UNCOMPACTED = "Switched back to the standard keyboard layout";

QUnit.module("LayoutState golden sequence");

QUnit.test("requests, width, keyboardType, user picks and a late counterpart resolve in one sequence", (assert) => {
  const { box, state, resize, setKeyboardType, declare } = createGoldenHost();
  /**
   * Per step: the `layout` property, the resolved layout, the events since the last
   * step, and the announcement a render would take now.
   */
  const trace: unknown[] = [];
  const step = (name: string): void => {
    trace.push([name, box.layout, state.resolvedName(), box.changes.splice(0), state.takePendingAnnouncement()]);
  };

  state.perform("home", "external", "passed to setLayout()");
  step("request A");
  resize(true);
  // No step here: a request arriving before the render is what retracts the text.
  const narrowed = [box.layout, box.changes.splice(0)];
  state.perform("away", "user", "referenced by a {layout:*} key");
  step("request B while narrow");
  setKeyboardType(KeyboardType.Numpad);
  step("Numpad");
  setKeyboardType(KeyboardType.Full);
  step("Full");
  resize(false);
  step("widen");
  state.perform("pick", "user", "referenced by a {layout:*} key");
  step("{layout:pick}");
  state.perform(state.getBaseLayout(), "external", "referenced by a {layout:*} key");
  step("{layout:base}");
  state.perform("solo", "external", "passed to setLayout()");
  resize(true);
  step("request solo, narrow");
  declare({ name: "solo-c", rows });
  step("solo-c declared");

  assert.deepEqual(
    [narrowed, trace],
    [
      ["home-c", [{ layout: "home-c", requestedLayout: "home", autoDetected: true }]],
      [
        ["request A", "home", "home", [{ layout: "home", requestedLayout: "home", autoDetected: false }], null],
        // The request retracts the narrowing's pending text, and fires one change,
        // naming the layout that renders, unannounced.
        [
          "request B while narrow",
          "away-c",
          "away-c",
          [{ layout: "away-c", requestedLayout: "away", autoDetected: true }],
          null,
        ],
        // The key pick was a user override, which a keyboardType change drops to the
        // base; the constraint wins, and lifting it re-tiers the base.
        ["Numpad", "away", "numpad", [{ layout: "away", requestedLayout: "away", autoDetected: false }], null],
        ["Full", "away-c", "away-c", [{ layout: "away-c", requestedLayout: "away", autoDetected: true }], null],
        ["widen", "away", "away", [{ layout: "away", requestedLayout: "away", autoDetected: true }], UNCOMPACTED],
        ["{layout:pick}", "pick", "pick", [{ layout: "pick", requestedLayout: "pick", autoDetected: false }], null],
        ["{layout:base}", "away", "away", [{ layout: "away", requestedLayout: "away", autoDetected: false }], null],
        // solo-c is not declared yet, so the crossing swaps nothing...
        [
          "request solo, narrow",
          "solo",
          "solo",
          [{ layout: "solo", requestedLayout: "solo", autoDetected: false }],
          null,
        ],
        // ...and the counterpart arriving applies without a resize, unannounced.
        [
          "solo-c declared",
          "solo-c",
          "solo-c",
          [{ layout: "solo-c", requestedLayout: "solo", autoDetected: true }],
          null,
        ],
      ],
    ],
  );
});

QUnit.test("a width crossing holds its announcement until it is taken", (assert) => {
  const { state, resize } = createGoldenHost();
  state.perform("home", "external", "passed to setLayout()");
  resize(true);
  assert.deepEqual([state.takePendingAnnouncement(), state.takePendingAnnouncement()], [COMPACTED, null]);
});

QUnit.test("a constraint holds the tiered layout under it until it lifts", (assert) => {
  const { box, state, resize, setKeyboardType } = createGoldenHost();
  state.perform("home", "external", "passed to setLayout()");
  resize(true);
  box.changes.length = 0;
  const trace: unknown[] = [];
  const step = (name: string): void => {
    trace.push([name, state.resolvedName(), box.layout, box.changes.splice(0)]);
  };

  setKeyboardType(KeyboardType.Numpad);
  step("Numpad while narrow");
  resize(false);
  step("widen under the constraint");
  setKeyboardType(KeyboardType.Full);
  step("lift");

  assert.deepEqual(trace, [
    ["Numpad while narrow", "numpad", "home-c", []],
    ["widen under the constraint", "numpad", "home-c", []],
    ["lift", "home", "home", [{ layout: "home", requestedLayout: "home", autoDetected: true }]],
  ]);
});

QUnit.test("every request resets the typing context once, a re-selection and a tiered one included", (assert) => {
  const { box, state, resize } = createGoldenHost();
  const resets: number[] = [];
  const count = (): void => {
    resets.push(box.shiftResets);
    box.shiftResets = 0;
  };
  box.shiftResets = 0;

  state.perform("home", "external", "passed to setLayout()");
  count();
  state.perform("home", "external", "passed to setLayout()");
  count();
  resize(true);
  count();
  state.perform("away", "user", "referenced by a {layout:*} key");
  count();

  assert.deepEqual(resets, [1, 1, 1, 1], "a switch, a re-selection, a width swap, a tiered request");
});
