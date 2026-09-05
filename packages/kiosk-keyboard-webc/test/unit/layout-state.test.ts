import { describe, it, expect } from "vitest";
import { LayoutState } from "../../src/core/layout-state.js";
import { EMPTY_FOLD } from "../../src/core/custom-layout-fold.js";
import type { KeyboardType } from "../../src/types.js";

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
    const { box, state } = createHost();
    state.applyKeySwitch("numeric");
    expect(box.current, "precondition: the user pick landed").to.equal("numeric");

    box.keyboardType = "Numpad";
    state.clearUserOverride();
    expect(state.resolvedName(), "the constraint pins the surface").to.equal("numpad");

    box.keyboardType = "Full";
    expect(state.resolvedName(), "the lifted constraint lands on the base").to.equal("qwerty");
    expect(box.changes).to.deep.equal(["numeric", "qwerty"]);
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
