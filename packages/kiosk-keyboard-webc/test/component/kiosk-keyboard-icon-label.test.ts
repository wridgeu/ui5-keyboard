import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";

const nextRender = renderFinished;
const DOM = KioskKeyboard.DOM;

function queryKey(el: KioskKeyboard, dataKey: string): HTMLElement {
  const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.keyByValue(dataKey));
  if (!key) throw new Error(`Key "${dataKey}" not found`);
  return key;
}

function queryKeyIcon(keyEl: HTMLElement): Element | null {
  return keyEl.querySelector(`.${DOM.classes.keyIcon}`);
}

function queryKeyLabel(keyEl: HTMLElement): HTMLElement | null {
  return keyEl.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
}

async function createKeyboard(layout: LayoutDefinition): Promise<KioskKeyboard> {
  KioskKeyboard.registerLayout("test-icon-label", layout);
  const el = await fixture<KioskKeyboard>(
    html`
      <kiosk-keyboard layout="test-icon-label"></kiosk-keyboard>
    `,
  );
  await nextRender();
  return el;
}

describe("icon + label rendering", () => {
  afterEach(() => {
    KioskKeyboard.unregisterLayout("test-icon-label");
  });

  // -- Permutation matrix --

  it("icon omitted, label omitted: renders label from value fallback", async () => {
    const el = await createKeyboard([[{ value: "a" }]]);
    const keyEl = queryKey(el, "a");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("a");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  it("icon omitted, label set: renders custom label only", async () => {
    const el = await createKeyboard([[{ value: "x", label: "Custom" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("Custom");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  it("icon omitted, label empty: renders blank key", async () => {
    const el = await createKeyboard([[{ value: "x", label: "" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)).to.be.null;
  });

  it("SAP icon set, label omitted: renders both icon and value label (dual)", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "sap-icon://home" }]]);
    const keyEl = queryKey(el, "x");
    const iconEl = queryKeyIcon(keyEl);
    expect(iconEl).to.exist;
    // SAP icon rendered via <ui5-icon mode="Decorative"> handles aria-hidden internally
    expect(iconEl!.tagName.toLowerCase()).to.equal("ui5-icon");
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("x");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("SAP icon set, label set: renders both icon and custom label (dual)", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "sap-icon://home", label: "Go" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("Go");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("SAP icon set, label empty: renders icon only", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "sap-icon://home", label: "" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.be.null;
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  it("icon empty string, label omitted: renders label only (icon suppressed)", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("x");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  it("icon empty string, label empty: renders blank key", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "", label: "" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)).to.be.null;
  });

  // -- Unicode / emoji icons --

  it("Unicode icon renders as text span with icon class", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "\u21E7", label: "Shift" }]]);
    const keyEl = queryKey(el, "x");
    const iconEl = queryKeyIcon(keyEl);
    expect(iconEl).to.exist;
    expect(iconEl!.tagName.toLowerCase()).to.not.equal("ui5-icon");
    expect(iconEl!.textContent).to.equal("\u21E7");
    expect(iconEl!.getAttribute("aria-hidden")).to.equal("true");
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("Shift");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("emoji icon renders as text span with icon class", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "\uD83D\uDD0D" }]]);
    const keyEl = queryKey(el, "x");
    const iconEl = queryKeyIcon(keyEl);
    expect(iconEl).to.exist;
    expect(iconEl!.textContent).to.equal("\uD83D\uDD0D");
  });

  // -- Built-in special keys --

  it("Shift key renders built-in icon + i18n label (dual)", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25" }]]);
    const keyEl = queryKey(el, "{shift}");
    const iconEl = queryKeyIcon(keyEl);
    const labelEl = queryKeyLabel(keyEl);
    expect(iconEl).to.exist;
    expect(labelEl).to.exist;
    expect(labelEl!.textContent).to.match(/shift/i);
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("Enter key renders built-in icon + i18n label (dual)", async () => {
    const el = await createKeyboard([[{ value: "{enter}", type: "action", width: "2.25" }]]);
    const keyEl = queryKey(el, "{enter}");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.match(/enter/i);
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("Backspace key renders built-in icon + i18n label (dual)", async () => {
    const el = await createKeyboard([[{ value: "{backspace}", type: "action", width: "2" }]]);
    const keyEl = queryKey(el, "{backspace}");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.match(/backspace/i);
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("Space bar renders visible label from i18n, no icon", async () => {
    const el = await createKeyboard([[{ value: " ", type: "space", width: "space" }]]);
    const keyEl = queryKey(el, " ");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.match(/space/i);
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  // -- Special key label suppression --

  it("Shift with label='' renders icon only (opt-out)", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", label: "" }]]);
    const keyEl = queryKey(el, "{shift}");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.be.null;
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  // -- Accessibility --

  it("icon-only key retains aria-label", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", label: "" }]]);
    const keyEl = queryKey(el, "{shift}");
    expect(keyEl.getAttribute("aria-label")).to.be.a("string").and.not.be.empty;
  });

  it("dual icon+label key has no redundant aria-label", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25" }]]);
    const keyEl = queryKey(el, "{shift}");
    // When visible text is present, aria-label should be removed
    // to satisfy WCAG 2.5.3 (Label in Name)
    expect(keyEl.getAttribute("aria-label")).to.be.null;
  });
});
