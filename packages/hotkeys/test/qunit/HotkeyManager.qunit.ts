import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { fireKey, fireKeyOn } from "./test-helpers";

const fixture = document.getElementById("qunit-fixture")!;

QUnit.module("HotkeyManager", {
  beforeEach() {
    // Ensure a fresh instance for each test
    const existing = HotkeyManager.getInstance();
    existing.destroy();
  },
  afterEach() {
    // Clean up singleton
    try {
      HotkeyManager.getInstance().destroy();
    } catch {
      // Already destroyed
    }
  },
});

// ──────────────────────────────────────────────
// Core: singleton, register, unregister
// ──────────────────────────────────────────────

QUnit.test("getInstance returns singleton", (assert) => {
  const a = HotkeyManager.getInstance();
  const b = HotkeyManager.getInstance();
  assert.strictEqual(a, b, "Same instance returned");
});

QUnit.test("Register and fire simple hotkey", (assert) => {
  const manager = HotkeyManager.getInstance();
  let fired = false;
  let receivedEvent: KeyboardEvent | null = null;

  manager.register("Escape", (event) => {
    fired = true;
    receivedEvent = event;
  });

  fireKey("Escape");
  assert.ok(fired, "Escape callback fired");
  assert.ok(receivedEvent! instanceof KeyboardEvent, "Received KeyboardEvent");
});

QUnit.test("Register and fire Ctrl+S", (assert) => {
  const manager = HotkeyManager.getInstance();
  let receivedDetails: { hotkey: string } | null = null;

  manager.register("Ctrl+S", (_event, details) => {
    receivedDetails = details;
  });

  fireKey("s", { ctrlKey: true });
  assert.strictEqual(receivedDetails!.hotkey, "Ctrl+S", "Hotkey string passed in details");
});

QUnit.test("Unregister prevents callback", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const handle = manager.register("Escape", () => {
    called = true;
  });

  handle.unregister();
  assert.notOk(handle.isActive, "Handle is no longer active");

  fireKey("Escape");
  assert.notOk(called, "Callback was not called after unregister");
});

QUnit.test("Double unregister is a silent no-op", (assert) => {
  const manager = HotkeyManager.getInstance();
  const handle = manager.register("Escape", () => {});

  handle.unregister();
  handle.unregister(); // no throw
  assert.notOk(handle.isActive, "Handle is no longer active");
});

// ──────────────────────────────────────────────
// enabled option
// ──────────────────────────────────────────────

QUnit.test("Disabled registration is skipped", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "Escape",
    () => {
      called = true;
    },
    { enabled: false },
  );

  fireKey("Escape");
  assert.notOk(called, "Disabled callback was not called");
});

QUnit.test("enabled as function: evaluated on each keypress", (assert) => {
  const manager = HotkeyManager.getInstance();
  let canFire = false;
  let callCount = 0;

  manager.register(
    "Escape",
    () => {
      callCount++;
    },
    { enabled: () => canFire },
  );

  // First press: enabled returns false — should not fire
  fireKey("Escape");
  assert.strictEqual(callCount, 0, "Not called when enabled() returns false");

  // Toggle enabled
  canFire = true;
  fireKey("Escape");
  assert.strictEqual(callCount, 1, "Called when enabled() returns true");
});

// ──────────────────────────────────────────────
// ignoreRepeat
// ──────────────────────────────────────────────

QUnit.test("ignoreRepeat skips repeated keydown", (assert) => {
  const manager = HotkeyManager.getInstance();
  let count = 0;

  manager.register(
    "Escape",
    () => {
      count++;
    },
    { ignoreRepeat: true },
  );

  fireKey("Escape");
  fireKey("Escape", { repeat: true });
  fireKey("Escape", { repeat: true });
  assert.strictEqual(count, 1, "Only first press counted");
});

// ──────────────────────────────────────────────
// Scope management
// ──────────────────────────────────────────────

QUnit.test("Scope: hotkey only fires in active scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  let globalCalled = false;
  let editorCalled = false;

  manager.register(
    "Escape",
    () => {
      globalCalled = true;
    },
    { scope: "__global__" },
  );

  manager.register(
    "Escape",
    () => {
      editorCalled = true;
    },
    { scope: "editor" },
  );

  // Editor scope is not active — only global should fire
  fireKey("Escape");
  assert.ok(globalCalled, "Global scope callback fired");
  assert.notOk(editorCalled, "Editor scope callback did not fire");
});

QUnit.test("Scope push/pop lifecycle", (assert) => {
  const manager = HotkeyManager.getInstance();
  let editorCalled = false;

  manager.register(
    "Escape",
    () => {
      editorCalled = true;
    },
    { scope: "editor" },
  );

  manager.pushScope("editor");
  assert.strictEqual(manager.getActiveScope(), "editor");

  fireKey("Escape");
  assert.ok(editorCalled, "Editor scope callback fired after pushScope");

  editorCalled = false;
  manager.popScope("editor");
  assert.strictEqual(manager.getActiveScope(), "__global__");

  fireKey("Escape");
  assert.notOk(editorCalled, "Editor scope callback did not fire after popScope");
});

QUnit.test("Scoped handler takes priority over global for same key", (assert) => {
  const manager = HotkeyManager.getInstance();
  let globalCalled = false;
  let editorCalled = false;

  manager.register(
    "Escape",
    () => {
      globalCalled = true;
    },
    { scope: "__global__" },
  );

  manager.register(
    "Escape",
    () => {
      editorCalled = true;
    },
    { scope: "editor" },
  );

  // Push editor scope — editor Escape should take priority
  manager.pushScope("editor");
  fireKey("Escape");
  assert.ok(editorCalled, "Editor scope Escape fired");
  assert.notOk(globalCalled, "Global Escape suppressed by scoped match");
});

QUnit.test("popScope throws on mismatch", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.pushScope("editor");

  assert.throws(() => manager.popScope("dialog"), /Cannot pop scope/, "Throws on scope mismatch");

  // Cleanup
  manager.popScope("editor");
});

QUnit.test("popScope throws when only global scope remains", (assert) => {
  const manager = HotkeyManager.getInstance();

  assert.throws(() => manager.popScope("__global__"), /Cannot pop the global scope/, "Cannot pop global scope");
});

QUnit.test("resetToGlobalScope pops all non-global scopes", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.pushScope("main");
  manager.pushScope("dialog");
  assert.strictEqual(manager.getActiveScope(), "dialog");

  manager.resetToGlobalScope();
  assert.strictEqual(manager.getActiveScope(), "__global__", "Back to global after reset");

  // Should be safe to call when already at global
  manager.resetToGlobalScope();
  assert.strictEqual(manager.getActiveScope(), "__global__", "No-op when already at global");
});

QUnit.test("pushScope allows duplicate scope and pops correctly", (assert) => {
  const manager = HotkeyManager.getInstance();
  let editorCalled = false;
  let globalCalled = false;

  manager.register("F5", () => {
    globalCalled = true;
  });
  manager.register(
    "F5",
    () => {
      editorCalled = true;
    },
    { scope: "editor" },
  );

  // Push editor twice
  manager.pushScope("editor");
  manager.pushScope("editor");
  assert.strictEqual(manager.getActiveScope(), "editor", "Active scope is editor");

  fireKey("F5");
  assert.ok(editorCalled, "Editor handler fires with duplicate scope on stack");
  assert.notOk(globalCalled, "Global handler suppressed");

  // First pop — still in editor
  editorCalled = false;
  manager.popScope("editor");
  assert.strictEqual(manager.getActiveScope(), "editor", "Still editor after first pop");

  fireKey("F5");
  assert.ok(editorCalled, "Editor handler still fires after first pop");

  // Second pop — back to global
  editorCalled = false;
  globalCalled = false;
  manager.popScope("editor");
  assert.strictEqual(manager.getActiveScope(), "__global__", "Back to global after second pop");

  fireKey("F5");
  assert.ok(globalCalled, "Global handler fires after both pops");
  assert.notOk(editorCalled, "Editor handler no longer fires");
});

// ──────────────────────────────────────────────
// Conflict handling
// ──────────────────────────────────────────────

QUnit.test("Conflict behavior: warn (default) allows both", (assert) => {
  const manager = HotkeyManager.getInstance();
  let firstCalled = false;

  manager.register("Escape", () => {
    firstCalled = true;
  });

  // Second registration with same hotkey — should warn but succeed
  manager.register("Escape", () => {
    // This would fire if first-match-wins didn't apply
  });

  fireKey("Escape");
  assert.ok(firstCalled, "First registration fires (first-match-wins)");
});

QUnit.test("Conflict behavior: error throws", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("Escape", () => {});

  assert.throws(
    () => manager.register("Escape", () => {}, { conflictBehavior: "error" }),
    /already registered/,
    "Error thrown on conflict",
  );
});

QUnit.test("Conflict behavior: replace removes old registration", (assert) => {
  const manager = HotkeyManager.getInstance();
  let oldCalled = false;
  let newCalled = false;

  const oldHandle = manager.register("Escape", () => {
    oldCalled = true;
  });

  manager.register(
    "Escape",
    () => {
      newCalled = true;
    },
    { conflictBehavior: "replace" },
  );

  fireKey("Escape");
  assert.notOk(oldCalled, "Old registration was replaced");
  assert.ok(newCalled, "New registration fires");
  assert.notOk(oldHandle.isActive, "Old handle becomes inactive after replace");
});

QUnit.test("Conflict behavior: same key/scope on different targets does not conflict", (assert) => {
  const manager = HotkeyManager.getInstance();
  let firstCalled = false;
  let secondCalled = false;

  const firstTarget = document.createElement("div");
  firstTarget.tabIndex = 0;
  fixture.appendChild(firstTarget);

  const secondTarget = document.createElement("div");
  secondTarget.tabIndex = 0;
  fixture.appendChild(secondTarget);

  manager.register(
    "F7",
    () => {
      firstCalled = true;
    },
    { target: firstTarget },
  );

  assert.expect(2);
  manager.register(
    "F7",
    () => {
      secondCalled = true;
    },
    { target: secondTarget, conflictBehavior: "error" },
  );

  firstTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "F7", bubbles: true, cancelable: true }));
  secondTarget.dispatchEvent(new KeyboardEvent("keydown", { key: "F7", bubbles: true, cancelable: true }));

  assert.ok(firstCalled, "First target registration fires");
  assert.ok(secondCalled, "Second target registration also fires");
});

// ──────────────────────────────────────────────
// Input suppression (ignoreInputs: "auto")
// ──────────────────────────────────────────────

QUnit.test("auto ignoreInputs: single key suppressed in text input", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  // F5 with default ignoreInputs: "auto" — should suppress in input
  manager.register("F5", () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "F5");
  assert.notOk(called, "Single-key F5 suppressed in text input");
});

QUnit.test("auto ignoreInputs: Ctrl combo fires in text input", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  // Ctrl+S with default ignoreInputs: "auto" — should fire even in input
  manager.register("Ctrl+S", () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "s", { ctrlKey: true });
  assert.ok(called, "Ctrl+S fires in text input (auto mode allows Ctrl combos)");
});

QUnit.test("auto ignoreInputs: Escape fires in text input", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register("Escape", () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "Escape");
  assert.ok(called, "Escape fires in text input (auto mode allows Escape)");
});

QUnit.test("ignoreInputs: false allows single key in input", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { ignoreInputs: false },
  );

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "F5");
  assert.ok(called, "F5 fires in input when ignoreInputs is false");
});

QUnit.test("ignoreInputs: true suppresses Ctrl combo in input", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "Ctrl+S",
    () => {
      called = true;
    },
    { ignoreInputs: true },
  );

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "s", { ctrlKey: true });
  assert.notOk(called, "Ctrl+S suppressed in input when ignoreInputs is true (unlike auto)");
});

QUnit.test("ignoreInputs: true suppresses Escape in input", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "Escape",
    () => {
      called = true;
    },
    { ignoreInputs: true },
  );

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "Escape");
  assert.notOk(called, "Escape suppressed in input when ignoreInputs is true (unlike auto)");
});

// ──────────────────────────────────────────────
// suppressInPopups
// ──────────────────────────────────────────────

QUnit.test("suppressInPopups: suppresses when popup is open", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { suppressInPopups: true },
  );

  // Mock popup state via private field (sap.m may not be loaded in test env)
  (manager as any)._hasOpenPopup = () => true;

  fireKey("F5");
  assert.notOk(called, "F5 suppressed when popup is open");

  // Reset mock: no popup open
  (manager as any)._hasOpenPopup = () => false;
  fireKey("F5");
  assert.ok(called, "F5 fires when popup is closed");
});

QUnit.test("suppressInPopups: false (default) fires even with popup open", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  // Default suppressInPopups: false
  manager.register("F5", () => {
    called = true;
  });

  (manager as any)._hasOpenPopup = () => true;

  fireKey("F5");
  assert.ok(called, "F5 fires even with popup open when suppressInPopups is false");
});

// ──────────────────────────────────────────────
// Error handling in callbacks
// ──────────────────────────────────────────────

QUnit.test("Callback error is caught and does not crash", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("F1", () => {
    throw new Error("Intentional test error");
  });

  // Should not throw — the error is caught and logged
  fireKey("F1");

  // Verify the manager is still operational after the error
  let secondCalled = false;
  manager.register("F2", () => {
    secondCalled = true;
  });

  fireKey("F2");
  assert.ok(secondCalled, "Manager still operational after callback error");
});

// ──────────────────────────────────────────────
// Introspection
// ──────────────────────────────────────────────

QUnit.test("getRegistrations returns all registrations", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("Escape", () => {});
  manager.register("Ctrl+S", () => {});

  const regs = manager.getRegistrations();
  assert.strictEqual(regs.length, 2, "Two registrations");
});

QUnit.test("getRegistrationsForScope filters by scope", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("Escape", () => {}, { scope: "__global__" });
  manager.register("Ctrl+S", () => {}, { scope: "editor" });

  assert.strictEqual(manager.getRegistrationsForScope("__global__").length, 1);
  assert.strictEqual(manager.getRegistrationsForScope("editor").length, 1);
  assert.strictEqual(manager.getRegistrationsForScope("unknown").length, 0);
});

// ──────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────

QUnit.test("destroy cleans up everything", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.register("Escape", () => {});

  manager.destroy();

  // Getting a new instance should give a fresh manager
  const newManager = HotkeyManager.getInstance();
  assert.strictEqual(newManager.getRegistrations().length, 0, "New instance has no registrations");
  assert.strictEqual(newManager.getActiveScope(), "__global__", "Scope stack reset");
});

QUnit.test("destroy is idempotent (safe to call twice)", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.register("Escape", () => {});
  manager.pushScope("editor");

  manager.destroy();

  // Second destroy on the same reference should not throw
  manager.destroy();

  // A fresh instance should still work
  const fresh = HotkeyManager.getInstance();
  assert.strictEqual(fresh.getRegistrations().length, 0, "Fresh instance after double destroy");
  assert.strictEqual(fresh.getActiveScope(), "__global__", "Scope stack clean after double destroy");
});

// ──────────────────────────────────────────────
// preventDefault / stopPropagation
// ──────────────────────────────────────────────

QUnit.test("preventDefault: true (default) prevents default", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("F5", () => {});

  const event = fireKey("F5");
  assert.ok(event.defaultPrevented, "Default was prevented");
});

QUnit.test("preventDefault: false does not prevent default", (assert) => {
  const manager = HotkeyManager.getInstance();

  manager.register("F5", () => {}, { preventDefault: false });

  const event = fireKey("F5");
  assert.notOk(event.defaultPrevented, "Default was not prevented");
});

QUnit.test("stopPropagation: true (default) stops propagation", (assert) => {
  const manager = HotkeyManager.getInstance();
  let propagated = false;

  // Add a bubble-phase listener that would fire if propagation is not stopped
  const listener = () => {
    propagated = true;
  };
  document.addEventListener("keydown", listener);

  manager.register("F5", () => {});
  fireKey("F5");

  assert.notOk(propagated, "Event did not propagate to bubble listener");
  document.removeEventListener("keydown", listener);
});

QUnit.test("stopPropagation: false allows propagation", (assert) => {
  const manager = HotkeyManager.getInstance();
  let propagated = false;

  const listener = () => {
    propagated = true;
  };
  document.addEventListener("keydown", listener);

  manager.register("F5", () => {}, { stopPropagation: false });
  fireKey("F5");

  assert.ok(propagated, "Event propagated to bubble listener");
  document.removeEventListener("keydown", listener);
});

// ──────────────────────────────────────────────
// Conflict behavior: allow
// ──────────────────────────────────────────────

QUnit.test("Conflict behavior: allow silently registers duplicate", (assert) => {
  const manager = HotkeyManager.getInstance();
  let firstCalled = false;

  manager.register("Escape", () => {
    firstCalled = true;
  });

  // Second registration with "allow" — no warning, no error
  manager.register("Escape", () => {}, { conflictBehavior: "allow" });

  fireKey("Escape");
  assert.ok(firstCalled, "First registration fires (first-match-wins)");
  assert.strictEqual(manager.getRegistrations().length, 2, "Both registrations exist");
});

// ──────────────────────────────────────────────
// IME composition guard
// ──────────────────────────────────────────────

QUnit.test("IME composition events are ignored", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register("Enter", () => {
    called = true;
  });

  // Simulate IME composition event
  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "isComposing", { value: true });
  document.dispatchEvent(event);

  assert.notOk(called, "Callback not fired during IME composition");
});

// ──────────────────────────────────────────────
// Modifier-only key presses
// ──────────────────────────────────────────────

QUnit.test("Pure modifier key presses are ignored", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  // Register Ctrl+S — pressing Ctrl alone should not fire anything
  manager.register("Ctrl+S", () => {
    called = true;
  });

  // Simulate pressing just the Control key
  const event = new KeyboardEvent("keydown", {
    key: "Control",
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
  });
  document.dispatchEvent(event);

  assert.notOk(called, "Callback not fired for modifier-only keypress");
});

// ──────────────────────────────────────────────
// Unhandled key callback
// ──────────────────────────────────────────────

QUnit.test("Unhandled: fires with no_match when no registration exists", (assert) => {
  const manager = HotkeyManager.getInstance();
  let ctx: any = null;

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  fireKey("F9");
  assert.strictEqual(ctx.reason, "no_match", "Reason is no_match");
  assert.strictEqual(ctx.activeScope, "__global__", "Active scope is global");
  assert.notOk(ctx.skippedRegistration, "No skipped registration for no_match");
  assert.ok(ctx.event instanceof KeyboardEvent, "Event is a KeyboardEvent");
});

QUnit.test("Unhandled: fires with disabled reason when registration is disabled", (assert) => {
  const manager = HotkeyManager.getInstance();
  let ctx: any = null;

  const handle = manager.register(
    "Ctrl+S",
    () => {
      assert.notOk(true, "Should not fire");
    },
    { enabled: false },
  );

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  fireKey("s", { ctrlKey: true });
  assert.strictEqual(ctx.reason, "disabled", "Reason is disabled");
  assert.ok(ctx.skippedRegistration, "Skipped registration is present");
  assert.strictEqual(ctx.skippedRegistration.id, handle.id, "Skipped registration matches");
});

QUnit.test("Unhandled: fires with input_suppressed for single key in input", (assert) => {
  const manager = HotkeyManager.getInstance();
  let ctx: any = null;

  manager.register("F5", () => {
    assert.notOk(true, "Should not fire");
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  fireKeyOn(input, "F5");
  assert.strictEqual(ctx.reason, "input_suppressed", "Reason is input_suppressed");
  assert.ok(ctx.isInput, "isInput is true");
  assert.ok(ctx.skippedRegistration, "Skipped registration is present");
});

QUnit.test("Unhandled: fires with popup_suppressed when popup open", (assert) => {
  const manager = HotkeyManager.getInstance();
  let ctx: any = null;

  manager.register(
    "F5",
    () => {
      assert.notOk(true, "Should not fire");
    },
    { suppressInPopups: true },
  );

  (manager as any)._hasOpenPopup = () => true;

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  fireKey("F5");
  assert.strictEqual(ctx.reason, "popup_suppressed", "Reason is popup_suppressed");
  assert.ok(ctx.isPopupOpen, "isPopupOpen is true");
  assert.ok(ctx.skippedRegistration, "Skipped registration is present");
});

QUnit.test("Unhandled: fires with repeat_ignored when key held", (assert) => {
  const manager = HotkeyManager.getInstance();
  let handlerFired = false;
  let ctx: any = null;

  manager.register("F5", () => {
    handlerFired = true;
  });

  // First press fires the handler
  fireKey("F5");
  assert.ok(handlerFired, "First press was handled normally");

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  // Repeated press triggers unhandled callback
  fireKey("F5", { repeat: true });
  assert.strictEqual(ctx.reason, "repeat_ignored", "Reason is repeat_ignored");
  assert.ok(ctx.skippedRegistration, "Skipped registration is present");
});

QUnit.test("Unhandled: does NOT fire for IME composing events", (assert) => {
  const manager = HotkeyManager.getInstance();
  let unhandledCalled = false;

  manager.setUnhandledHandler(() => {
    unhandledCalled = true;
  });

  const event = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "isComposing", { value: true });
  document.dispatchEvent(event);

  assert.notOk(unhandledCalled, "Unhandled callback not fired for IME event");
});

QUnit.test("Unhandled: does NOT fire for pure modifier presses", (assert) => {
  const manager = HotkeyManager.getInstance();
  let unhandledCalled = false;

  manager.setUnhandledHandler(() => {
    unhandledCalled = true;
  });

  const event = new KeyboardEvent("keydown", {
    key: "Control",
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
  });
  document.dispatchEvent(event);

  assert.notOk(unhandledCalled, "Unhandled callback not fired for modifier-only press");
});

QUnit.test("Unhandled: does NOT fire when a hotkey IS handled", (assert) => {
  const manager = HotkeyManager.getInstance();
  let handlerFired = false;
  let unhandledCalled = false;

  manager.register("Escape", () => {
    handlerFired = true;
  });

  manager.setUnhandledHandler(() => {
    unhandledCalled = true;
  });

  fireKey("Escape");
  assert.ok(handlerFired, "Hotkey handler fired");
  assert.notOk(unhandledCalled, "Unhandled callback not fired when hotkey was handled");
});

QUnit.test("Unhandled: does NOT fire no_match when target hotkey handles event", (assert) => {
  const manager = HotkeyManager.getInstance();
  let targetCalled = false;
  let unhandledCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register(
    "F6",
    () => {
      targetCalled = true;
    },
    { target: div },
  );

  manager.setUnhandledHandler(() => {
    unhandledCalled = true;
  });

  div.dispatchEvent(new KeyboardEvent("keydown", { key: "F6", bubbles: true, cancelable: true }));

  assert.ok(targetCalled, "Target hotkey handler fired");
  assert.notOk(unhandledCalled, "Unhandled callback is not fired for target-handled key");
});

QUnit.test("Unhandled: passes correct activeScope in context", (assert) => {
  const manager = HotkeyManager.getInstance();
  let ctx: any = null;

  manager.pushScope("detail");

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  fireKey("F9");
  assert.strictEqual(ctx.activeScope, "detail", "Active scope is detail");
});

QUnit.test("Unhandled: null removes the callback", (assert) => {
  const manager = HotkeyManager.getInstance();
  let unhandledCalled = false;

  manager.setUnhandledHandler(() => {
    unhandledCalled = true;
  });

  manager.setUnhandledHandler(null);

  fireKey("F9");
  assert.notOk(unhandledCalled, "Callback not fired after setting to null");
});

// ──────────────────────────────────────────────
// setOptions (Feature 7)
// ──────────────────────────────────────────────

QUnit.test("setOptions: toggle enabled", (assert) => {
  const manager = HotkeyManager.getInstance();
  let count = 0;

  const handle = manager.register("Escape", () => {
    count++;
  });

  // Disable via setOptions
  handle.setOptions({ enabled: false });
  fireKey("Escape");
  assert.strictEqual(count, 0, "Disabled via setOptions — not called");

  // Re-enable
  handle.setOptions({ enabled: true });
  fireKey("Escape");
  assert.strictEqual(count, 1, "Re-enabled via setOptions — called once");
});

QUnit.test("setOptions: update description", (assert) => {
  const manager = HotkeyManager.getInstance();

  const handle = manager.register("Escape", () => {}, { description: "Close" });

  handle.setOptions({ description: "Dismiss" });

  const regs = manager.getRegistrations();
  const reg = regs.find((r) => r.id === handle.id);
  assert.strictEqual(reg?.description, "Dismiss", "Description updated");
});

QUnit.test("setOptions: update ignoreRepeat", (assert) => {
  const manager = HotkeyManager.getInstance();
  let count = 0;

  const handle = manager.register("F5", () => {
    count++;
  });

  // Default: ignoreRepeat is true
  fireKey("F5");
  fireKey("F5", { repeat: true });
  assert.strictEqual(count, 1, "Repeat ignored by default");

  // Allow repeats
  handle.setOptions({ ignoreRepeat: false });
  fireKey("F5", { repeat: true });
  assert.strictEqual(count, 2, "Repeat fires after disabling ignoreRepeat");
});

QUnit.test("setOptions: update preventDefault", (assert) => {
  const manager = HotkeyManager.getInstance();

  const handle = manager.register("F5", () => {});

  // Default: preventDefault is true
  let event = fireKey("F5");
  assert.ok(event.defaultPrevented, "Default prevented initially");

  // Disable preventDefault
  handle.setOptions({ preventDefault: false });
  event = fireKey("F5");
  assert.notOk(event.defaultPrevented, "Default not prevented after setOptions");
});

QUnit.test("setOptions: update stopPropagation", (assert) => {
  const manager = HotkeyManager.getInstance();
  let propagated = false;

  const listener = () => {
    propagated = true;
  };
  document.addEventListener("keydown", listener);

  const handle = manager.register("F5", () => {});

  // Default: stopPropagation is true
  fireKey("F5");
  assert.notOk(propagated, "Event did not propagate initially");

  // Disable stopPropagation
  handle.setOptions({ stopPropagation: false });
  fireKey("F5");
  assert.ok(propagated, "Event propagates after setOptions({ stopPropagation: false })");

  document.removeEventListener("keydown", listener);
});

QUnit.test("setOptions: update ignoreInputs", (assert) => {
  const manager = HotkeyManager.getInstance();
  let count = 0;

  // Register with default ignoreInputs: "auto" — single key suppressed in inputs
  const handle = manager.register("F5", () => {
    count++;
  });

  const input = document.createElement("input");
  input.type = "text";
  fixture.appendChild(input);

  fireKeyOn(input, "F5");
  assert.strictEqual(count, 0, "F5 suppressed in input with auto ignoreInputs");

  // Override to false
  handle.setOptions({ ignoreInputs: false });
  fireKeyOn(input, "F5");
  assert.strictEqual(count, 1, "F5 fires in input after setOptions({ ignoreInputs: false })");
});

QUnit.test("setOptions: update suppressInPopups", (assert) => {
  const manager = HotkeyManager.getInstance();
  let count = 0;

  const handle = manager.register(
    "F5",
    () => {
      count++;
    },
    { suppressInPopups: true },
  );

  (manager as any)._hasOpenPopup = () => true;

  fireKey("F5");
  assert.strictEqual(count, 0, "F5 suppressed with popup open");

  handle.setOptions({ suppressInPopups: false });
  fireKey("F5");
  assert.strictEqual(count, 1, "F5 fires after setOptions({ suppressInPopups: false })");
});

QUnit.test("setOptions: throws on unregistered handle", (assert) => {
  const manager = HotkeyManager.getInstance();
  const handle = manager.register("Escape", () => {});
  handle.unregister();

  assert.throws(() => handle.setOptions({ enabled: false }), /unregistered/, "Throws on setOptions after unregister");
});

QUnit.test("setOptions: throws on scope change", (assert) => {
  const manager = HotkeyManager.getInstance();
  const handle = manager.register("Escape", () => {});

  assert.throws(
    () => handle.setOptions({ scope: "other" } as any),
    /Cannot change scope/,
    "Throws when trying to change scope",
  );
});

// ──────────────────────────────────────────────
// AltGr guard (Feature 5)
// ──────────────────────────────────────────────

QUnit.test("AltGr: right-Alt does NOT fire Ctrl+Alt hotkey on Windows", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  // Override platform to windows for this test
  (manager as any)._platform = "windows";

  manager.register("Ctrl+Alt+E", () => {
    called = true;
  });

  // Simulate AltGr: first a right-Alt keydown, then the character key with both ctrlKey and altKey
  const altEvent = new KeyboardEvent("keydown", {
    key: "Alt",
    bubbles: true,
    cancelable: true,
    altKey: true,
  });
  Object.defineProperty(altEvent, "location", { value: 2 }); // Right Alt
  document.dispatchEvent(altEvent);

  // Now fire 'e' with both ctrlKey and altKey (AltGr+E)
  const eEvent = new KeyboardEvent("keydown", {
    key: "e",
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    altKey: true,
  });
  document.dispatchEvent(eEvent);

  assert.notOk(called, "AltGr+E did not fire Ctrl+Alt+E");
});

QUnit.test("AltGr: left-Alt DOES fire Ctrl+Alt hotkey", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  (manager as any)._platform = "windows";

  manager.register("Ctrl+Alt+E", () => {
    called = true;
  });

  // Simulate left Alt
  const altEvent = new KeyboardEvent("keydown", {
    key: "Alt",
    bubbles: true,
    cancelable: true,
    altKey: true,
  });
  Object.defineProperty(altEvent, "location", { value: 1 }); // Left Alt
  document.dispatchEvent(altEvent);

  fireKey("e", { ctrlKey: true, altKey: true });
  assert.ok(called, "Left Alt+Ctrl+E fires normally");
});

QUnit.test("AltGr: guard only active on Windows", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  (manager as any)._platform = "linux";

  manager.register("Ctrl+Alt+E", () => {
    called = true;
  });

  // Simulate right Alt on Linux
  const altEvent = new KeyboardEvent("keydown", {
    key: "Alt",
    bubbles: true,
    cancelable: true,
    altKey: true,
  });
  Object.defineProperty(altEvent, "location", { value: 2 });
  document.dispatchEvent(altEvent);

  fireKey("e", { ctrlKey: true, altKey: true });
  assert.ok(called, "AltGr guard not active on Linux");
});

QUnit.test("AltGr: normal Ctrl+Alt works without prior Alt", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  (manager as any)._platform = "windows";

  manager.register("Ctrl+Alt+E", () => {
    called = true;
  });

  // No prior Alt keydown — _lastAltLocation stays 0
  fireKey("e", { ctrlKey: true, altKey: true });
  assert.ok(called, "Ctrl+Alt+E fires without prior Alt (location=0)");
});

// ──────────────────────────────────────────────
// Target element (Feature 13)
// ──────────────────────────────────────────────

QUnit.test("Target element: hotkey fires on target element", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register(
    "Escape",
    () => {
      called = true;
    },
    { target: div },
  );

  // Fire on the target element
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  div.dispatchEvent(event);

  assert.ok(called, "Hotkey fires on target element");
});

QUnit.test("Target element: document events don't fire target hotkey", (assert) => {
  const manager = HotkeyManager.getInstance();
  let targetCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register(
    "F7",
    () => {
      targetCalled = true;
    },
    { target: div },
  );

  // Fire on document — should NOT trigger target-bound hotkey
  fireKey("F7");
  assert.notOk(targetCalled, "Target hotkey does not fire from document event");
});

QUnit.test("Target element: document and target coexist", (assert) => {
  const manager = HotkeyManager.getInstance();
  let docCalled = false;
  let targetCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  // Doc registration must not stop propagation, otherwise the capture-phase
  // document listener fires first (capture goes top-down: document → div)
  // and stopPropagation prevents the event from reaching div's listener.
  manager.register(
    "F8",
    () => {
      docCalled = true;
    },
    { stopPropagation: false },
  );
  manager.register(
    "F8",
    () => {
      targetCalled = true;
    },
    { target: div },
  );

  // Fire on div — both doc and target listeners see it (capture phase: document first, then div)
  const divEvent = new KeyboardEvent("keydown", {
    key: "F8",
    bubbles: true,
    cancelable: true,
  });
  div.dispatchEvent(divEvent);

  assert.ok(targetCalled, "Target hotkey fired from element event");
  assert.ok(docCalled, "Doc hotkey also fires (capture phase, stopPropagation: false)");

  // Now fire on document directly — only doc should fire
  targetCalled = false;
  docCalled = false;
  fireKey("F8");
  assert.ok(docCalled, "Doc hotkey fires from document event");
  assert.notOk(targetCalled, "Target hotkey does not fire from document event");
});

QUnit.test("Target element: with scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register(
    "F9",
    () => {
      called = true;
    },
    { target: div, scope: "editor" },
  );

  // Fire without editor scope — should not fire
  const event1 = new KeyboardEvent("keydown", {
    key: "F9",
    bubbles: true,
    cancelable: true,
  });
  div.dispatchEvent(event1);
  assert.notOk(called, "Target hotkey does not fire in wrong scope");

  // Push editor scope
  manager.pushScope("editor");
  const event2 = new KeyboardEvent("keydown", {
    key: "F9",
    bubbles: true,
    cancelable: true,
  });
  div.dispatchEvent(event2);
  assert.ok(called, "Target hotkey fires in correct scope");
});

QUnit.test("Target element: setOptions swaps target", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const div1 = document.createElement("div");
  div1.tabIndex = 0;
  fixture.appendChild(div1);

  const div2 = document.createElement("div");
  div2.tabIndex = 0;
  fixture.appendChild(div2);

  const handle = manager.register(
    "F11",
    () => {
      called = true;
    },
    { target: div1 },
  );

  // Swap target from div1 to div2
  handle.setOptions({ target: div2 });

  // Fire on old target — should NOT fire
  const event1 = new KeyboardEvent("keydown", {
    key: "F11",
    bubbles: true,
    cancelable: true,
  });
  div1.dispatchEvent(event1);
  assert.notOk(called, "Hotkey does not fire on old target after setOptions");

  // Fire on new target — should fire
  const event2 = new KeyboardEvent("keydown", {
    key: "F11",
    bubbles: true,
    cancelable: true,
  });
  div2.dispatchEvent(event2);
  assert.ok(called, "Hotkey fires on new target after setOptions");
});

QUnit.test("Target element: unregister removes listener", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  const handle = manager.register(
    "F10",
    () => {
      called = true;
    },
    { target: div },
  );

  handle.unregister();

  const event = new KeyboardEvent("keydown", {
    key: "F10",
    bubbles: true,
    cancelable: true,
  });
  div.dispatchEvent(event);

  assert.notOk(called, "Target hotkey does not fire after unregister");
});

QUnit.test("Target element: replace cleans up old target listener", (assert) => {
  const manager = HotkeyManager.getInstance();
  let oldCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  // Register on target element — this adds a capture listener on div
  manager.register(
    "F10",
    () => {
      oldCalled = true;
    },
    { target: div },
  );

  // Replace with a new target registration on the same element
  let newCalled = false;
  const newHandle = manager.register(
    "F10",
    () => {
      newCalled = true;
    },
    { target: div, conflictBehavior: "replace" },
  );

  // Verify only the new handler fires
  const event = new KeyboardEvent("keydown", {
    key: "F10",
    bubbles: true,
    cancelable: true,
  });
  div.dispatchEvent(event);

  assert.notOk(oldCalled, "Old target registration was replaced and does not fire");
  assert.ok(newCalled, "New target registration fires");

  // Now unregister the new one — ref count should go to 0, removing the listener.
  newHandle.unregister();

  // Verify the target listener Map is cleaned up (ref count reached 0)
  const targetListeners = (manager as any)._targetListeners as Map<EventTarget, unknown>;
  assert.strictEqual(targetListeners.size, 0, "Target listener removed after all registrations unregistered");
});

// ──────────────────────────────────────────────
// Handle introspection
// ──────────────────────────────────────────────

QUnit.test("Handle exposes hotkey, scope, and description", (assert) => {
  const manager = HotkeyManager.getInstance();

  const handle = manager.register("Mod+S", () => {}, {
    scope: "editor",
    description: "Save",
  });

  assert.strictEqual(handle.hotkey, "Mod+S", "hotkey property returns original hotkey string");
  assert.strictEqual(handle.scope, "editor", "scope property returns scope");
  assert.strictEqual(handle.description, "Save", "description property returns description");
});

QUnit.test("Handle description reflects setOptions update", (assert) => {
  const manager = HotkeyManager.getInstance();

  const handle = manager.register("Escape", () => {}, { description: "Close" });

  handle.setOptions({ description: "Dismiss" });
  assert.strictEqual(handle.description, "Dismiss", "description reflects setOptions update");
});

QUnit.test("Handle defaults: scope is global, description is empty", (assert) => {
  const manager = HotkeyManager.getInstance();

  const handle = manager.register("F5", () => {});

  assert.strictEqual(handle.scope, "__global__", "default scope is __global__");
  assert.strictEqual(handle.description, "", "default description is empty string");
});

// ──────────────────────────────────────────────
// enabled() callback error handling
// ──────────────────────────────────────────────

QUnit.test("enabled function throwing: hotkey does not fire and manager stays operational", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "Escape",
    () => {
      called = true;
    },
    {
      enabled: () => {
        throw new Error("Intentional enabled() error");
      },
    },
  );

  fireKey("Escape");
  assert.notOk(called, "Callback not fired when enabled() throws");

  // Manager should still be operational
  let secondCalled = false;
  manager.register("F2", () => {
    secondCalled = true;
  });
  fireKey("F2");
  assert.ok(secondCalled, "Manager still operational after enabled() error");
});

QUnit.test("enabled function throwing: getRegistrations shows enabled as false", (assert) => {
  const manager = HotkeyManager.getInstance();

  const handle = manager.register("F3", () => {}, {
    enabled: () => {
      throw new Error("Intentional enabled() error");
    },
  });

  const reg = manager.getRegistrations().find((r) => r.id === handle.id);
  assert.strictEqual(reg?.enabled, false, "Registration shows enabled=false when enabled() throws");
});

// ──────────────────────────────────────────────
// Target element: ref-counting with multiple registrations
// ──────────────────────────────────────────────

QUnit.test("Target element: two registrations on same target, unregister one", (assert) => {
  const manager = HotkeyManager.getInstance();
  let firstCalled = false;
  let secondCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  const h1 = manager.register(
    "F3",
    () => {
      firstCalled = true;
    },
    { target: div },
  );

  manager.register(
    "F4",
    () => {
      secondCalled = true;
    },
    { target: div },
  );

  // Unregister the first — the target listener should remain (ref count > 0)
  h1.unregister();

  // F3 should no longer fire
  const event1 = new KeyboardEvent("keydown", { key: "F3", bubbles: true, cancelable: true });
  div.dispatchEvent(event1);
  assert.notOk(firstCalled, "Unregistered F3 does not fire");

  // F4 should still fire — the target listener was NOT removed
  const event2 = new KeyboardEvent("keydown", { key: "F4", bubbles: true, cancelable: true });
  div.dispatchEvent(event2);
  assert.ok(secondCalled, "F4 still fires on same target after sibling unregister");

  // Verify listener map still has the target
  const targetListeners = (manager as any)._targetListeners as Map<EventTarget, unknown>;
  assert.strictEqual(targetListeners.size, 1, "Target listener still registered (ref count > 0)");
});
