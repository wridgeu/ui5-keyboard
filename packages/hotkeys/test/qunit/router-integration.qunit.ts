import Router from "sap/ui/core/routing/Router";
import { GLOBAL_SCOPE } from "ui5/hotkeys/library";
import { createHotkeyManager, destroyHotkeyManager, fireKey } from "./test-helpers";

const openRouters: Router[] = [];

/**
 * A Router with no routes and no owner component. It is never initialized, so it
 * drives no hash: the tests fire `beforeRouteMatched` on it directly.
 */
function createRouter(): Router {
  const router = new Router();
  openRouters.push(router);
  return router;
}

QUnit.module("Router Integration", {
  beforeEach() {
    destroyHotkeyManager();
  },
  afterEach() {
    destroyHotkeyManager();
    for (const router of openRouters.splice(0)) {
      router.destroy();
    }
  },
});

QUnit.test("Route change pushes scope", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createRouter();
  group.enableRouterIntegration(router);

  router.fireBeforeRouteMatched({ name: "main" });
  assert.strictEqual(manager.getActiveScope(), "main", "Active scope is 'main' after route change");
});

QUnit.test("Route change resets previous scopes", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createRouter();
  group.enableRouterIntegration(router);

  router.fireBeforeRouteMatched({ name: "main" });
  assert.strictEqual(manager.getActiveScope(), "main");

  router.fireBeforeRouteMatched({ name: "detail" });
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
  const router = createRouter();
  group.enableRouterIntegration(router);

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

  router.fireBeforeRouteMatched({ name: "main" });
  fireKey("F5");
  assert.ok(mainCalled, "F5 fired in 'main' scope");
  assert.notOk(detailCalled, "F5 did not fire in 'detail' scope");

  mainCalled = false;
  router.fireBeforeRouteMatched({ name: "detail" });
  fireKey("F5");
  assert.notOk(mainCalled, "F5 did not fire in 'main' scope after switching to 'detail'");
  assert.ok(detailCalled, "F5 fired in 'detail' scope");
});

QUnit.test("Global hotkey still fires after route change", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createRouter();
  group.enableRouterIntegration(router);

  let globalCalled = false;
  manager.register("Ctrl+S", () => {
    globalCalled = true;
  });

  router.fireBeforeRouteMatched({ name: "main" });
  fireKey("s", { ctrlKey: true });
  assert.ok(globalCalled, "Global Ctrl+S still fires after route change");
});

QUnit.test("Detach cleanup on destroy", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createRouter();
  group.enableRouterIntegration(router);

  router.fireBeforeRouteMatched({ name: "main" });
  assert.strictEqual(manager.getActiveScope(), "main");

  group.destroyAll();
  manager.destroy();

  const newManager = createHotkeyManager();
  router.fireBeforeRouteMatched({ name: "detail" });
  assert.strictEqual(newManager.getActiveScope(), GLOBAL_SCOPE, "New manager unaffected by old router");
});

QUnit.test("Calling enableRouterIntegration twice replaces the previous router", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router1 = createRouter();
  const router2 = createRouter();

  group.enableRouterIntegration(router1);
  group.enableRouterIntegration(router2);

  manager.pushScope("initial");
  router2.fireBeforeRouteMatched({ name: "newRoute" });
  assert.strictEqual(manager.getActiveScope(), "newRoute", "Second router is active");

  router1.fireBeforeRouteMatched({ name: "staleRoute" });
  assert.strictEqual(manager.getActiveScope(), "newRoute", "First router is detached");
});

QUnit.test("Route with empty/undefined name only resets scope", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createRouter();
  group.enableRouterIntegration(router);

  router.fireBeforeRouteMatched({ name: "main" });
  assert.strictEqual(manager.getActiveScope(), "main");

  // Fire route with undefined name
  router.fireBeforeRouteMatched({});
  assert.strictEqual(manager.getActiveScope(), GLOBAL_SCOPE, "Scope reset to global when route name is undefined");
});

QUnit.test("destroyAll detaches router integration", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createRouter();
  group.enableRouterIntegration(router);

  router.fireBeforeRouteMatched({ name: "main" });
  assert.strictEqual(manager.getActiveScope(), "main");

  group.destroyAll();
  router.fireBeforeRouteMatched({ name: "detail" });
  assert.strictEqual(manager.getActiveScope(), "main", "Scope unchanged after group destroyed");
});

QUnit.test("Router integration reads only the two documented router members", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const router = createRouter();

  // `enableRouterIntegration` accepts any object carrying `attachBeforeRouteMatched` /
  // `detachBeforeRouteMatched`, so a JS caller may hand it a stand-in that implements
  // nothing else. This stand-in exposes exactly that pair (bound to the real router so
  // the router's own internals stay off the record) and answers every other member with
  // `undefined`. The traps below record what the implementation reaches for, so that
  // widening it beyond the documented pair fails here rather than silently narrowing
  // the contract for JS callers. Today's implementation trips none of them.
  const DOCUMENTED = new Set(["attachBeforeRouteMatched", "detachBeforeRouteMatched"]);
  const otherMembers = new Set<string>();
  const standInRouter = new Proxy(router, {
    get(_target, member) {
      if (member === "attachBeforeRouteMatched") return router.attachBeforeRouteMatched.bind(router);
      if (member === "detachBeforeRouteMatched") return router.detachBeforeRouteMatched.bind(router);
      otherMembers.add(String(member));
      return undefined;
    },
    // `in` is trapped as well as property reads: a capability check written as
    // `if ("getRoute" in router)` would otherwise forward to the real target and
    // answer true without the widening ever being recorded.
    has(_target, member) {
      if (DOCUMENTED.has(String(member))) return true;
      otherMembers.add(String(member));
      return false;
    },
    // A plain-object prototype, so an `instanceof Router` narrowing would fail here
    // exactly as it does for a JS caller passing a hand-rolled stand-in.
    getPrototypeOf() {
      return Object.prototype;
    },
  });
  assert.notOk(standInRouter instanceof Router, "the stand-in is not a Router instance");

  group.enableRouterIntegration(standInRouter);
  router.fireBeforeRouteMatched({ name: "main" });
  assert.strictEqual(manager.getActiveScope(), "main", "attach ran through the stand-in router");

  group.destroyAll();
  router.fireBeforeRouteMatched({ name: "detail" });
  assert.strictEqual(manager.getActiveScope(), "main", "detach ran through the stand-in router");

  assert.deepEqual([...otherMembers], [], "no member outside the documented pair is read or probed");
});

QUnit.test("New group can re-enable router integration after previous group destroyed", (assert) => {
  const manager = createHotkeyManager();
  const group1 = manager.createGroup();
  const router = createRouter();
  group1.enableRouterIntegration(router);

  router.fireBeforeRouteMatched({ name: "main" });
  assert.strictEqual(manager.getActiveScope(), "main");

  group1.destroyAll();
  manager.resetToGlobalScope();

  const group2 = manager.createGroup();
  group2.enableRouterIntegration(router);
  router.fireBeforeRouteMatched({ name: "settings" });
  assert.strictEqual(manager.getActiveScope(), "settings", "New group's router integration works");

  group2.destroyAll();
});
