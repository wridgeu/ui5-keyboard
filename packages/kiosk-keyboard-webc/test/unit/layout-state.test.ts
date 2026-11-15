import { describe, it, expect } from "vitest";
import { LayoutState } from "../../src/core/layout-state.js";
import { EMPTY_FOLD, foldCustomLayouts } from "../../src/core/custom-layout-fold.js";
import { isBuiltInLayout } from "../../src/core/layout-registry.js";
import type { CustomLayoutSpec, KeyboardType, LayoutChangeEventDetail } from "../../src/types.js";

/** A host over a local layout variable and a keyboardType box, recording every `layout-change`. */
function createHost(attribute = "qwerty", locale = "qwerty") {
  const box = { current: "", keyboardType: "Full" as `${KeyboardType}`, changes: [] as string[] };
  const state = new LayoutState({
    getCurrentLayout: () => box.current,
    setCurrentLayout: (name) => {
      box.current = name;
    },
    getLayoutAttribute: () => attribute,
    getLocaleLayout: () => locale,
    getKeyboardType: () => box.keyboardType,
    getFold: () => EMPTY_FOLD,
    fireLayoutChange: (p) => {
      box.changes.push(p.layout);
    },
    resetShiftState: () => {},
    endComposition: () => {},
    focusAnchor: () => ({ value: null, focused: false }),
    reseatFocusAnchor: () => {},
    reapplyAutoCompact: () => {},
    announce: () => {},
  });
  state.seed();
  return { box, state };
}

describe("LayoutState.clearUserOverride", () => {
  it("a keyboardType round-trip lands on the base, not on the user pick", () => {
    const { box, state } = createHost("qwertz-de", "qwerty");
    state.applyKeySwitch("numeric");
    expect(box.current, "precondition: the user pick landed").to.equal("numeric");

    box.keyboardType = "Numpad";
    state.clearUserOverride();
    expect(state.resolvedName(), "the constraint pins the surface").to.equal("numpad");

    box.keyboardType = "Full";
    expect(state.resolvedName(), "the lifted constraint lands on the base").to.equal("qwertz-de");
    expect(box.changes).to.deep.equal(["numeric", "qwertz-de"]);
  });

  it("a user pick of a primary layout still returns to the base under the constraint", () => {
    const { box, state } = createHost();
    state.applyKeySwitch("qwertz-de");
    expect(box.current, "precondition: the user pick landed").to.equal("qwertz-de");

    box.keyboardType = "Numpad";
    state.clearUserOverride();
    expect(state.resolvedName(), "the constraint pins the surface").to.equal("numpad");
    expect(box.changes).to.deep.equal(["qwertz-de"]);
  });

  it("clearUserOverride leaves a programmatic layout alone", () => {
    const { box, state } = createHost();
    state.applyAttribute("numeric");
    state.clearUserOverride();
    expect(box.current).to.equal("numeric");
    expect(state.resolvedName()).to.equal("numeric");
  });
});

describe("LayoutState.seed", () => {
  it("a secondary `layout` attribute renders but does not become the base", () => {
    const { box, state } = createHost("fkeys", "qwertz-de");
    expect(box.current, "the authored secondary layout is the one on screen").to.equal("fkeys");

    state.applyKeySwitch("base");
    expect(box.current, "{layout:base} lands on the alphabetic locale layout").to.equal("qwertz-de");
    expect(box.changes, "exactly one change, naming the layout switched to").to.deep.equal(["qwertz-de"]);
  });

  it("a primary `layout` attribute is the base", () => {
    const { box, state } = createHost("qwertz-de", "qwerty");
    state.applyKeySwitch("numeric");
    state.applyKeySwitch("base");
    expect(box.current, "{layout:base} returns to the authored layout").to.equal("qwertz-de");
  });

  it("the first {layout:base} tap on the authored layout announces no change", () => {
    const { box, state } = createHost("qwertz-de", "qwerty");
    state.applyKeySwitch("base");
    expect(box.current, "the surface stays on the authored layout").to.equal("qwertz-de");
    expect(box.changes, "a non-switch fires nothing").to.deep.equal([]);
  });
});

describe("LayoutState golden sequence", () => {
  /** Rows are irrelevant here: only the names, counterparts and roles are read. */
  const rows = [[{ value: "x" }]];
  const specs: CustomLayoutSpec[] = [
    { name: "home", rows, compact: "home-c" },
    { name: "home-c", rows },
    { name: "away", rows, compact: "away-c" },
    { name: "away-c", rows },
    { name: "pick", rows, secondary: true },
    { name: "solo", rows, compact: "solo-c" },
  ];

  /**
   * A host whose width tier behaves like `AutoCompactController`: a verdict reaches the
   * state only when it differs from the cached one, and a reapply drops the cache and
   * waits for the next frame.
   */
  function createGoldenHost() {
    const box = {
      current: "",
      keyboardType: "Full" as `${KeyboardType}`,
      fold: foldCustomLayouts(specs, isBuiltInLayout, () => false),
      changes: [] as LayoutChangeEventDetail[],
      announced: [] as string[],
    };
    let narrow = false;
    let applied: boolean | null = null;
    let scheduled = false;
    const reapply = (): void => {
      applied = null;
      scheduled = true;
    };
    const state = new LayoutState({
      getCurrentLayout: () => box.current,
      setCurrentLayout: (name) => {
        box.current = name;
      },
      getLayoutAttribute: () => "qwerty",
      getLocaleLayout: () => "qwerty",
      getKeyboardType: () => box.keyboardType,
      getFold: () => box.fold,
      fireLayoutChange: (p) => {
        box.changes.push(p);
      },
      resetShiftState: () => {},
      endComposition: () => {},
      focusAnchor: () => ({ value: null, focused: false }),
      reseatFocusAnchor: () => {},
      reapplyAutoCompact: reapply,
      announce: (text) => {
        box.announced.push(text);
      },
    });
    /** The frame the controller applies a scheduled verdict from. */
    const frame = (): void => {
      if (!scheduled) return;
      scheduled = false;
      if (narrow === applied) return;
      const crossed = applied !== null;
      applied = narrow;
      state.applyTier(narrow, crossed);
    };
    const resize = (next: boolean): void => {
      narrow = next;
      scheduled = true;
      frame();
    };
    /** What the element's `keyboardType` invalidation does. */
    const setKeyboardType = (type: `${KeyboardType}`): void => {
      box.keyboardType = type;
      state.clearUserOverride();
      reapply();
      frame();
    };
    /** What the fold cache does when a slotted layout arrives. */
    const slot = (spec: CustomLayoutSpec): void => {
      box.fold = foldCustomLayouts([...specs, spec], isBuiltInLayout, () => false);
      reapply();
      frame();
    };
    state.seed();
    resize(false);
    return { box, state, frame, resize, setKeyboardType, slot };
  }

  const COMPACTED = "Switched to the compact keyboard layout";
  const UNCOMPACTED = "Switched back to the standard keyboard layout";

  it("requests, width, keyboardType, user picks and a late counterpart resolve in one sequence", () => {
    const { box, state, frame, resize, setKeyboardType, slot } = createGoldenHost();
    /** Per step: the resolved layout, and the events and announcements since the last step. */
    const trace: unknown[] = [];
    const step = (name: string): void => {
      trace.push([name, state.resolvedName(), box.changes.splice(0), box.announced.splice(0)]);
    };

    state.applyAttribute("home");
    frame();
    step("request A");
    resize(true);
    step("narrow");
    state.applyKeySwitch("away");
    step("request B while narrow");
    frame();
    step("its tier frame");
    setKeyboardType("Numpad");
    step("Numpad");
    setKeyboardType("Full");
    step("Full");
    resize(false);
    step("widen");
    state.applyKeySwitch("pick");
    frame();
    step("{layout:pick}");
    state.applyKeySwitch("base");
    frame();
    step("{layout:base}");
    state.applyAttribute("solo");
    frame();
    resize(true);
    step("request solo, narrow");
    slot({ name: "solo-c", rows });
    step("solo-c slotted");

    expect(trace).to.deep.equal([
      // The attribute path applies silently.
      ["request A", "home", [], []],
      ["narrow", "home-c", [{ layout: "home-c", autoDetected: true }], [COMPACTED]],
      // The request lands first, then the tier frame resolves against it, unannounced.
      ["request B while narrow", "away", [{ layout: "away", autoDetected: false }], []],
      ["its tier frame", "away-c", [{ layout: "away-c", autoDetected: true }], []],
      // The key pick was a user override, which a keyboardType change drops to the
      // base; the constraint wins, and lifting it re-tiers the base.
      ["Numpad", "numpad", [{ layout: "away", autoDetected: false }], []],
      ["Full", "away-c", [{ layout: "away-c", autoDetected: true }], []],
      ["widen", "away", [{ layout: "away", autoDetected: true }], [UNCOMPACTED]],
      ["{layout:pick}", "pick", [{ layout: "pick", autoDetected: false }], []],
      ["{layout:base}", "away", [{ layout: "away", autoDetected: false }], []],
      // solo-c is not registered yet, so the crossing swaps nothing...
      ["request solo, narrow", "solo", [], []],
      // ...and the counterpart arriving applies without a resize, unannounced.
      ["solo-c slotted", "solo-c", [{ layout: "solo-c", autoDetected: true }], []],
    ]);
  });
});
