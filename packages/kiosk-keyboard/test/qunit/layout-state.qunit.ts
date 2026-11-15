import LayoutState from "ui5/kiosk/internal/layout-state";
import { EMPTY_FOLD, foldCustomLayouts } from "ui5/kiosk/internal/custom-layout-fold";
import { isBuiltInLayout } from "ui5/kiosk/internal/layout-registry";
import { KeyboardType, LayoutChangeReason } from "ui5/kiosk/library";
import type { CustomLayoutSpec } from "ui5/kiosk/types";

interface Change {
  layout: string;
  effectiveLayout: string;
  reason: LayoutChangeReason;
}

const { User, Api, Width, KeyboardTypeChange: Type, Layouts } = LayoutChangeReason;

/** A host over a local `layout` variable and a keyboardType box, recording every `layoutChange`. */
function createHost() {
  const box = { layout: "qwerty", keyboardType: KeyboardType.Full, changes: [] as Change[] };
  const state = new LayoutState({
    getLayout: () => box.layout,
    setLayoutProperty: (name) => {
      box.layout = name;
    },
    invalidate: () => {},
    getKeyboardType: () => box.keyboardType,
    getFold: () => EMPTY_FOLD,
    fireLayoutChange: (p) => {
      box.changes.push(p);
    },
    resetShiftState: () => {},
    cancelPress: () => {},
    endComposition: () => {},
    focusAnchorValue: () => null,
    reseatFocusAnchor: () => {},
  });
  state.seed("qwerty");
  return { box, state };
}

QUnit.module("LayoutState.clearUserOverride");

QUnit.test("a user pick of a primary layout still returns to the base under the constraint", (assert) => {
  const { box, state } = createHost();
  state.perform("qwertz-de", "user", "referenced by a {layout:*} key", User);
  assert.strictEqual(box.layout, "qwertz-de", "precondition: the user pick landed as the intent");

  box.keyboardType = KeyboardType.Numpad;
  state.clearUserOverride(Type);
  assert.strictEqual(state.resolvedName(), "numpad", "the constraint pins the surface");
  assert.deepEqual(box.changes, [
    { layout: "qwertz-de", effectiveLayout: "qwertz-de", reason: User },
    { layout: "qwertz-de", effectiveLayout: "numpad", reason: Type },
  ]);
});

QUnit.test("clearUserOverride leaves a programmatic layout alone", (assert) => {
  const { box, state } = createHost();
  state.perform("numeric", "external", "passed to setLayout()", Api);
  state.clearUserOverride(Type);
  assert.strictEqual(box.layout, "numeric", "the app asked for a secondary layout, which is the intent");
  assert.strictEqual(state.resolvedName(), "numeric", "and still resolves");
});

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
    invalidate: () => {},
    getKeyboardType: () => box.keyboardType,
    getFold: () => box.fold,
    fireLayoutChange: (p) => {
      box.changes.push(p);
    },
    resetShiftState: () => {
      box.shiftResets++;
    },
    cancelPress: () => {},
    endComposition: () => {},
    focusAnchorValue: () => null,
    reseatFocusAnchor: () => {},
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
    state.clearUserOverride(Type);
    state.refresh(Type);
  };
  /** What the fold cache does when the declared layouts change. */
  const declare = (specs: CustomLayoutSpec[]): void => {
    box.fold = foldCustomLayouts(specs, isBuiltInLayout, () => false);
    state.refresh(Layouts);
  };
  state.seed("qwerty");
  resize(false);
  return { box, state, resize, setKeyboardType, declare };
}

const COMPACTED = "Switched to the compact keyboard layout";
const UNCOMPACTED = "Switched back to the standard keyboard layout";

QUnit.module("LayoutState golden sequence");

QUnit.test("the intent, the effective layout and one event per change, through every input", (assert) => {
  const { box, state, resize, setKeyboardType, declare } = createGoldenHost();
  /**
   * Per step: the `layout` property (intent), the effective layout, the events since
   * the last step, and the announcement a render would take now.
   */
  const trace: unknown[] = [];
  const step = (name: string): void => {
    trace.push([name, box.layout, state.resolvedName(), box.changes.splice(0), state.takePendingAnnouncement()]);
  };
  const key = (name: string): void => {
    const base = name === "base";
    state.perform(base ? state.getBaseLayout() : name, base ? "external" : "user", "by a key", User);
  };

  state.perform("home", "external", "passed to setLayout()", Api);
  step("api home");
  resize(true);
  // No step here: a request arriving before the render is what retracts the text.
  const narrowed = [box.layout, state.resolvedName(), box.changes.splice(0)];
  key("away");
  step("{layout:away} while narrow");
  setKeyboardType(KeyboardType.Numpad);
  step("Numpad");
  setKeyboardType(KeyboardType.Full);
  step("Full");
  resize(false);
  step("widen");
  key("pick");
  step("{layout:pick}");
  state.perform(state.getBaseLayout(), "external", "held as the base layout", Api);
  step("resetLayout");
  key("pick");
  key("base");
  step("{layout:pick}, {layout:base}");
  state.perform("solo", "external", "passed to setLayout()", Api);
  resize(true);
  step("api solo, narrow");
  declare([...goldenSpecs, { name: "solo-c", rows }]);
  step("solo-c declared");
  declare(goldenSpecs.filter((spec) => spec.name !== "solo"));
  step("solo and solo-c removed");

  assert.deepEqual(
    [narrowed, trace],
    [
      ["home", "home-c", [{ layout: "home", effectiveLayout: "home-c", reason: Width }]],
      [
        ["api home", "home", "home", [{ layout: "home", effectiveLayout: "home", reason: Api }], null],
        // A primary pick is the user's intent; both change, one event. The pick
        // retracts the narrowing's pending text.
        [
          "{layout:away} while narrow",
          "away",
          "away-c",
          [{ layout: "away", effectiveLayout: "away-c", reason: User }],
          null,
        ],
        // The constraint pins the surface without touching the intent; lifting it
        // re-tiers the intent.
        ["Numpad", "away", "numpad", [{ layout: "away", effectiveLayout: "numpad", reason: Type }], null],
        ["Full", "away", "away-c", [{ layout: "away", effectiveLayout: "away-c", reason: Type }], null],
        ["widen", "away", "away", [{ layout: "away", effectiveLayout: "away", reason: Width }], UNCOMPACTED],
        // A secondary pick changes only what renders.
        ["{layout:pick}", "away", "pick", [{ layout: "away", effectiveLayout: "pick", reason: User }], null],
        ["resetLayout", "away", "away", [{ layout: "away", effectiveLayout: "away", reason: Api }], null],
        [
          "{layout:pick}, {layout:base}",
          "away",
          "away",
          [
            { layout: "away", effectiveLayout: "pick", reason: User },
            { layout: "away", effectiveLayout: "away", reason: User },
          ],
          null,
        ],
        // solo-c is not declared yet, so the crossing swaps nothing...
        ["api solo, narrow", "solo", "solo", [{ layout: "solo", effectiveLayout: "solo", reason: Api }], null],
        // ...and the counterpart arriving applies without a resize, unannounced.
        ["solo-c declared", "solo", "solo-c", [{ layout: "solo", effectiveLayout: "solo-c", reason: Layouts }], null],
        // The intent outlives its layout; the registry fallback renders.
        [
          "solo and solo-c removed",
          "solo",
          "qwerty",
          [{ layout: "solo", effectiveLayout: "qwerty", reason: Layouts }],
          null,
        ],
      ],
    ],
  );
});

QUnit.test("a width crossing holds its announcement until it is taken", (assert) => {
  const { state, resize } = createGoldenHost();
  state.perform("home", "external", "passed to setLayout()", Api);
  resize(true);
  assert.deepEqual([state.takePendingAnnouncement(), state.takePendingAnnouncement()], [COMPACTED, null]);
});

QUnit.test("a constraint holds the tiered layout under it until it lifts", (assert) => {
  const { box, state, resize, setKeyboardType } = createGoldenHost();
  state.perform("home", "external", "passed to setLayout()", Api);
  resize(true);
  box.changes.length = 0;
  const trace: unknown[] = [];
  const step = (name: string): void => {
    trace.push([name, box.layout, state.resolvedName(), box.changes.splice(0)]);
  };

  setKeyboardType(KeyboardType.Numpad);
  step("Numpad while narrow");
  resize(false);
  step("widen under the constraint");
  setKeyboardType(KeyboardType.Full);
  step("lift");

  assert.deepEqual(trace, [
    ["Numpad while narrow", "home", "numpad", [{ layout: "home", effectiveLayout: "numpad", reason: Type }]],
    ["widen under the constraint", "home", "numpad", []],
    ["lift", "home", "home", [{ layout: "home", effectiveLayout: "home", reason: Type }]],
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

  state.perform("home", "external", "passed to setLayout()", Api);
  count();
  state.perform("home", "external", "passed to setLayout()", Api);
  count();
  resize(true);
  count();
  state.perform("away", "user", "referenced by a {layout:*} key", User);
  count();

  assert.deepEqual(resets, [1, 1, 1, 1], "a switch, a re-selection, a width swap, a tiered request");
});
