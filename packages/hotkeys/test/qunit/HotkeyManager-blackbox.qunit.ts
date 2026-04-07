import { GLOBAL_SCOPE } from "ui5/hotkeys/library";
import { createHotkeyManager, destroyHotkeyManager, fireKey, fireKeyOn } from "./test-helpers";

const fixture = document.getElementById("qunit-fixture")!;

QUnit.module("HotkeyManager - Black-Box Contracts", {
  beforeEach() {
    destroyHotkeyManager();
  },
  afterEach() {
    destroyHotkeyManager();
  },
});

// ──────────────────────────────────────────────
// 1. Active scope precedence over global
// ──────────────────────────────────────────────

QUnit.test("Active scope handler fires instead of global for same key", (assert) => {
  const manager = createHotkeyManager();
  let globalFired = false;
  let scopedFired = false;

  manager.register(
    "Escape",
    () => {
      globalFired = true;
    },
    { scope: GLOBAL_SCOPE },
  );

  manager.register(
    "Escape",
    () => {
      scopedFired = true;
    },
    { scope: "editor" },
  );

  manager.pushScope("editor");
  fireKey("Escape");

  assert.ok(scopedFired, "Scoped handler fired");
  assert.notOk(globalFired, "Global handler suppressed by active scope");
});

// ──────────────────────────────────────────────
// 2. Target-bound registration isolation
// ──────────────────────────────────────────────

QUnit.test("Target-bound hotkey only fires on its own element", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const elementA = document.createElement("div");
  elementA.tabIndex = 0;
  fixture.appendChild(elementA);

  const elementB = document.createElement("div");
  elementB.tabIndex = 0;
  fixture.appendChild(elementB);

  manager.register(
    "Escape",
    () => {
      called = true;
    },
    { target: elementA },
  );

  // Fire on elementB - should NOT trigger
  fireKeyOn(elementB, "Escape");
  assert.notOk(called, "Callback does not fire on non-target element");

  // Fire on elementA - should trigger
  fireKeyOn(elementA, "Escape");
  assert.ok(called, "Callback fires on target element");
});

// ──────────────────────────────────────────────
// 3. preventDefault contract
// ──────────────────────────────────────────────

QUnit.test("preventDefault: false leaves event.defaultPrevented as false", (assert) => {
  const manager = createHotkeyManager();

  manager.register("F5", () => {}, { preventDefault: false });

  const event = fireKey("F5");
  assert.notOk(event.defaultPrevented, "Default was not prevented");
});

QUnit.test("preventDefault: default (true) sets event.defaultPrevented", (assert) => {
  const manager = createHotkeyManager();

  manager.register("F5", () => {});

  const event = fireKey("F5");
  assert.ok(event.defaultPrevented, "Default was prevented");
});

// ──────────────────────────────────────────────
// 4. stopPropagation contract
// ──────────────────────────────────────────────

QUnit.test("stopPropagation: default (true) blocks bubble-phase listener", (assert) => {
  const manager = createHotkeyManager();
  let propagated = false;

  const listener = () => {
    propagated = true;
  };
  document.addEventListener("keydown", listener);

  manager.register("F5", () => {});
  fireKey("F5");

  assert.notOk(propagated, "Bubble-phase listener did not fire");
  document.removeEventListener("keydown", listener);
});

QUnit.test("stopPropagation: false allows bubble-phase listener to fire", (assert) => {
  const manager = createHotkeyManager();
  let propagated = false;

  const listener = () => {
    propagated = true;
  };
  document.addEventListener("keydown", listener);

  manager.register("F5", () => {}, { stopPropagation: false });
  fireKey("F5");

  assert.ok(propagated, "Bubble-phase listener fired");
  document.removeEventListener("keydown", listener);
});

// ──────────────────────────────────────────────
// 5. Input suppression (ignoreInputs: "auto")
// ──────────────────────────────────────────────

QUnit.test("ignoreInputs auto: single-key F5 suppressed in <input>", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.register("F5", () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "F5");
  assert.notOk(called, "Single-key hotkey suppressed in text input");
});

QUnit.test("ignoreInputs auto: Ctrl+S fires in <input>", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.register("Ctrl+S", () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "s", { ctrlKey: true });
  assert.ok(called, "Ctrl combo fires in text input under auto mode");
});

QUnit.test("ignoreInputs auto: Escape fires in <input>", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.register("Escape", () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "Escape");
  assert.ok(called, "Escape fires in text input under auto mode");
});

// ──────────────────────────────────────────────
// 6. Lifecycle cleanup
// ──────────────────────────────────────────────

QUnit.test("handle.unregister() stops handling and marks handle inactive", (assert) => {
  const manager = createHotkeyManager();
  let count = 0;

  const handle = manager.register("Escape", () => {
    count++;
  });

  fireKey("Escape");
  assert.strictEqual(count, 1, "Callback fired before unregister");

  handle.unregister();
  assert.notOk(handle.isActive, "Handle is inactive after unregister");

  fireKey("Escape");
  assert.strictEqual(count, 1, "Callback did not fire after unregister");
});

QUnit.test("manager.destroy() stops handling; double destroy is safe; fresh instance is clean", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.register("Escape", () => {
    called = true;
  });

  manager.destroy();

  fireKey("Escape");
  assert.notOk(called, "Callback does not fire after destroy");

  // Second destroy must not throw
  manager.destroy();
  assert.ok(true, "Double destroy did not throw");

  // Fresh instance should be empty
  const fresh = createHotkeyManager();
  assert.strictEqual(fresh.getRegistrations().length, 0, "Fresh instance has no registrations");
  assert.strictEqual(fresh.getActiveScope(), GLOBAL_SCOPE, "Fresh instance scope is global");
});
