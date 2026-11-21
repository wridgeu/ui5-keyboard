import { describe, it, expect } from "vitest";
import { LayoutState } from "../../src/core/layout-state.js";
import { EMPTY_FOLD, foldCustomLayouts, type CustomLayoutFold } from "../../src/core/custom-layout-fold.js";
import { isBuiltInLayout } from "../../src/core/layout-registry.js";
import type { CustomLayoutSpec, KeyboardType, LayoutChangeEventDetail } from "../../src/types.js";

/** Rows are irrelevant here: only the names, counterparts and roles are read. */
const rows = [[{ value: "x" }]];

/**
 * A host over a local layout attribute, fold and keyboardType box, recording every
 * `layout-change`. Writing the attribute re-enters `applyAttribute` the way the
 * element's invalidation does.
 */
function createHost(attribute = "qwerty", locale = "qwerty", fold: CustomLayoutFold = EMPTY_FOLD) {
  const box = {
    attribute,
    current: "",
    keyboardType: "Full" as `${KeyboardType}`,
    autoCompact: true,
    fold,
    changes: [] as LayoutChangeEventDetail[],
    announced: [] as string[],
    shiftResets: 0,
    /** The switch effects other than the shift reset, in call order. */
    effects: [] as string[],
  };
  const state: LayoutState = new LayoutState({
    getCurrentLayout: () => box.current,
    setCurrentLayout: (name) => {
      box.current = name;
    },
    getLayoutAttribute: () => box.attribute,
    setLayoutAttribute: (name) => {
      box.attribute = name;
      state.applyAttribute(name);
    },
    getLocaleLayout: () => locale,
    getKeyboardType: () => box.keyboardType,
    isAutoCompactEnabled: () => box.autoCompact,
    getFold: () => box.fold,
    fireLayoutChange: (p) => {
      box.changes.push(p);
    },
    resetShiftState: () => {
      box.shiftResets++;
    },
    cancelPress: () => {
      box.effects.push("cancelPress");
    },
    endComposition: () => {
      box.effects.push("endComposition");
    },
    focusAnchor: () => ({ value: null, focused: false }),
    reseatFocusAnchor: () => {
      box.effects.push("reseatFocusAnchor");
    },
    announce: (text) => {
      box.announced.push(text);
    },
  });
  state.seed();
  /** What an app setting the `layout` property does. */
  const setAttribute = (name: string): void => {
    box.attribute = name;
    state.applyAttribute(name);
  };
  /** What the element's `keyboardType` invalidation does. */
  const setKeyboardType = (type: `${KeyboardType}`): void => {
    box.keyboardType = type;
    state.clearUserOverride("keyboardType");
    state.refresh("keyboardType");
  };
  /** What the fold cache does when the slot changes. */
  const slot = (specs: CustomLayoutSpec[]): void => {
    box.fold = foldCustomLayouts(specs, isBuiltInLayout, () => false);
    state.refresh("layouts");
  };
  return { box, state, setAttribute, setKeyboardType, slot };
}

describe("LayoutState.clearUserOverride", () => {
  it("a keyboardType round-trip lands on the base, not on the user pick", () => {
    const { box, state, setKeyboardType } = createHost("qwertz-de", "qwerty");
    state.applyKeySwitch("numeric");
    expect(box.current, "precondition: the user pick landed").to.equal("numeric");

    setKeyboardType("Numpad");
    expect(state.resolvedName(), "the constraint pins the surface").to.equal("numpad");
    setKeyboardType("Full");
    expect(state.resolvedName(), "the lifted constraint lands on the base").to.equal("qwertz-de");
    expect(box.changes).to.deep.equal([
      { layout: "qwertz-de", effectiveLayout: "numeric", reason: "user" },
      { layout: "qwertz-de", effectiveLayout: "numpad", reason: "keyboardType" },
      { layout: "qwertz-de", effectiveLayout: "qwertz-de", reason: "keyboardType" },
    ]);
  });

  it("a user pick of a primary layout still returns to the base under the constraint", () => {
    const { box, state, setKeyboardType } = createHost();
    state.applyKeySwitch("qwertz-de");
    expect(box.current, "precondition: the user pick landed").to.equal("qwertz-de");

    setKeyboardType("Numpad");
    expect(state.resolvedName(), "the constraint pins the surface").to.equal("numpad");
    expect(box.changes).to.deep.equal([
      { layout: "qwertz-de", effectiveLayout: "qwertz-de", reason: "user" },
      { layout: "qwertz-de", effectiveLayout: "numpad", reason: "keyboardType" },
    ]);
  });

  it("clearUserOverride leaves a programmatic layout alone", () => {
    const { box, state, setAttribute } = createHost();
    setAttribute("numeric");
    state.clearUserOverride("keyboardType");
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
    expect(box.changes, "exactly one change, naming both layouts").to.deep.equal([
      { layout: "qwertz-de", effectiveLayout: "qwertz-de", reason: "user" },
    ]);
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

describe("LayoutState intent", () => {
  it("a primary pick is written back to the attribute; a secondary pick is not", () => {
    const { box, state } = createHost("", "qwerty");
    state.applyKeySwitch("numeric");
    expect(box.attribute, "a secondary pick leaves the attribute unset").to.equal("");
    state.applyKeySwitch("qwertz-de");
    expect(box.attribute, "a primary pick reflects").to.equal("qwertz-de");
    expect(box.changes).to.deep.equal([
      { layout: "qwerty", effectiveLayout: "numeric", reason: "user" },
      { layout: "qwertz-de", effectiveLayout: "qwertz-de", reason: "user" },
    ]);
  });

  it("setting the attribute to the intent it holds keeps a secondary pick; reset drops it", () => {
    const { box, state, setAttribute } = createHost("qwertz-de", "qwerty");
    state.applyKeySwitch("numeric");
    setAttribute("qwertz-de");
    expect(state.resolvedName(), "the same value is a no-op").to.equal("numeric");
    state.resetToBase();
    expect(state.resolvedName()).to.equal("qwertz-de");
    expect(box.changes).to.deep.equal([
      { layout: "qwertz-de", effectiveLayout: "numeric", reason: "user" },
      { layout: "qwertz-de", effectiveLayout: "qwertz-de", reason: "api" },
    ]);
  });
});

describe("LayoutState golden sequence", () => {
  const specs: CustomLayoutSpec[] = [
    { name: "home", rows, compact: "home-c" },
    { name: "home-c", rows },
    { name: "away", rows, compact: "away-c" },
    { name: "away-c", rows },
    { name: "pick", rows, secondary: true },
    { name: "solo", rows, compact: "solo-c" },
  ];

  /** A host whose width tier reports a verdict the way `AutoCompactController` does. */
  function createGoldenHost() {
    const host = createHost(
      "qwerty",
      "qwerty",
      foldCustomLayouts(specs, isBuiltInLayout, () => false),
    );
    const resize = (narrow: boolean): void => host.state.applyTier(narrow);
    resize(false);
    return { ...host, resize };
  }

  it("a narrow verdict resolves to no counterpart while autoCompact is off", () => {
    const { box, state, resize, setAttribute } = createGoldenHost();
    setAttribute("home");
    resize(true);
    expect(state.resolvedName(), "precondition: tiered").toBe("home-c");

    box.autoCompact = false;
    state.refresh("layouts");
    expect(state.resolvedName()).toBe("home");
  });

  it("announces a crossing, not a first verdict after none", () => {
    const { box, state, resize, setAttribute } = createGoldenHost();
    setAttribute("home");

    state.applyTier(null);
    resize(true);
    expect(box.announced, "a first verdict after none crossed nothing").toEqual([]);
    resize(false);
    expect(box.announced).toEqual(["Switched back to the standard keyboard layout"]);
  });

  const COMPACTED = "Switched to the compact keyboard layout";
  const UNCOMPACTED = "Switched back to the standard keyboard layout";

  it("the intent, the effective layout and one event per change, through every input", () => {
    const { box, state, resize, setAttribute, setKeyboardType, slot } = createGoldenHost();
    /** Per step: the attribute (intent), the effective layout, and the events and announcements since the last step. */
    const trace: unknown[] = [];
    const step = (name: string): void => {
      trace.push([name, box.attribute, state.resolvedName(), box.changes.splice(0), box.announced.splice(0)]);
    };

    setAttribute("home");
    step("api home");
    resize(true);
    step("narrow");
    state.applyKeySwitch("away");
    step("{layout:away} while narrow");
    setKeyboardType("Numpad");
    step("Numpad");
    setKeyboardType("Full");
    step("Full");
    resize(false);
    step("widen");
    state.applyKeySwitch("pick");
    step("{layout:pick}");
    state.resetToBase();
    step("reset");
    state.applyKeySwitch("pick");
    state.applyKeySwitch("base");
    step("{layout:pick}, {layout:base}");
    setAttribute("solo");
    resize(true);
    step("api solo, narrow");
    slot([...specs, { name: "solo-c", rows }]);
    step("solo-c slotted");
    slot(specs.filter((spec) => spec.name !== "solo"));
    step("solo and solo-c removed");

    expect(trace).to.deep.equal([
      ["api home", "home", "home", [{ layout: "home", effectiveLayout: "home", reason: "api" }], []],
      ["narrow", "home", "home-c", [{ layout: "home", effectiveLayout: "home-c", reason: "width" }], [COMPACTED]],
      // A primary pick is the user's intent, reflected; both change, one event.
      [
        "{layout:away} while narrow",
        "away",
        "away-c",
        [{ layout: "away", effectiveLayout: "away-c", reason: "user" }],
        [],
      ],
      // The constraint pins the surface without touching the intent; lifting it
      // re-tiers the intent.
      ["Numpad", "away", "numpad", [{ layout: "away", effectiveLayout: "numpad", reason: "keyboardType" }], []],
      ["Full", "away", "away-c", [{ layout: "away", effectiveLayout: "away-c", reason: "keyboardType" }], []],
      ["widen", "away", "away", [{ layout: "away", effectiveLayout: "away", reason: "width" }], [UNCOMPACTED]],
      // A secondary pick changes only what renders.
      ["{layout:pick}", "away", "pick", [{ layout: "away", effectiveLayout: "pick", reason: "user" }], []],
      ["reset", "away", "away", [{ layout: "away", effectiveLayout: "away", reason: "api" }], []],
      [
        "{layout:pick}, {layout:base}",
        "away",
        "away",
        [
          { layout: "away", effectiveLayout: "pick", reason: "user" },
          { layout: "away", effectiveLayout: "away", reason: "user" },
        ],
        [],
      ],
      // solo-c is not registered yet, so the crossing swaps nothing...
      ["api solo, narrow", "solo", "solo", [{ layout: "solo", effectiveLayout: "solo", reason: "api" }], []],
      // ...and the counterpart arriving applies without a resize, unannounced.
      ["solo-c slotted", "solo", "solo-c", [{ layout: "solo", effectiveLayout: "solo-c", reason: "layouts" }], []],
      // The intent outlives its layout; the registry fallback renders.
      [
        "solo and solo-c removed",
        "solo",
        "qwerty",
        [{ layout: "solo", effectiveLayout: "qwerty", reason: "layouts" }],
        [],
      ],
    ]);
  });

  it("a constraint holds the tiered layout under it until it lifts", () => {
    const { box, state, resize, setAttribute, setKeyboardType } = createGoldenHost();
    setAttribute("home");
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
      [
        "Numpad while narrow",
        "numpad",
        "home-c",
        [{ layout: "home", effectiveLayout: "numpad", reason: "keyboardType" }],
      ],
      ["widen under the constraint", "numpad", "home-c", []],
      ["lift", "home", "home", [{ layout: "home", effectiveLayout: "home", reason: "keyboardType" }]],
    ]);
  });

  it("every request resets the typing context once, a re-selection and a tiered one included", () => {
    const { box, state, resize, setAttribute } = createGoldenHost();
    const resets: number[] = [];
    const count = (): void => {
      resets.push(box.shiftResets);
      box.shiftResets = 0;
    };
    box.shiftResets = 0;

    setAttribute("home");
    count();
    state.applyKeySwitch("home");
    count();
    resize(true);
    count();
    state.applyKeySwitch("away");
    count();

    expect(resets, "a switch, a re-selection, a width swap, a tiered request").to.deep.equal([1, 1, 1, 1]);
  });
});

describe("LayoutState reports what the slot changes", () => {
  it("a requested layout slotted after the request fires once, naming it", () => {
    const { box, state, slot } = createHost("late1");
    expect(state.resolvedName(), "precondition: the fallback renders").to.equal("qwerty");

    slot([{ name: "late1", rows }]);
    expect(state.resolvedName()).to.equal("late1");
    expect(box.changes).to.deep.equal([{ layout: "late1", effectiveLayout: "late1", reason: "layouts" }]);
  });

  it("removing the requested layout from the slot fires once, naming the fallback", () => {
    const { box, state, slot } = createHost(
      "late1",
      "qwerty",
      foldCustomLayouts([{ name: "late1", rows }], isBuiltInLayout, () => false),
    );
    expect(state.resolvedName(), "precondition: the slotted layout renders").to.equal("late1");

    slot([]);
    expect(state.resolvedName()).to.equal("qwerty");
    expect(box.changes).to.deep.equal([{ layout: "late1", effectiveLayout: "qwerty", reason: "layouts" }]);
  });

  it("a slot change that moves the effective layout applies every switch effect once", () => {
    const { box, slot, setKeyboardType } = createHost(
      "late1",
      "qwerty",
      foldCustomLayouts([{ name: "late1", rows }], isBuiltInLayout, () => false),
    );
    const effects: [string, string[], number][] = [];
    const step = (label: string): void => {
      effects.push([label, box.effects, box.shiftResets]);
      box.effects = [];
      box.shiftResets = 0;
    };
    box.shiftResets = 0;

    slot([]);
    step("removed");
    slot([{ name: "late1", rows }]);
    step("slotted again");
    setKeyboardType("Numpad");
    step("constraint on");
    slot([]);
    step("removed under the constraint");

    const all = ["cancelPress", "endComposition", "reseatFocusAnchor"];
    expect(effects).to.deep.equal([
      ["removed", all, 1],
      ["slotted again", all, 1],
      ["constraint on", all, 1],
      ["removed under the constraint", [], 0],
    ]);
  });

  it("an unregistered request holds its report for the render pass, then names the fallback", () => {
    const { box, state, setAttribute } = createHost("qwertz-de");
    setAttribute("late1");
    expect(box.changes, "the fold may still be filling at request time").to.deep.equal([]);
    state.settle();
    expect(box.changes).to.deep.equal([{ layout: "late1", effectiveLayout: "qwerty", reason: "api" }]);
  });

  it("a request slotted before the render pass reports once, as asked", () => {
    const { box, state, setAttribute } = createHost("qwertz-de");
    setAttribute("late1");
    box.fold = foldCustomLayouts([{ name: "late1", rows }], isBuiltInLayout, () => false);
    state.refresh("layouts");
    state.settle();
    expect(state.resolvedName(), "precondition: the slotted layout renders").to.equal("late1");
    expect(box.changes).to.deep.equal([{ layout: "late1", effectiveLayout: "late1", reason: "api" }]);
  });
});
