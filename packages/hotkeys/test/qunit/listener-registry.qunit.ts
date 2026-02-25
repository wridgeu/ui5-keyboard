import ListenerRegistry from "ui5/hotkeys/listener-registry";
import { fireKeyOn } from "./test-helpers";

// ──────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────

interface ProcessCall {
  target: EventTarget;
  emitUnhandled: boolean;
}

function createRegistry(calls: ProcessCall[], shouldIgnore = false) {
  return new ListenerRegistry(
    () => shouldIgnore,
    (_event, target, emitUnhandled) => {
      calls.push({ target, emitUnhandled });
    },
  );
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

let outer: HTMLDivElement;
let inner: HTMLDivElement;

QUnit.module("ListenerRegistry", {
  beforeEach() {
    outer = document.createElement("div");
    inner = document.createElement("div");
    outer.appendChild(inner);
    document.body.appendChild(outer);
  },
  afterEach() {
    outer.remove();
  },
});

// ── hasTarget ──────────────────────────────────

QUnit.test("hasTarget returns false for unknown target", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  assert.notOk(registry.hasTarget(outer), "Unknown target not found");
});

QUnit.test("hasTarget returns true after attachTarget", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachTarget(outer);
  assert.ok(registry.hasTarget(outer), "Target found after attach");

  registry.detachAllTargets();
});

QUnit.test("hasTarget returns false after final detachTarget", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachTarget(outer);
  registry.detachTarget(outer);
  assert.notOk(registry.hasTarget(outer), "Target removed after detach");
});

// ── attachTarget / detachTarget ────────────────

QUnit.test("Handler fires on keydown dispatched on target", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachTarget(outer);
  fireKeyOn(outer, "Escape");

  assert.strictEqual(calls.length, 1, "processTargetKeyEvent called once");
  assert.strictEqual(calls[0].target, outer, "Correct target passed");

  registry.detachAllTargets();
});

QUnit.test("Ref-counted: attach twice, single detach keeps listener", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachTarget(outer);
  registry.attachTarget(outer);
  registry.detachTarget(outer);

  // Listener should still be active
  assert.ok(registry.hasTarget(outer), "Target still registered after one detach");
  fireKeyOn(outer, "Escape");
  assert.strictEqual(calls.length, 1, "Handler still fires");

  registry.detachAllTargets();
});

QUnit.test("Ref-counted: both detaches remove listener", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachTarget(outer);
  registry.attachTarget(outer);
  registry.detachTarget(outer);
  registry.detachTarget(outer);

  assert.notOk(registry.hasTarget(outer), "Target removed after both detaches");
  fireKeyOn(outer, "Escape");
  assert.strictEqual(calls.length, 0, "Handler no longer fires");
});

QUnit.test("detachTarget for unknown target is no-op", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.detachTarget(outer);
  assert.ok(true, "No error thrown for unknown target");
});

// ── detachAllTargets ──────────────────────────

QUnit.test("detachAllTargets removes all listeners", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachTarget(outer);
  registry.attachTarget(inner);
  registry.detachAllTargets();

  assert.notOk(registry.hasTarget(outer), "Outer removed");
  assert.notOk(registry.hasTarget(inner), "Inner removed");

  fireKeyOn(outer, "Escape");
  fireKeyOn(inner, "Escape");
  assert.strictEqual(calls.length, 0, "No handlers fire after detachAll");
});

// ── shouldIgnoreKeyEvent filtering ────────────

QUnit.test("Ignored events do not trigger processTargetKeyEvent", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls, /* shouldIgnore */ true);

  registry.attachTarget(outer);
  fireKeyOn(outer, "Escape");

  assert.strictEqual(calls.length, 0, "processTargetKeyEvent not called for ignored event");

  registry.detachAllTargets();
});

// ── emitUnhandled (composed-path logic) ───────

QUnit.test("Single target always gets emitUnhandled = true", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachTarget(inner);
  fireKeyOn(inner, "Escape");

  assert.strictEqual(calls.length, 1, "Single call");
  assert.ok(calls[0].emitUnhandled, "emitUnhandled is true for the only registered target");

  registry.detachAllTargets();
});

QUnit.test("Nested targets: inner gets emitUnhandled=true, outer gets false", (assert) => {
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachTarget(outer);
  registry.attachTarget(inner);

  // Dispatch on inner — capture phase traverses outer then inner
  fireKeyOn(inner, "Escape");

  // Capture order: outer fires first, inner fires second
  assert.strictEqual(calls.length, 2, "Both handlers fire");

  const outerCall = calls.find((c) => c.target === outer);
  const innerCall = calls.find((c) => c.target === inner);

  assert.ok(outerCall, "Outer handler called");
  assert.ok(innerCall, "Inner handler called");
  assert.notOk(outerCall!.emitUnhandled, "Outer target: emitUnhandled is false");
  assert.ok(innerCall!.emitUnhandled, "Inner target: emitUnhandled is true");

  registry.detachAllTargets();
});

// ── attachDocument / detachDocument ───────────

QUnit.test("attachDocument adds capture-phase listener on document", (assert) => {
  let called = false;
  const handler = () => {
    called = true;
  };
  const calls: ProcessCall[] = [];
  const registry = createRegistry(calls);

  registry.attachDocument(handler as unknown as (event: KeyboardEvent) => void);

  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  document.dispatchEvent(event);

  assert.ok(called, "Document handler fires on keydown");

  registry.detachDocument(handler as unknown as (event: KeyboardEvent) => void);

  called = false;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  assert.notOk(called, "Document handler does not fire after detach");
});
