import { isInputElement, getEventTarget } from "ui5/hotkeys/internal/dom";

QUnit.module("dom - isInputElement", {
  afterEach() {
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) {
      fixture.innerHTML = "";
    }
  },
});

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string>,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }
  document.getElementById("qunit-fixture")!.appendChild(el);
  return el;
}

QUnit.test("Returns true for text input", (assert) => {
  const el = createElement("input", { type: "text" });
  assert.ok(isInputElement(el));
});

QUnit.test("Returns true for password input", (assert) => {
  const el = createElement("input", { type: "password" });
  assert.ok(isInputElement(el));
});

QUnit.test("Returns true for email input", (assert) => {
  const el = createElement("input", { type: "email" });
  assert.ok(isInputElement(el));
});

QUnit.test("Returns true for number input", (assert) => {
  const el = createElement("input", { type: "number" });
  assert.ok(isInputElement(el));
});

QUnit.test("Returns true for search input", (assert) => {
  const el = createElement("input", { type: "search" });
  assert.ok(isInputElement(el));
});

QUnit.test("Returns true for input with no type (defaults to text)", (assert) => {
  const el = createElement("input");
  assert.ok(isInputElement(el));
});

QUnit.test("Returns false for button input", (assert) => {
  const el = createElement("input", { type: "button" });
  assert.notOk(isInputElement(el));
});

QUnit.test("Returns false for submit input", (assert) => {
  const el = createElement("input", { type: "submit" });
  assert.notOk(isInputElement(el));
});

QUnit.test("Returns false for reset input", (assert) => {
  const el = createElement("input", { type: "reset" });
  assert.notOk(isInputElement(el));
});

QUnit.test("Returns false for checkbox input", (assert) => {
  const el = createElement("input", { type: "checkbox" });
  assert.notOk(isInputElement(el));
});

QUnit.test("Returns false for radio input", (assert) => {
  const el = createElement("input", { type: "radio" });
  assert.notOk(isInputElement(el));
});

QUnit.test("Returns true for textarea", (assert) => {
  const el = createElement("textarea");
  assert.ok(isInputElement(el));
});

QUnit.test("Returns true for select", (assert) => {
  const el = createElement("select");
  assert.ok(isInputElement(el));
});

QUnit.test("Returns true for contentEditable element", (assert) => {
  const el = createElement("div", { contenteditable: "true" });
  assert.ok(isInputElement(el));
});

QUnit.test("Returns false for non-editable div", (assert) => {
  const el = createElement("div");
  assert.notOk(isInputElement(el));
});

QUnit.test("Returns false for null", (assert) => {
  assert.notOk(isInputElement(null));
});

QUnit.test("Returns false for non-HTMLElement", (assert) => {
  assert.notOk(isInputElement(document));
});

// ──────────────────────────────────────────────
// getEventTarget (C5)
// ──────────────────────────────────────────────

QUnit.module("dom - getEventTarget");

QUnit.test("Returns the element that dispatched the event", (assert) => {
  const div = document.createElement("div");
  document.getElementById("qunit-fixture")!.appendChild(div);

  let capturedTarget: EventTarget | null = null;
  div.addEventListener("click", (e) => {
    capturedTarget = getEventTarget(e);
  });

  div.dispatchEvent(new Event("click", { bubbles: true }));
  assert.strictEqual(capturedTarget, div, "Returns the dispatching element");
});

QUnit.test("Falls back to event.target when composedPath is unavailable", (assert) => {
  const div = document.createElement("div");
  document.getElementById("qunit-fixture")!.appendChild(div);

  const event = new Event("click", { bubbles: true });
  div.dispatchEvent(event);

  // Simulate missing composedPath by creating a mock event object
  const mockEvent = {
    target: div,
    composedPath: undefined,
  } as unknown as Event;

  const target = getEventTarget(mockEvent);
  assert.strictEqual(target, div, "Falls back to event.target");
});
