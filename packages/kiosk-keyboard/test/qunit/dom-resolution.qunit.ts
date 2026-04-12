import { resolveInputOrTextarea, resolveWithCustomResolver } from "ui5/kiosk/internal/dom";
import Input from "sap/m/Input";
import TextArea from "sap/m/TextArea";
import StepInput from "sap/m/StepInput";
import HTML from "sap/ui/core/HTML";
import nextUIUpdate from "sap/ui/test/utils/nextUIUpdate";

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

// ─── UI5 control helpers ────────────────────────

const controls: { destroy(): void }[] = [];

async function renderControl<T extends { placeAt(id: string): void; destroy(): void }>(ctrl: T): Promise<T> {
  controls.push(ctrl);
  ctrl.placeAt("qunit-fixture");
  await nextUIUpdate();
  return ctrl;
}

// ═══════════════════════════════════════════════════
// resolveInputOrTextarea -- direct elements
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

QUnit.test("Returns null for null", (assert) => {
  assert.strictEqual(resolveInputOrTextarea(null), null);
});

QUnit.test("Returns null for undefined", (assert) => {
  assert.strictEqual(resolveInputOrTextarea(undefined), null);
});

// ═══════════════════════════════════════════════════
// resolveInputOrTextarea -- light DOM
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

QUnit.test("Finds <input> nested deeper in light DOM", (assert) => {
  const host = document.createElement("div");
  host.innerHTML = '<div class="wrapper"><span><input type="text"></span></div>';
  fixture.appendChild(host);

  const input = host.querySelector("input")!;
  assert.strictEqual(resolveInputOrTextarea(host), input);
});

QUnit.test("Returns null when light DOM has no input or textarea", (assert) => {
  const host = document.createElement("div");
  host.innerHTML = "<span>text</span><button>click</button>";
  fixture.appendChild(host);

  assert.strictEqual(resolveInputOrTextarea(host), null);
});

// ═══════════════════════════════════════════════════
// resolveInputOrTextarea -- shadow DOM
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
// resolveInputOrTextarea -- nested shadow DOM
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - nested shadow DOM", {
  afterEach() {
    fixture.innerHTML = "";
  },
});

QUnit.test("Finds <input> at 2 levels of shadow nesting", (assert) => {
  const host = makeNestedShadowChain(2);
  const result = resolveInputOrTextarea(host);

  assert.ok(result instanceof HTMLInputElement, "found nested input");
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

// ═══════════════════════════════════════════════════
// UI5 control integration -- real controls rendered
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - UI5 sap.m.Input", {
  async afterEach() {
    controls.forEach((c) => c.destroy());
    controls.length = 0;
    await nextUIUpdate();
  },
});

QUnit.test("getFocusDomRef resolves to native <input>", async (assert) => {
  const ctrl = await renderControl(new Input({ value: "test" }));
  const focusRef = ctrl.getFocusDomRef();
  const resolved = resolveInputOrTextarea(focusRef);

  assert.ok(resolved instanceof HTMLInputElement, "resolved to HTMLInputElement");
  assert.strictEqual(resolved!.value, "test", "value matches");
});

QUnit.test("resolver finds <input> from the control root", async (assert) => {
  const ctrl = await renderControl(new Input());
  const dom = ctrl.getDomRef();
  const resolved = resolveInputOrTextarea(dom);

  assert.ok(resolved instanceof HTMLInputElement, "found input from root DOM ref");
});

// ═══════════════════════════════════════════════════
// UI5 control integration -- sap.m.TextArea
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - UI5 sap.m.TextArea", {
  async afterEach() {
    controls.forEach((c) => c.destroy());
    controls.length = 0;
    await nextUIUpdate();
  },
});

QUnit.test("getFocusDomRef resolves to native <textarea>", async (assert) => {
  const ctrl = await renderControl(new TextArea({ value: "multi" }));
  const focusRef = ctrl.getFocusDomRef();
  const resolved = resolveInputOrTextarea(focusRef);

  assert.ok(resolved instanceof HTMLTextAreaElement, "resolved to HTMLTextAreaElement");
  assert.strictEqual(resolved!.value, "multi", "value matches");
});

QUnit.test("resolver finds <textarea> from the control root", async (assert) => {
  const ctrl = await renderControl(new TextArea());
  const dom = ctrl.getDomRef();
  const resolved = resolveInputOrTextarea(dom);

  assert.ok(resolved instanceof HTMLTextAreaElement, "found textarea from root DOM ref");
});

// ═══════════════════════════════════════════════════
// UI5 control integration -- sap.m.StepInput (composite)
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - UI5 sap.m.StepInput", {
  async afterEach() {
    controls.forEach((c) => c.destroy());
    controls.length = 0;
    await nextUIUpdate();
  },
});

QUnit.test("getFocusDomRef resolves to native <input> inside composite", async (assert) => {
  const ctrl = await renderControl(new StepInput({ value: 42 }));
  const focusRef = ctrl.getFocusDomRef();
  const resolved = resolveInputOrTextarea(focusRef);

  assert.ok(resolved instanceof HTMLInputElement, "resolved to HTMLInputElement inside StepInput");
});

QUnit.test("resolver finds <input> from the StepInput root", async (assert) => {
  const ctrl = await renderControl(new StepInput({ value: 5 }));
  const dom = ctrl.getDomRef();
  const resolved = resolveInputOrTextarea(dom);

  assert.ok(resolved instanceof HTMLInputElement, "found input from StepInput root DOM");
});

// ═══════════════════════════════════════════════════
// UI5 control integration -- sap.ui.core.HTML
// ═══════════════════════════════════════════════════

QUnit.module("dom-resolution - UI5 sap.ui.core.HTML", {
  async afterEach() {
    controls.forEach((c) => c.destroy());
    controls.length = 0;
    await nextUIUpdate();
  },
});

QUnit.test("resolver finds <input> inside HTML control content", async (assert) => {
  const ctrl = await renderControl(new HTML({ content: '<div><input type="text" value="from-html"></div>' }));
  const dom = ctrl.getDomRef();
  assert.ok(dom, "HTML control rendered (getDomRef not null)");
  const resolved = resolveInputOrTextarea(dom);

  assert.ok(resolved instanceof HTMLInputElement, "found input inside HTML control");
  assert.strictEqual(resolved!.value, "from-html", "value matches");
});

QUnit.test("resolver finds <textarea> inside HTML control content", async (assert) => {
  const ctrl = await renderControl(new HTML({ content: "<div><textarea>area</textarea></div>" }));
  const dom = ctrl.getDomRef();
  assert.ok(dom, "HTML control rendered (getDomRef not null)");
  const resolved = resolveInputOrTextarea(dom);

  assert.ok(resolved instanceof HTMLTextAreaElement, "found textarea inside HTML control");
});

QUnit.test("resolver works when HTML content root has a custom ID", async (assert) => {
  const ctrl = await renderControl(
    new HTML({ content: '<div id="custom-html-id"><input type="text" value="custom-id"></div>' }),
  );
  const dom = document.getElementById("custom-html-id");
  assert.ok(dom, "custom-ID element exists in DOM");
  const resolved = resolveInputOrTextarea(dom);

  assert.ok(resolved instanceof HTMLInputElement, "found input via custom-ID element");
  assert.strictEqual(resolved!.value, "custom-id", "value matches");
});

QUnit.test("returns null when HTML control has no input or textarea", async (assert) => {
  const ctrl = await renderControl(new HTML({ content: "<div><span>no input here</span></div>" }));
  const dom = ctrl.getDomRef();
  assert.ok(dom, "HTML control rendered (getDomRef not null)");
  const resolved = resolveInputOrTextarea(dom);

  assert.strictEqual(resolved, null, "no input found in HTML control");
});
