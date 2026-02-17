import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { fireKey } from "./test-helpers";

QUnit.module("RegistrationGroup", {
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

QUnit.test("createGroup returns a RegistrationGroup", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  assert.ok(group, "Group is truthy");
  assert.strictEqual(group.size, 0, "Empty group has size 0");
  assert.notOk(group.isDestroyed, "New group is not destroyed");
});

QUnit.test("group.register delegates to manager and tracks handle", (assert) => {
  const manager = HotkeyManager.getInstance();
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

QUnit.test("group.registerSequence delegates and tracks", (assert) => {
  const done = assert.async();
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  const handle = group.registerSequence(["G", "I"], () => {
    assert.ok(true, "Sequence callback fired");
    assert.strictEqual(group.size, 1, "Group size is 1 (sequence)");
    done();
  });

  assert.ok(handle.isActive, "Sequence handle is active");
  assert.strictEqual(group.size, 1, "Group size is 1");

  fireKey("g");
  setTimeout(() => {
    fireKey("i");
  }, 50);
});

QUnit.test("destroyAll unregisters all handles", (assert) => {
  const manager = HotkeyManager.getInstance();
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

QUnit.test("destroyAll is idempotent", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  group.register("F5", () => {});
  group.destroyAll();
  group.destroyAll(); // second call — no throw

  assert.ok(group.isDestroyed, "Still destroyed after second call");
  assert.strictEqual(group.size, 0, "Size is 0");
});

QUnit.test("size reflects active registrations", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  const h1 = group.register("F5", () => {});
  group.register("F6", () => {});

  assert.strictEqual(group.size, 2, "Size is 2 after two registrations");

  h1.unregister();
  assert.strictEqual(group.size, 1, "Size decrements when individual handle is unregistered");
});

QUnit.test("size decrements for individually unregistered sequences", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  group.register("F5", () => {});
  const seqHandle = group.registerSequence(["G", "I"], () => {});

  assert.strictEqual(group.size, 2, "Size counts hotkeys and sequences");

  seqHandle.unregister();
  assert.strictEqual(group.size, 1, "Size decrements after sequence unregister");
});

QUnit.test("Registering on a destroyed group throws", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  group.destroyAll();

  assert.throws(
    () => group.register("F5", () => {}),
    /destroyed RegistrationGroup/,
    "register throws on destroyed group",
  );

  assert.throws(
    () => group.registerSequence(["G", "I"], () => {}),
    /destroyed RegistrationGroup/,
    "registerSequence throws on destroyed group",
  );
});

QUnit.test("Handles returned by group are normal handles", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();
  let count = 0;

  const handle = group.register("F5", () => {
    count++;
  });

  // setOptions works
  handle.setOptions({ enabled: false });
  fireKey("F5");
  assert.strictEqual(count, 0, "Disabled via setOptions");

  handle.setOptions({ enabled: true });
  fireKey("F5");
  assert.strictEqual(count, 1, "Re-enabled via setOptions");

  // unregister works
  handle.unregister();
  assert.notOk(handle.isActive, "Handle is inactive after unregister");
});
