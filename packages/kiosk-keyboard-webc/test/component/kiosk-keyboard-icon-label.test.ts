import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import navRow from "../../src/layouts/nav-row.js";
import qwerty from "../../src/layouts/qwerty.js";
import type { KeyDefinition, LayoutDefinition } from "../../src/types.js";
import { customLayout, resetAnnouncements, requireKey as queryKey } from "../helpers/fixtures.js";
import { captureConsole } from "../helpers/console.js";

beforeEach(resetAnnouncements);

const nextRender = renderFinished;
const DOM = KioskKeyboard.DOM;

function queryKeyIcon(keyEl: HTMLElement): Element | null {
  return keyEl.querySelector(`.${DOM.classes.keyIcon}`);
}

function queryKeyLabel(keyEl: HTMLElement): HTMLElement | null {
  return keyEl.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
}

async function createKeyboard(layout: LayoutDefinition): Promise<KioskKeyboard> {
  const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
  el.setAttribute("layout", "test-icon-label");
  el.appendChild(customLayout({ name: "test-icon-label", rows: layout }));
  await fixture(el);
  await nextRender();
  return el;
}

async function createBuiltInKeyboard(layout: string): Promise<KioskKeyboard> {
  const el = await fixture<KioskKeyboard>(html` <kiosk-keyboard layout="${layout}"></kiosk-keyboard> `);
  await nextRender();
  return el;
}

describe("icon + label rendering", () => {
  // Permutation matrix

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

  // Unicode / emoji icons

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

  // Built-in special keys

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

  // Special key label suppression

  it("Shift with label='' renders icon only (opt-out)", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", label: "" }]]);
    const keyEl = queryKey(el, "{shift}");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.be.null;
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  // Accessibility

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

  // CapsLock property overrides

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

  // Title tooltip for truncated labels

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
      name: "single-glyph label carries an empty title",
      keyDef: { value: "a" },
      expectedTitle: "",
    },
    {
      name: "empty label carries an empty title",
      keyDef: { value: "x", label: "" },
      expectedTitle: "",
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
      name: "CJK single glyph carries an empty title",
      keyDef: { value: "x", label: "\u3042" },
      expectedTitle: "",
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

  it("multi-character labels shrink responsively whatever the key type", async () => {
    const el = await createKeyboard([
      [
        { value: "{layout:numeric}", label: "123", type: "modifier" },
        { value: "{enter}", label: "Enter", type: "action" },
        { value: "x", label: "Custom" },
        { value: "y", label: "あ" },
      ],
    ]);

    for (const value of ["{layout:numeric}", "{enter}", "x"]) {
      const label = queryKeyLabel(queryKey(el, value))!;
      expect(label.classList.contains(DOM.classes.keyLabelMulti), `${value} word label shrinks`).to.be.true;
    }

    const glyph = queryKeyLabel(queryKey(el, "y"))!;
    expect(glyph.classList.contains(DOM.classes.keyLabelMulti), "single-glyph label keeps its own sizing").to.be.false;
  });

  it("bumps dual icons above their own key font once the label goes sr-only", async () => {
    // NOTE: fixture({ parentNode }) appends the wrapper to body and registers it
    // for cleanup, so do NOT also call document.body.appendChild() or wrapper.remove().
    const wrapper = document.createElement("div");
    wrapper.style.width = "320px";

    const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
    el.setAttribute("layout", "test-icon-bump");
    el.appendChild(customLayout({ name: "test-icon-bump", rows: [navRow, ...qwerty] }));
    await fixture(el, { parentNode: wrapper });
    await nextRender();

    const shift = queryKey(el, "{shift}");
    const shiftLabel = queryKeyLabel(shift)!;
    expect(getComputedStyle(shiftLabel).clipPath, "keys are narrow enough that dual labels are sr-only").to.equal(
      "inset(50%)",
    );

    // Every icon is anchored against its own key's font size: modifier keys carry
    // a reduced font, so an icon still sitting at 1em of it has not been bumped.
    const fontSizeOf = (elm: Element) => parseFloat(getComputedStyle(elm).fontSize);
    const shiftIconFs = fontSizeOf(queryKeyIcon(shift)!);
    const shiftKeyFs = fontSizeOf(shift);
    expect(
      shiftIconFs,
      `Shift icon is bumped above its own key font (${shiftIconFs.toFixed(1)} vs ${shiftKeyFs.toFixed(1)}px)`,
    ).to.be.greaterThan(shiftKeyFs + 0.5);

    const navKeys = [...el.shadowRoot!.querySelectorAll<HTMLElement>(DOM.selectors.key)].filter((k) =>
      k.hasAttribute("data-fkey"),
    );
    expect(navKeys.length, "eight nav fkey keys rendered").to.equal(8);

    // The nav arm of the bump rule is separate from the plain dual arm: collapsing
    // the two into one loses these keys to the later [data-fkey] icon rule.
    for (const navKey of navKeys) {
      const iconFs = fontSizeOf(queryKeyIcon(navKey)!);
      const keyFs = fontSizeOf(navKey);
      const name = navKey.getAttribute("data-key");
      expect(
        iconFs,
        `"${name}" icon is bumped above its own key font (${iconFs.toFixed(1)} vs ${keyFs.toFixed(1)}px)`,
      ).to.be.greaterThan(keyFs + 0.5);
      expect(iconFs, `"${name}" icon matches the Shift icon`).to.be.closeTo(shiftIconFs, 0.5);
    }
  });

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

  // A `ui5-icon` carries its own `:host` color and a fixed 1rem box, which win
  // unless the key's stylesheet overrides them from the outer tree. Left alone,
  // an Emphasized key paints a dark theme icon on its blue fill.
  it("paints a SAP icon in the key's own color on every key type", async () => {
    const el = await createKeyboard([
      [
        { value: "{enter}", type: "action", icon: "sap-icon://accept" },
        { value: "{shift}", type: "modifier", icon: "sap-icon://arrow-top" },
        { value: "x", icon: "sap-icon://home" },
      ],
    ]);
    for (const value of ["{enter}", "{shift}", "x"]) {
      const keyEl = queryKey(el, value);
      const iconEl = queryKeyIcon(keyEl)!;
      expect(iconEl.tagName.toLowerCase(), `"${value}" renders a ui5-icon`).to.equal("ui5-icon");
      expect(getComputedStyle(iconEl).color, `"${value}" icon takes the key's color`).to.equal(
        getComputedStyle(keyEl).color,
      );
    }
  });

  it("sizes a SAP icon from the key font size rather than pinning it to 1rem", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "sap-icon://home" }]]);
    // `ui5-icon` sizes by width/height, not font-size, so its own `:host` 1rem box
    // would stay put while the key scales. Its box tracking its font size is what
    // says the outer rule is winning.
    for (const size of ["12px", "20px"]) {
      el.style.setProperty("--kiosk-keyboard-key-font-size", size);
      await nextRender();
      const style = getComputedStyle(queryKeyIcon(queryKey(el, "x")) as HTMLElement);
      expect(style.fontSize, `the icon inherits the ${size} key font size`).to.equal(size);
      expect(style.width, `the icon box follows the ${size} font size`).to.equal(size);
      expect(style.height, `the icon box follows the ${size} font size`).to.equal(size);
    }
  });

  it("leaves a unicode-glyph icon unboxed so wide glyphs are not cropped", async () => {
    // A key is a flex container, so its glyph span is a blockified flex item and
    // a 1em box would apply to it too - cropping any glyph whose advance exceeds
    // 1em (a dual key adds `overflow: hidden`) and pulling it off the key centre.
    // The `ui5-icon` box must therefore not reach the span.
    const el = await createKeyboard([[{ value: "{backspace}", icon: "⌫", label: "Back" }]]);
    const iconEl = queryKeyIcon(queryKey(el, "{backspace}")) as HTMLElement;

    expect(iconEl.tagName.toLowerCase(), "a unicode icon renders as a span").to.equal("span");
    const style = getComputedStyle(iconEl);
    expect(style.width, "the glyph span is not pinned to a 1em box").to.not.equal(style.fontSize);
    expect(
      iconEl.scrollWidth,
      `the glyph is not cropped horizontally (${iconEl.scrollWidth} > ${iconEl.clientWidth})`,
    ).to.be.at.most(iconEl.clientWidth + 1);
    expect(
      iconEl.scrollHeight,
      `the glyph is not cropped vertically (${iconEl.scrollHeight} > ${iconEl.clientHeight})`,
    ).to.be.at.most(iconEl.clientHeight + 1);
  });

  // A keycap is a specimen, so the font's `isol` lookup must not restyle it into a
  // joining form. `font-feature-settings` inherits, so the declaration has to sit on the
  // Arabic labels alone: on the label class, the keyboard root or `:host` it would turn
  // the feature off for every keycap in the layout. The arabic number row renders
  // Western digits, so the unscoped label that guards against that always exists.
  it("turns the isol feature off on Arabic keycaps and nowhere else", async () => {
    const el = await createBuiltInKeyboard("arabic");
    const arabicLabel = el.shadowRoot!.querySelector<HTMLElement>(
      `.${DOM.classes.keyLabel}[${DOM.attributes.glyphScript}="arabic"]`,
    )!;
    const plainLabel = el.shadowRoot!.querySelector<HTMLElement>(
      `.${DOM.classes.keyLabel}:not([${DOM.attributes.glyphScript}])`,
    )!;

    expect(getComputedStyle(arabicLabel).fontFeatureSettings, "an arabic keycap turns isol off").to.equal('"isol" 0');
    expect(
      getComputedStyle(plainLabel).fontFeatureSettings,
      "a label with no glyph script keeps the font default",
    ).to.equal("normal");
  });

  // Language of parts (WCAG 2.2 SC 3.1.2)

  const layoutLangCases: { layout: string; lang: string; charKey: string }[] = [
    { layout: "arabic", lang: "ar", charKey: "ا" },
    { layout: "ja-kana", lang: "ja", charKey: "わ" },
    { layout: "ko-hangul", lang: "ko", charKey: "ㅁ" },
  ];

  for (const { layout, lang, charKey } of layoutLangCases) {
    it(`${layout} keycaps are labelled lang="${lang}", its command keys are not`, async () => {
      const el = await createBuiltInKeyboard(layout);
      expect(queryKeyLabel(queryKey(el, charKey))!.getAttribute("lang")).to.equal(lang);

      // The command keys read in the UI language whatever script the keycaps are
      // in, so their labels must not be pulled into the layout's language.
      for (const value of ["{shift}", "{enter}", " "]) {
        const labelEl = queryKeyLabel(queryKey(el, value))!;
        expect(labelEl.hasAttribute("lang"), `"${value}" keeps the UI language`).to.be.false;
      }
    });
  }

  for (const layout of ["qwerty", "ja-romaji"]) {
    it(`${layout} writes its keycaps in the UI language, so no label declares one`, async () => {
      const el = await createBuiltInKeyboard(layout);
      const labels = [...el.shadowRoot!.querySelectorAll<HTMLElement>(`.${DOM.classes.keyLabel}`)];
      expect(labels.length, "labels rendered").to.be.above(0);
      for (const labelEl of labels) {
        expect(labelEl.hasAttribute("lang"), `"${labelEl.textContent}" carries no language`).to.be.false;
      }
    });
  }

  it("confines the layout language to the keycap labels", async () => {
    const el = await createBuiltInKeyboard("arabic");
    const keyEl = queryKey(el, "ا");
    expect(queryKeyLabel(keyEl)!.getAttribute("lang")).to.equal("ar");

    // Only the keycap text is in the layout's language: a key carries an English
    // aria-label and the group carries an English name.
    expect(keyEl.hasAttribute("lang"), "the key element stays in the UI language").to.be.false;
    const root = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.root)!;
    expect(root.hasAttribute("lang"), "the keyboard group stays in the UI language").to.be.false;
  });

  it("declares the language on a modifier-typed key whose keycap is kana", async () => {
    const el = await createBuiltInKeyboard("ja-kana");

    // The dakuten / handakuten keys are typed `modifier` for their visual weight,
    // but they carry no i18n label: the keycap is the raw kana mark.
    expect(queryKeyLabel(queryKey(el, "゛"))!.getAttribute("lang"), "dakuten").to.equal("ja");
    expect(queryKeyLabel(queryKey(el, "゜"))!.getAttribute("lang"), "handakuten").to.equal("ja");

    // A layout-switch key is a control affordance, so its label stays in the UI language.
    const switchLabel = queryKeyLabel(queryKey(el, "{layout:ja-romaji}"))!;
    expect(switchLabel.hasAttribute("lang"), "layout-switch key declares none").to.be.false;
  });

  it("drops the language from reused labels when switching to a UI-language layout", async () => {
    // The key element id is stable across layouts, so the label span is reused
    // rather than remounted: an attribute left behind here would read as
    // lang="" (unknown language), which stops inheritance from <html lang>.
    const el = await createBuiltInKeyboard("arabic");
    expect(queryKeyLabel(queryKey(el, "ا"))!.getAttribute("lang"), "arabic keycap").to.equal("ar");

    el.layout = "qwerty";
    await nextRender();

    const labels = [...el.shadowRoot!.querySelectorAll<HTMLElement>(`.${DOM.classes.keyLabel}`)];
    expect(labels.length, "labels rendered after the switch").to.be.above(0);
    for (const labelEl of labels) {
      expect(labelEl.hasAttribute("lang"), `"${labelEl.textContent}" carries no language`).to.be.false;
    }
  });

  it("gives a reused key the same tooltip state as a freshly mounted one", async () => {
    // Key ids are positional, so a layout switch patches the key div rather than
    // remounting it. The invariant is that a key reached by switching is
    // indistinguishable from the same key mounted directly; writing the attribute
    // unconditionally is what holds it, since this renderer cannot express removal.
    const fresh = document.createElement("kiosk-keyboard") as KioskKeyboard;
    fresh.setAttribute("layout", "plain");
    fresh.appendChild(customLayout({ name: "plain", rows: [[{ value: "y" }]] }));
    await fixture(fresh);
    await nextRender();
    const freshTitle = queryKey(fresh, "y").getAttribute("title");

    const switched = document.createElement("kiosk-keyboard") as KioskKeyboard;
    switched.setAttribute("layout", "tooltipped");
    switched.append(
      customLayout({ name: "tooltipped", rows: [[{ value: "x", label: "Custom" }]] }),
      customLayout({ name: "plain", rows: [[{ value: "y" }]] }),
    );
    await fixture(switched);
    await nextRender();
    expect(queryKey(switched, "x").getAttribute("title"), "the first layout sets a tooltip").to.equal("Custom");

    switched.layout = "plain";
    await nextRender();

    expect(
      queryKey(switched, "y").getAttribute("title"),
      "a switched-to key matches the same key mounted directly",
    ).to.equal(freshTitle);
  });
});
