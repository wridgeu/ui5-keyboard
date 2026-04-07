import { createHotkeyManager, destroyHotkeyManager, fireKey, fireKeyOn } from "./test-helpers";

const fixture = document.getElementById("qunit-fixture")!;
let clock: { tick: (ms: number) => number; restore: () => void };

QUnit.module("SequenceManager (via HotkeyManager)", {
  beforeEach() {
    destroyHotkeyManager();
    clock = sinon.useFakeTimers();
  },
  afterEach() {
    clock.restore();
    destroyHotkeyManager();
  },
});

QUnit.test("2-key sequence fires callback", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.ok(called, "G E sequence fired");
});

QUnit.test("Timeout resets sequence", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { timeout: 100 },
  );

  fireKey("g");
  clock.tick(200);
  fireKey("e");

  assert.notOk(called, "Sequence did not fire after timeout");
});

QUnit.test("Modifier sequences work", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["Ctrl+K", "Ctrl+S"], () => {
    called = true;
  });

  fireKey("k", { ctrlKey: true });
  clock.tick(50);
  fireKey("s", { ctrlKey: true });

  assert.ok(called, "Ctrl+K Ctrl+S sequence fired");
});

QUnit.test("Mismatch resets sequence", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  fireKey("g");
  clock.tick(50);
  fireKey("x");

  assert.notOk(called, "Sequence did not fire after mismatch");
});

QUnit.test("Overlapping sequences: G E vs G G", (assert) => {
  const manager = createHotkeyManager();
  let geCalled = false;
  let ggCalled = false;

  manager.registerSequence(["G", "E"], () => {
    geCalled = true;
  });
  manager.registerSequence(["G", "G"], () => {
    ggCalled = true;
  });

  fireKey("g");
  clock.tick(50);
  fireKey("g");

  assert.ok(ggCalled, "G G sequence fired");
  assert.notOk(geCalled, "G E sequence did not fire");
});

QUnit.test("Repeated keydown does not advance duplicate-key sequence", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "G"], () => {
    called = true;
  });

  fireKey("g");
  clock.tick(20);
  fireKey("g", { repeat: true });

  assert.notOk(called, "Repeated keydown from a held key does not complete sequence");

  fireKey("g");
  assert.ok(called, "A new non-repeat keydown completes sequence");
});

QUnit.test("Scope filtering", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { scope: "editor" },
  );

  fireKey("g");
  clock.tick(50);
  fireKey("e");
  assert.notOk(called, "Sequence did not fire in wrong scope");

  manager.pushScope("editor");
  fireKey("g");
  clock.tick(50);
  fireKey("e");
  assert.ok(called, "Sequence fires in correct scope");
});

QUnit.test("Active scope sequence wins over global on completion", (assert) => {
  const manager = createHotkeyManager();
  let scopedCalled = false;
  let globalCalled = false;

  manager.registerSequence(["G", "E"], () => {
    globalCalled = true;
  });
  manager.registerSequence(
    ["G", "E"],
    () => {
      scopedCalled = true;
    },
    { scope: "editor" },
  );

  manager.pushScope("editor");
  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.ok(scopedCalled, "Scoped sequence fired");
  assert.notOk(globalCalled, "Global sequence did not override scoped sequence");
});

QUnit.test("Disabled sequence does not fire", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { enabled: false },
  );

  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.notOk(called, "Disabled sequence did not fire");
});

QUnit.test("Unregister clears pending matches", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const handle = manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  fireKey("g");

  // Unregister mid-sequence
  handle.unregister();
  assert.notOk(handle.isActive, "Handle is no longer active");

  clock.tick(50);
  fireKey("e");

  assert.notOk(called, "Sequence did not fire after unregister");
});

QUnit.test("getSequenceRegistrations returns active registrations", (assert) => {
  const manager = createHotkeyManager();

  assert.strictEqual(manager.getSequenceRegistrations().length, 0, "Empty initially");

  const h1 = manager.registerSequence(["G", "E"], () => {});
  const h2 = manager.registerSequence(["G", "G"], () => {});

  assert.strictEqual(manager.getSequenceRegistrations().length, 2, "Two registrations after adding");

  h1.unregister();
  assert.strictEqual(manager.getSequenceRegistrations().length, 1, "One registration after unregister");

  h2.unregister();
  assert.strictEqual(manager.getSequenceRegistrations().length, 0, "Empty after all unregistered");
});

QUnit.test("setSequencePendingHandler fires on mid-sequence progress", (assert) => {
  const manager = createHotkeyManager();
  const pendingCalls: { completedSteps: number; totalSteps: number; nextKey: string }[] = [];

  manager.registerSequence(["G", "E", "X"], () => {
    // Full sequence callback - not relevant for this test
  });

  manager.setSequencePendingHandler((info) => {
    pendingCalls.push({
      completedSteps: info.completedSteps,
      totalSteps: info.totalSteps,
      nextKey: info.nextKey,
    });
  });

  fireKey("g");
  clock.tick(0);

  assert.strictEqual(pendingCalls.length, 1, "Pending callback fired after first key");
  assert.strictEqual(pendingCalls[0].completedSteps, 1, "1 step completed");
  assert.strictEqual(pendingCalls[0].totalSteps, 3, "3 total steps");
  assert.strictEqual(pendingCalls[0].nextKey, "E", "Next key is E");

  manager.setSequencePendingHandler(null);
});

QUnit.test("Pending callback error does not crash", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  manager.setSequencePendingHandler(() => {
    throw new Error("Intentional pending callback error");
  });

  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.ok(called, "Sequence still completes when pending callback throws");

  let secondCalled = false;
  manager.registerSequence(["H", "I"], () => {
    secondCalled = true;
  });

  fireKey("h");
  clock.tick(50);
  fireKey("i");

  assert.ok(secondCalled, "Manager remains operational after pending callback error");
});

QUnit.test("Destroy cleans up everything", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  manager.destroy();

  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.notOk(called, "Sequence did not fire after destroy");

  const newManager = createHotkeyManager();
  assert.strictEqual(newManager.getSequenceRegistrations().length, 0, "New instance has no registrations");
});

QUnit.test("Sequences are suppressed in input elements by default (auto)", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "g");
  clock.tick(50);
  fireKeyOn(input, "e");

  assert.notOk(called, "Sequence suppressed when input is focused");
});

QUnit.test("ignoreInputs: false allows sequences in input elements", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  manager.registerSequence(
    ["Ctrl+K", "Ctrl+S"],
    () => {
      called = true;
    },
    { ignoreInputs: false },
  );

  fireKeyOn(input, "k", { ctrlKey: true });
  clock.tick(50);
  fireKeyOn(input, "s", { ctrlKey: true });
  assert.ok(called, "Ctrl+K Ctrl+S fired inside input");
});

QUnit.test("Mid-sequence input focus drops matches with ignoreInputs", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKey("g");
  clock.tick(50);
  fireKeyOn(input, "e");

  assert.notOk(called, "Sequence dropped when focus moves to input mid-sequence");
});

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

QUnit.test("1-step sequence throws", (assert) => {
  const manager = createHotkeyManager();
  assert.throws(() => manager.registerSequence(["G"], () => {}), /at least 2 steps/, "Throws for 1-step sequence");
});

QUnit.test("Empty sequence throws", (assert) => {
  const manager = createHotkeyManager();
  assert.throws(() => manager.registerSequence([], () => {}), /at least 2 steps/, "Throws for empty sequence");
});

QUnit.test("registerSequence throws for invalid timeout values", (assert) => {
  const manager = createHotkeyManager();

  assert.throws(
    () => manager.registerSequence(["G", "E"], () => {}, { timeout: 0 }),
    /Invalid sequence timeout/,
    "Timeout 0 is rejected",
  );
  assert.throws(
    () => manager.registerSequence(["G", "E"], () => {}, { timeout: -1 }),
    /Invalid sequence timeout/,
    "Negative timeout is rejected",
  );
  assert.throws(
    () => manager.registerSequence(["G", "E"], () => {}, { timeout: Number.NaN }),
    /Invalid sequence timeout/,
    "NaN timeout is rejected",
  );
});

QUnit.test("registerSequence throws for empty scope", (assert) => {
  const manager = createHotkeyManager();

  assert.throws(
    () => manager.registerSequence(["G", "E"], () => {}, { scope: "" }),
    /non-empty string/,
    "Empty scope is rejected",
  );
  assert.throws(
    () => manager.registerSequence(["G", "E"], () => {}, { scope: "   " }),
    /non-empty string/,
    "Whitespace-only scope is rejected",
  );
});

QUnit.test("3-key sequence completes", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E", "X"], () => {
    called = true;
  });

  fireKey("g");
  clock.tick(50);
  fireKey("e");
  clock.tick(50);
  fireKey("x");

  assert.ok(called, "3-key sequence completed");
});

QUnit.test("Callback error does not crash", (assert) => {
  const manager = createHotkeyManager();

  manager.registerSequence(["G", "E"], () => {
    throw new Error("Intentional test error");
  });

  fireKey("g");
  clock.tick(50);
  fireKey("e");

  let secondCalled = false;
  manager.registerSequence(["H", "I"], () => {
    secondCalled = true;
  });

  fireKey("h");
  clock.tick(50);
  fireKey("i");

  assert.ok(secondCalled, "Manager still operational after callback error");
});

// ──────────────────────────────────────────────
// preventDefault / stopPropagation
// ──────────────────────────────────────────────

QUnit.test("preventDefault: false does not prevent default on final key", (assert) => {
  const manager = createHotkeyManager();

  manager.registerSequence(["G", "E"], () => {}, { preventDefault: false });

  fireKey("g");
  clock.tick(50);
  const event = fireKey("e");
  assert.notOk(event.defaultPrevented, "Default not prevented on final key");
});

QUnit.test("stopPropagation: false allows propagation on final key", (assert) => {
  const manager = createHotkeyManager();
  let propagated = false;

  const listener = () => {
    propagated = true;
  };
  document.addEventListener("keydown", listener);

  manager.registerSequence(["G", "E"], () => {}, { stopPropagation: false });

  fireKey("g");
  clock.tick(50);
  fireKey("e");

  assert.ok(propagated, "Event propagated on final key");
  document.removeEventListener("keydown", listener);
});

// ──────────────────────────────────────────────
// setOptions
// ──────────────────────────────────────────────

QUnit.test("setOptions: toggle enabled off", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const handle = manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  handle.setOptions({ enabled: false });

  fireKey("g");
  clock.tick(50);
  fireKey("e");
  assert.notOk(called, "Sequence does not fire when disabled via setOptions");
});

QUnit.test("setOptions: disabling mid-sequence drops pending match", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const handle = manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  fireKey("g");
  handle.setOptions({ enabled: false });

  clock.tick(50);
  fireKey("e");
  assert.notOk(called, "Disabled sequence does not complete when already pending");
});

QUnit.test("setOptions: toggle enabled back on", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const handle = manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  handle.setOptions({ enabled: false });
  handle.setOptions({ enabled: true });

  fireKey("g");
  clock.tick(50);
  fireKey("e");
  assert.ok(called, "Sequence fires again after re-enabling via setOptions");
});

QUnit.test("Scope change mid-sequence drops pending match", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    { scope: "editor" },
  );

  manager.pushScope("editor");
  fireKey("g");

  manager.popScope("editor");

  clock.tick(50);
  fireKey("e");
  assert.notOk(called, "Sequence does not complete after leaving its scope");
});

QUnit.test("setOptions: throws on unregistered handle", (assert) => {
  const manager = createHotkeyManager();
  const handle = manager.registerSequence(["G", "E"], () => {});
  handle.unregister();

  assert.throws(() => handle.setOptions({ enabled: false }), /unregistered/, "Throws on setOptions after unregister");
});

QUnit.test("setOptions: throws on scope change", (assert) => {
  const manager = createHotkeyManager();
  const handle = manager.registerSequence(["G", "E"], () => {});

  assert.throws(
    // @ts-expect-error Testing runtime guard for disallowed option
    () => handle.setOptions({ scope: "other" }),
    /Cannot change scope/,
    "Throws when trying to change scope",
  );
});

QUnit.test("setOptions: timeout validation rejects invalid values", (assert) => {
  const manager = createHotkeyManager();
  const handle = manager.registerSequence(["G", "E"], () => {});

  assert.throws(() => handle.setOptions({ timeout: 0 }), /Invalid sequence timeout/, "Timeout 0 is rejected");
});

// ──────────────────────────────────────────────
// ignoreInputs: "auto" (default)
// ──────────────────────────────────────────────

QUnit.test("ignoreInputs: auto suppresses plain-key sequence in input", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(["G", "E"], () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "g");
  clock.tick(50);
  fireKeyOn(input, "e");
  assert.notOk(called, "Plain-key sequence suppressed in input with auto");
});

QUnit.test("ignoreInputs: auto allows Ctrl sequence in input", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  manager.registerSequence(["Ctrl+K", "Ctrl+S"], () => {
    called = true;
  });

  fireKeyOn(input, "k", { ctrlKey: true });
  clock.tick(50);
  fireKeyOn(input, "s", { ctrlKey: true });
  assert.ok(called, "Ctrl sequence allowed in input with auto");
});

// ──────────────────────────────────────────────
// Handle introspection
// ──────────────────────────────────────────────

QUnit.test("Handle exposes sequence, scope, and description", (assert) => {
  const manager = createHotkeyManager();

  const handle = manager.registerSequence(["G", "I"], () => {}, {
    scope: "main",
    description: "Go to Inbox",
  });

  assert.deepEqual(handle.sequence, ["G", "I"], "sequence property returns original keys");
  assert.strictEqual(handle.scope, "main", "scope property returns scope");
  assert.strictEqual(handle.description, "Go to Inbox", "description property returns description");

  // Description updates via setOptions should be reflected
  handle.setOptions({ description: "Navigate to Inbox" });
  assert.strictEqual(handle.description, "Navigate to Inbox", "description reflects setOptions update");

  const snapshot = handle.sequence;
  snapshot[0] = "X";
  assert.deepEqual(handle.sequence, ["G", "I"], "Mutating sequence snapshot does not mutate registration");
});

// ──────────────────────────────────────────────
// enabled() callback error handling
// ──────────────────────────────────────────────

QUnit.test("enabled function throwing: sequence does not start", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.registerSequence(
    ["G", "E"],
    () => {
      called = true;
    },
    {
      enabled: () => {
        throw new Error("Intentional enabled() error");
      },
    },
  );

  fireKey("g");
  clock.tick(50);
  fireKey("e");
  assert.notOk(called, "Sequence not started when enabled() throws");
});
