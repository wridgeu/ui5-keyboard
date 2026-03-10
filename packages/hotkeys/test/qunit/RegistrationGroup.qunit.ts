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
  assert.expect(4);
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  const handle = group.registerSequence(["G", "I"], () => {
    assert.ok(true, "Sequence callback fired");
    assert.strictEqual(group.size, 1, "Group size is 1 (sequence)");
  });

  assert.ok(handle.isActive, "Sequence handle is active");
  assert.strictEqual(group.size, 1, "Group size is 1");

  fireKey("g");
  fireKey("i");
});

QUnit.test("getRegistrations/getSequenceRegistrations return only this group's entries", (assert) => {
  const manager = HotkeyManager.getInstance();
  const groupA = manager.createGroup();
  const groupB = manager.createGroup();

  const aHotkey = groupA.register("F5", () => {}, { description: "A" });
  groupA.registerSequence(["G", "I"], () => {}, { description: "A-seq" });

  groupB.register("F6", () => {}, { description: "B" });
  groupB.registerSequence(["G", "H"], () => {}, { description: "B-seq" });

  const aRegistrations = groupA.getRegistrations();
  const aSequences = groupA.getSequenceRegistrations();

  assert.strictEqual(aRegistrations.length, 1, "Group A returns only its hotkey registration");
  assert.strictEqual(aRegistrations[0]?.id, aHotkey.id, "Hotkey registration id matches Group A handle");
  assert.strictEqual(aSequences.length, 1, "Group A returns only its sequence registration");
  assert.strictEqual(aSequences[0]?.description, "A-seq", "Sequence registration belongs to Group A");

  aHotkey.unregister();
  assert.strictEqual(groupA.getRegistrations().length, 0, "Unregistered group hotkey is removed from introspection");
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

QUnit.test("destroyAll only affects its own group", (assert) => {
  const manager = HotkeyManager.getInstance();
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
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  group.register("F5", () => {});
  group.destroyAll();
  group.destroyAll(); // second call - no throw

  assert.ok(group.isDestroyed, "Still destroyed after second call");
  assert.strictEqual(group.size, 0, "Size is 0");
});

QUnit.test("manager destroy finalizes group lifecycle", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();

  const hotkeyHandle = group.register("F5", () => {});
  const sequenceHandle = group.registerSequence(["G", "I"], () => {});

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

// ──────────────────────────────────────────────
// Per-registration onPending callback
// ──────────────────────────────────────────────

QUnit.test("onPending fires on intermediate key and dies with unregister", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();
  const calls: string[] = [];

  const handle = group.registerSequence(["G", "I"], () => {}, {
    onPending: () => {
      calls.push("pending");
    },
  });

  fireKey("g");
  assert.strictEqual(calls.length, 1, "onPending fires on intermediate key");

  handle.unregister();

  // New sequence without onPending - should not fire the old callback
  group.registerSequence(["G", "I"], () => {});
  fireKey("g");
  assert.strictEqual(calls.length, 1, "onPending does not fire after unregister");
  group.destroyAll();
});

QUnit.test("onPending dies with group.destroyAll", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();
  const calls: string[] = [];

  group.registerSequence(["G", "I"], () => {}, {
    onPending: () => {
      calls.push("pending");
    },
  });

  fireKey("g");
  assert.strictEqual(calls.length, 1, "Fires before destroyAll");

  group.destroyAll();

  // New sequence on fresh group - old onPending must not fire
  const group2 = manager.createGroup();
  group2.registerSequence(["G", "I"], () => {});
  fireKey("g");
  assert.strictEqual(calls.length, 1, "Does not fire after destroyAll");
  group2.destroyAll();
});

QUnit.test("onPending takes precedence over global setSequencePendingHandler", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();
  const calls: string[] = [];

  manager.setSequencePendingHandler(() => {
    calls.push("global");
  });

  group.registerSequence(["G", "I"], () => {}, {
    onPending: () => {
      calls.push("per-reg");
    },
  });

  fireKey("g");
  assert.deepEqual(calls, ["per-reg"], "Per-registration callback wins over global");

  group.destroyAll();
  manager.setSequencePendingHandler(null);
});

QUnit.test("global pending handler fires when onPending is not set", (assert) => {
  const manager = HotkeyManager.getInstance();
  const group = manager.createGroup();
  const calls: string[] = [];

  manager.setSequencePendingHandler(() => {
    calls.push("global");
  });

  group.registerSequence(["G", "I"], () => {});

  fireKey("g");
  assert.deepEqual(calls, ["global"], "Global handler fires as fallback");

  group.destroyAll();
  manager.setSequencePendingHandler(null);
});
