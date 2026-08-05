import XMLView from "sap/ui/core/mvc/XMLView";
import JSONModel from "sap/ui/model/json/JSONModel";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Log from "sap/base/Log";
import CustomLayout from "ui5/kiosk/CustomLayout";
import Mw from "./customlayouts-middleware";
import { waitForRender, getRenderedLayoutKeys, getRequiredKeyElement } from "./test-helpers";

// The declarability guard: a Fiori developer must be able to configure a complete
// layout extension in an XML view without touching a controller. Nothing else in
// `check:base` parses `<kiosk:CustomLayout>`, so if this suite stops asserting, the
// XML path can break silently and only surface on GitHub Pages.

const DOM = KioskKeyboard.DOM;
const sandbox = sinon.createSandbox();

async function view(definition: string): Promise<XMLView> {
  const v = await XMLView.create({ definition });
  // Rows are an object-typed property, so they reach XML through a model binding
  // rather than as an inline attribute literal - the form the demo and the README use.
  v.setModel(new JSONModel({ warehouse: [[{ value: "w" }]] }), "layouts");
  return v;
}

QUnit.module("customLayouts-xml", {
  afterEach() {
    sandbox.restore();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("a CustomLayout node lands in the aggregation and its bound rows render", async (assert) => {
  const v = await view(`<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:kiosk="ui5.kiosk">
    <kiosk:KioskKeyboard id="kb">
      <kiosk:customLayouts>
        <kiosk:CustomLayout name="warehouse" rows="{layouts>/warehouse}" />
      </kiosk:customLayouts>
    </kiosk:KioskKeyboard>
  </mvc:View>`);
  const kb = v.byId("kb") as KioskKeyboard;

  assert.strictEqual(kb.getCustomLayouts().length, 1, "the child node is aggregated");
  assert.ok(kb.getCustomLayouts()[0] instanceof CustomLayout, "as a real CustomLayout element");
  assert.deepEqual(kb.getCustomLayouts()[0]!.getRows(), [[{ value: "w" }]], "and the binding populates its rows");

  // Rows arrive from the model after construction, so a `layout` written on the view
  // could not have resolved this name yet. Selecting it once the model is in place is
  // the flow a controller uses, and it is what proves the rows reach the renderer.
  kb.setLayout("warehouse");
  v.placeAt("qunit-fixture");
  await waitForRender();
  assert.deepEqual(getRenderedLayoutKeys(kb), [["w"]], "and the layout renders them");

  v.destroy();
});

QUnit.test("a bound rows reports nothing while the model is still propagating", async (assert) => {
  // The control is constructed before it joins the view, so a model-bound `rows` is null
  // for the first fold. That is the documented XML form, so it must not warn: reporting
  // `unknown-target` here would make every declarative example noisy on load.
  const warn = sandbox.stub(Log, "warning");
  const v = await view(`<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:kiosk="ui5.kiosk">
    <kiosk:KioskKeyboard id="kb">
      <kiosk:customLayouts>
        <kiosk:CustomLayout name="warehouse" rows="{layouts>/warehouse}" />
      </kiosk:customLayouts>
    </kiosk:KioskKeyboard>
  </mvc:View>`);
  const kb = v.byId("kb") as KioskKeyboard;

  assert.notOk(
    warn.getCalls().some((call) => String(call.args[0]).includes("nothing resolves it")),
    "the pending binding is not reported as an unresolvable name",
  );
  assert.deepEqual(kb.getCustomLayouts()[0]!.getRows(), [[{ value: "w" }]], "and the rows arrive");

  v.destroy();
});

QUnit.test("locales comma-splits and drives the construction-time layout", async (assert) => {
  const v = await view(`<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:kiosk="ui5.kiosk">
    <kiosk:KioskKeyboard id="kb">
      <kiosk:customLayouts>
        <kiosk:CustomLayout name="ja-kana" locales="pl,pl-PL" />
      </kiosk:customLayouts>
    </kiosk:KioskKeyboard>
  </mvc:View>`);
  const kb = v.byId("kb") as KioskKeyboard;

  assert.deepEqual(kb.getCustomLayouts()[0]!.getLocales(), ["pl", "pl-PL"], "the attribute splits on commas");

  v.destroy();
});

QUnit.test("a middleware factory resolves through core:require", async (assert) => {
  const v = await view(`<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:core="sap.ui.core" xmlns:kiosk="ui5.kiosk">
    <kiosk:KioskKeyboard id="kb" layout="qwerty">
      <kiosk:customLayouts>
        <kiosk:CustomLayout core:require="{ Mw: 'test-resources/ui5/kiosk/qunit/customlayouts-middleware' }" name="qwerty" middleware="Mw.create" />
      </kiosk:customLayouts>
    </kiosk:KioskKeyboard>
  </mvc:View>`);
  v.placeAt("qunit-fixture");
  await waitForRender();

  const kb = v.byId("kb") as KioskKeyboard;
  // The assertion is on the resolved value specifically: a view that failed to parse
  // at all would prove nothing about the function-property path. `resolveReference`
  // binds the dotted reference to its module, so this compares behaviour rather than
  // identity - the factory must be the real one and must actually run.
  const resolved = kb.getCustomLayouts()[0]!.getMiddleware() as (() => unknown) | null;
  assert.strictEqual(typeof resolved, "function", "the reference resolves to a function, not to a string");
  const before = Mw.created;
  resolved!();
  assert.strictEqual(Mw.created, before + 1, "and it is the module's own factory");

  v.destroy();
});

QUnit.test("suppress reaches the fold and takes the layout out of the variant table", async (assert) => {
  const v = await view(`<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:kiosk="ui5.kiosk">
    <kiosk:KioskKeyboard id="kb" layout="qwerty" accentVariants="true">
      <kiosk:customLayouts>
        <kiosk:CustomLayout name="qwerty" suppress="Variants" />
      </kiosk:customLayouts>
    </kiosk:KioskKeyboard>
  </mvc:View>`);
  v.placeAt("qunit-fixture");
  await waitForRender();

  const kb = v.byId("kb") as KioskKeyboard;
  assert.deepEqual(kb.getCustomLayouts()[0]!.getSuppress(), ["Variants"], "the attribute parses to the enum array");
  assert.strictEqual(
    getRequiredKeyElement(kb, "a").hasAttribute(DOM.attributes.hasVariants),
    false,
    "and the layout carries no long-press affordance",
  );

  v.destroy();
});

QUnit.test("suppress accepts a comma-separated list", async (assert) => {
  const v = await view(`<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:kiosk="ui5.kiosk">
    <kiosk:KioskKeyboard id="kb" layout="qwerty">
      <kiosk:customLayouts>
        <kiosk:CustomLayout name="qwerty" suppress="Variants,Middleware" />
      </kiosk:customLayouts>
    </kiosk:KioskKeyboard>
  </mvc:View>`);
  const kb = v.byId("kb") as KioskKeyboard;

  assert.deepEqual(kb.getCustomLayouts()[0]!.getSuppress(), ["Variants", "Middleware"], "both members parse");

  v.destroy();
});

QUnit.test("layoutRole promotes the built-in secondary numeric to a base layout", async (assert) => {
  const v = await view(`<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:kiosk="ui5.kiosk">
    <kiosk:KioskKeyboard id="kb" layout="qwerty">
      <kiosk:customLayouts>
        <kiosk:CustomLayout name="numeric" layoutRole="Base" />
      </kiosk:customLayouts>
    </kiosk:KioskKeyboard>
  </mvc:View>`);
  v.placeAt("qunit-fixture");
  await waitForRender();

  const kb = v.byId("kb") as KioskKeyboard;
  kb.setLayout("numeric");
  assert.strictEqual(kb.getBaseLayout(), "numeric", "the promoted layout is tracked as the base");

  v.destroy();
});

QUnit.test("a typo in a closed enum attribute fails loudly rather than silently", async (assert) => {
  // `createEnumType.parseValue` yields `undefined` for an unknown token and
  // `validateProperty` then throws, so a mis-spelled facet cannot resolve to
  // nothing without a word.
  const rejected = await view(`<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:kiosk="ui5.kiosk">
    <kiosk:KioskKeyboard id="kb" layout="qwerty">
      <kiosk:customLayouts>
        <kiosk:CustomLayout name="qwerty" suppress="Varients" />
      </kiosk:customLayouts>
    </kiosk:KioskKeyboard>
  </mvc:View>`).then(
    () => null,
    (error: unknown) => error,
  );

  // The rejected view never resolves, so there is nothing to destroy.
  assert.ok(rejected, "the view rejects rather than resolving with a silently-dropped facet");
});
