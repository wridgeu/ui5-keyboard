import {
  configureI18n,
  resetI18nConfiguration,
  setI18nOverrideHook,
  clearI18nOverrideHook,
  getText,
  reloadBundles,
} from "ui5/kiosk/i18n-registry";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Lib from "sap/ui/core/Lib";
import Log from "sap/base/Log";
import { placeAndWait, waitForRender } from "./test-helpers";

// ─── Helpers ─────────────────────────────────────

const sandbox = sinon.createSandbox();

function commonAfterEach() {
  sandbox.restore();
  resetI18nConfiguration();
  clearI18nOverrideHook();
}

function makeBundleStub(texts: Record<string, string>): ResourceBundle {
  return {
    getText(key: string) {
      return texts[key] ?? null;
    },
  } as unknown as ResourceBundle;
}

function stubBundleCreate(bundle: ResourceBundle): sinon.SinonStub {
  return sandbox.stub(ResourceBundle, "create").returns(Promise.resolve(bundle) as never);
}

function stubBundleCreateMultiple(bundles: ResourceBundle[]): sinon.SinonStub {
  const stub = sandbox.stub(ResourceBundle, "create");
  bundles.forEach((b, i) => {
    stub.onCall(i).returns(Promise.resolve(b) as never);
  });
  return stub;
}

function stubBaseBundle(texts: Record<string, string>): sinon.SinonStub {
  return sandbox.stub(Lib, "getResourceBundleFor").returns(makeBundleStub(texts));
}

// ──────────────────────────────────────────────────
// configureI18n validation
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry — configureI18n validation", { afterEach: commonAfterEach });

QUnit.test("Accepts valid config with enhanceWith", async (assert) => {
  const spy = sandbox.spy(Log, "warning");
  stubBundleCreate(makeBundleStub({}));

  await configureI18n({
    enhanceWith: [{ bundleName: "my.app.i18n" }],
  });

  assert.notOk(spy.called, "No warning for valid config");
});

QUnit.test("Accepts config without enhanceWith (locale-only)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    supportedLocales: ["en", "de"],
    fallbackLocale: "en",
  });

  assert.notOk(spy.called, "No warning for config without enhanceWith");
});

QUnit.test("Rejects non-object config (null)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n(null as never);

  assert.ok(spy.calledOnce, "Warning logged for null config");
  assert.ok(spy.firstCall.args[0].includes("plain object"), "Warning mentions plain object");
});

QUnit.test("Rejects non-object config (array)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n([] as never);

  assert.ok(spy.calledOnce, "Warning logged for array config");
});

QUnit.test("Rejects non-object config (string)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n("bad" as never);

  assert.ok(spy.calledOnce, "Warning logged for string config");
});

QUnit.test("Rejects enhancement entry with neither bundleName nor bundleUrl", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    enhanceWith: [{} as never],
  });

  assert.ok(spy.calledOnce, "Warning logged for entry without bundleName or bundleUrl");
  assert.ok(
    spy.firstCall.args[0].includes("bundleName or bundleUrl"),
    "Warning message references bundleName/bundleUrl",
  );
});

QUnit.test("Rejects enhancement entry with both bundleName and bundleUrl", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    enhanceWith: [{ bundleName: "x", bundleUrl: "y" } as never],
  });

  assert.ok(spy.calledOnce, "Warning logged for entry with both");
  assert.ok(spy.firstCall.args[0].includes("not both"), "Warning message says not both");
});

QUnit.test("Skips invalid entries, keeps valid ones", async (assert) => {
  const validBundle = makeBundleStub({ KEY: "valid" });
  const createStub = sandbox.stub(ResourceBundle, "create").returns(Promise.resolve(validBundle) as never);

  await configureI18n({
    enhanceWith: [{} as never, { bundleName: "valid.bundle" }],
  });

  assert.strictEqual(createStub.callCount, 1, "Only valid entry triggers bundle creation");
});

QUnit.test("Logs warning for invalid entries", async (assert) => {
  const spy = sandbox.spy(Log, "warning");
  stubBundleCreate(makeBundleStub({}));

  await configureI18n({
    enhanceWith: [{} as never, { bundleName: "valid.bundle" }],
  });

  assert.strictEqual(spy.callCount, 1, "One warning for the invalid entry");
});

// ──────────────────────────────────────────────────
// async bundle loading
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry — async bundle loading", { afterEach: commonAfterEach });

QUnit.test("configureI18n returns a Promise that resolves after loading", async (assert) => {
  stubBundleCreate(makeBundleStub({}));

  const result = configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  assert.ok(result instanceof Promise, "Returns a Promise");
  await result;
  assert.ok(true, "Promise resolved");
});

QUnit.test("getText returns base text while bundles are loading", (assert) => {
  stubBaseBundle({ KEY: "base" });
  sandbox.stub(ResourceBundle, "create").returns(new Promise(() => {}) as never);

  void configureI18n({ enhanceWith: [{ bundleName: "slow.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "base", "Base text returned while loading");
});

QUnit.test("getText returns enhanced text after Promise resolves", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreate(makeBundleStub({ KEY: "enhanced" }));

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "enhanced", "Enhanced text returned after load");
});

QUnit.test("Rapid reconfiguration: only latest generation is stored", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  let resolveFirst!: (b: ResourceBundle) => void;
  let resolveSecond!: (b: ResourceBundle) => void;

  const createStub = sandbox.stub(ResourceBundle, "create");
  createStub.onCall(0).returns(
    new Promise((r) => {
      resolveFirst = r as (b: ResourceBundle) => void;
    }) as never,
  );
  createStub.onCall(1).returns(
    new Promise((r) => {
      resolveSecond = r as (b: ResourceBundle) => void;
    }) as never,
  );

  const first = configureI18n({ enhanceWith: [{ bundleName: "first.bundle" }] });
  const second = configureI18n({ enhanceWith: [{ bundleName: "second.bundle" }] });

  resolveSecond(makeBundleStub({ KEY: "second" }));
  await second;

  resolveFirst(makeBundleStub({ KEY: "first" }));
  await first;

  assert.strictEqual(getText("KEY", "fallback"), "second", "Latest config wins over earlier");
});

QUnit.test("resetI18nConfiguration cancels in-flight loads (generation guard)", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  let resolveBundle!: (b: ResourceBundle) => void;
  sandbox.stub(ResourceBundle, "create").returns(
    new Promise((r) => {
      resolveBundle = r as (b: ResourceBundle) => void;
    }) as never,
  );

  const loading = configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  resetI18nConfiguration();

  resolveBundle(makeBundleStub({ KEY: "stale" }));
  await loading;

  assert.strictEqual(getText("KEY", "fallback"), "base", "Stale load discarded after reset");
});

QUnit.test("reloadBundles re-creates bundles for current locale", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  const createStub = sandbox.stub(ResourceBundle, "create");

  createStub.returns(Promise.resolve(makeBundleStub({ KEY: "v1" })) as never);
  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  assert.strictEqual(getText("KEY", "fallback"), "v1", "Initial load");

  createStub.returns(Promise.resolve(makeBundleStub({ KEY: "v2" })) as never);
  await reloadBundles();
  assert.strictEqual(getText("KEY", "fallback"), "v2", "Reloaded bundle used");
});

// ──────────────────────────────────────────────────
// enhancement bundle precedence
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry — enhancement bundle precedence", { afterEach: commonAfterEach });

QUnit.test("Base bundle text used when no enhancements configured", (assert) => {
  stubBaseBundle({ KEY: "base" });

  assert.strictEqual(getText("KEY", "fallback"), "base", "Base bundle text returned");
});

QUnit.test("Single enhancement overrides base bundle text", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreate(makeBundleStub({ KEY: "enhanced" }));

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "enhanced", "Enhancement overrides base");
});

QUnit.test("Last enhancement wins when multiple provide same key", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreateMultiple([makeBundleStub({ KEY: "first" }), makeBundleStub({ KEY: "second" })]);

  await configureI18n({
    enhanceWith: [{ bundleName: "first.bundle" }, { bundleName: "second.bundle" }],
  });

  assert.strictEqual(getText("KEY", "fallback"), "second", "Last enhancement wins");
});

QUnit.test("Enhancement that does not provide a key falls through to base", async (assert) => {
  stubBaseBundle({ KEY: "base", OTHER: "other-base" });
  stubBundleCreate(makeBundleStub({ OTHER: "other-enhanced" }));

  await configureI18n({ enhanceWith: [{ bundleName: "partial.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "base", "Missing key falls through to base");
  assert.strictEqual(getText("OTHER", "fallback"), "other-enhanced", "Provided key is enhanced");
});

QUnit.test("Enhancement bundle error does not break resolution", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  const spy = sandbox.spy(Log, "warning");
  sandbox.stub(ResourceBundle, "create").returns(Promise.reject(new Error("load failed")) as never);

  await configureI18n({ enhanceWith: [{ bundleName: "broken.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "base", "Base text used after bundle failure");
  assert.ok(spy.calledOnce, "Warning logged for failed bundle");
  assert.ok(spy.firstCall.args[0].includes("Failed to create"), "Warning mentions failure");
});

// ──────────────────────────────────────────────────
// override hook
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry — override hook", { afterEach: commonAfterEach });

QUnit.test("Hook receives correct context", (assert) => {
  stubBaseBundle({ KEY: "base" });
  let receivedCtx: Record<string, unknown> | null = null;

  setI18nOverrideHook((ctx) => {
    receivedCtx = { ...ctx };
    return undefined;
  });

  getText("KEY", "fallback");

  assert.ok(receivedCtx, "Hook was called");
  assert.strictEqual(receivedCtx!.key, "KEY", "Correct key");
  assert.strictEqual(typeof receivedCtx!.locale, "string", "Locale is a string");
  assert.strictEqual(receivedCtx!.defaultText, "fallback", "Correct defaultText");
  assert.strictEqual(receivedCtx!.resolvedText, "base", "Correct resolvedText");
});

QUnit.test("Hook return replaces resolved text", (assert) => {
  stubBaseBundle({ KEY: "base" });

  setI18nOverrideHook(() => "overridden");

  assert.strictEqual(getText("KEY", "fallback"), "overridden", "Hook override applied");
});

QUnit.test("Hook returning undefined keeps resolved text", (assert) => {
  stubBaseBundle({ KEY: "base" });

  setI18nOverrideHook(() => undefined);

  assert.strictEqual(getText("KEY", "fallback"), "base", "Resolved text kept when hook returns undefined");
});

QUnit.test("Hook runs after enhancement resolution", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreate(makeBundleStub({ KEY: "enhanced" }));

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  let receivedResolved = "";
  setI18nOverrideHook((ctx) => {
    receivedResolved = ctx.resolvedText;
    return undefined;
  });

  getText("KEY", "fallback");
  assert.strictEqual(receivedResolved, "enhanced", "Hook sees enhanced text as resolvedText");
});

QUnit.test("Hook error is caught, resolved text used", (assert) => {
  stubBaseBundle({ KEY: "base" });
  const spy = sandbox.spy(Log, "warning");

  setI18nOverrideHook(() => {
    throw new Error("hook error");
  });

  assert.strictEqual(getText("KEY", "fallback"), "base", "Resolved text used on hook error");
  assert.ok(spy.calledOnce, "Warning logged for hook error");
  assert.ok(spy.firstCall.args[0].includes("hook threw"), "Warning message mentions hook");
});

QUnit.test("setI18nOverrideHook replaces previous hook", (assert) => {
  stubBaseBundle({ KEY: "base" });

  setI18nOverrideHook(() => "first");
  setI18nOverrideHook(() => "second");

  assert.strictEqual(getText("KEY", "fallback"), "second", "Second hook replaces first");
});

QUnit.test("setI18nOverrideHook rejects non-function (null)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  setI18nOverrideHook(null as never);

  assert.ok(spy.calledOnce, "Warning logged for null");
  assert.ok(spy.firstCall.args[0].includes("must be a function"), "Warning mentions function");
});

QUnit.test("setI18nOverrideHook rejects non-function (string)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  setI18nOverrideHook("bad" as never);

  assert.ok(spy.calledOnce, "Warning logged for string");
});

QUnit.test("setI18nOverrideHook rejects non-function (number)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  setI18nOverrideHook(42 as never);

  assert.ok(spy.calledOnce, "Warning logged for number");
});

QUnit.test("clearI18nOverrideHook removes hook", (assert) => {
  stubBaseBundle({ KEY: "base" });

  setI18nOverrideHook(() => "overridden");
  assert.strictEqual(getText("KEY", "fallback"), "overridden", "Hook active");

  clearI18nOverrideHook();
  assert.strictEqual(getText("KEY", "fallback"), "base", "Hook removed");
});

// ──────────────────────────────────────────────────
// resetI18nConfiguration
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry — resetI18nConfiguration", { afterEach: commonAfterEach });

QUnit.test("Clears enhancement bundles", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreate(makeBundleStub({ KEY: "enhanced" }));

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  assert.strictEqual(getText("KEY", "fallback"), "enhanced", "Enhanced before reset");

  resetI18nConfiguration();
  assert.strictEqual(getText("KEY", "fallback"), "base", "Base text after reset");
});

QUnit.test("Does NOT clear override hook", (assert) => {
  stubBaseBundle({ KEY: "base" });

  setI18nOverrideHook(() => "hooked");
  assert.strictEqual(getText("KEY", "fallback"), "hooked", "Hook active before reset");

  resetI18nConfiguration();
  assert.strictEqual(getText("KEY", "fallback"), "hooked", "Hook still active after reset");
});

QUnit.test("Subsequent getText returns base bundle text only", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreate(makeBundleStub({ KEY: "enhanced" }));

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  resetI18nConfiguration();

  assert.strictEqual(getText("KEY", "fallback"), "base", "Only base text after reset");
});

QUnit.test("Idempotent — double reset does not error", (assert) => {
  resetI18nConfiguration();
  resetI18nConfiguration();
  assert.ok(true, "No error on double reset");
});

QUnit.test("New configureI18n after reset works correctly", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  const createStub = sandbox.stub(ResourceBundle, "create");

  createStub.returns(Promise.resolve(makeBundleStub({ KEY: "first" })) as never);
  await configureI18n({ enhanceWith: [{ bundleName: "first.bundle" }] });

  resetI18nConfiguration();

  createStub.returns(Promise.resolve(makeBundleStub({ KEY: "second" })) as never);
  await configureI18n({ enhanceWith: [{ bundleName: "second.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "second", "New config works after reset");
});

// ──────────────────────────────────────────────────
// KioskKeyboard facade
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry — KioskKeyboard facade", {
  afterEach() {
    sandbox.restore();
    KioskKeyboard.resetI18nConfiguration();
    KioskKeyboard.clearI18nOverrideHook();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Static configureI18n returns Promise", (assert) => {
  stubBundleCreate(makeBundleStub({}));

  const result = KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.bundle" }],
  });

  assert.ok(result instanceof Promise, "Returns a Promise");
});

QUnit.test("Static configureI18n performs double invalidation (immediate + deferred)", async (assert) => {
  stubBaseBundle({});
  stubBundleCreate(makeBundleStub({}));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const invalidateSpy = sandbox.spy(kb, "invalidate");

  // Immediate invalidation fires synchronously
  const loaded = KioskKeyboard.configureI18n({
    enhanceWith: [{ bundleName: "test.bundle" }],
  });
  assert.ok(invalidateSpy.callCount >= 1, "Immediate invalidation fires synchronously");

  const countBeforeAwait = invalidateSpy.callCount;
  await loaded;
  // Deferred invalidation fires after the promise (in microtask)
  await Promise.resolve();
  assert.ok(invalidateSpy.callCount > countBeforeAwait, "Deferred invalidation fires after bundle load");

  input.destroy();
  kb.destroy();
});

QUnit.test("Static resetI18nConfiguration clears config state", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreate(makeBundleStub({ KEY: "enhanced" }));

  await KioskKeyboard.configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  assert.strictEqual(getText("KEY", "fallback"), "enhanced", "Enhanced before reset");

  KioskKeyboard.resetI18nConfiguration();
  assert.strictEqual(getText("KEY", "fallback"), "base", "Base after reset");
});

QUnit.test("Static setI18nOverrideHook / clearI18nOverrideHook round-trip", (assert) => {
  stubBaseBundle({ KEY: "base" });

  KioskKeyboard.setI18nOverrideHook(() => "overridden");
  assert.strictEqual(getText("KEY", "fallback"), "overridden", "Hook active");

  KioskKeyboard.clearI18nOverrideHook();
  assert.strictEqual(getText("KEY", "fallback"), "base", "Hook cleared");
});

QUnit.test("getText reflects facade-configured enhancements (after await)", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreate(makeBundleStub({ KEY: "from-facade" }));

  await KioskKeyboard.configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "from-facade", "getText reflects facade config");
});

QUnit.test("All four methods invalidate live instances", async (assert) => {
  stubBaseBundle({});
  stubBundleCreate(makeBundleStub({}));

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const invalidateSpy = sandbox.spy(kb, "invalidate");

  const configPromise = KioskKeyboard.configureI18n({ enhanceWith: [{ bundleName: "test" }] });
  assert.ok(invalidateSpy.callCount >= 1, "configureI18n invalidates immediately");
  await configPromise;

  invalidateSpy.resetHistory();
  KioskKeyboard.resetI18nConfiguration();
  assert.ok(invalidateSpy.callCount >= 1, "resetI18nConfiguration invalidates");

  invalidateSpy.resetHistory();
  KioskKeyboard.setI18nOverrideHook(() => undefined);
  assert.ok(invalidateSpy.callCount >= 1, "setI18nOverrideHook invalidates");

  invalidateSpy.resetHistory();
  KioskKeyboard.clearI18nOverrideHook();
  assert.ok(invalidateSpy.callCount >= 1, "clearI18nOverrideHook invalidates");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────────
// onLocalizationChanged
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry — onLocalizationChanged", {
  afterEach() {
    sandbox.restore();
    KioskKeyboard.resetI18nConfiguration();
    KioskKeyboard.clearI18nOverrideHook();
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Triggers bundle reload", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  const createStub = sandbox.stub(ResourceBundle, "create");
  createStub.returns(Promise.resolve(makeBundleStub({ KEY: "v1" })) as never);

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  assert.strictEqual(getText("KEY", "fallback"), "v1", "Initial text");

  createStub.returns(Promise.resolve(makeBundleStub({ KEY: "v2" })) as never);

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  (kb as unknown as { onLocalizationChanged: () => void }).onLocalizationChanged();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await waitForRender();

  assert.strictEqual(getText("KEY", "fallback"), "v2", "Bundle reloaded with new text");

  input.destroy();
  kb.destroy();
});

QUnit.test("Invalidates instance immediately", async (assert) => {
  stubBaseBundle({});

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const invalidateSpy = sandbox.spy(kb, "invalidate");

  (kb as unknown as { onLocalizationChanged: () => void }).onLocalizationChanged();

  assert.ok(invalidateSpy.calledOnce, "Instance invalidated immediately");

  input.destroy();
  kb.destroy();
});

QUnit.test("No-op when no config is active", async (assert) => {
  stubBaseBundle({});

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  // Spy on ResourceBundle.create after the control is initialized
  // to avoid catching library-level bundle creation
  const createSpy = sandbox.spy(ResourceBundle, "create");

  (kb as unknown as { onLocalizationChanged: () => void }).onLocalizationChanged();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.notOk(createSpy.called, "No bundle creation when no config active");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────────
// FLP lifecycle simulation
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry — FLP lifecycle simulation", { afterEach: commonAfterEach });

QUnit.test("Configure + hook in init, cleanup in destroy, next app sees defaults", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  stubBundleCreate(makeBundleStub({ KEY: "app1" }));

  // App 1 init
  await configureI18n({ enhanceWith: [{ bundleName: "app1.bundle" }] });
  setI18nOverrideHook(() => "app1-hook");
  assert.strictEqual(getText("KEY", "fallback"), "app1-hook", "App 1 sees hooked text");

  // App 1 destroy
  clearI18nOverrideHook();
  resetI18nConfiguration();

  // App 2 — should see defaults
  assert.strictEqual(getText("KEY", "fallback"), "base", "App 2 sees base text");
});

QUnit.test("Override hook does not leak across simulated app sessions", (assert) => {
  stubBaseBundle({ KEY: "base" });

  // App 1
  setI18nOverrideHook(() => "leaked");
  assert.strictEqual(getText("KEY", "fallback"), "leaked", "App 1 hook active");

  // App 1 cleanup
  clearI18nOverrideHook();

  // App 2
  assert.strictEqual(getText("KEY", "fallback"), "base", "Hook not leaked to app 2");
});
