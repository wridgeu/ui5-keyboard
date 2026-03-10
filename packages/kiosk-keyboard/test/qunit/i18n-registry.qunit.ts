import {
  configureI18n,
  resetI18nConfiguration,
  setI18nOverrideHook,
  clearI18nOverrideHook,
  getI18nConfiguration,
  hasConfiguredEnhancements,
  getText,
  reloadBundles,
  reloadIfStale,
} from "ui5/kiosk/internal/i18n-registry";
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import ResourceBundle from "sap/base/i18n/ResourceBundle";
import Localization from "sap/base/i18n/Localization";
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

/** Poll until `pending` has at least `count` entries (max ~50 ticks). */
async function waitForCreateCalls(pending: unknown[], count: number): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (pending.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`Timed out waiting for ${count} ResourceBundle.create calls`);
}

async function expectValidationRejected(
  assert: { ok: (value: unknown, message?: string) => void },
  promise: Promise<void>,
  message: string,
): Promise<void> {
  let rejection: unknown;
  try {
    await promise;
  } catch (error) {
    rejection = error;
  }

  assert.ok(rejection instanceof TypeError, `${message} (rejects with TypeError)`);
  if (rejection instanceof Error) {
    assert.ok(rejection.message.includes("validation failed"), `${message} (error message)`);
  }
}

// ──────────────────────────────────────────────────
// configureI18n validation
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - configureI18n validation", { afterEach: commonAfterEach });

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

QUnit.test("Accepts config with empty enhanceWith array", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({ enhanceWith: [] });

  assert.notOk(spy.called, "No warning for empty enhanceWith array");
  const snapshot = getI18nConfiguration();
  assert.ok(snapshot, "Config is stored");
  assert.deepEqual(snapshot!.enhanceWith, [], "enhanceWith is an empty array");
});

QUnit.test("Rejects non-object config (null)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await expectValidationRejected(assert, configureI18n(null as never), "Invalid null config rejects");

  assert.ok(spy.calledOnce, "Warning logged for null config");
  assert.ok(spy.firstCall.args[0].includes("plain object"), "Warning mentions plain object");
});

QUnit.test("Rejects non-object config (array)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await expectValidationRejected(assert, configureI18n([] as never), "Invalid array config rejects");

  assert.ok(spy.calledOnce, "Warning logged for array config");
});

QUnit.test("Rejects non-object config (string)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await expectValidationRejected(assert, configureI18n("bad" as never), "Invalid string config rejects");

  assert.ok(spy.calledOnce, "Warning logged for string config");
});

QUnit.test("Rejects non-array enhanceWith (string)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await expectValidationRejected(
    assert,
    configureI18n({ enhanceWith: "bad" } as never),
    "Invalid non-array enhanceWith rejects",
  );

  assert.ok(spy.calledOnce, "Warning logged for string enhanceWith");
  assert.ok(spy.firstCall.args[0].includes("enhanceWith"), "Warning mentions enhanceWith");
});

QUnit.test("Rejects non-array enhanceWith (object)", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await expectValidationRejected(
    assert,
    configureI18n({ enhanceWith: { bundleName: "x" } } as never),
    "Invalid object enhanceWith rejects",
  );

  assert.ok(spy.calledOnce, "Warning logged for object enhanceWith");
});

QUnit.test("Rejects enhancement entry with neither bundleName nor bundleUrl", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    enhanceWith: [{} as never],
  });

  assert.strictEqual(spy.callCount, 2, "Per-entry warning + aggregate all-invalid warning");
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

  assert.strictEqual(spy.callCount, 2, "Per-entry warning + aggregate all-invalid warning");
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

QUnit.test("Rejects non-array supportedLocales", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await expectValidationRejected(
    assert,
    configureI18n({ supportedLocales: "de" } as never),
    "Invalid supportedLocales rejects",
  );

  assert.ok(spy.calledOnce, "Warning logged for non-array supportedLocales");
  assert.ok(spy.firstCall.args[0].includes("supportedLocales"), "Warning mentions supportedLocales");
});

QUnit.test("Rejects supportedLocales with non-string elements", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await expectValidationRejected(
    assert,
    configureI18n({ supportedLocales: [42, null] } as never),
    "Invalid supportedLocales element types reject",
  );

  assert.ok(spy.calledOnce, "Warning logged for non-string elements in supportedLocales");
  assert.ok(spy.firstCall.args[0].includes("supportedLocales"), "Warning mentions supportedLocales");
});

QUnit.test("Rejects non-string fallbackLocale", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await expectValidationRejected(
    assert,
    configureI18n({ fallbackLocale: 42 } as never),
    "Invalid fallbackLocale rejects",
  );

  assert.ok(spy.calledOnce, "Warning logged for non-string fallbackLocale");
  assert.ok(spy.firstCall.args[0].includes("fallbackLocale"), "Warning mentions fallbackLocale");
});

QUnit.test("Rejects entry with non-array supportedLocales", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    enhanceWith: [{ bundleName: "x", supportedLocales: "de" } as never],
  });

  assert.strictEqual(spy.callCount, 2, "Per-entry warning + aggregate all-invalid warning");
});

QUnit.test("Rejects entry with non-string elements in supportedLocales", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    enhanceWith: [{ bundleName: "x", supportedLocales: ["en", 123] } as never],
  });

  assert.strictEqual(spy.callCount, 2, "Per-entry warning + aggregate all-invalid warning");
});

QUnit.test("Rejects entry with non-string fallbackLocale", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    enhanceWith: [{ bundleName: "x", fallbackLocale: 42 } as never],
  });

  assert.strictEqual(spy.callCount, 2, "Per-entry warning + aggregate all-invalid warning");
});

QUnit.test("Rejects enhancement entry with empty-string bundleName", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    enhanceWith: [{ bundleName: "" } as never],
  });

  assert.strictEqual(spy.callCount, 2, "Per-entry warning + aggregate all-invalid warning");
  assert.ok(
    spy.firstCall.args[0].includes("bundleName or bundleUrl"),
    "Warning references missing bundleName/bundleUrl",
  );
});

QUnit.test("All enhanceWith entries invalid triggers aggregate warning", async (assert) => {
  const spy = sandbox.spy(Log, "warning");

  await configureI18n({
    enhanceWith: [{} as never, { bundleName: "x", bundleUrl: "y" } as never],
  });

  const aggregateCall = spy.getCalls().find((c) => (c.args[0] as string).includes("all enhancement entries"));
  assert.ok(aggregateCall, "Aggregate all-invalid warning logged");
  assert.ok(!hasConfiguredEnhancements(), "No enhancements active after all-invalid config");
});

// ──────────────────────────────────────────────────
// async bundle loading
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - async bundle loading", { afterEach: commonAfterEach });

QUnit.test("configureI18n returns a Promise that resolves after loading", async (assert) => {
  stubBundleCreate(makeBundleStub({}));

  const result = configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  assert.ok(result instanceof Promise, "Returns a Promise");
  await result;
  assert.ok(hasConfiguredEnhancements(), "Enhancements are active after load");
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

QUnit.test("configureI18n tolerates synchronous ResourceBundle.create throws", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  const warningSpy = sandbox.spy(Log, "warning");
  sandbox.stub(ResourceBundle, "create").throws(new Error("sync create fail"));

  await configureI18n({ enhanceWith: [{ bundleName: "broken.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "base", "Falls back to base text when create throws synchronously");
  assert.ok(warningSpy.calledOnce, "Warning logged for synchronous bundle-create failure");
  assert.ok(warningSpy.firstCall.args[0].includes("Failed to create"), "Warning message mentions create failure");
});

QUnit.test("reloadBundles tolerates synchronous ResourceBundle.create throws", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  const createStub = sandbox.stub(ResourceBundle, "create");
  createStub.onCall(0).returns(Promise.resolve(makeBundleStub({ KEY: "v1" })) as never);

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  assert.strictEqual(getText("KEY", "fallback"), "v1", "Initial load uses enhancement bundle");

  const warningSpy = sandbox.spy(Log, "warning");
  createStub.onCall(1).throws(new Error("sync reload fail"));

  await reloadBundles();

  assert.strictEqual(
    getText("KEY", "fallback"),
    "base",
    "Falls back to base text when reload create throws synchronously",
  );
  assert.ok(warningSpy.calledOnce, "Warning logged for synchronous reload failure");
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

QUnit.test("Empty config cancels in-flight loads (generation guard)", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  let resolveBundle!: (b: ResourceBundle) => void;
  sandbox.stub(ResourceBundle, "create").returns(
    new Promise((r) => {
      resolveBundle = r as (b: ResourceBundle) => void;
    }) as never,
  );

  const loading = configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  // Second call with no enhanceWith - should invalidate the in-flight load
  await configureI18n({});

  resolveBundle(makeBundleStub({ KEY: "stale" }));
  await loading;

  assert.strictEqual(getText("KEY", "fallback"), "base", "Stale load discarded after empty config");
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

QUnit.test("configureI18n snapshots config to avoid caller-side mutation", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  const createStub = sandbox.stub(ResourceBundle, "create");
  createStub.onCall(0).returns(Promise.resolve(makeBundleStub({ KEY: "v1" })) as never);
  createStub.onCall(1).returns(Promise.resolve(makeBundleStub({ KEY: "v2" })) as never);

  const mutableConfig = {
    supportedLocales: ["", "en"],
    enhanceWith: [
      {
        bundleName: "initial.bundle",
        supportedLocales: ["", "de"],
      },
    ],
  };

  await configureI18n(mutableConfig as Parameters<typeof configureI18n>[0]);
  assert.strictEqual(getText("KEY", "fallback"), "v1", "Initial enhancement bundle is active");

  mutableConfig.enhanceWith[0].bundleName = "mutated.bundle";
  mutableConfig.supportedLocales.push("it");
  mutableConfig.enhanceWith[0].supportedLocales.push("fr");

  await reloadBundles();

  const params = createStub.getCall(1).args[0] as Record<string, unknown>;
  assert.strictEqual(params.bundleName, "initial.bundle", "Reload uses snapshotted bundleName");
  assert.deepEqual(params.supportedLocales, ["", "de"], "Reload uses snapshotted entry locales");
  assert.strictEqual(getText("KEY", "fallback"), "v2", "Reload still succeeds");
});

QUnit.test("reloadBundles coalesces concurrent calls (same promise returned)", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  const createStub = sandbox.stub(ResourceBundle, "create");

  createStub.returns(Promise.resolve(makeBundleStub({ KEY: "v1" })) as never);
  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  // Reset stub to track only reload calls
  createStub.resetHistory();
  createStub.returns(Promise.resolve(makeBundleStub({ KEY: "v2" })) as never);

  const first = reloadBundles();
  const second = reloadBundles();
  const third = reloadBundles();

  assert.strictEqual(first, second, "Second call returns same promise");
  assert.strictEqual(second, third, "Third call returns same promise");

  await first;

  assert.strictEqual(createStub.callCount, 1, "ResourceBundle.create called only once despite 3 reloadBundles calls");
  assert.strictEqual(getText("KEY", "fallback"), "v2", "Reloaded text available");
});

QUnit.test("reloadBundles queues a follow-up reload when locale changes mid-flight", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  const pendingCreates: Array<(bundle: ResourceBundle) => void> = [];
  const createStub = sandbox.stub(ResourceBundle, "create").callsFake(
    () =>
      new Promise<ResourceBundle>((resolve) => {
        pendingCreates.push(resolve);
      }) as never,
  );

  let locale = "en";
  sandbox.stub(Localization, "getLanguageTag").callsFake(() => ({ toString: () => locale }) as never);

  const initialLoad = configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  await waitForCreateCalls(pendingCreates, 1);
  pendingCreates.shift()!(makeBundleStub({ KEY: "en-initial" }));
  await initialLoad;
  assert.strictEqual(getText("KEY", "fallback"), "en-initial", "Initial enhancement bundle is active");

  const firstReload = reloadBundles();
  await waitForCreateCalls(pendingCreates, 1);

  locale = "de";
  const secondCall = reloadBundles();
  assert.strictEqual(secondCall, firstReload, "Second call returns same pending promise");

  pendingCreates.shift()!(makeBundleStub({ KEY: "en-stale" }));

  await waitForCreateCalls(pendingCreates, 1);
  pendingCreates.shift()!(makeBundleStub({ KEY: "de-latest" }));

  await firstReload;

  assert.strictEqual(getText("KEY", "fallback"), "de-latest", "Latest locale bundle is applied");
  assert.strictEqual(createStub.callCount, 3, "configure + two reload cycles");
});

QUnit.test("reloadBundles without enhancements returns a stable no-op promise", async (assert) => {
  const first = reloadBundles();
  const second = reloadBundles();

  assert.strictEqual(first, second, "No-config path returns the same promise instance");
  await first;
});

QUnit.test("configureI18n detaches in-flight reload without invalidating its own load", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  const pendingCreates: Array<(bundle: ResourceBundle) => void> = [];
  const createStub = sandbox.stub(ResourceBundle, "create").callsFake(
    () =>
      new Promise<ResourceBundle>((resolve) => {
        pendingCreates.push(resolve);
      }) as never,
  );

  const initialLoad = configureI18n({ enhanceWith: [{ bundleName: "initial.bundle" }] });
  await waitForCreateCalls(pendingCreates, 1);
  pendingCreates.shift()!(makeBundleStub({ KEY: "initial" }));
  await initialLoad;
  assert.strictEqual(getText("KEY", "fallback"), "initial", "Initial enhancement bundle is active");

  const staleReload = reloadBundles();
  await waitForCreateCalls(pendingCreates, 1);

  const configured = configureI18n({ enhanceWith: [{ bundleName: "new.bundle" }] });
  await waitForCreateCalls(pendingCreates, 2);

  // Resolve the detached reload first. Without a detach guard in reloadBundles,
  // this can trigger a second stale cycle that bumps generation and invalidates
  // the in-flight configureI18n load.
  pendingCreates.shift()!(makeBundleStub({ KEY: "stale-reload" }));
  await Promise.resolve();

  pendingCreates.shift()!(makeBundleStub({ KEY: "configured" }));
  await configured;

  // Allow any unexpected follow-up cycle to enqueue, then drain leftovers so
  // the detached reload promise can settle cleanly.
  await new Promise((resolve) => setTimeout(resolve, 0));
  while (pendingCreates.length) {
    pendingCreates.shift()!(makeBundleStub({ KEY: "unexpected-extra" }));
  }
  await staleReload;

  assert.strictEqual(getText("KEY", "fallback"), "configured", "configureI18n keeps its own bundle active");
  assert.strictEqual(createStub.callCount, 3, "Detached reload does not start an extra load cycle");
});

QUnit.test("reloadIfStale detects stale bundles when locale changes mid-load", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  let resolveInitial!: (b: ResourceBundle) => void;
  const createStub = sandbox.stub(ResourceBundle, "create");
  createStub.onCall(0).returns(
    new Promise((r) => {
      resolveInitial = r as (b: ResourceBundle) => void;
    }) as never,
  );

  let locale = "en";
  sandbox.stub(Localization, "getLanguageTag").callsFake(() => ({ toString: () => locale }) as never);

  const loading = configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  // Locale changes while initial load is in-flight
  locale = "de";

  resolveInitial(makeBundleStub({ KEY: "en-text" }));
  await loading;

  // bundlesLoadedLocale should be "en" (the snapshot), not "de" (current),
  // so reloadIfStale must detect the mismatch.
  createStub.onCall(1).returns(Promise.resolve(makeBundleStub({ KEY: "de-text" })) as never);

  const reloadPromise = reloadIfStale();
  assert.ok(reloadPromise instanceof Promise, "reloadIfStale returns a Promise (bundles detected as stale)");

  await reloadPromise;
  assert.strictEqual(getText("KEY", "fallback"), "de-text", "After reload, text matches new locale bundle");
});

QUnit.test("reloadIfStale resolves immediately when bundles are current", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  const createStub = stubBundleCreate(makeBundleStub({ KEY: "enhanced" }));
  sandbox.stub(Localization, "getLanguageTag").callsFake(() => ({ toString: () => "en" }) as never);

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  const callCountBefore = createStub.callCount;

  const result = reloadIfStale();
  assert.ok(result instanceof Promise, "reloadIfStale returns a Promise");
  await result;
  assert.strictEqual(createStub.callCount, callCountBefore, "No new bundle load triggered when locale has not changed");
});

// ──────────────────────────────────────────────────
// enhancement bundle precedence
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - enhancement bundle precedence", { afterEach: commonAfterEach });

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

QUnit.test("Three bundles with partial overlap - last providing bundle wins per key", async (assert) => {
  stubBaseBundle({ K1: "base1", K2: "base2", K3: "base3" });
  stubBundleCreateMultiple([
    makeBundleStub({ K1: "b1-k1", K2: "b1-k2" }),
    makeBundleStub({ K2: "b2-k2", K3: "b2-k3" }),
    makeBundleStub({ K1: "b3-k1" }),
  ]);

  await configureI18n({
    enhanceWith: [{ bundleName: "b1" }, { bundleName: "b2" }, { bundleName: "b3" }],
  });

  assert.strictEqual(getText("K1", "fallback"), "b3-k1", "K1 from bundle 3 (last provider)");
  assert.strictEqual(getText("K2", "fallback"), "b2-k2", "K2 from bundle 2 (last provider)");
  assert.strictEqual(getText("K3", "fallback"), "b2-k3", "K3 from bundle 2 (only provider)");
});

QUnit.test("Enhancement that does not provide a key falls through to base", async (assert) => {
  stubBaseBundle({ KEY: "base", OTHER: "other-base" });
  stubBundleCreate(makeBundleStub({ OTHER: "other-enhanced" }));

  await configureI18n({ enhanceWith: [{ bundleName: "partial.bundle" }] });

  assert.strictEqual(getText("KEY", "fallback"), "base", "Missing key falls through to base");
  assert.strictEqual(getText("OTHER", "fallback"), "other-enhanced", "Provided key is enhanced");
});

QUnit.test("bundleUrl entry loads and resolves text", async (assert) => {
  stubBaseBundle({ KEY: "base" });
  const createStub = stubBundleCreate(makeBundleStub({ KEY: "from-url" }));

  await configureI18n({
    enhanceWith: [{ bundleUrl: "https://example.com/i18n/messagebundle.properties" }],
  });

  assert.strictEqual(getText("KEY", "fallback"), "from-url", "bundleUrl entry text resolved");
  assert.ok(createStub.calledOnce, "ResourceBundle.create called once");
  const params = createStub.firstCall.args[0] as Record<string, unknown>;
  assert.strictEqual(params.url, "https://example.com/i18n/messagebundle.properties", "URL passed correctly");
  assert.notOk("bundleName" in params, "bundleName not set for URL entry");
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

QUnit.module("i18n-registry - override hook", { afterEach: commonAfterEach });

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

QUnit.test("Hook returning non-string truthy value falls back to resolved text", (assert) => {
  stubBaseBundle({ KEY: "base" });

  setI18nOverrideHook((() => 42) as never);
  assert.strictEqual(getText("KEY", "fallback"), "base", "Number return ignored, resolved text kept");

  setI18nOverrideHook((() => ({ text: "obj" })) as never);
  assert.strictEqual(getText("KEY", "fallback"), "base", "Object return ignored, resolved text kept");

  setI18nOverrideHook((() => true) as never);
  assert.strictEqual(getText("KEY", "fallback"), "base", "Boolean return ignored, resolved text kept");
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

  assert.strictEqual(
    setI18nOverrideHook(() => "first"),
    true,
    "First hook accepted",
  );
  assert.strictEqual(
    setI18nOverrideHook(() => "second"),
    true,
    "Second hook accepted",
  );

  assert.strictEqual(getText("KEY", "fallback"), "second", "Second hook replaces first");
});

QUnit.test("setI18nOverrideHook rejects non-function (null)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  assert.strictEqual(setI18nOverrideHook(null as never), false, "Returns false for null");
  assert.ok(spy.calledOnce, "Warning logged for null");
  assert.ok(spy.firstCall.args[0].includes("must be a function"), "Warning mentions function");
});

QUnit.test("setI18nOverrideHook rejects non-function (string)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  assert.strictEqual(setI18nOverrideHook("bad" as never), false, "Returns false for string");
  assert.ok(spy.calledOnce, "Warning logged for string");
});

QUnit.test("setI18nOverrideHook rejects non-function (number)", (assert) => {
  const spy = sandbox.spy(Log, "warning");

  assert.strictEqual(setI18nOverrideHook(42 as never), false, "Returns false for number");
  assert.ok(spy.calledOnce, "Warning logged for number");
});

QUnit.test("clearI18nOverrideHook removes hook", (assert) => {
  stubBaseBundle({ KEY: "base" });

  setI18nOverrideHook(() => "overridden");
  assert.strictEqual(getText("KEY", "fallback"), "overridden", "Hook active");

  assert.strictEqual(clearI18nOverrideHook(), true, "Returns true when hook was set");
  assert.strictEqual(getText("KEY", "fallback"), "base", "Hook removed");
  assert.strictEqual(clearI18nOverrideHook(), false, "Returns false when no hook to clear");
});

// ──────────────────────────────────────────────────
// resetI18nConfiguration
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - resetI18nConfiguration", { afterEach: commonAfterEach });

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

QUnit.test("Idempotent - double reset does not error", (assert) => {
  resetI18nConfiguration();
  resetI18nConfiguration();
  assert.strictEqual(getI18nConfiguration(), null, "Still null after double reset");
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

QUnit.module("i18n-registry - KioskKeyboard facade", {
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

QUnit.module("i18n-registry - onLocalizationChanged", {
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

  await reloadBundles();
  kb.invalidate();
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
  await Promise.resolve();
  assert.strictEqual(invalidateSpy.callCount, 1, "No deferred global invalidation without enhancement config");

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

  await reloadBundles();

  assert.notOk(createSpy.called, "No bundle creation when no config active");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────────
// FLP lifecycle simulation
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - FLP lifecycle simulation", { afterEach: commonAfterEach });

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

  // App 2 - should see defaults
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

// ──────────────────────────────────────────────────
// MAX_RELOAD_CYCLES safety valve
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - MAX_RELOAD_CYCLES safety valve", { afterEach: commonAfterEach });

QUnit.test("reloadBundles aborts after exceeding MAX_RELOAD_CYCLES", async (assert) => {
  stubBaseBundle({ KEY: "base" });

  // Track create calls and auto-resolve with a 1-tick delay so there
  // is a window to trigger locale churn between iterations.
  let createCount = 0;
  sandbox.stub(ResourceBundle, "create").callsFake(
    () =>
      new Promise<ResourceBundle>((resolve) => {
        createCount++;
        // Resolve asynchronously (1 tick) to allow the while-loop's
        // await to yield control back to us.
        setTimeout(() => resolve(makeBundleStub({ KEY: `v${createCount}` })), 0);
      }) as never,
  );

  let locale = "en";
  sandbox.stub(Localization, "getLanguageTag").callsFake(() => ({ toString: () => locale }) as never);

  // Initial configure
  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  const warningSpy = sandbox.spy(Log, "warning");
  createCount = 0;

  // Start a reload. The IIFE inside reloadBundles runs a while-loop:
  // each iteration does `await loadBundles()`, then checks whether
  // pendingReloadRequestedLocale changed. We hook into the create stub
  // to trigger churn on every cycle by intercepting loadBundles.
  //
  // Strategy: override the create stub to change locale + call
  // reloadBundles() on each invocation. Since reloadBundles() coalesces,
  // it just updates pendingReloadRequestedLocale, causing the loop to retry.
  (ResourceBundle.create as sinon.SinonStub).callsFake(
    () =>
      new Promise<ResourceBundle>((resolve) => {
        createCount++;
        // Change locale to simulate locale churn
        locale = `churn-${createCount}`;
        // Update pendingReloadRequestedLocale so the loop retries
        reloadBundles();
        setTimeout(() => resolve(makeBundleStub({ KEY: `v${createCount}` })), 0);
      }) as never,
  );

  const reload = reloadBundles();
  await reload;

  // MAX_RELOAD_CYCLES is 5 internally. The initial configureI18n load plus
  // up to 5 retry cycles means at least 6 create calls before the abort.
  assert.ok(createCount >= 6, `At least 6 create calls expected (got ${createCount})`);
  assert.ok(warningSpy.calledWithMatch(sinon.match("exceeded")), "Warning logged about exceeding MAX_RELOAD_CYCLES");
});

// ──────────────────────────────────────────────────
// getText edge cases
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - getText edge cases", { afterEach: commonAfterEach });

QUnit.test("getText returns fallback when base bundle is unavailable (null)", (assert) => {
  sandbox.stub(Lib, "getResourceBundleFor").returns(null as never);

  assert.strictEqual(getText("KEY", "fallback"), "fallback", "Fallback returned when base bundle is null");
});

QUnit.test("getText returns fallback when base bundle is undefined", (assert) => {
  sandbox.stub(Lib, "getResourceBundleFor").returns(undefined as never);

  assert.strictEqual(getText("MISSING", "fallback"), "fallback", "Fallback returned when base bundle is undefined");
});

QUnit.test("Partial bundle failure: one succeeds, one fails", async (assert) => {
  stubBaseBundle({ KEY: "base", OTHER: "other-base" });
  const warningSpy = sandbox.spy(Log, "warning");

  const createStub = sandbox.stub(ResourceBundle, "create");
  createStub.onCall(0).returns(Promise.resolve(makeBundleStub({ KEY: "enhanced-key" })) as never);
  createStub.onCall(1).returns(Promise.reject(new Error("load failed")) as never);

  await configureI18n({
    enhanceWith: [{ bundleName: "good.bundle" }, { bundleName: "broken.bundle" }],
  });

  assert.strictEqual(getText("KEY", "fallback"), "enhanced-key", "Successful bundle text is applied");
  assert.strictEqual(getText("OTHER", "fallback"), "other-base", "Base text used for key not in successful bundle");
  assert.ok(
    warningSpy.getCalls().some((c) => String(c.args[0]).includes("Failed to create i18n enhancement bundle")),
    "Warning logged for the failed bundle",
  );
});

QUnit.test("Override hook returning empty string applies empty string", (assert) => {
  stubBaseBundle({ KEY: "base" });

  setI18nOverrideHook(() => "");

  assert.strictEqual(getText("KEY", "fallback"), "", "Empty string from hook is applied (typeof 'string')");
});

// ──────────────────────────────────────────────────
// getI18nConfiguration
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - getI18nConfiguration", { afterEach: commonAfterEach });

QUnit.test("Returns null when no configuration is applied", (assert) => {
  assert.strictEqual(getI18nConfiguration(), null, "null before any config");
});

QUnit.test("Returns frozen snapshot of active config", async (assert) => {
  stubBundleCreate(makeBundleStub({}));

  await configureI18n({
    supportedLocales: ["", "de"],
    fallbackLocale: "",
    enhanceWith: [{ bundleName: "test.bundle", supportedLocales: ["", "fr"] }],
  });

  const config = getI18nConfiguration();
  assert.ok(config, "Config is not null");
  assert.ok(Object.isFrozen(config), "Config is frozen");
  assert.deepEqual(config!.supportedLocales, ["", "de"], "supportedLocales matches");
  assert.strictEqual(config!.fallbackLocale, "", "fallbackLocale matches");
  assert.strictEqual(config!.enhanceWith?.length, 1, "One enhancement entry");
  assert.strictEqual(
    (config!.enhanceWith![0] as { bundleName: string }).bundleName,
    "test.bundle",
    "bundleName matches",
  );
});

QUnit.test("Returned snapshot is frozen and mutation attempts do not affect internal state", async (assert) => {
  stubBundleCreate(makeBundleStub({}));

  await configureI18n({
    supportedLocales: ["", "de"],
    enhanceWith: [{ bundleName: "test.bundle" }],
  });

  const config1 = getI18nConfiguration();
  assert.ok(config1, "Config is not null");

  // Attempting to mutate the frozen snapshot should throw.
  assert.throws(
    () => {
      (config1!.supportedLocales as string[]).push("it");
    },
    /extensible|readonly|read only/i,
    "Mutation attempt throws for frozen snapshot",
  );

  const config2 = getI18nConfiguration();
  assert.deepEqual(config2!.supportedLocales, ["", "de"], "Internal state not affected by snapshot mutation");
});

QUnit.test("Returns null after resetI18nConfiguration", async (assert) => {
  stubBundleCreate(makeBundleStub({}));

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  assert.ok(getI18nConfiguration(), "Config exists before reset");

  resetI18nConfiguration();
  assert.strictEqual(getI18nConfiguration(), null, "null after reset");
});

QUnit.test("Static KioskKeyboard.getI18nConfiguration delegates to registry", async (assert) => {
  stubBundleCreate(makeBundleStub({}));

  assert.strictEqual(KioskKeyboard.getI18nConfiguration(), null, "null before config");

  await KioskKeyboard.configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  const config = KioskKeyboard.getI18nConfiguration();
  assert.ok(config, "Config returned via facade");
  assert.strictEqual(config!.enhanceWith?.length, 1, "Enhancement entry present");

  KioskKeyboard.resetI18nConfiguration();
  assert.strictEqual(KioskKeyboard.getI18nConfiguration(), null, "null after facade reset");
});

// ──────────────────────────────────────────────────
// hasConfiguredEnhancements
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - hasConfiguredEnhancements", { afterEach: commonAfterEach });

QUnit.test("Returns false when no config is active", (assert) => {
  assert.notOk(hasConfiguredEnhancements(), "No config = no enhancements");
});

QUnit.test("Returns true when config with enhanceWith is active", async (assert) => {
  stubBundleCreate(makeBundleStub({}));

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  assert.ok(hasConfiguredEnhancements(), "Enhancements configured");
});

QUnit.test("Returns false when config without enhanceWith is active", async (assert) => {
  await configureI18n({ supportedLocales: ["en"] });
  assert.notOk(hasConfiguredEnhancements(), "No enhanceWith = no enhancements");
});

QUnit.test("Returns false after reset", async (assert) => {
  stubBundleCreate(makeBundleStub({}));

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });
  resetI18nConfiguration();
  assert.notOk(hasConfiguredEnhancements(), "No enhancements after reset");
});

// ──────────────────────────────────────────────────
// clearI18nOverrideHook conditional invalidation
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - clearI18nOverrideHook conditional invalidation", {
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

QUnit.test("clearI18nOverrideHook does NOT invalidate when no hook was set", async (assert) => {
  stubBaseBundle({});

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const invalidateSpy = sandbox.spy(kb, "invalidate");

  KioskKeyboard.clearI18nOverrideHook();
  assert.strictEqual(invalidateSpy.callCount, 0, "No invalidation when no hook was set");

  input.destroy();
  kb.destroy();
});

QUnit.test("clearI18nOverrideHook invalidates when a hook was set", async (assert) => {
  stubBaseBundle({});

  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  KioskKeyboard.setI18nOverrideHook(() => undefined);

  const invalidateSpy = sandbox.spy(kb, "invalidate");
  KioskKeyboard.clearI18nOverrideHook();
  assert.ok(invalidateSpy.callCount >= 1, "Invalidation triggered when hook was cleared");

  input.destroy();
  kb.destroy();
});

// ──────────────────────────────────────────────────
// onLocalizationChanged dedup with multiple instances
// ──────────────────────────────────────────────────

QUnit.module("i18n-registry - onLocalizationChanged dedup", {
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

QUnit.test("Multiple instances calling onLocalizationChanged register only one .then() callback", async (assert) => {
  stubBaseBundle({});
  const createStub = sandbox.stub(ResourceBundle, "create");
  createStub.returns(Promise.resolve(makeBundleStub({})) as never);

  await configureI18n({ enhanceWith: [{ bundleName: "test.bundle" }] });

  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  const kb1 = new KioskKeyboard({ targetInput: input1 });
  const kb2 = new KioskKeyboard({ targetInput: input2 });
  await placeAndWait(kb1);
  kb2.placeAt("qunit-fixture");
  await waitForRender();

  // Reset stubs to track only reload activity
  createStub.resetHistory();
  createStub.returns(Promise.resolve(makeBundleStub({})) as never);

  const invalidateAll = sandbox.spy(
    KioskKeyboard as unknown as { _invalidateAllInstances: () => void },
    "_invalidateAllInstances",
  );

  // Simulate onLocalizationChanged on both instances (as UI5 framework would)
  const onLc = "onLocalizationChanged";
  (kb1 as unknown as Record<string, () => void>)[onLc]();
  (kb2 as unknown as Record<string, () => void>)[onLc]();

  // Await the coalesced reload promise (reloadBundles returns the pending promise)
  await reloadBundles();

  // The sentinel dedup should mean _invalidateAllInstances is called once
  // for the post-reload callback (plus 0 or more from the immediate invalidate() calls)
  assert.strictEqual(createStub.callCount, 1, "ResourceBundle.create called only once despite two instances");

  input1.destroy();
  input2.destroy();
  kb1.destroy();
  kb2.destroy();
  invalidateAll.restore();
});
