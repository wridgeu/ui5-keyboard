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

(
  [
    ["text input", { type: "text" }, true],
    ["password input", { type: "password" }, true],
    ["email input", { type: "email" }, true],
    ["number input", { type: "number" }, true],
    ["search input", { type: "search" }, true],
    ["button input", { type: "button" }, false],
    ["submit input", { type: "submit" }, false],
    ["reset input", { type: "reset" }, false],
    ["checkbox input", { type: "checkbox" }, false],
    ["radio input", { type: "radio" }, false],
  ] as const satisfies ReadonlyArray<readonly [string, Record<string, string>, boolean]>
).forEach(([label, attrs, expected]) => {
  QUnit.test(`Returns ${expected ? "true" : "false"} for ${label}`, (assert) => {
    const el = createElement("input", attrs);
    assert.strictEqual(isInputElement(el), expected);
  });
});

QUnit.test("Returns true for input with no type (defaults to text)", (assert) => {
  const el = createElement("input");
  assert.ok(isInputElement(el));
});

QUnit.test("Returns false for readonly text input", (assert) => {
  const el = createElement("input", { type: "text", readonly: "" });
  assert.notOk(isInputElement(el), "readonly text input is not editable");
});

QUnit.test("Returns true for textarea", (assert) => {
  const el = createElement("textarea");
  assert.ok(isInputElement(el));
});

QUnit.test("Returns true for select (native type-ahead must not be pre-empted)", (assert) => {
  // <select> has built-in single-key type-ahead; suppressing letter shortcuts here
  // keeps the browser's option matching working, matching Mousetrap / hotkeys-js.
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

QUnit.test("Returns the node inside a shadow root that dispatched the event", (assert) => {
  const host = document.createElement("div");
  document.getElementById("qunit-fixture")!.appendChild(host);
  const inner = document.createElement("div");
  host.attachShadow({ mode: "open" }).appendChild(inner);

  // Outside the shadow tree event.target is retargeted to the host.
  let capturedTarget: EventTarget | null = null;
  host.addEventListener("click", (e) => {
    capturedTarget = getEventTarget(e);
  });

  inner.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
  assert.strictEqual(capturedTarget, inner, "Returns the dispatching node, not the retargeted host");
});

QUnit.test("Falls back to event.target when composedPath is unavailable", (assert) => {
  const div = document.createElement("div");
  document.getElementById("qunit-fixture")!.appendChild(div);

  // The dispatch sets event.target; the own property then shadows the prototype's
  // composedPath, reproducing a browser that predates it.
  const event = new Event("click");
  div.dispatchEvent(event);
  Object.defineProperty(event, "composedPath", { value: undefined });

  const target = getEventTarget(event);
  assert.strictEqual(target, div, "Falls back to event.target");
});
