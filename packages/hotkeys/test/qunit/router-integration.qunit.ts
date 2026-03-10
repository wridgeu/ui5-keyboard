import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { GLOBAL_SCOPE } from "ui5/hotkeys/library";
import { fireKey } from "./test-helpers";

interface MockRouter {
  attachBeforeRouteMatched: (handler: Function, listener: object) => void;
  detachBeforeRouteMatched: (handler: Function, listener: object) => void;
  fireRouteMatched: (name: string) => void;
  fireRouteMatchedUndefined: () => void;
}

function createMockRouter(): MockRouter {
  let _handler: Function | null = null;
  let _listener: object | null = null;
  return {
    attachBeforeRouteMatched(h: Function, l: object) {
      _handler = h;
      _listener = l;
    },
    detachBeforeRouteMatched(_h: Function, l: object) {
      if (_listener === l) {
        _handler = null;
        _listener = null;
      }
    },
    fireRouteMatched(name: string) {
      _handler?.call(_listener, {
        getParameter: (p: string) => (p === "name" ? name : undefined),
      });
    },
    fireRouteMatchedUndefined() {
      _handler?.call(_listener, {
        getParameter: () => undefined,
      });
    },
  };
}

QUnit.module("Router Integration", {
  beforeEach() {
    const existing = HotkeyManager.getInstance();
    existing.destroy();
  },
  afterEach() {
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

QUnit.test("Route change pushes scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router as any);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main", "Active scope is 'main' after route change");
});

QUnit.test("Route change resets previous scopes", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router as any);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  router.fireRouteMatched("detail");
  assert.strictEqual(manager.getActiveScope(), "detail", "Active scope is 'detail' after second route change");
});

QUnit.test("Hotkey fires in correct route scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router as any);

  let mainCalled = false;
  let detailCalled = false;

  manager.register(
    "F5",
    () => {
      mainCalled = true;
    },
    { scope: "main" },
  );
  manager.register(
    "F5",
    () => {
      detailCalled = true;
    },
    { scope: "detail" },
  );

  router.fireRouteMatched("main");
  fireKey("F5");
  assert.ok(mainCalled, "F5 fired in 'main' scope");
  assert.notOk(detailCalled, "F5 did not fire in 'detail' scope");

  mainCalled = false;
  router.fireRouteMatched("detail");
  fireKey("F5");
  assert.notOk(mainCalled, "F5 did not fire in 'main' scope after switching to 'detail'");
  assert.ok(detailCalled, "F5 fired in 'detail' scope");
});

QUnit.test("Global hotkey still fires after route change", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router as any);

  let globalCalled = false;
  manager.register("Ctrl+S", () => {
    globalCalled = true;
  });

  router.fireRouteMatched("main");
  fireKey("s", { ctrlKey: true });
  assert.ok(globalCalled, "Global Ctrl+S still fires after route change");
});

QUnit.test("Detach cleanup on destroy", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router as any);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  manager.destroy();

  // Get a fresh manager - route changes should have no effect
  const newManager = HotkeyManager.getInstance();
  router.fireRouteMatched("detail");
  assert.strictEqual(newManager.getActiveScope(), GLOBAL_SCOPE, "New manager unaffected by old router");
});

QUnit.test("Error on double enableRouterIntegration", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router as any);

  assert.throws(
    () => manager.enableRouterIntegration(router as any),
    /already enabled/,
    "Throws on double enableRouterIntegration",
  );
});

QUnit.test("Route with empty/undefined name only resets scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router as any);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  // Fire route with undefined name
  router.fireRouteMatchedUndefined();
  assert.strictEqual(manager.getActiveScope(), GLOBAL_SCOPE, "Scope reset to global when route name is undefined");
});

QUnit.test("hasRouterIntegration reflects router integration state", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();

  assert.notOk(manager.hasRouterIntegration(), "False before enable");

  manager.enableRouterIntegration(router as any);
  assert.ok(manager.hasRouterIntegration(), "True after enable");

  manager.disableRouterIntegration();
  assert.notOk(manager.hasRouterIntegration(), "False after disable");
});

// ──────────────────────────────────────────────
// disableRouterIntegration (C3)
// ──────────────────────────────────────────────

QUnit.test("disableRouterIntegration: disable stops scope updates", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router as any);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  manager.disableRouterIntegration();
  router.fireRouteMatched("detail");
  // Scope should NOT change - router is detached
  assert.strictEqual(manager.getActiveScope(), "main", "Scope unchanged after disable");
});

QUnit.test("disableRouterIntegration: throws when not enabled", (assert) => {
  const manager = HotkeyManager.getInstance();

  assert.throws(
    () => manager.disableRouterIntegration(),
    /not enabled/,
    "Throws when router integration is not enabled",
  );
});

QUnit.test("disableRouterIntegration: re-enable after disable", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();

  manager.enableRouterIntegration(router as any);
  manager.disableRouterIntegration();
  manager.resetToGlobalScope();

  // Re-enable and verify it works again
  manager.enableRouterIntegration(router as any);
  router.fireRouteMatched("settings");
  assert.strictEqual(manager.getActiveScope(), "settings", "Scope changes after re-enable");
});
