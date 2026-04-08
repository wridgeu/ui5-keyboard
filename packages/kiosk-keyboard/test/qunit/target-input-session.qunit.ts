import TargetInputSession from "ui5/kiosk/internal/target-input-session";
import type { TargetElement } from "ui5/kiosk/internal/types";

const fixture = document.getElementById("qunit-fixture")!;

// ─── Helpers ─────────────────────────────────────

interface FiredEvent {
  name: string;
  params: Record<string, unknown>;
}

/**
 * Creates a mock UI5 Element wrapping the given DOM node.
 * Supports getMetadata/fireEvent so opsFireTargetChange works end-to-end.
 */
function makeMockElement(dom: HTMLInputElement | HTMLTextAreaElement | null): TargetElement & { $fired: FiredEvent[] } {
  const fired: FiredEvent[] = [];
  return {
    getFocusDomRef: () => dom,
    getMetadata: () => ({
      hasProperty: (name: string) => name === "value",
      hasEvent: (name: string) => name === "change" || name === "liveChange",
    }),
    fireEvent(name: string, params: Record<string, unknown>) {
      fired.push({ name, params });
    },
    setProperty() {},
    /** Recorded fireEvent calls for assertions. */
    $fired: fired,
  };
}

function makeInput(value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  fixture.appendChild(input);
  return input;
}

function makeTextarea(value: string): HTMLTextAreaElement {
  const ta = document.createElement("textarea");
  ta.value = value;
  fixture.appendChild(ta);
  return ta;
}

function changeEvents(mock: ReturnType<typeof makeMockElement>): FiredEvent[] {
  return mock.$fired.filter((e) => e.name === "change");
}

// ──────────────────────────────────────────────────
// resetForTargetSwitch
// ──────────────────────────────────────────────────

QUnit.module("target-input-session - resetForTargetSwitch", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Clears cached cursor - next insert goes to end of value", (assert) => {
  const input = makeInput("abcde");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  // Move cursor to start, then insert - establishes cursor at position 1
  session.handleNavigationKey("Home");
  session.insertText("x");
  assert.strictEqual(input.value, "xabcde", "Pre-reset: 'x' inserted at start");

  // Reset clears cached cursor
  session.resetForTargetSwitch();

  // Next insert: _cursorPos is null → cursor placed at end of value
  session.insertText("z");
  assert.strictEqual(input.value, "xabcdez", "Post-reset: 'z' appended at end");
});

QUnit.test("Clears _lastKnownValue - value-divergence detection starts fresh", (assert) => {
  const input = makeInput("aaa");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  // Establish session state with cached _lastKnownValue
  session.insertText("!");
  assert.strictEqual(input.value, "aaa!", "Session state established");

  session.handleNavigationKey("Home"); // cursor at 0

  // Reset, then change value externally
  session.resetForTargetSwitch();
  input.value = "bbb";

  // After reset: _cursorPos === null → cursor at end (not divergence path)
  session.insertText("x");
  assert.strictEqual(input.value, "bbbx", "Cursor at end of new value after reset");
});

QUnit.test("Does not clear dirty flag (handled separately by captureAndClearDirty)", (assert) => {
  const input = makeInput("test");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("!"); // marks dirty

  session.resetForTargetSwitch(); // cursor + lastKnownValue cleared, dirty preserved

  session.fireChangeIfDirty();
  assert.strictEqual(changeEvents(mock).length, 1, "Change event fired - dirty flag survived reset");
});

// ──────────────────────────────────────────────────
// _getTargetDomRef - cursor recovery
// ──────────────────────────────────────────────────

QUnit.module("target-input-session - cursor recovery", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("First access with no cached state places cursor at end", (assert) => {
  const input = makeInput("hello");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("!");
  assert.strictEqual(input.value, "hello!", "Text appended at end on first access");
});

QUnit.test("Detects programmatic setValue and resets cursor to end", (assert) => {
  const input = makeInput("hello");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  // Build up session state with cursor at the start
  session.insertText("!"); // "hello!", cursor [6,6]
  session.handleNavigationKey("Home"); // cursor [0,0]
  session.insertText(">"); // ">hello!", cursor [1,1]
  assert.strictEqual(input.value, ">hello!", "Cursor was at start before divergence");

  // Simulate programmatic setValue - value diverges from _lastKnownValue
  input.value = "world";

  // Session detects divergence → resets cursor to end of new value
  session.insertText("!");
  assert.strictEqual(input.value, "world!", "After setValue: cursor reset to end");
});

QUnit.test("Reads cursor from focused DOM element", (assert) => {
  const input = makeInput("abcde");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  // Focus and set selection in the middle
  input.focus();
  input.setSelectionRange(2, 2);

  session.insertText("X");
  assert.strictEqual(input.value, "abXcde", "Text inserted at focused DOM selection position");
});

// ──────────────────────────────────────────────────
// insertText
// ──────────────────────────────────────────────────

QUnit.module("target-input-session - insertText", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Inserts text and marks session dirty", (assert) => {
  const input = makeInput("abc");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("X");
  assert.strictEqual(input.value, "abcX", "Text inserted");

  // Verify dirty: captureAndClearDirty returns a callback when dirty
  const cb = session.captureAndClearDirty();
  assert.notStrictEqual(cb, null, "Session is dirty after insertText");
});

QUnit.test("No-op when target element is null", (assert) => {
  const session = new TargetInputSession(() => null);

  session.insertText("X"); // should not throw
  assert.ok(true, "No error thrown when target element is null");
});

QUnit.test("No-op when target has no resolvable DOM ref", (assert) => {
  const mock = makeMockElement(null);
  const session = new TargetInputSession(() => mock);

  session.insertText("X"); // should not throw
  assert.ok(true, "No error thrown when DOM ref is null");
});

// ──────────────────────────────────────────────────
// handleBackspace
// ──────────────────────────────────────────────────

QUnit.module("target-input-session - handleBackspace", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Deletes character and marks session dirty", (assert) => {
  const input = makeInput("abc");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  // Cursor starts at end (position 3)
  session.handleBackspace();
  assert.strictEqual(input.value, "ab", "Last character deleted");

  const cb = session.captureAndClearDirty();
  assert.notStrictEqual(cb, null, "Session is dirty after backspace");
});

QUnit.test("No-op at position 0 - does not mark dirty", (assert) => {
  const input = makeInput("abc");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.handleNavigationKey("Home"); // cursor → [0,0]
  session.handleBackspace(); // returns null - nothing to delete

  assert.strictEqual(input.value, "abc", "Value unchanged");

  const cb = session.captureAndClearDirty();
  assert.strictEqual(cb, null, "Not dirty - backspace was a no-op");
});

QUnit.test("No-op when target element is null", (assert) => {
  const session = new TargetInputSession(() => null);

  session.handleBackspace(); // should not throw
  assert.ok(true, "No error thrown when target is null");
});

// ──────────────────────────────────────────────────
// handleEnter
// ──────────────────────────────────────────────────

QUnit.module("target-input-session - handleEnter", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Input: fires change event and clears dirty flag", (assert) => {
  const input = makeInput("hello");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("!"); // "hello!" - marks dirty

  session.handleEnter();

  const changes = changeEvents(mock);
  assert.strictEqual(changes.length, 1, "Change event fired on Enter");
  assert.strictEqual(changes[0].params.value, "hello!", "Change event carries current value");

  // Dirty flag cleared - captureAndClearDirty should return null
  const cb = session.captureAndClearDirty();
  assert.strictEqual(cb, null, "Dirty flag cleared by handleEnter");
});

QUnit.test("Input: fires change even when session was not dirty", (assert) => {
  const input = makeInput("hello");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  // No prior insertText - session is clean
  session.handleEnter();

  const changes = changeEvents(mock);
  assert.strictEqual(changes.length, 1, "Change fired regardless of dirty state");
  assert.strictEqual(changes[0].params.value, "hello", "Change carries current value");
});

QUnit.test("Textarea: inserts newline without marking dirty", (assert) => {
  const ta = makeTextarea("line1");
  const mock = makeMockElement(ta);
  const session = new TargetInputSession(() => mock);

  session.handleEnter();

  assert.strictEqual(ta.value, "line1\n", "Newline inserted in textarea");
  assert.strictEqual(mock.$fired.length, 0, "No events fired for textarea Enter");

  // Should NOT be dirty (bypasses insertText's dirty marking)
  const cb = session.captureAndClearDirty();
  assert.strictEqual(cb, null, "Textarea Enter does not mark session dirty");
});

QUnit.test("Textarea: successive Enter calls insert multiple newlines", (assert) => {
  const ta = makeTextarea("start");
  const mock = makeMockElement(ta);
  const session = new TargetInputSession(() => mock);

  session.handleEnter();
  session.handleEnter();

  assert.strictEqual(ta.value, "start\n\n", "Two newlines appended");
});

QUnit.test("No-op when target has no DOM ref", (assert) => {
  const mock = makeMockElement(null);
  const session = new TargetInputSession(() => mock);

  session.handleEnter(); // should not throw
  assert.strictEqual(mock.$fired.length, 0, "No events fired when no DOM ref");
});

// ──────────────────────────────────────────────────
// handleNavigationKey
// ──────────────────────────────────────────────────

QUnit.module("target-input-session - handleNavigationKey", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Moves cursor without marking dirty", (assert) => {
  const input = makeInput("abcde");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.handleNavigationKey("Home");

  const cb = session.captureAndClearDirty();
  assert.strictEqual(cb, null, "Navigation does not mark session dirty");

  // Verify cursor moved by inserting at the new position
  session.insertText(">");
  assert.strictEqual(input.value, ">abcde", "Cursor was at start after Home");
});

QUnit.test("Unsupported key is silently ignored", (assert) => {
  const input = makeInput("test");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.handleNavigationKey("Tab"); // returns null from opsHandleNavigation

  // Cursor stays at initial position (end of value)
  session.insertText("x");
  assert.strictEqual(input.value, "testx", "Cursor unchanged after unsupported key");
});

QUnit.test("No-op when target element is null", (assert) => {
  const session = new TargetInputSession(() => null);

  session.handleNavigationKey("Home"); // should not throw
  assert.ok(true, "No error thrown when target is null");
});

// ──────────────────────────────────────────────────
// fireChangeIfDirty
// ──────────────────────────────────────────────────

QUnit.module("target-input-session - fireChangeIfDirty", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Fires change event for dirty HTMLInputElement", (assert) => {
  const input = makeInput("hello");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("!");

  session.fireChangeIfDirty();

  const changes = changeEvents(mock);
  assert.strictEqual(changes.length, 1, "Change event fired");
  assert.strictEqual(changes[0].params.value, "hello!", "Correct value in event");
});

QUnit.test("Does not fire when session is not dirty", (assert) => {
  const input = makeInput("hello");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.fireChangeIfDirty();
  assert.strictEqual(changeEvents(mock).length, 0, "No event when not dirty");
});

QUnit.test("Skips HTMLTextAreaElement even when dirty", (assert) => {
  const ta = makeTextarea("text");
  const mock = makeMockElement(ta);
  const session = new TargetInputSession(() => mock);

  session.insertText("!"); // marks dirty

  session.fireChangeIfDirty();
  assert.strictEqual(changeEvents(mock).length, 0, "No change event for textarea");
});

QUnit.test("Clears dirty flag after firing - second call is a no-op", (assert) => {
  const input = makeInput("test");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("x");

  session.fireChangeIfDirty();
  assert.strictEqual(changeEvents(mock).length, 1, "First call fires");

  session.fireChangeIfDirty();
  assert.strictEqual(changeEvents(mock).length, 1, "Second call does not fire - dirty was cleared");
});

QUnit.test("No-op when target element becomes null after dirty", (assert) => {
  const input = makeInput("test");
  const mock = makeMockElement(input);
  let element: TargetElement | null = mock;
  const session = new TargetInputSession(() => element);
  session.insertText("x"); // marks dirty
  element = null; // target removed

  session.fireChangeIfDirty(); // should not throw
  assert.strictEqual(changeEvents(mock).length, 0, "No event when element is gone");
});

// ──────────────────────────────────────────────────
// captureAndClearDirty
// ──────────────────────────────────────────────────

QUnit.module("target-input-session - captureAndClearDirty", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Returns deferred callback that fires change event", (assert) => {
  const input = makeInput("hello");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("!"); // "hello!" - dirty

  const cb = session.captureAndClearDirty();
  assert.notStrictEqual(cb, null, "Returns a callback");

  // No event fired yet - deferred
  assert.strictEqual(changeEvents(mock).length, 0, "Change not fired until callback invoked");

  cb!();

  const changes = changeEvents(mock);
  assert.strictEqual(changes.length, 1, "Change fired after callback invoked");
  assert.strictEqual(changes[0].params.value, "hello!", "Correct value in deferred event");
});

QUnit.test("Returns null when session is not dirty", (assert) => {
  const input = makeInput("hello");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  const cb = session.captureAndClearDirty();
  assert.strictEqual(cb, null, "Returns null - nothing to fire");
});

QUnit.test("Returns null for textarea target even when dirty", (assert) => {
  const ta = makeTextarea("text");
  const mock = makeMockElement(ta);
  const session = new TargetInputSession(() => mock);

  session.insertText("!"); // marks dirty

  const cb = session.captureAndClearDirty();
  assert.strictEqual(cb, null, "Returns null for textarea - change events are input-only");
});

QUnit.test("Clears dirty flag - second call returns null", (assert) => {
  const input = makeInput("test");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("!"); // dirty

  const cb1 = session.captureAndClearDirty();
  assert.notStrictEqual(cb1, null, "First call returns callback");

  const cb2 = session.captureAndClearDirty();
  assert.strictEqual(cb2, null, "Second call returns null - dirty was cleared");
});

QUnit.test("Deferred callback fires with captured value, not current DOM value", (assert) => {
  const input = makeInput("original");
  const mock = makeMockElement(input);
  const session = new TargetInputSession(() => mock);

  session.insertText("!"); // "original!" - dirty

  const cb = session.captureAndClearDirty(); // captures value "original!"

  // Value changes after capture (simulates state transitions in _setActiveTarget)
  input.value = "something-else";

  cb!();

  const changes = changeEvents(mock);
  assert.strictEqual(
    changes[0].params.value,
    "original!",
    "Deferred callback fires with value captured at time of capture",
  );
});

QUnit.test("Returns null when target element becomes null after dirty", (assert) => {
  const input = makeInput("test");
  const mock = makeMockElement(input);
  let element: TargetElement | null = mock;
  const session = new TargetInputSession(() => element);
  session.insertText("x"); // dirty
  element = null; // target removed

  const cb = session.captureAndClearDirty();
  assert.strictEqual(cb, null, "Returns null when element is gone");
});
