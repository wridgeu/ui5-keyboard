import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { GLOBAL_SCOPE } from "ui5/hotkeys/library";
import { destroyHotkeyManager, fireKey } from "./test-helpers";

interface MockRouter {
  attachBeforeRouteMatched: (handler: (...args: any[]) => void, listener: object) => void;
  detachBeforeRouteMatched: (handler: (...args: any[]) => void, listener: object) => void;
  fireRouteMatched: (name: string) => void;
  fireRouteMatchedUndefined: () => void;
}

function createMockRouter(): MockRouter {
  let _handler: ((...args: any[]) => void) | null = null;
  let _listener: object | null = null;
  return {
    attachBeforeRouteMatched(h: (...args: any[]) => void, l: object) {
      _handler = h;
      _listener = l;
    },
    detachBeforeRouteMatched(_h: (...args: any[]) => void, l: object) {
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
    destroyHotkeyManager();
  },
  afterEach() {
    destroyHotkeyManager();
  },
});

QUnit.test("Route change pushes scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main", "Active scope is 'main' after route change");
});

QUnit.test("Route change resets previous scopes", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  router.fireRouteMatched("detail");
  assert.strictEqual(manager.getActiveScope(), "detail", "Active scope is 'detail' after second route change");
});

QUnit.test("Hotkey fires in correct route scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router);

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
  manager.enableRouterIntegration(router);

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
  manager.enableRouterIntegration(router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  manager.destroy();

  // Get a fresh manager - route changes should have no effect
  const newManager = HotkeyManager.getInstance();
  router.fireRouteMatched("detail");
  assert.strictEqual(newManager.getActiveScope(), GLOBAL_SCOPE, "New manager unaffected by old router");
});

QUnit.test("Calling enableRouterIntegration twice replaces the previous router", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router1 = createMockRouter();
  const router2 = createMockRouter();

  manager.enableRouterIntegration(router1);
  manager.enableRouterIntegration(router2);

  // The second router should be active -- fire a route match on it
  manager.pushScope("initial");
  router2.fireRouteMatched("newRoute");
  assert.strictEqual(manager.getActiveScope(), "newRoute", "Second router is active");

  // The first router should be detached -- firing on it has no effect
  router1.fireRouteMatched("staleRoute");
  assert.strictEqual(manager.getActiveScope(), "newRoute", "First router is detached");
});

QUnit.test("Route with empty/undefined name only resets scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();
  manager.enableRouterIntegration(router);

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

  manager.enableRouterIntegration(router);
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
  manager.enableRouterIntegration(router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  manager.disableRouterIntegration();
  router.fireRouteMatched("detail");
  // Scope should NOT change - router is detached
  assert.strictEqual(manager.getActiveScope(), "main", "Scope unchanged after disable");
});

QUnit.test("disableRouterIntegration: no-op when not enabled", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.disableRouterIntegration();
  assert.ok(true, "No error when calling disableRouterIntegration without enable");
});

QUnit.test("disableRouterIntegration: re-enable after disable", (assert) => {
  const manager = HotkeyManager.getInstance();
  const router = createMockRouter();

  manager.enableRouterIntegration(router);
  manager.disableRouterIntegration();
  manager.resetToGlobalScope();

  // Re-enable and verify it works again
  manager.enableRouterIntegration(router);
  router.fireRouteMatched("settings");
  assert.strictEqual(manager.getActiveScope(), "settings", "Scope changes after re-enable");
});
