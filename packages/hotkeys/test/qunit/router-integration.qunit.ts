/*
 * This suite proves the duck-typed half of `enableRouterIntegration`'s documented contract:
 * "A UI5 Router or any object with `attachBeforeRouteMatched` / `detachBeforeRouteMatched`".
 * The parameter is declared as the `Router` class, so exercising that promise means handing it
 * something deliberately not a Router - hence `MockRouter as unknown as Router` throughout. A
 * real Router is not a substitute: it would prove only the concrete path, and driving it needs
 * `fireBeforeRouteMatched`, which UI5 marks `@ui5-protected`.
 */
import type Router from "sap/ui/core/routing/Router";
import { GLOBAL_SCOPE } from "ui5/hotkeys/library";
import { createHotkeyManager, destroyHotkeyManager, fireKey } from "./test-helpers";

interface MockRouter {
  attachBeforeRouteMatched: (handler: (...args: any[]) => void, listener: object) => void;
  detachBeforeRouteMatched: (handler: (...args: any[]) => void, listener: object) => void;
  attachBypassed: (handler: (...args: any[]) => void, listener: object) => void;
  detachBypassed: (handler: (...args: any[]) => void, listener: object) => void;
  fireRouteMatched: (name: string) => void;
  fireRouteMatchedUndefined: () => void;
  fireBypassed: () => void;
}

function createMockRouter(): MockRouter {
  let _handler: ((...args: any[]) => void) | null = null;
  let _listener: object | null = null;
  let _bypassedHandler: ((...args: any[]) => void) | null = null;
  let _bypassedListener: object | null = null;
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
    attachBypassed(h: (...args: any[]) => void, l: object) {
      _bypassedHandler = h;
      _bypassedListener = l;
    },
    detachBypassed(_h: (...args: any[]) => void, l: object) {
      if (_bypassedListener === l) {
        _bypassedHandler = null;
        _bypassedListener = null;
      }
    },
    fireBypassed() {
      _bypassedHandler?.call(_bypassedListener, {
        getParameter: (p: string) => (p === "hash" ? "#/bogus" : undefined),
      });
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
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main", "Active scope is 'main' after route change");
});

QUnit.test("Route change resets previous scopes", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  router.fireRouteMatched("detail");
  assert.strictEqual(manager.getActiveScope(), "detail", "Active scope is 'detail' after second route change");

  // With reset semantics the stack is [global, detail]; popping "detail" yields
  // global. If the handler merely stacked scopes, "main" would remain underneath.
  manager.popScope("detail");
  assert.strictEqual(
    manager.getActiveScope(),
    GLOBAL_SCOPE,
    "previous 'main' scope was reset, not stacked under 'detail'",
  );
});

QUnit.test("Hotkey fires in correct route scope", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

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
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

  let globalCalled = false;
  manager.register("Ctrl+S", () => {
    globalCalled = true;
  });

  router.fireRouteMatched("main");
  fireKey("s", { ctrlKey: true });
  assert.ok(globalCalled, "Global Ctrl+S still fires after route change");
});

QUnit.test("Detach cleanup on destroy", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  group.destroyAll();
  manager.destroy();

  const newManager = createHotkeyManager();
  router.fireRouteMatched("detail");
  assert.strictEqual(newManager.getActiveScope(), GLOBAL_SCOPE, "New manager unaffected by old router");
});

QUnit.test("Calling enableRouterIntegration twice replaces the previous router", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router1 = createMockRouter();
  const router2 = createMockRouter();

  group.enableRouterIntegration(router1 as unknown as Router);
  group.enableRouterIntegration(router2 as unknown as Router);

  manager.pushScope("initial");
  router2.fireRouteMatched("newRoute");
  assert.strictEqual(manager.getActiveScope(), "newRoute", "Second router is active");

  router1.fireRouteMatched("staleRoute");
  assert.strictEqual(manager.getActiveScope(), "newRoute", "First router is detached");
});

QUnit.test("Route with empty/undefined name only resets scope", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  // Fire route with undefined name
  router.fireRouteMatchedUndefined();
  assert.strictEqual(manager.getActiveScope(), GLOBAL_SCOPE, "Scope reset to global when route name is undefined");
});

QUnit.test("destroyAll detaches router integration", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  group.destroyAll();
  router.fireRouteMatched("detail");
  assert.strictEqual(manager.getActiveScope(), "main", "Scope unchanged after group destroyed");
});

QUnit.test("Bypassed route resets to global scope", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

  router.fireRouteMatched("integration");
  assert.strictEqual(manager.getActiveScope(), "integration");

  router.fireBypassed();
  assert.strictEqual(
    manager.getActiveScope(),
    GLOBAL_SCOPE,
    "not-found target carries the global scope, not the previous route's",
  );
});

QUnit.test("destroyAll detaches the bypassed listener", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createMockRouter();
  group.enableRouterIntegration(router as unknown as Router);

  group.destroyAll();
  manager.pushScope("manual");
  router.fireBypassed();
  assert.strictEqual(manager.getActiveScope(), "manual", "Scope unchanged after group destroyed");
});

QUnit.test("New group can re-enable router integration after previous group destroyed", (assert) => {
  const manager = createHotkeyManager();
  const group1 = manager.createGroup();
  const router = createMockRouter();
  group1.enableRouterIntegration(router as unknown as Router);

  router.fireRouteMatched("main");
  assert.strictEqual(manager.getActiveScope(), "main");

  group1.destroyAll();
  manager.resetToGlobalScope();

  const group2 = manager.createGroup();
  group2.enableRouterIntegration(router as unknown as Router);
  router.fireRouteMatched("settings");
  assert.strictEqual(manager.getActiveScope(), "settings", "New group's router integration works");

  group2.destroyAll();
});
