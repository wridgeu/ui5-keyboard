import { ConflictBehavior, GLOBAL_SCOPE, Platform } from "ui5/hotkeys/library";
import { runtimeHooks } from "ui5/hotkeys/internal/runtime";
import type Log from "sap/base/Log";
import { createHotkeyManager, destroyHotkeyManager, fireKey, fireKeyOn } from "./test-helpers";

const fixture = document.getElementById("qunit-fixture")!;
const sandbox = sinon.createSandbox();

QUnit.module("HotkeyManager", {
  beforeEach() {
    destroyHotkeyManager();
  },
  afterEach() {
    sandbox.restore();
    destroyHotkeyManager();
  },
});

// ──────────────────────────────────────────────
// Core: register, unregister
// ──────────────────────────────────────────────

QUnit.test("Register and fire simple hotkey", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let receivedDetails: { hotkey: string } | null = null;

  manager.register("Ctrl+S", (_event, details) => {
    receivedDetails = details;
  });

  fireKey("s", { ctrlKey: true });
  assert.strictEqual(receivedDetails!.hotkey, "Ctrl+S", "Hotkey string passed in details");
});

QUnit.test("Unregister prevents callback", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  const handle = manager.register("Escape", () => {});

  handle.unregister();
  handle.unregister(); // no throw
  assert.notOk(handle.isActive, "Handle is no longer active");
});

// ──────────────────────────────────────────────
// enabled option
// ──────────────────────────────────────────────

QUnit.test("Disabled registration is skipped", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let canFire = false;
  let callCount = 0;

  manager.register(
    "Escape",
    () => {
      callCount++;
    },
    { enabled: () => canFire },
  );

  // First press: enabled returns false - should not fire
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let globalCalled = false;
  let editorCalled = false;

  manager.register(
    "Escape",
    () => {
      globalCalled = true;
    },
    { scope: GLOBAL_SCOPE },
  );

  manager.register(
    "Escape",
    () => {
      editorCalled = true;
    },
    { scope: "editor" },
  );

  // Editor scope is not active - only global should fire
  fireKey("Escape");
  assert.ok(globalCalled, "Global scope callback fired");
  assert.notOk(editorCalled, "Editor scope callback did not fire");
});

QUnit.test("Scope push/pop lifecycle", (assert) => {
  const manager = createHotkeyManager();
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
  assert.strictEqual(manager.getActiveScope(), GLOBAL_SCOPE);

  fireKey("Escape");
  assert.notOk(editorCalled, "Editor scope callback did not fire after popScope");
});

QUnit.test("pushScope trims whitespace and activates normalized scope", (assert) => {
  const manager = createHotkeyManager();
  let editorCalled = false;

  manager.register(
    "Escape",
    () => {
      editorCalled = true;
    },
    { scope: "editor" },
  );

  manager.pushScope("  editor  ");
  assert.strictEqual(manager.getActiveScope(), "editor", "Active scope is trimmed");

  fireKey("Escape");
  assert.ok(editorCalled, "Registration in normalized scope fires");
});

QUnit.test("popScope trims whitespace and pops normalized scope", (assert) => {
  const manager = createHotkeyManager();

  manager.pushScope("editor");
  assert.strictEqual(manager.getActiveScope(), "editor", "Editor scope pushed");

  manager.popScope("  editor  ");
  assert.strictEqual(manager.getActiveScope(), GLOBAL_SCOPE, "Pop with whitespace-trimmed value succeeds");
});

QUnit.test("pushScope and popScope whitespace-only values throw", (assert) => {
  const manager = createHotkeyManager();

  manager.pushScope("main");
  assert.throws(() => manager.pushScope("   "), /non-empty string/, "Whitespace-only pushScope is rejected");

  assert.throws(() => manager.popScope("   "), /non-empty string/, "Whitespace-only popScope is rejected");

  assert.strictEqual(manager.getActiveScope(), "main", "Stack remains unchanged after rejected whitespace calls");

  manager.popScope("main");
  assert.strictEqual(manager.getActiveScope(), GLOBAL_SCOPE, "Normal pop still works after rejected whitespace calls");
});

QUnit.test("register throws for empty scope string", (assert) => {
  const manager = createHotkeyManager();

  assert.throws(
    () => manager.register("Escape", () => {}, { scope: "" }),
    /non-empty string/,
    "Empty scope is rejected",
  );

  assert.throws(
    () => manager.register("Escape", () => {}, { scope: "   " }),
    /non-empty string/,
    "Whitespace-only scope is rejected",
  );
});

QUnit.test("Scoped handler takes priority over global for same key", (assert) => {
  const manager = createHotkeyManager();
  let globalCalled = false;
  let editorCalled = false;

  manager.register(
    "Escape",
    () => {
      globalCalled = true;
    },
    { scope: GLOBAL_SCOPE },
  );

  manager.register(
    "Escape",
    () => {
      editorCalled = true;
    },
    { scope: "editor" },
  );

  // Push editor scope - editor Escape should take priority
  manager.pushScope("editor");
  fireKey("Escape");
  assert.ok(editorCalled, "Editor scope Escape fired");
  assert.notOk(globalCalled, "Global Escape suppressed by scoped match");
});

QUnit.test("popScope throws on mismatch", (assert) => {
  const manager = createHotkeyManager();
  manager.pushScope("editor");

  assert.throws(() => manager.popScope("dialog"), /Cannot pop scope/, "Throws on scope mismatch");

  // Cleanup
  manager.popScope("editor");
});

QUnit.test("popScope throws when only global scope remains", (assert) => {
  const manager = createHotkeyManager();

  assert.throws(() => manager.popScope(GLOBAL_SCOPE), /Cannot pop the global scope/, "Cannot pop global scope");
});

QUnit.test("resetToGlobalScope pops all non-global scopes", (assert) => {
  const manager = createHotkeyManager();

  manager.pushScope("main");
  manager.pushScope("dialog");
  assert.strictEqual(manager.getActiveScope(), "dialog");

  manager.resetToGlobalScope();
  assert.strictEqual(manager.getActiveScope(), GLOBAL_SCOPE, "Back to global after reset");

  // Should be safe to call when already at global
  manager.resetToGlobalScope();
  assert.strictEqual(manager.getActiveScope(), GLOBAL_SCOPE, "No-op when already at global");
});

QUnit.test("pushScope rejects duplicate top scope", (assert) => {
  const manager = createHotkeyManager();

  manager.pushScope("editor");
  assert.strictEqual(manager.getActiveScope(), "editor");

  assert.throws(() => manager.pushScope("editor"), /already the active scope/, "Duplicate top scope is rejected");

  // Different scope on top is fine
  manager.pushScope("dialog");
  assert.strictEqual(manager.getActiveScope(), "dialog");
});

QUnit.test("pushScope rejects GLOBAL_SCOPE", (assert) => {
  const manager = createHotkeyManager();

  assert.throws(
    () => manager.pushScope("__global__"),
    /Cannot push the global scope/,
    "Pushing GLOBAL_SCOPE is rejected",
  );
});

// ──────────────────────────────────────────────
// Conflict handling
// ──────────────────────────────────────────────

QUnit.test("Conflict behavior: warn (default) allows both", (assert) => {
  const manager = createHotkeyManager();
  let firstCalled = false;

  manager.register("Escape", () => {
    firstCalled = true;
  });

  // Second registration with same hotkey - should warn but succeed
  manager.register("Escape", () => {
    // This would fire if first-match-wins didn't apply
  });

  fireKey("Escape");
  assert.ok(firstCalled, "First registration fires (first-match-wins)");
});

QUnit.test("Conflict behavior: error throws", (assert) => {
  const manager = createHotkeyManager();

  manager.register("Escape", () => {});

  assert.throws(
    () => manager.register("Escape", () => {}, { conflictBehavior: ConflictBehavior.Error }),
    /already registered/,
    "Error thrown on conflict",
  );
});

QUnit.test("Conflict behavior: replace removes old registration", (assert) => {
  const manager = createHotkeyManager();
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
    { conflictBehavior: ConflictBehavior.Replace },
  );

  fireKey("Escape");
  assert.notOk(oldCalled, "Old registration was replaced");
  assert.ok(newCalled, "New registration fires");
  assert.notOk(oldHandle.isActive, "Old handle becomes inactive after replace");
});

QUnit.test("Conflict behavior: same key/scope on different targets does not conflict", (assert) => {
  const manager = createHotkeyManager();
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
    { target: secondTarget, conflictBehavior: ConflictBehavior.Error },
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
  const manager = createHotkeyManager();
  let called = false;

  // F5 with default ignoreInputs: "auto" - should suppress in input
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
  const manager = createHotkeyManager();
  let called = false;

  // Ctrl+S with default ignoreInputs: "auto" - should fire even in input
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let called = false;

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { suppressInPopups: true },
  );

  const popupStub = sandbox.stub(runtimeHooks, "hasOpenPopup").returns(true);

  fireKey("F5");
  assert.notOk(called, "F5 suppressed when popup is open");

  popupStub.returns(false);
  fireKey("F5");
  assert.ok(called, "F5 fires when popup is closed");
});

QUnit.test("suppressInPopups: true (default) suppresses when popup is open", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  // Default suppressInPopups: true
  manager.register("F5", () => {
    called = true;
  });

  sandbox.stub(runtimeHooks, "hasOpenPopup").returns(true);

  fireKey("F5");
  assert.notOk(called, "F5 suppressed with popup open (default suppressInPopups: true)");
});

QUnit.test("suppressInPopups: false fires even with popup open", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { suppressInPopups: false },
  );

  sandbox.stub(runtimeHooks, "hasOpenPopup").returns(true);

  fireKey("F5");
  assert.ok(called, "F5 fires with popup open when suppressInPopups is false");
});

// ──────────────────────────────────────────────
// Error handling in callbacks
// ──────────────────────────────────────────────

QUnit.test("Callback error is caught and does not crash", (assert) => {
  const manager = createHotkeyManager();

  manager.register("F1", () => {
    throw new Error("Intentional test error");
  });

  // Should not throw - the error is caught and logged
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
  const manager = createHotkeyManager();

  manager.register("Escape", () => {});
  manager.register("Ctrl+S", () => {});

  const regs = manager.getRegistrations();
  assert.strictEqual(regs.length, 2, "Two registrations");
});

QUnit.test("getRegistrationsForScope filters by scope", (assert) => {
  const manager = createHotkeyManager();

  manager.register("Escape", () => {}, { scope: GLOBAL_SCOPE });
  manager.register("Ctrl+S", () => {}, { scope: "editor" });

  assert.strictEqual(manager.getRegistrationsForScope(GLOBAL_SCOPE).length, 1);
  assert.strictEqual(manager.getRegistrationsForScope("editor").length, 1);
  assert.strictEqual(manager.getRegistrationsForScope("unknown").length, 0);
});

QUnit.test("scope introspection normalizes whitespace consistently", (assert) => {
  const manager = createHotkeyManager();

  manager.register("Escape", () => {}, { scope: GLOBAL_SCOPE });
  manager.register("Ctrl+S", () => {}, { scope: "editor" });
  manager.register("G I", () => {}, { scope: "editor" });

  assert.strictEqual(manager.getRegistrationsForScope(" editor ").length, 2, "Registrations trim scope values");
  assert.throws(() => manager.getRegistrationsForScope("   "), /scope must be a non-empty string/);
  assert.strictEqual(
    manager.getRegistrationsForScope(" editor ").filter((r) => r.sequence !== null).length,
    1,
    "Sequence filter with trimmed scope values",
  );
});

// ──────────────────────────────────────────────
// Lifecycle
// ──────────────────────────────────────────────

QUnit.test("destroy cleans up everything", (assert) => {
  const manager = createHotkeyManager();
  manager.register("Escape", () => {});

  manager.destroy();

  // Getting a new instance should give a fresh manager
  const newManager = createHotkeyManager();
  assert.strictEqual(newManager.getRegistrations().length, 0, "New instance has no registrations");
  assert.strictEqual(newManager.getActiveScope(), GLOBAL_SCOPE, "Scope stack reset");
});

QUnit.test("destroy is idempotent (safe to call twice)", (assert) => {
  const manager = createHotkeyManager();
  manager.register("Escape", () => {});
  manager.pushScope("editor");

  manager.destroy();

  // Second destroy on the same reference should not throw
  manager.destroy();

  // A fresh instance should still work
  const fresh = createHotkeyManager();
  assert.strictEqual(fresh.getRegistrations().length, 0, "Fresh instance after double destroy");
  assert.strictEqual(fresh.getActiveScope(), GLOBAL_SCOPE, "Scope stack clean after double destroy");
});

QUnit.test("destroy invalidates hotkey and sequence handles", (assert) => {
  const manager = createHotkeyManager();
  const hotkeyHandle = manager.register("Escape", () => {});
  const sequenceHandle = manager.register("G E", () => {});

  assert.ok(hotkeyHandle.isActive, "Hotkey handle starts active");
  assert.ok(sequenceHandle.isActive, "Sequence handle starts active");

  manager.destroy();

  assert.notOk(hotkeyHandle.isActive, "Hotkey handle is inactive after manager destroy");
  assert.notOk(sequenceHandle.isActive, "Sequence handle is inactive after manager destroy");

  assert.throws(
    () => hotkeyHandle.setOptions({ enabled: false }),
    /unregistered/,
    "setOptions throws on hotkey handle after manager destroy",
  );
  assert.throws(
    () => sequenceHandle.setOptions({ enabled: false }),
    /unregistered/,
    "setOptions throws on sequence handle after manager destroy",
  );
});

// ──────────────────────────────────────────────
// preventDefault / stopPropagation
// ──────────────────────────────────────────────

QUnit.test("preventDefault: true (default) prevents default", (assert) => {
  const manager = createHotkeyManager();

  manager.register("F5", () => {});

  const event = fireKey("F5");
  assert.ok(event.defaultPrevented, "Default was prevented");
});

QUnit.test("preventDefault: false does not prevent default", (assert) => {
  const manager = createHotkeyManager();

  manager.register("F5", () => {}, { preventDefault: false });

  const event = fireKey("F5");
  assert.notOk(event.defaultPrevented, "Default was not prevented");
});

QUnit.test("stopPropagation: true (default) stops propagation", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let firstCalled = false;

  manager.register("Escape", () => {
    firstCalled = true;
  });

  // Second registration with "allow" - no warning, no error
  manager.register("Escape", () => {}, { conflictBehavior: ConflictBehavior.Allow });

  fireKey("Escape");
  assert.ok(firstCalled, "First registration fires (first-match-wins)");
  assert.strictEqual(manager.getRegistrations().length, 2, "Both registrations exist");
});

// ──────────────────────────────────────────────
// Validation warnings during register()
// ──────────────────────────────────────────────

QUnit.test("register logs a warning for browser-conflicting hotkeys", (assert) => {
  const LogModule = sap.ui.require("sap/base/Log") as typeof Log;
  const warningSpy = sandbox.spy(LogModule, "warning");
  const manager = createHotkeyManager();

  manager.register("Ctrl+T", () => {});

  assert.ok(
    warningSpy.getCalls().some((call) => String(call.args[0]).includes("browser shortcut")),
    "Browser-conflict warning logged during register()",
  );
});

QUnit.test("register('Ctrl++') logs no unknown-key warning", (assert) => {
  const LogModule = sap.ui.require("sap/base/Log") as typeof Log;
  const warningSpy = sandbox.spy(LogModule, "warning");
  const manager = createHotkeyManager();

  manager.register("Ctrl++", () => {});

  assert.notOk(
    warningSpy.getCalls().some((call) => /unknown key/i.test(String(call.args[0]))),
    "No unknown-key warning for the literal + key",
  );
});

// ──────────────────────────────────────────────
// IME composition guard
// ──────────────────────────────────────────────

QUnit.test("IME composition events are ignored", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let called = false;

  // Register Ctrl+S - pressing Ctrl alone should not fire anything
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
  const manager = createHotkeyManager();
  let ctx: any = null;

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  fireKey("F9");
  assert.strictEqual(ctx.reason, "no_match", "Reason is no_match");
  assert.strictEqual(ctx.activeScope, GLOBAL_SCOPE, "Active scope is global");
  assert.notOk(ctx.skippedRegistration, "No skipped registration for no_match");
  assert.ok(ctx.event instanceof KeyboardEvent, "Event is a KeyboardEvent");
});

QUnit.test("Unhandled: fires with disabled reason when registration is disabled", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let ctx: any = null;

  manager.register(
    "F5",
    () => {
      assert.notOk(true, "Should not fire");
    },
    { suppressInPopups: true },
  );

  sandbox.stub(runtimeHooks, "hasOpenPopup").returns(true);

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  fireKey("F5");
  assert.strictEqual(ctx.reason, "popup_suppressed", "Reason is popup_suppressed");
  assert.ok(ctx.isPopupOpen, "isPopupOpen is true");
  assert.ok(ctx.skippedRegistration, "Skipped registration is present");
});

QUnit.test("Unhandled: fires with repeat_ignored when key held", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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

QUnit.test("Unhandled: does NOT fire no_match for sequence progression/completion", (assert) => {
  const manager = createHotkeyManager();
  let sequenceCalled = false;
  let unhandledCount = 0;

  manager.register("G E", () => {
    sequenceCalled = true;
  });

  manager.setUnhandledHandler((ctx) => {
    if (ctx.reason === "no_match") {
      unhandledCount++;
    }
  });

  fireKey("g");
  fireKey("e");

  assert.ok(sequenceCalled, "Sequence callback fired");
  assert.strictEqual(unhandledCount, 0, "no_match not emitted for sequence keys");
});

QUnit.test("Unhandled: does NOT fire no_match when target hotkey handles event", (assert) => {
  const manager = createHotkeyManager();
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

QUnit.test("Unhandled: nested targets do not emit no_match when inner target handles", (assert) => {
  const manager = createHotkeyManager();
  let innerCalled = false;
  let unhandledCalled = false;

  const outer = document.createElement("div");
  outer.tabIndex = 0;
  const inner = document.createElement("button");
  inner.type = "button";
  outer.appendChild(inner);
  fixture.appendChild(outer);

  // Keep a listener attached on the outer target so this key first passes
  // through an outer no-match before being handled by the inner target.
  manager.register("F7", () => {}, { target: outer });
  manager.register(
    "F6",
    () => {
      innerCalled = true;
    },
    { target: inner },
  );

  manager.setUnhandledHandler(() => {
    unhandledCalled = true;
  });

  inner.dispatchEvent(new KeyboardEvent("keydown", { key: "F6", bubbles: true, cancelable: true }));

  assert.ok(innerCalled, "Inner target hotkey handler fired");
  assert.notOk(unhandledCalled, "Outer no_match does not emit unhandled before inner handler runs");
});

QUnit.test("Unhandled: nested target no_match is emitted once", (assert) => {
  const manager = createHotkeyManager();
  let unhandledCount = 0;
  let lastReason = "";

  const outer = document.createElement("div");
  outer.tabIndex = 0;
  const inner = document.createElement("button");
  inner.type = "button";
  outer.appendChild(inner);
  fixture.appendChild(outer);

  manager.register("F7", () => {}, { target: outer });
  manager.register("F8", () => {}, { target: inner });

  manager.setUnhandledHandler((ctx) => {
    unhandledCount++;
    lastReason = ctx.reason;
  });

  inner.dispatchEvent(new KeyboardEvent("keydown", { key: "F9", bubbles: true, cancelable: true }));

  assert.strictEqual(unhandledCount, 1, "no_match is reported exactly once for nested target listeners");
  assert.strictEqual(lastReason, "no_match", "Reason remains no_match");
});

QUnit.test("Unhandled: nested inner no_match is suppressed after ancestor handles", (assert) => {
  const manager = createHotkeyManager();
  let outerCalled = false;
  let unhandledCalled = false;

  const outer = document.createElement("div");
  outer.tabIndex = 0;
  const inner = document.createElement("button");
  inner.type = "button";
  outer.appendChild(inner);
  fixture.appendChild(outer);

  manager.register(
    "F6",
    () => {
      outerCalled = true;
    },
    {
      target: outer,
      stopPropagation: false,
    },
  );
  manager.register("F7", () => {}, { target: inner });

  manager.setUnhandledHandler(() => {
    unhandledCalled = true;
  });

  inner.dispatchEvent(new KeyboardEvent("keydown", { key: "F6", bubbles: true, cancelable: true }));

  assert.ok(outerCalled, "Ancestor target handled the key");
  assert.notOk(unhandledCalled, "Inner no_match does not emit unhandled after key was already handled");
});

QUnit.test("Unhandled: passes correct activeScope in context", (assert) => {
  const manager = createHotkeyManager();
  let ctx: any = null;

  manager.pushScope("detail");

  manager.setUnhandledHandler((c) => {
    ctx = c;
  });

  fireKey("F9");
  assert.strictEqual(ctx.activeScope, "detail", "Active scope is detail");
});

QUnit.test("Unhandled: null removes the callback", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let count = 0;

  const handle = manager.register("Escape", () => {
    count++;
  });

  // Disable via setOptions
  handle.setOptions({ enabled: false });
  fireKey("Escape");
  assert.strictEqual(count, 0, "Disabled via setOptions - not called");

  // Re-enable
  handle.setOptions({ enabled: true });
  fireKey("Escape");
  assert.strictEqual(count, 1, "Re-enabled via setOptions - called once");
});

QUnit.test("setOptions: update description", (assert) => {
  const manager = createHotkeyManager();

  const handle = manager.register("Escape", () => {}, { description: "Close" });

  handle.setOptions({ description: "Dismiss" });

  const regs = manager.getRegistrations();
  const reg = regs.find((r) => r.id === handle.id);
  assert.strictEqual(reg?.description, "Dismiss", "Description updated");
});

QUnit.test("setOptions: update ignoreRepeat", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();

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
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let count = 0;

  // Register with default ignoreInputs: "auto" - single key suppressed in inputs
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
  const manager = createHotkeyManager();
  let count = 0;

  const handle = manager.register(
    "F5",
    () => {
      count++;
    },
    { suppressInPopups: true },
  );

  sandbox.stub(runtimeHooks, "hasOpenPopup").returns(true);

  fireKey("F5");
  assert.strictEqual(count, 0, "F5 suppressed with popup open");

  handle.setOptions({ suppressInPopups: false });
  fireKey("F5");
  assert.strictEqual(count, 1, "F5 fires after setOptions({ suppressInPopups: false })");
});

QUnit.test("setOptions: throws on unregistered handle", (assert) => {
  const manager = createHotkeyManager();
  const handle = manager.register("Escape", () => {});
  handle.unregister();

  assert.throws(() => handle.setOptions({ enabled: false }), /unregistered/, "Throws on setOptions after unregister");
});

QUnit.test("setOptions: throws on scope change", (assert) => {
  const manager = createHotkeyManager();
  const handle = manager.register("Escape", () => {});

  assert.throws(
    // @ts-expect-error Testing runtime guard for disallowed option
    () => handle.setOptions({ scope: "other" }),
    /Cannot change scope/,
    "Throws when trying to change scope",
  );
});

QUnit.test("setOptions: throws on conflictBehavior change", (assert) => {
  const manager = createHotkeyManager();
  const handle = manager.register("Escape", () => {});

  assert.throws(
    // @ts-expect-error Testing runtime guard for disallowed option
    () => handle.setOptions({ conflictBehavior: ConflictBehavior.Error }),
    /Cannot change conflictBehavior/,
    "Throws when trying to change conflictBehavior",
  );
});

// ──────────────────────────────────────────────
// AltGr guard (Feature 5)
// ──────────────────────────────────────────────

QUnit.test("AltGr: right-Alt does NOT fire Ctrl+Alt hotkey on Windows", (assert) => {
  sandbox.stub(runtimeHooks, "detectPlatform").returns(Platform.Windows);
  const manager = createHotkeyManager();
  let called = false;

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

QUnit.test("AltGr: AltGraph modifier state suppresses Ctrl+Alt hotkey on Windows", (assert) => {
  sandbox.stub(runtimeHooks, "detectPlatform").returns(Platform.Windows);
  const manager = createHotkeyManager();
  let called = false;

  manager.register("Ctrl+Alt+E", () => {
    called = true;
  });

  const eEvent = new KeyboardEvent("keydown", {
    key: "e",
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    altKey: true,
  });
  Object.defineProperty(eEvent, "getModifierState", {
    value: (keyArg: string) => keyArg === "AltGraph",
    writable: false,
  });
  document.dispatchEvent(eEvent);

  assert.notOk(called, "AltGraph+E did not fire Ctrl+Alt+E");
});

QUnit.test("AltGr: left-Alt DOES fire Ctrl+Alt hotkey", (assert) => {
  sandbox.stub(runtimeHooks, "detectPlatform").returns(Platform.Windows);
  const manager = createHotkeyManager();
  let called = false;

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
  sandbox.stub(runtimeHooks, "detectPlatform").returns(Platform.Linux);
  const manager = createHotkeyManager();
  let called = false;

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
  sandbox.stub(runtimeHooks, "detectPlatform").returns(Platform.Windows);
  const manager = createHotkeyManager();
  let called = false;

  manager.register("Ctrl+Alt+E", () => {
    called = true;
  });

  // No prior Alt keydown - _lastAltLocation stays 0
  fireKey("e", { ctrlKey: true, altKey: true });
  assert.ok(called, "Ctrl+Alt+E fires without prior Alt (location=0)");
});

QUnit.test("AltGr: stale right-Alt state is cleared after non-Alt keydown", (assert) => {
  sandbox.stub(runtimeHooks, "detectPlatform").returns(Platform.Windows);
  const manager = createHotkeyManager();
  let called = false;

  manager.register("Ctrl+Alt+E", () => {
    called = true;
  });

  const altEvent = new KeyboardEvent("keydown", {
    key: "Alt",
    bubbles: true,
    cancelable: true,
    altKey: true,
  });
  Object.defineProperty(altEvent, "location", { value: 2 });
  document.dispatchEvent(altEvent);

  // Alt is no longer held on this event, so stale AltGr state should be reset.
  fireKey("x");
  fireKey("e", { ctrlKey: true, altKey: true });

  assert.ok(called, "Ctrl+Alt hotkey fires after stale AltGr state reset");
});

// ──────────────────────────────────────────────
// Target element (Feature 13)
// ──────────────────────────────────────────────

QUnit.test("Target element: hotkey fires on target element", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
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

  // Fire on document - should NOT trigger target-bound hotkey
  fireKey("F7");
  assert.notOk(targetCalled, "Target hotkey does not fire from document event");
});

QUnit.test("Target element: document and target coexist", (assert) => {
  const manager = createHotkeyManager();
  let docCalled = false;
  let targetCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  // Target-scoped handlers fire first; set stopPropagation: false on the target
  // registration so the untargeted handler can also fire as a fallback.
  manager.register("F8", () => {
    docCalled = true;
  });
  manager.register(
    "F8",
    () => {
      targetCalled = true;
    },
    { target: div, stopPropagation: false },
  );

  // Fire on div - both target and doc listeners fire (target first, then document fallback)
  const divEvent = new KeyboardEvent("keydown", {
    key: "F8",
    bubbles: true,
    cancelable: true,
  });
  div.dispatchEvent(divEvent);

  assert.ok(targetCalled, "Target hotkey fired from element event");
  assert.ok(docCalled, "Doc hotkey also fires (capture phase, stopPropagation: false)");

  // Now fire on document directly - only doc should fire
  targetCalled = false;
  docCalled = false;
  fireKey("F8");
  assert.ok(docCalled, "Doc hotkey fires from document event");
  assert.notOk(targetCalled, "Target hotkey does not fire from document event");
});

QUnit.test("Target element: with scope", (assert) => {
  const manager = createHotkeyManager();
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

  // Fire without editor scope - should not fire
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
  const manager = createHotkeyManager();
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

  // Fire on old target - should NOT fire
  const event1 = new KeyboardEvent("keydown", {
    key: "F11",
    bubbles: true,
    cancelable: true,
  });
  div1.dispatchEvent(event1);
  assert.notOk(called, "Hotkey does not fire on old target after setOptions");

  // Fire on new target - should fire
  const event2 = new KeyboardEvent("keydown", {
    key: "F11",
    bubbles: true,
    cancelable: true,
  });
  div2.dispatchEvent(event2);
  assert.ok(called, "Hotkey fires on new target after setOptions");
});

QUnit.test("Target element: setOptions target swap triggers conflict detection (error)", (assert) => {
  const manager = createHotkeyManager();

  const div1 = document.createElement("div");
  div1.tabIndex = 0;
  fixture.appendChild(div1);

  const div2 = document.createElement("div");
  div2.tabIndex = 0;
  fixture.appendChild(div2);

  // Register F9 on div2 with error conflict behavior
  manager.register("F9", () => {}, { target: div2, conflictBehavior: ConflictBehavior.Error });

  // Register the same hotkey on div1
  let fired = false;
  const handle = manager.register(
    "F9",
    () => {
      fired = true;
    },
    { target: div1, conflictBehavior: ConflictBehavior.Error },
  );

  // Retarget to div2 - should throw because F9 is already registered on div2
  assert.throws(
    () => handle.setOptions({ target: div2 }),
    /already registered/,
    "setOptions target swap throws on conflict with error behavior",
  );

  // After failed retarget, registration must remain fully functional on div1
  assert.ok(handle.isActive, "Handle stays active after failed retarget");
  div1.dispatchEvent(new KeyboardEvent("keydown", { key: "F9", bubbles: true, cancelable: true }));
  assert.ok(fired, "Hotkey still fires on original target after failed retarget");
});

QUnit.test("Target element: setOptions target swap triggers conflict detection (replace)", (assert) => {
  const manager = createHotkeyManager();
  let oldCalled = false;
  let swappedCalled = false;

  const div1 = document.createElement("div");
  div1.tabIndex = 0;
  fixture.appendChild(div1);

  const div2 = document.createElement("div");
  div2.tabIndex = 0;
  fixture.appendChild(div2);

  // Existing registration on div2
  const existingHandle = manager.register(
    "F9",
    () => {
      oldCalled = true;
    },
    { target: div2 },
  );

  // Register same hotkey on div1 with replace behavior
  const handle = manager.register(
    "F9",
    () => {
      swappedCalled = true;
    },
    { target: div1, conflictBehavior: ConflictBehavior.Replace },
  );

  // Retarget to div2 - should replace the existing registration
  handle.setOptions({ target: div2 });

  assert.notOk(existingHandle.isActive, "Existing registration deactivated after replace");

  div2.dispatchEvent(new KeyboardEvent("keydown", { key: "F9", bubbles: true, cancelable: true }));
  assert.notOk(oldCalled, "Old registration callback not called");
  assert.ok(swappedCalled, "Swapped registration callback fires on new target");
});

QUnit.test("Target element: unregister removes listener", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();
  let oldCalled = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  // Register on target element - this adds a capture listener on div
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
    { target: div, conflictBehavior: ConflictBehavior.Replace },
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

  // Now unregister the new one - ref count should go to 0, removing the listener.
  newHandle.unregister();
  newCalled = false;

  fireKeyOn(div, "F3");
  assert.notOk(newCalled, "No callbacks fire after unregistering all registrations");
});

// ──────────────────────────────────────────────
// Handle introspection
// ──────────────────────────────────────────────

QUnit.test("Handle exposes hotkey, scope, and description", (assert) => {
  const manager = createHotkeyManager();

  const handle = manager.register("Mod+S", () => {}, {
    scope: "editor",
    description: "Save",
  });

  assert.strictEqual(handle.hotkey, "Mod+S", "hotkey property returns original hotkey string");
  assert.strictEqual(handle.scope, "editor", "scope property returns scope");
  assert.strictEqual(handle.description, "Save", "description property returns description");
});

QUnit.test("Handle description reflects setOptions update", (assert) => {
  const manager = createHotkeyManager();

  const handle = manager.register("Escape", () => {}, { description: "Close" });

  handle.setOptions({ description: "Dismiss" });
  assert.strictEqual(handle.description, "Dismiss", "description reflects setOptions update");
});

QUnit.test("Handle defaults: scope is global, description is empty", (assert) => {
  const manager = createHotkeyManager();

  const handle = manager.register("F5", () => {});

  assert.strictEqual(handle.scope, GLOBAL_SCOPE, "default scope is GLOBAL_SCOPE");
  assert.strictEqual(handle.description, "", "default description is empty string");
});

// ──────────────────────────────────────────────
// enabled() callback error handling
// ──────────────────────────────────────────────

QUnit.test("enabled function throwing: hotkey does not fire and manager stays operational", (assert) => {
  const manager = createHotkeyManager();
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
  const manager = createHotkeyManager();

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
  const manager = createHotkeyManager();
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

  const h2 = manager.register(
    "F4",
    () => {
      secondCalled = true;
    },
    { target: div },
  );

  // Unregister the first - the target listener should remain (ref count > 0)
  h1.unregister();

  // F3 should no longer fire
  const event1 = new KeyboardEvent("keydown", { key: "F3", bubbles: true, cancelable: true });
  div.dispatchEvent(event1);
  assert.notOk(firstCalled, "Unregistered F3 does not fire");

  // F4 should still fire - the target listener was NOT removed
  const event2 = new KeyboardEvent("keydown", { key: "F4", bubbles: true, cancelable: true });
  div.dispatchEvent(event2);
  assert.ok(secondCalled, "F4 still fires on same target after sibling unregister");

  h2.unregister();
  firstCalled = false;
  secondCalled = false;

  fireKeyOn(div, "F3");
  fireKeyOn(div, "F4");
  assert.notOk(firstCalled, "No first callback after unregistering both handles");
  assert.notOk(secondCalled, "No second callback after unregistering both handles");
});

// ──────────────────────────────────────────────
// Target callback (lazy target resolution)
// ──────────────────────────────────────────────

QUnit.test("Target callback: fires when resolved element is in composedPath", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { target: () => div },
  );

  fireKeyOn(div, "F5");
  assert.ok(called, "Callback target fires when element is in event path");
});

QUnit.test("Target callback: does not fire when resolved element is not in path", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const target = document.createElement("div");
  target.tabIndex = 0;
  fixture.appendChild(target);

  const other = document.createElement("div");
  other.tabIndex = 0;
  fixture.appendChild(other);

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { target: () => target },
  );

  fireKeyOn(other, "F5");
  assert.notOk(called, "Callback target does not fire for events on other elements");
});

QUnit.test("Target callback: null return skips registration silently", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { target: () => null },
  );

  fireKey("F5");
  assert.notOk(called, "Registration with null-returning callback does not fire");
});

QUnit.test("Target callback: resolved lazily on each keydown", (assert) => {
  const manager = createHotkeyManager();
  let callCount = 0;
  let resolveCount = 0;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register(
    "F5",
    () => {
      callCount++;
    },
    {
      target: () => {
        resolveCount++;
        return div;
      },
    },
  );

  fireKeyOn(div, "F5");
  fireKeyOn(div, "F5");

  assert.strictEqual(resolveCount, 2, "Callback evaluated on each keydown");
  assert.strictEqual(callCount, 2, "Handler fires both times");
});

QUnit.test("Target callback: respects scope", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register(
    "F5",
    () => {
      called = true;
    },
    { target: () => div, scope: "detail" },
  );

  // Wrong scope - should not fire
  fireKeyOn(div, "F5");
  assert.notOk(called, "Does not fire in global scope");

  // Correct scope
  manager.pushScope("detail");
  fireKeyOn(div, "F5");
  assert.ok(called, "Fires when scope matches");
});

QUnit.test("Target callback: throwing callback is caught and skipped", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  manager.register(
    "F5",
    () => {
      called = true;
    },
    {
      target: () => {
        throw new Error("boom");
      },
    },
  );

  fireKey("F5");
  assert.notOk(called, "Registration with throwing callback does not fire");
});

QUnit.test("Target callback: unregister cleans up", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  const handle = manager.register(
    "F5",
    () => {
      called = true;
    },
    { target: () => div },
  );

  handle.unregister();

  fireKeyOn(div, "F5");
  assert.notOk(called, "Callback target does not fire after unregister");
});

QUnit.test("Target callback: setOptions swaps static to callback target", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const div1 = document.createElement("div");
  div1.tabIndex = 0;
  fixture.appendChild(div1);

  const div2 = document.createElement("div");
  div2.tabIndex = 0;
  fixture.appendChild(div2);

  const handle = manager.register(
    "F5",
    () => {
      called = true;
    },
    { target: div1 },
  );

  // Swap from static to callback
  handle.setOptions({ target: () => div2 });

  fireKeyOn(div1, "F5");
  assert.notOk(called, "Old static target no longer fires");

  fireKeyOn(div2, "F5");
  assert.ok(called, "New callback target fires");
});

QUnit.test("Target callback: setOptions swaps callback to static target", (assert) => {
  const manager = createHotkeyManager();
  let called = false;

  const div1 = document.createElement("div");
  div1.tabIndex = 0;
  fixture.appendChild(div1);

  const div2 = document.createElement("div");
  div2.tabIndex = 0;
  fixture.appendChild(div2);

  const handle = manager.register(
    "F5",
    () => {
      called = true;
    },
    { target: () => div1 },
  );

  // Swap from callback to static
  handle.setOptions({ target: div2 });

  fireKeyOn(div1, "F5");
  assert.notOk(called, "Old callback target no longer fires");

  fireKeyOn(div2, "F5");
  assert.ok(called, "New static target fires");
});

QUnit.test("Target callback: hasTarget reports true in registration info", (assert) => {
  const manager = createHotkeyManager();

  const div = document.createElement("div");
  fixture.appendChild(div);

  manager.register("F5", () => {}, { target: () => div });

  const regs = manager.getRegistrations();
  assert.strictEqual(regs.length, 1, "One registration exists");
  assert.ok(regs[0]!.hasTarget, "hasTarget is true for callback target");
});

QUnit.test("Target callback: coexists with static target and untargeted", (assert) => {
  const manager = createHotkeyManager();
  let staticCalled = false;
  let callbackCalled = false;
  let untargetedCalled = false;

  const div1 = document.createElement("div");
  div1.tabIndex = 0;
  fixture.appendChild(div1);

  const div2 = document.createElement("div");
  div2.tabIndex = 0;
  fixture.appendChild(div2);

  manager.register(
    "F5",
    () => {
      staticCalled = true;
    },
    { target: div1 },
  );
  manager.register(
    "F5",
    () => {
      callbackCalled = true;
    },
    { target: () => div2 },
  );
  manager.register("F6", () => {
    untargetedCalled = true;
  });

  fireKeyOn(div1, "F5");
  assert.ok(staticCalled, "Static target fires");
  assert.notOk(callbackCalled, "Callback target does not fire for other element");

  staticCalled = false;
  fireKeyOn(div2, "F5");
  assert.notOk(staticCalled, "Static target does not fire for callback element");
  assert.ok(callbackCalled, "Callback target fires on its element");

  fireKey("F6");
  assert.ok(untargetedCalled, "Untargeted registration fires normally");
});

QUnit.test("Target callback: unhandled reports TargetMismatch for off-path callback", (assert) => {
  const manager = createHotkeyManager();
  let reason: string | undefined;

  const div = document.createElement("div");
  div.tabIndex = 0;
  fixture.appendChild(div);

  manager.register("F5", () => {}, { target: () => div });

  manager.setUnhandledHandler((ctx) => {
    reason = ctx.reason;
  });

  // Fire on document, not on div
  fireKey("F5");
  assert.strictEqual(reason, "target_mismatch", "TargetMismatch reported for off-path callback target");
});
