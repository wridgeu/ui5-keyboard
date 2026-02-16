import HotkeyManager from "ui5/hotkeys/HotkeyManager";
import { fireKey, fireKeyOn } from "./test-helpers";

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
  const done = assert.async();
  const manager = HotkeyManager.getInstance();

  manager.register("Escape", (event) => {
    assert.ok(true, "Escape callback fired");
    assert.ok(event instanceof KeyboardEvent, "Received KeyboardEvent");
    done();
  });

  fireKey("Escape");
});

QUnit.test("Register and fire Ctrl+S", (assert) => {
  const done = assert.async();
  const manager = HotkeyManager.getInstance();

  manager.register("Ctrl+S", (_event, details) => {
    assert.strictEqual(details.hotkey, "Ctrl+S", "Hotkey string passed in details");
    done();
  });

  fireKey("s", { ctrlKey: true });
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "Callback was not called after unregister");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "Disabled callback was not called");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.strictEqual(callCount, 0, "Not called when enabled() returns false");

    // Toggle enabled
    canFire = true;
    fireKey("Escape");

    setTimeout(() => {
      assert.strictEqual(callCount, 1, "Called when enabled() returns true");
      done();
    }, 50);
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.strictEqual(count, 1, "Only first press counted");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(globalCalled, "Global scope callback fired");
    assert.notOk(editorCalled, "Editor scope callback did not fire");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(editorCalled, "Editor scope callback fired after pushScope");

    editorCalled = false;
    manager.popScope("editor");
    assert.strictEqual(manager.getActiveScope(), "__global__");

    fireKey("Escape");

    setTimeout(() => {
      assert.notOk(editorCalled, "Editor scope callback did not fire after popScope");
      done();
    }, 50);
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(editorCalled, "Editor scope Escape fired");
    assert.notOk(globalCalled, "Global Escape suppressed by scoped match");
    done();
  }, 50);
});

QUnit.test("popScope throws on mismatch", (assert) => {
  const manager = HotkeyManager.getInstance();
  manager.pushScope("editor");

  assert.throws(() => manager.popScope("dialog"), /Scope mismatch/, "Throws on scope mismatch");

  // Cleanup
  manager.popScope("editor");
});

QUnit.test("popScope throws when only global scope remains", (assert) => {
  const manager = HotkeyManager.getInstance();

  assert.throws(() => manager.popScope(), /Cannot pop the global scope/, "Cannot pop global scope");
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(firstCalled, "First registration fires (first-match-wins)");
    done();
  }, 50);
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

  manager.register("Escape", () => {
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(oldCalled, "Old registration was replaced");
    assert.ok(newCalled, "New registration fires");
    done();
  }, 50);
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

  // Create and mount an input element
  const input = document.createElement("input");
  input.type = "text";
  document.body.appendChild(input);

  fireKeyOn(input, "F5");

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "Single-key F5 suppressed in text input");
    document.body.removeChild(input);
    done();
  }, 50);
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
  document.body.appendChild(input);

  fireKeyOn(input, "s", { ctrlKey: true });

  const done = assert.async();
  setTimeout(() => {
    assert.ok(called, "Ctrl+S fires in text input (auto mode allows Ctrl combos)");
    document.body.removeChild(input);
    done();
  }, 50);
});

QUnit.test("auto ignoreInputs: Escape fires in text input", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register("Escape", () => {
    called = true;
  });

  const input = document.createElement("input");
  input.type = "text";
  document.body.appendChild(input);

  fireKeyOn(input, "Escape");

  const done = assert.async();
  setTimeout(() => {
    assert.ok(called, "Escape fires in text input (auto mode allows Escape)");
    document.body.removeChild(input);
    done();
  }, 50);
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
  document.body.appendChild(input);

  fireKeyOn(input, "F5");

  const done = assert.async();
  setTimeout(() => {
    assert.ok(called, "F5 fires in input when ignoreInputs is false");
    document.body.removeChild(input);
    done();
  }, 50);
});

// ──────────────────────────────────────────────
// suppressInDialogs
// ──────────────────────────────────────────────

QUnit.test("suppressInDialogs: suppresses when dialog is open", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { suppressInDialogs: true },
  );

  // Mock dialog state via private field (sap.m may not be loaded in test env)
  (manager as any)._hasOpenDialog = () => true;

  fireKey("F5");

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "F5 suppressed when dialog is open");

    // Reset mock: no dialog open
    (manager as any)._hasOpenDialog = () => false;
    fireKey("F5");

    setTimeout(() => {
      assert.ok(called, "F5 fires when dialog is closed");
      done();
    }, 50);
  }, 50);
});

QUnit.test("suppressInDialogs: false (default) fires even with dialog open", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  // Default suppressInDialogs: false
  manager.register("F5", () => {
    called = true;
  });

  (manager as any)._hasOpenDialog = () => true;

  fireKey("F5");

  const done = assert.async();
  setTimeout(() => {
    assert.ok(called, "F5 fires even with dialog open when suppressInDialogs is false");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(secondCalled, "Manager still operational after callback error");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(propagated, "Event did not propagate to bubble listener");
    document.removeEventListener("keydown", listener);
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(propagated, "Event propagated to bubble listener");
    document.removeEventListener("keydown", listener);
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(firstCalled, "First registration fires (first-match-wins)");
    assert.strictEqual(manager.getRegistrations().length, 2, "Both registrations exist");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "Callback not fired during IME composition");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "Callback not fired for modifier-only keypress");
    done();
  }, 50);
});

// ──────────────────────────────────────────────
// Unhandled key callback
// ──────────────────────────────────────────────

QUnit.test("Unhandled: fires with no_match when no registration exists", (assert) => {
  const manager = HotkeyManager.getInstance();
  const done = assert.async();

  manager.setUnhandledHandler((ctx) => {
    assert.strictEqual(ctx.reason, "no_match", "Reason is no_match");
    assert.strictEqual(ctx.activeScope, "__global__", "Active scope is global");
    assert.notOk(ctx.skippedRegistration, "No skipped registration for no_match");
    assert.ok(ctx.event instanceof KeyboardEvent, "Event is a KeyboardEvent");
    done();
  });

  fireKey("F9");
});

QUnit.test("Unhandled: fires with disabled reason when registration is disabled", (assert) => {
  const manager = HotkeyManager.getInstance();
  const done = assert.async();

  const handle = manager.register(
    "Ctrl+S",
    () => {
      assert.notOk(true, "Should not fire");
    },
    { enabled: false },
  );

  manager.setUnhandledHandler((ctx) => {
    assert.strictEqual(ctx.reason, "disabled", "Reason is disabled");
    assert.ok(ctx.skippedRegistration, "Skipped registration is present");
    assert.strictEqual(ctx.skippedRegistration!.id, handle.id, "Skipped registration matches");
    done();
  });

  fireKey("s", { ctrlKey: true });
});

QUnit.test("Unhandled: fires with input_suppressed for single key in input", (assert) => {
  const manager = HotkeyManager.getInstance();
  const done = assert.async();

  manager.register("F5", () => {
    assert.notOk(true, "Should not fire");
  });

  const input = document.createElement("input");
  input.type = "text";
  document.body.appendChild(input);

  manager.setUnhandledHandler((ctx) => {
    assert.strictEqual(ctx.reason, "input_suppressed", "Reason is input_suppressed");
    assert.ok(ctx.isInput, "isInput is true");
    assert.ok(ctx.skippedRegistration, "Skipped registration is present");
    document.body.removeChild(input);
    done();
  });

  fireKeyOn(input, "F5");
});

QUnit.test("Unhandled: fires with dialog_suppressed when dialog open", (assert) => {
  const manager = HotkeyManager.getInstance();
  const done = assert.async();

  manager.register(
    "F5",
    () => {
      assert.notOk(true, "Should not fire");
    },
    { suppressInDialogs: true },
  );

  (manager as any)._hasOpenDialog = () => true;

  manager.setUnhandledHandler((ctx) => {
    assert.strictEqual(ctx.reason, "dialog_suppressed", "Reason is dialog_suppressed");
    assert.ok(ctx.isDialogOpen, "isDialogOpen is true");
    assert.ok(ctx.skippedRegistration, "Skipped registration is present");
    done();
  });

  fireKey("F5");
});

QUnit.test("Unhandled: fires with repeat_ignored when key held", (assert) => {
  const manager = HotkeyManager.getInstance();
  let handlerFired = false;
  const done = assert.async();

  manager.register("F5", () => {
    handlerFired = true;
  });

  // First press fires the handler
  fireKey("F5");

  manager.setUnhandledHandler((ctx) => {
    assert.ok(handlerFired, "First press was handled normally");
    assert.strictEqual(ctx.reason, "repeat_ignored", "Reason is repeat_ignored");
    assert.ok(ctx.skippedRegistration, "Skipped registration is present");
    done();
  });

  // Repeated press triggers unhandled callback
  fireKey("F5", { repeat: true });
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(unhandledCalled, "Unhandled callback not fired for IME event");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(unhandledCalled, "Unhandled callback not fired for modifier-only press");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(handlerFired, "Hotkey handler fired");
    assert.notOk(unhandledCalled, "Unhandled callback not fired when hotkey was handled");
    done();
  }, 50);
});

QUnit.test("Unhandled: passes correct activeScope in context", (assert) => {
  const manager = HotkeyManager.getInstance();
  const done = assert.async();

  manager.pushScope("detail");

  manager.setUnhandledHandler((ctx) => {
    assert.strictEqual(ctx.activeScope, "detail", "Active scope is detail");
    done();
  });

  fireKey("F9");
});

QUnit.test("Unhandled: null removes the callback", (assert) => {
  const manager = HotkeyManager.getInstance();
  let unhandledCalled = false;

  manager.setUnhandledHandler(() => {
    unhandledCalled = true;
  });

  manager.setUnhandledHandler(null);

  fireKey("F9");

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(unhandledCalled, "Callback not fired after setting to null");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.strictEqual(count, 0, "Disabled via setOptions — not called");

    // Re-enable
    handle.setOptions({ enabled: true });
    fireKey("Escape");

    setTimeout(() => {
      assert.strictEqual(count, 1, "Re-enabled via setOptions — called once");
      done();
    }, 50);
  }, 50);
});

QUnit.test("setOptions: update description", (assert) => {
  const manager = HotkeyManager.getInstance();

  const handle = manager.register("Escape", () => {}, { description: "Close" });

  handle.setOptions({ description: "Dismiss" });

  const regs = manager.getRegistrations();
  const reg = regs.find((r) => r.id === handle.id);
  assert.strictEqual(reg?.options.description, "Dismiss", "Description updated");
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

  const done = assert.async();
  setTimeout(() => {
    assert.strictEqual(count, 1, "Repeat ignored by default");

    // Allow repeats
    handle.setOptions({ ignoreRepeat: false });
    fireKey("F5", { repeat: true });

    setTimeout(() => {
      assert.strictEqual(count, 2, "Repeat fires after disabling ignoreRepeat");
      done();
    }, 50);
  }, 50);
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
    () => handle.setOptions({ scope: "other" }),
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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "AltGr+E did not fire Ctrl+Alt+E");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(called, "Left Alt+Ctrl+E fires normally");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(called, "AltGr guard not active on Linux");
    done();
  }, 50);
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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(called, "Ctrl+Alt+E fires without prior Alt (location=0)");
    done();
  }, 50);
});

// ──────────────────────────────────────────────
// Target element (Feature 13)
// ──────────────────────────────────────────────

QUnit.test("Target element: hotkey fires on target element", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  document.body.appendChild(div);

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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(called, "Hotkey fires on target element");
    document.body.removeChild(div);
    done();
  }, 50);
});

QUnit.test("Target element: document events don't fire target hotkey", (assert) => {
  const manager = HotkeyManager.getInstance();
  let targetCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  document.body.appendChild(div);

  manager.register(
    "F7",
    () => {
      targetCalled = true;
    },
    { target: div },
  );

  // Fire on document — should NOT trigger target-bound hotkey
  fireKey("F7");

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(targetCalled, "Target hotkey does not fire from document event");
    document.body.removeChild(div);
    done();
  }, 50);
});

QUnit.test("Target element: document and target coexist", (assert) => {
  const manager = HotkeyManager.getInstance();
  let docCalled = false;
  let targetCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  document.body.appendChild(div);

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

  const done = assert.async();
  setTimeout(() => {
    assert.ok(targetCalled, "Target hotkey fired from element event");
    assert.ok(docCalled, "Doc hotkey also fires (capture phase, stopPropagation: false)");

    // Now fire on document directly — only doc should fire
    targetCalled = false;
    docCalled = false;
    fireKey("F8");

    setTimeout(() => {
      assert.ok(docCalled, "Doc hotkey fires from document event");
      assert.notOk(targetCalled, "Target hotkey does not fire from document event");
      document.body.removeChild(div);
      done();
    }, 50);
  }, 50);
});

QUnit.test("Target element: with scope", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  document.body.appendChild(div);

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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "Target hotkey does not fire in wrong scope");

    // Push editor scope
    manager.pushScope("editor");
    const event2 = new KeyboardEvent("keydown", {
      key: "F9",
      bubbles: true,
      cancelable: true,
    });
    div.dispatchEvent(event2);

    setTimeout(() => {
      assert.ok(called, "Target hotkey fires in correct scope");
      document.body.removeChild(div);
      done();
    }, 50);
  }, 50);
});

QUnit.test("Target element: setOptions swaps target", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const div1 = document.createElement("div");
  div1.tabIndex = 0;
  document.body.appendChild(div1);

  const div2 = document.createElement("div");
  div2.tabIndex = 0;
  document.body.appendChild(div2);

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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "Hotkey does not fire on old target after setOptions");

    // Fire on new target — should fire
    const event2 = new KeyboardEvent("keydown", {
      key: "F11",
      bubbles: true,
      cancelable: true,
    });
    div2.dispatchEvent(event2);

    setTimeout(() => {
      assert.ok(called, "Hotkey fires on new target after setOptions");
      document.body.removeChild(div1);
      document.body.removeChild(div2);
      done();
    }, 50);
  }, 50);
});

QUnit.test("Target element: unregister removes listener", (assert) => {
  const manager = HotkeyManager.getInstance();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  document.body.appendChild(div);

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

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(called, "Target hotkey does not fire after unregister");
    document.body.removeChild(div);
    done();
  }, 50);
});

QUnit.test("Target element: replace cleans up old target listener", (assert) => {
  const manager = HotkeyManager.getInstance();
  let oldCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  document.body.appendChild(div);

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

  // The target listener is ref-counted. After replace with cleanup:
  //   attach(div) → count=1, detach(div) → count=0 (removed), attach(div) → count=1
  // Without cleanup (the bug):
  //   attach(div) → count=1, (no detach), attach(div) → count=2
  // Verify only the new handler fires
  const event = new KeyboardEvent("keydown", {
    key: "F10",
    bubbles: true,
    cancelable: true,
  });
  div.dispatchEvent(event);

  const done = assert.async();
  setTimeout(() => {
    assert.notOk(oldCalled, "Old target registration was replaced and does not fire");
    assert.ok(newCalled, "New target registration fires");

    // Now unregister the new one — ref count should go to 0, removing the listener.
    // Without the fix, ref count would go to 1 (leaked), and the listener would remain.
    newHandle.unregister();

    // Verify the target listener Map is cleaned up (ref count reached 0)
    const targetListeners = (manager as any)._targetListeners as Map<EventTarget, unknown>;
    assert.strictEqual(targetListeners.size, 0, "Target listener removed after all registrations unregistered");

    document.body.removeChild(div);
    done();
  }, 50);
});
