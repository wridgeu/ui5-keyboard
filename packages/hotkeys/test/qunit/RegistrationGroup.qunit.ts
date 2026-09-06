import { createHotkeyManager, destroyHotkeyManager, fireKey } from "./test-helpers";

QUnit.module("RegistrationGroup", {
  beforeEach() {
    destroyHotkeyManager();
  },
  afterEach() {
    destroyHotkeyManager();
  },
});

QUnit.test("group.register delegates to manager and tracks handle", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  let called = false;

  const handle = group.register("F5", () => {
    called = true;
  });

  assert.ok(handle.isActive, "Handle is active");
  assert.strictEqual(group.size, 1, "Group size is 1");
  assert.strictEqual(manager.getRegistrations().length, 1, "Manager has 1 registration");

  fireKey("F5");
  assert.ok(called, "Callback fires via group registration");
});

QUnit.test("group.register with sequence delegates and tracks", (assert) => {
  assert.expect(4);
  const manager = createHotkeyManager();
  const group = manager.createGroup();

  const handle = group.register("G I", () => {
    assert.ok(true, "Sequence callback fired");
    assert.strictEqual(group.size, 1, "Group size is 1 (sequence)");
  });

  assert.ok(handle.isActive, "Sequence handle is active");
  assert.strictEqual(group.size, 1, "Group size is 1");

  fireKey("g");
  fireKey("i");
});

QUnit.test("getRegistrations returns both hotkeys and sequences for this group", (assert) => {
  const manager = createHotkeyManager();
  const groupA = manager.createGroup();
  const groupB = manager.createGroup();

  const aHotkey = groupA.register("F5", () => {}, { description: "A" });
  groupA.register("G I", () => {}, { description: "A-seq" });

  groupB.register("F6", () => {}, { description: "B" });
  groupB.register("G H", () => {}, { description: "B-seq" });

  const aRegistrations = groupA.getRegistrations();
  const aSequences = groupA.getRegistrations().filter((r) => r.sequence !== null);

  assert.strictEqual(aRegistrations.length, 2, "Group A returns both hotkey and sequence registrations");
  assert.strictEqual(aRegistrations[0]?.id, aHotkey.id, "Hotkey registration id matches Group A handle");
  assert.strictEqual(aSequences.length, 1, "Group A has one sequence registration");
  assert.strictEqual(aSequences[0]?.description, "A-seq", "Sequence registration belongs to Group A");

  aHotkey.unregister();
  assert.strictEqual(groupA.getRegistrations().length, 1, "Unregistered group hotkey is removed from introspection");
});

QUnit.test("destroyAll unregisters all handles", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  let hotkeyCalled = false;

  group.register("F5", () => {
    hotkeyCalled = true;
  });
  group.register("F6", () => {});

  assert.strictEqual(group.size, 2, "Group has 2 registrations");
  assert.strictEqual(manager.getRegistrations().length, 2, "Manager has 2 registrations");

  group.destroyAll();

  assert.ok(group.isDestroyed, "Group is destroyed");
  assert.strictEqual(group.size, 0, "Group size is 0 after destroyAll");
  assert.strictEqual(manager.getRegistrations().length, 0, "Manager has 0 registrations");

  fireKey("F5");
  assert.notOk(hotkeyCalled, "Callback does not fire after destroyAll");
});

QUnit.test("destroyAll only affects its own group", (assert) => {
  const manager = createHotkeyManager();
  const groupA = manager.createGroup();
  const groupB = manager.createGroup();

  let aCalled = false;
  let bCalled = false;

  groupA.register("F5", () => {
    aCalled = true;
  });
  groupB.register("F6", () => {
    bCalled = true;
  });

  assert.strictEqual(manager.getRegistrations().length, 2, "Two registrations before cleanup");

  groupA.destroyAll();

  assert.ok(groupA.isDestroyed, "Group A is destroyed");
  assert.notOk(groupB.isDestroyed, "Group B remains active");
  assert.strictEqual(manager.getRegistrations().length, 1, "Only Group A registrations were removed");

  fireKey("F5");
  fireKey("F6");

  assert.notOk(aCalled, "Group A callback no longer fires");
  assert.ok(bCalled, "Group B callback still fires");
});

QUnit.test("destroyAll is idempotent", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();

  group.register("F5", () => {});
  group.destroyAll();
  group.destroyAll(); // second call - no throw

  assert.ok(group.isDestroyed, "Still destroyed after second call");
  assert.strictEqual(group.size, 0, "Size is 0");
});

QUnit.test("manager destroy finalizes group lifecycle", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();

  const hotkeyHandle = group.register("F5", () => {});
  const sequenceHandle = group.register("G I", () => {});

  manager.destroy();

  assert.ok(group.isDestroyed, "Group is destroyed when manager is destroyed");
  assert.strictEqual(group.size, 0, "Group size is 0 after manager destroy");
  assert.notOk(hotkeyHandle.isActive, "Hotkey handle is inactive after manager destroy");
  assert.notOk(sequenceHandle.isActive, "Sequence handle is inactive after manager destroy");
  assert.throws(
    () => group.register("F6", () => {}),
    /destroyed RegistrationGroup/,
    "Group rejects new registrations after manager destroy",
  );
});

QUnit.test("size reflects active registrations", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();

  const h1 = group.register("F5", () => {});
  group.register("F6", () => {});

  assert.strictEqual(group.size, 2, "Size is 2 after two registrations");

  h1.unregister();
  assert.strictEqual(group.size, 1, "Size decrements when individual handle is unregistered");
});

QUnit.test("Registering on a destroyed group throws", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();

  group.destroyAll();

  assert.throws(
    () => group.register("F5", () => {}),
    /destroyed RegistrationGroup/,
    "register throws on destroyed group",
  );
});

// ──────────────────────────────────────────────
// Per-registration onPending callback
// ──────────────────────────────────────────────

QUnit.test("onPending fires on intermediate key and dies with unregister", (assert) => {
  const manager = createHotkeyManager();
  const group = manager.createGroup();
  const calls: string[] = [];

  const handle = group.register("G I", () => {}, {
    onPending: () => {
      calls.push("pending");
    },
  });

  fireKey("g");
  assert.strictEqual(calls.length, 1, "onPending fires on intermediate key");

  handle.unregister();

  // New sequence without onPending - should not fire the old callback
  group.register("G I", () => {});
  fireKey("g");
  assert.strictEqual(calls.length, 1, "onPending does not fire after unregister");
  group.destroyAll();
});
