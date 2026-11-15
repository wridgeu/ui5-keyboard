import { describe, it, expect } from "vitest";
import { LayoutState } from "../../src/core/layout-state.js";
import { EMPTY_FOLD, foldCustomLayouts } from "../../src/core/custom-layout-fold.js";
import { isBuiltInLayout } from "../../src/core/layout-registry.js";
import type { CustomLayoutSpec, KeyboardType, LayoutChangeEventDetail } from "../../src/types.js";

/** A host over a local layout variable and a keyboardType box, recording every `layout-change`. */
function createHost(attribute = "qwerty", locale = "qwerty") {
  const box = {
    current: "",
    keyboardType: "Full" as `${KeyboardType}`,
    changes: [] as string[],
  };
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
   * state only when it differs from the last one.
   */
  function createGoldenHost() {
    const box = {
      current: "",
      keyboardType: "Full" as `${KeyboardType}`,
      fold: foldCustomLayouts(specs, isBuiltInLayout, () => false),
      changes: [] as LayoutChangeEventDetail[],
      announced: [] as string[],
      shiftResets: 0,
    };
    let applied: boolean | null = null;
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
      resetShiftState: () => {
        box.shiftResets++;
      },
      endComposition: () => {},
      focusAnchor: () => ({ value: null, focused: false }),
      reseatFocusAnchor: () => {},
      announce: (text) => {
        box.announced.push(text);
      },
    });
    const resize = (narrow: boolean): void => {
      if (narrow === applied) return;
      const crossed = applied !== null;
      applied = narrow;
      state.applyTier(narrow, crossed);
    };
    /** What the element's `keyboardType` invalidation does. */
    const setKeyboardType = (type: `${KeyboardType}`): void => {
      box.keyboardType = type;
      state.clearUserOverride();
      state.refresh();
    };
    /** What the fold cache does when a slotted layout arrives. */
    const slot = (spec: CustomLayoutSpec): void => {
      box.fold = foldCustomLayouts([...specs, spec], isBuiltInLayout, () => false);
      state.refresh();
    };
    state.seed();
    resize(false);
    return { box, state, resize, setKeyboardType, slot };
  }

  const COMPACTED = "Switched to the compact keyboard layout";
  const UNCOMPACTED = "Switched back to the standard keyboard layout";

  it("requests, width, keyboardType, user picks and a late counterpart resolve in one sequence", () => {
    const { box, state, resize, setKeyboardType, slot } = createGoldenHost();
    /** Per step: the resolved layout, and the events and announcements since the last step. */
    const trace: unknown[] = [];
    const step = (name: string): void => {
      trace.push([name, state.resolvedName(), box.changes.splice(0), box.announced.splice(0)]);
    };

    state.applyAttribute("home");
    step("request A");
    resize(true);
    step("narrow");
    state.applyKeySwitch("away");
    step("request B while narrow");
    setKeyboardType("Numpad");
    step("Numpad");
    setKeyboardType("Full");
    step("Full");
    resize(false);
    step("widen");
    state.applyKeySwitch("pick");
    step("{layout:pick}");
    state.applyKeySwitch("base");
    step("{layout:base}");
    state.applyAttribute("solo");
    resize(true);
    step("request solo, narrow");
    slot({ name: "solo-c", rows });
    step("solo-c slotted");

    expect(trace).to.deep.equal([
      // The attribute path is silent about what it was asked for.
      ["request A", "home", [], []],
      ["narrow", "home-c", [{ layout: "home-c", requestedLayout: "home", autoDetected: true }], [COMPACTED]],
      // One change, naming the layout that renders, unannounced.
      ["request B while narrow", "away-c", [{ layout: "away-c", requestedLayout: "away", autoDetected: true }], []],
      // The key pick was a user override, which a keyboardType change drops to the
      // base; the constraint wins, and lifting it re-tiers the base.
      ["Numpad", "numpad", [{ layout: "away", requestedLayout: "away", autoDetected: false }], []],
      ["Full", "away-c", [{ layout: "away-c", requestedLayout: "away", autoDetected: true }], []],
      ["widen", "away", [{ layout: "away", requestedLayout: "away", autoDetected: true }], [UNCOMPACTED]],
      ["{layout:pick}", "pick", [{ layout: "pick", requestedLayout: "pick", autoDetected: false }], []],
      ["{layout:base}", "away", [{ layout: "away", requestedLayout: "away", autoDetected: false }], []],
      // solo-c is not registered yet, so the crossing swaps nothing...
      ["request solo, narrow", "solo", [], []],
      // ...and the counterpart arriving applies without a resize, unannounced.
      ["solo-c slotted", "solo-c", [{ layout: "solo-c", requestedLayout: "solo", autoDetected: true }], []],
    ]);
  });

  it("a constraint holds the tiered layout under it until it lifts", () => {
    const { box, state, resize, setKeyboardType } = createGoldenHost();
    state.applyAttribute("home");
    resize(true);
    box.changes.length = 0;
    const trace: unknown[] = [];
    const step = (name: string): void => {
      trace.push([name, state.resolvedName(), box.current, box.changes.splice(0)]);
    };

    setKeyboardType("Numpad");
    step("Numpad while narrow");
    resize(false);
    step("widen under the constraint");
    setKeyboardType("Full");
    step("lift");

    expect(trace).to.deep.equal([
      ["Numpad while narrow", "numpad", "home-c", []],
      ["widen under the constraint", "numpad", "home-c", []],
      ["lift", "home", "home", [{ layout: "home", requestedLayout: "home", autoDetected: true }]],
    ]);
  });

  it("every request resets the typing context once, a re-selection and a tiered one included", () => {
    const { box, state, resize } = createGoldenHost();
    const resets: number[] = [];
    const count = (): void => {
      resets.push(box.shiftResets);
      box.shiftResets = 0;
    };
    box.shiftResets = 0;

    state.applyAttribute("home");
    count();
    state.applyAttribute("home");
    count();
    resize(true);
    count();
    state.applyKeySwitch("away");
    count();

    expect(resets, "a switch, a re-selection, a width swap, a tiered request").to.deep.equal([1, 1, 1, 1]);
  });
});

describe("LayoutState fires layout-change whenever the rendered layout changes", () => {
  const rows = [[{ value: "x" }]];

  /** A host whose fold and keyboardType a test can change under the state. */
  function createRenderHost(attribute: string, specs: CustomLayoutSpec[]) {
    const box = {
      current: "",
      keyboardType: "Full" as `${KeyboardType}`,
      fold: foldCustomLayouts(specs, isBuiltInLayout, () => false),
      changes: [] as LayoutChangeEventDetail[],
    };
    const state = new LayoutState({
      getCurrentLayout: () => box.current,
      setCurrentLayout: (name) => {
        box.current = name;
      },
      getLayoutAttribute: () => attribute,
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
      announce: () => {},
    });
    state.seed();
    /** What the fold cache does when the slot changes. */
    const slot = (next: CustomLayoutSpec[]): void => {
      box.fold = foldCustomLayouts(next, isBuiltInLayout, () => false);
      state.refresh();
    };
    /** What the element's `keyboardType` invalidation does. */
    const setKeyboardType = (type: `${KeyboardType}`): void => {
      box.keyboardType = type;
      state.clearUserOverride();
      state.refresh();
    };
    return { box, state, slot, setKeyboardType };
  }

  it("a requested layout slotted after the request fires once, naming it", () => {
    const { box, state, slot } = createRenderHost("late1", []);
    expect(state.resolvedName(), "precondition: the fallback renders").to.equal("qwerty");

    slot([{ name: "late1", rows }]);
    expect(state.resolvedName()).to.equal("late1");
    expect(box.changes).to.deep.equal([{ layout: "late1", requestedLayout: "late1", autoDetected: true }]);
  });

  it("removing the requested layout from the slot fires once, naming the fallback", () => {
    const { box, state, slot } = createRenderHost("late1", [{ name: "late1", rows }]);
    expect(state.resolvedName(), "precondition: the slotted layout renders").to.equal("late1");

    slot([]);
    expect(state.resolvedName()).to.equal("qwerty");
    expect(box.changes).to.deep.equal([{ layout: "qwerty", requestedLayout: "late1", autoDetected: true }]);
  });

  it("a keyboardType constraint taking effect and lifting each fire once", () => {
    const { box, state, setKeyboardType } = createRenderHost("qwertz-de", []);

    setKeyboardType("Numeric");
    expect(state.resolvedName()).to.equal("numeric");
    setKeyboardType("Full");
    expect(state.resolvedName()).to.equal("qwertz-de");
    expect(box.changes).to.deep.equal([
      { layout: "numeric", requestedLayout: "qwertz-de", autoDetected: true },
      { layout: "qwertz-de", requestedLayout: "qwertz-de", autoDetected: true },
    ]);
  });

  it("an unregistered request that leaves the same layout on screen fires nothing", () => {
    const { box, state } = createRenderHost("qwerty", []);
    state.applyAttribute("late1");
    expect(state.resolvedName(), "precondition: the fallback still renders").to.equal("qwerty");
    expect(box.changes).to.deep.equal([]);
  });
});
