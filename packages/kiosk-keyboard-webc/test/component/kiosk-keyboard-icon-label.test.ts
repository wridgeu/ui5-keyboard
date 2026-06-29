import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { KeyDefinition, LayoutDefinition } from "../../src/types.js";
import { requireKey as queryKey } from "../helpers/fixtures.js";
import { captureConsole } from "../helpers/console.js";

const nextRender = renderFinished;
const DOM = KioskKeyboard.DOM;

function queryKeyIcon(keyEl: HTMLElement): Element | null {
  return keyEl.querySelector(`.${DOM.classes.keyIcon}`);
}

function queryKeyLabel(keyEl: HTMLElement): HTMLElement | null {
  return keyEl.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
}

async function createKeyboard(layout: LayoutDefinition): Promise<KioskKeyboard> {
  const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="test-icon-label"></kiosk-keyboard> `);
  el.instanceLayouts = { "test-icon-label": layout };
  await nextRender();
  return el;
}

describe("icon + label rendering", () => {
  // -- Permutation matrix --

  const permutations: {
    name: string;
    key: KeyDefinition;
    expectIcon: false | "ui5-icon" | "span";
    expectLabelText: string | null;
    expectDual: boolean;
  }[] = [
    {
      name: "icon omitted, label omitted: renders label from value fallback",
      key: { value: "a" },
      expectIcon: false,
      expectLabelText: "a",
      expectDual: false,
    },
    {
      name: "icon omitted, label set: renders custom label only",
      key: { value: "x", label: "Custom" },
      expectIcon: false,
      expectLabelText: "Custom",
      expectDual: false,
    },
    {
      name: "icon omitted, label empty: renders blank key",
      key: { value: "x", label: "" },
      expectIcon: false,
      expectLabelText: null,
      expectDual: false,
    },
    {
      name: "SAP icon set, label omitted: renders both icon and value label (dual)",
      key: { value: "x", icon: "sap-icon://home" },
      expectIcon: "ui5-icon",
      expectLabelText: "x",
      expectDual: true,
    },
    {
      name: "SAP icon set, label set: renders both icon and custom label (dual)",
      key: { value: "x", icon: "sap-icon://home", label: "Go" },
      expectIcon: "ui5-icon",
      expectLabelText: "Go",
      expectDual: true,
    },
    {
      name: "SAP icon set, label empty: renders icon only",
      key: { value: "x", icon: "sap-icon://home", label: "" },
      expectIcon: "ui5-icon",
      expectLabelText: null,
      expectDual: false,
    },
    {
      name: "icon empty string, label omitted: renders label only (icon suppressed)",
      key: { value: "x", icon: "" },
      expectIcon: false,
      expectLabelText: "x",
      expectDual: false,
    },
    {
      name: "icon empty string, label empty: renders blank key",
      key: { value: "x", icon: "", label: "" },
      expectIcon: false,
      expectLabelText: null,
      expectDual: false,
    },
  ];

  for (const { name, key, expectIcon, expectLabelText, expectDual } of permutations) {
    it(name, async () => {
      const el = await createKeyboard([[key]]);
      const keyEl = queryKey(el, key.value);
      const iconEl = queryKeyIcon(keyEl);

      if (expectIcon === false) {
        expect(iconEl).to.be.null;
      } else {
        expect(iconEl).to.exist;
        if (expectIcon === "ui5-icon") {
          // SAP icon rendered via <ui5-icon mode="Decorative"> handles aria-hidden internally
          expect(iconEl!.tagName.toLowerCase()).to.equal("ui5-icon");
        } else {
          expect(iconEl!.tagName.toLowerCase()).to.not.equal("ui5-icon");
        }
      }

      if (expectLabelText === null) {
        expect(queryKeyLabel(keyEl)).to.be.null;
      } else {
        expect(queryKeyLabel(keyEl)).to.exist;
        expect(queryKeyLabel(keyEl)!.textContent).to.equal(expectLabelText);
      }

      expect(keyEl.classList.contains(DOM.classes.keyDual)).to.equal(expectDual);
    });
  }

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

  it("warns once per icon-only key with no accessible name, not on every re-render", async () => {
    // Unique value so the module-level warn-once cache for this key starts
    // empty regardless of other tests in this file.
    const noNameValue = "webc-warn-once-probe";
    const messages = await captureConsole("warn", async () => {
      const el = await createKeyboard([
        [
          { value: "{shift}", type: "modifier", width: "2.25" },
          { value: noNameValue, icon: "sap-icon://home", label: "" },
        ],
      ]);
      // Toggle shift to force a full re-render of the keyboard, which
      // recomputes the icon-only key's aria-label a second time.
      queryKey(el, "{shift}").click();
      await nextRender();
    });
    const probeWarnings = messages.filter((m) => m.includes(noNameValue));
    expect(probeWarnings.length).to.equal(1);
  });

  it("dual icon+label key has no redundant aria-label", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25" }]]);
    const keyEl = queryKey(el, "{shift}");
    // When visible text is present, aria-label should be removed
    // to satisfy WCAG 2.5.3 (Label in Name)
    expect(keyEl.getAttribute("aria-label")).to.be.null;
  });

  // -- CapsLock property overrides --

  it("capsLockLabel overrides visible label during caps lock", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", capsLockLabel: "CL" }]]);
    const keyEl = queryKey(el, "{shift}");
    // Activate caps lock (double-tap)
    keyEl.click();
    await nextRender();
    keyEl.click();
    await nextRender();
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("CL");
    expect(keyEl.getAttribute("aria-label")).to.be.null;
  });

  it("capsLockIcon overrides icon during caps lock", async () => {
    const el = await createKeyboard([
      [{ value: "{shift}", type: "modifier", width: "2.25", capsLockIcon: "\u{1F512}" }],
    ]);
    const keyEl = queryKey(el, "{shift}");
    // Activate caps lock
    keyEl.click();
    await nextRender();
    keyEl.click();
    await nextRender();
    const iconEl = queryKeyIcon(keyEl);
    expect(iconEl).to.exist;
    expect(iconEl!.textContent).to.equal("\u{1F512}");
  });

  it("capsLockIcon: '' suppresses icon during caps lock", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", capsLockIcon: "" }]]);
    const keyEl = queryKey(el, "{shift}");
    // Activate caps lock
    keyEl.click();
    await nextRender();
    keyEl.click();
    await nextRender();
    expect(queryKeyIcon(keyEl)).to.be.null;
  });

  it("capsLockLabel: '' suppresses label, aria-label says Caps Lock", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", capsLockLabel: "" }]]);
    const keyEl = queryKey(el, "{shift}");
    // Activate caps lock
    keyEl.click();
    await nextRender();
    keyEl.click();
    await nextRender();
    expect(queryKeyLabel(keyEl)).to.be.null;
    expect(keyEl.getAttribute("aria-label")).to.match(/caps lock/i);
  });

  // -- Title tooltip for truncated labels --

  const titleCases: {
    name: string;
    keyDef: KeyDefinition;
    expectedTitle: string | null | RegExp;
  }[] = [
    {
      name: "multi-character label gets title attribute",
      keyDef: { value: "x", label: "Custom" },
      expectedTitle: "Custom",
    },
    {
      name: "single-glyph label does not get title attribute",
      keyDef: { value: "a" },
      expectedTitle: null,
    },
    {
      name: "empty label does not get title attribute",
      keyDef: { value: "x", label: "" },
      expectedTitle: null,
    },
    {
      name: "special key with i18n label gets title (e.g. Enter)",
      keyDef: { value: "{enter}", type: "action", width: "2.25" },
      expectedTitle: /enter/i,
    },
    {
      name: "CJK multi-character label gets title",
      keyDef: { value: "{layout:alpha}", label: "\u30ED\u30FC\u30DE\u5B57" },
      expectedTitle: "\u30ED\u30FC\u30DE\u5B57",
    },
    {
      name: "CJK single glyph does not get title",
      keyDef: { value: "x", label: "\u3042" },
      expectedTitle: null,
    },
  ];

  for (const { name, keyDef, expectedTitle } of titleCases) {
    it(name, async () => {
      const el = await createKeyboard([[keyDef]]);
      const keyEl = queryKey(el, keyDef.value);
      const title = keyEl.getAttribute("title");
      if (expectedTitle === null) {
        expect(title).to.be.null;
      } else if (expectedTitle instanceof RegExp) {
        expect(title).to.match(expectedTitle);
      } else {
        expect(title).to.equal(expectedTitle);
      }
    });
  }

  it("icon: '' + capsLockIcon shows icon only during caps lock", async () => {
    const el = await createKeyboard([
      [{ value: "{shift}", type: "modifier", width: "2.25", icon: "", capsLockIcon: "\u{1F512}" }],
    ]);
    const keyEl = queryKey(el, "{shift}");
    // Normal state: no icon (icon: "" suppresses)
    expect(queryKeyIcon(keyEl)).to.be.null;
    // Activate caps lock
    keyEl.click();
    await nextRender();
    keyEl.click();
    await nextRender();
    // CapsLock state: capsLockIcon renders independently
    const iconEl = queryKeyIcon(keyEl);
    expect(iconEl).to.exist;
    expect(iconEl!.textContent).to.equal("\u{1F512}");
  });
});
