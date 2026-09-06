import { resolveInputOrTextarea, resolveWithCustomResolver, type TargetResolverFn } from "ui5/kiosk/internal/dom";

const fixture = document.getElementById("qunit-fixture")!;

// ─── Pure DOM helpers ───────────────────────────

function makeShadowHost(innerHtml: string): HTMLElement {
  const host = document.createElement("div");
  host.attachShadow({ mode: "open" }).innerHTML = innerHtml;
  fixture.appendChild(host);
  return host;
}

function makeNestedShadowChain(depth: number): HTMLElement {
  const outerHost = document.createElement("div");
  fixture.appendChild(outerHost);

  let current = outerHost;
  for (let i = 0; i < depth; i++) {
    const shadow = current.attachShadow({ mode: "open" });
    if (i === depth - 1) {
      shadow.innerHTML = '<input type="text">';
    } else {
      const next = document.createElement("div");
      shadow.appendChild(next);
      current = next;
    }
  }
  return outerHost;
}

// ═══════════════════════════════════════════════════
// resolveInputOrTextarea: direct elements
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - direct elements", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Returns a direct <input> element", (assert) => {
  const input = document.createElement("input");
  fixture.appendChild(input);
  assert.strictEqual(resolveInputOrTextarea(input), input);
});

QUnit.test("Returns a direct <textarea> element", (assert) => {
  const ta = document.createElement("textarea");
  fixture.appendChild(ta);
  assert.strictEqual(resolveInputOrTextarea(ta), ta);
});

QUnit.test("Returns null for a plain <div>", (assert) => {
  const div = document.createElement("div");
  fixture.appendChild(div);
  assert.strictEqual(resolveInputOrTextarea(div), null);
});

QUnit.test("Returns null for null and undefined", (assert) => {
  assert.strictEqual(resolveInputOrTextarea(null), null);
  assert.strictEqual(resolveInputOrTextarea(undefined), null);
});

// ═══════════════════════════════════════════════════
// resolveInputOrTextarea: light DOM
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - light DOM children", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Finds <input> as direct child of host", (assert) => {
  const host = document.createElement("div");
  const input = document.createElement("input");
  host.appendChild(input);
  fixture.appendChild(host);

  assert.strictEqual(resolveInputOrTextarea(host), input);
});

QUnit.test("Finds <textarea> as direct child of host", (assert) => {
  const host = document.createElement("div");
  const ta = document.createElement("textarea");
  host.appendChild(ta);
  fixture.appendChild(host);

  assert.strictEqual(resolveInputOrTextarea(host), ta);
});

QUnit.test("Returns null when light DOM has no input or textarea", (assert) => {
  const host = document.createElement("div");
  host.innerHTML = "<span>text</span><button>click</button>";
  fixture.appendChild(host);

  assert.strictEqual(resolveInputOrTextarea(host), null);
});

// ═══════════════════════════════════════════════════
// resolveInputOrTextarea: shadow DOM
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - shadow DOM", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Finds <input> in open shadow root", (assert) => {
  const host = makeShadowHost('<input type="text">');
  const input = host.shadowRoot!.querySelector("input")!;

  assert.strictEqual(resolveInputOrTextarea(host), input);
});

QUnit.test("Finds <textarea> in open shadow root", (assert) => {
  const host = makeShadowHost("<textarea></textarea>");
  const ta = host.shadowRoot!.querySelector("textarea")!;

  assert.strictEqual(resolveInputOrTextarea(host), ta);
});

QUnit.test("Returns null when shadow root has no input or textarea", (assert) => {
  const host = makeShadowHost("<span>shadow content</span>");

  assert.strictEqual(resolveInputOrTextarea(host), null);
});

QUnit.test("Prefers light DOM input over shadow DOM input", (assert) => {
  const host = document.createElement("div");
  const lightInput = document.createElement("input");
  lightInput.className = "light";
  host.appendChild(lightInput);

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = '<input class="shadow">';
  fixture.appendChild(host);

  assert.strictEqual(resolveInputOrTextarea(host), lightInput, "light DOM checked first");
});

// ═══════════════════════════════════════════════════
// resolveInputOrTextarea: nested shadow DOM
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - nested shadow DOM", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Finds <input> at 3 levels of shadow nesting (default maxDepth)", (assert) => {
  const host = makeNestedShadowChain(3);
  const result = resolveInputOrTextarea(host);

  assert.ok(result instanceof HTMLInputElement, "found 3-level nested input");
});

QUnit.test("Returns null at 4 levels (exceeds default maxDepth=3)", (assert) => {
  const host = makeNestedShadowChain(4);
  const result = resolveInputOrTextarea(host);

  assert.strictEqual(result, null, "4 levels exceeds maxDepth=3");
});

QUnit.test("Respects explicit maxDepth=0 (no recursion into shadow)", (assert) => {
  const host = makeShadowHost('<input type="text">');
  const result = resolveInputOrTextarea(host, 0);

  assert.strictEqual(result, null, "maxDepth=0 prevents shadow traversal");
});

QUnit.test("Respects explicit maxDepth=1 (one level only)", (assert) => {
  const host1 = makeNestedShadowChain(1);
  const host2 = makeNestedShadowChain(2);

  assert.ok(resolveInputOrTextarea(host1, 1) instanceof HTMLInputElement, "1-level chain with maxDepth=1 works");
  assert.strictEqual(resolveInputOrTextarea(host2, 1), null, "2-level chain with maxDepth=1 fails");
});

// ═══════════════════════════════════════════════════
// resolveWithCustomResolver
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - resolveWithCustomResolver", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Uses custom resolver result when it returns a valid input", (assert) => {
  const host = document.createElement("div");
  const customInput = document.createElement("input");
  host.appendChild(customInput);
  fixture.appendChild(host);

  const resolver: TargetResolverFn = () => customInput;
  assert.strictEqual(resolveWithCustomResolver(host, resolver), customInput);
});

QUnit.test("Falls back to default when custom resolver returns null", (assert) => {
  const host = document.createElement("div");
  const input = document.createElement("input");
  host.appendChild(input);
  fixture.appendChild(host);

  const resolver: TargetResolverFn = () => null;
  assert.strictEqual(resolveWithCustomResolver(host, resolver), input, "fell back to default");
});

QUnit.test("Falls back to default when custom resolver throws", (assert) => {
  const host = document.createElement("div");
  const input = document.createElement("input");
  host.appendChild(input);
  fixture.appendChild(host);

  const resolver: TargetResolverFn = () => {
    throw new Error("resolver error");
  };
  assert.strictEqual(resolveWithCustomResolver(host, resolver), input, "fell back after throw");
});

QUnit.test("Falls back to default when resolver is null", (assert) => {
  const host = document.createElement("div");
  const input = document.createElement("input");
  host.appendChild(input);
  fixture.appendChild(host);

  assert.strictEqual(resolveWithCustomResolver(host, null), input, "null resolver uses default");
});

QUnit.test("Passes the host element to the custom resolver", (assert) => {
  const host = document.createElement("div");
  fixture.appendChild(host);

  let receivedEl: HTMLElement | null = null;
  const resolver: TargetResolverFn = (el) => {
    receivedEl = el;
    return null;
  };
  resolveWithCustomResolver(host, resolver);

  assert.strictEqual(receivedEl, host, "resolver received the host element");
});
