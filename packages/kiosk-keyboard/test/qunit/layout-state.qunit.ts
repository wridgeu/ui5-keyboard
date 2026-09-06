import LayoutState from "ui5/kiosk/internal/layout-state";
import { EMPTY_FOLD } from "ui5/kiosk/internal/custom-layout-fold";
import { KeyboardType } from "ui5/kiosk/library";

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
    reapplyAutoCompact: () => {},
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
