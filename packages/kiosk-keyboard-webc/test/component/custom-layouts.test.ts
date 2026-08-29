import { fixture, expect } from "@open-wc/testing";
import { withCapturedWarnings } from "../helpers/console.js";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import { setLanguage } from "@ui5/webcomponents-base/dist/config/Language.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type CustomLayout from "../../src/CustomLayout.js";
import type { CompositionMiddleware, LayoutDefinition } from "../../src/types.js";
import { customLayout, readDataKeys, requireKey } from "../helpers/fixtures.js";

const DOM = KioskKeyboard.DOM;
const nextRender = renderFinished;

function tapKey(el: KioskKeyboard, value: string): void {
  requireKey(el, value).click();
}

/**
 * Mounts a keyboard whose custom layouts are attached before it connects, the way
 * slotted markup arrives, so every declaration is honoured on the first paint.
 */
async function mount(attributes: Record<string, string>, ...children: CustomLayout[]): Promise<KioskKeyboard> {
  const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.append(...children);
  await fixture(el);
  await nextRender();
  return el;
}

/** Mounts a keyboard alongside an input already wired as its target. */
async function mountWithTarget(
  attributes: Record<string, string>,
  ...children: CustomLayout[]
): Promise<{ el: KioskKeyboard; input: HTMLInputElement }> {
  const container = document.createElement("div");
  const input = document.createElement("input");
  input.type = "text";
  const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  el.append(...children);
  container.append(input, el);

  await fixture(container);
  el.setTargetElement(input);
  await nextRender();
  return { el, input };
}

/**
 * Configures the framework language. `setLanguage` is typed for a language tag,
 * but `null` is the value that clears the configured one, so the next test starts
 * from the browser default again.
 */
function configureLanguage(language: string | null): Promise<void> {
  return setLanguage(language as string);
}

/** Objects that survive an `instanceof Object` screen but carry no variant entries. */
type NotAVariantTable = unknown[] | Map<string, readonly string[]> | Date | Record<string, never>;

const layoutA: LayoutDefinition = [[{ value: "ax" }, { value: "bx" }]];
const layoutB: LayoutDefinition = [[{ value: "two" }]];

/** An unrelated factory, used where a swap only needs a different identity. */
const otherFactory = (): CompositionMiddleware => ({
  handleKey: () => false,
  commit: () => null,
  reset: () => {},
});

describe("kiosk-keyboard - custom layouts", () => {
  it("renders a custom layout that is not in the built-in registry", async () => {
    const el = await mount({ layout: "warehouse-pos" }, customLayout({ name: "warehouse-pos", rows: layoutA }));

    expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
  });

  it("a custom layout shadows the built-in qwerty for one element without affecting another", async () => {
    const elOverride = await mount({ layout: "qwerty" }, customLayout({ name: "qwerty", rows: layoutA }));
    const elDefault = await mount({ layout: "qwerty" });

    expect(readDataKeys(elOverride)).to.deep.equal([["ax", "bx"]]);
    // The other element keeps the built-in qwerty: the declaration never leaked.
    // "q" is in qwerty and not in layoutA. readDataKeys returns [] when nothing
    // renders, which "not the custom rows" would satisfy just as well.
    expect(readDataKeys(elDefault).flat()).to.include("q");
  });

  it("falls through to the built-in registry when no custom layout matches the active name", async () => {
    const el = await mount({ layout: "qwerty" }, customLayout({ name: "unrelated", rows: layoutA }));

    // Active layout is qwerty (built-in); the unrelated custom layout is ignored.
    const rows = readDataKeys(el);
    expect(rows.length).to.be.greaterThan(0);
    expect(rows).to.not.deep.equal([["ax", "bx"]]);
  });

  it("sibling elements with conflicting custom layouts each see their own", async () => {
    const elA = await mount({ layout: "shared" }, customLayout({ name: "shared", rows: layoutA }));
    const elB = await mount({ layout: "shared" }, customLayout({ name: "shared", rows: layoutB }));

    expect(readDataKeys(elA)).to.deep.equal([["ax", "bx"]]);
    expect(readDataKeys(elB)).to.deep.equal([["two"]]);
  });

  it("removing a custom layout makes the next resolution fall back", async () => {
    const entry = customLayout({ name: "qwerty", rows: layoutA });
    const el = await mount({ layout: "qwerty" }, entry);
    expect(readDataKeys(el), "precondition: the custom layout renders").to.deep.equal([["ax", "bx"]]);

    entry.remove();
    await nextRender();

    // "q" is in qwerty and not in layoutA. readDataKeys returns [] when nothing
    // renders, so "no longer the custom rows" would hold with nothing painted.
    expect(readDataKeys(el).flat(), "the built-in qwerty is back").to.include("q");
  });

  it("a locale can resolve to a layout only this element declares", async () => {
    const originalLanguage = navigator.language;
    const originalLanguages = navigator.languages;
    // getLocale() reads the browser locale from navigator.languages[0] (falling
    // back to navigator.language), so override both to "de".
    Object.defineProperty(navigator, "language", {
      value: "de",
      configurable: true,
    });
    Object.defineProperty(navigator, "languages", {
      value: ["de"],
      configurable: true,
    });
    try {
      // The whole subtree is built before the host connects so onEnterDOM sees the
      // declaration when it resolves _baseLayout.
      const el = document.createElement("kiosk-keyboard") as KioskKeyboard;
      el.appendChild(customLayout({ name: "warehouse-de", rows: layoutA, locales: "de" }));
      document.body.appendChild(el);
      await nextRender();
      try {
        expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
      } finally {
        el.remove();
      }
    } finally {
      Object.defineProperty(navigator, "language", {
        value: originalLanguage,
        configurable: true,
      });
      Object.defineProperty(navigator, "languages", {
        value: originalLanguages,
        configurable: true,
      });
    }
  });

  it("custom layouts do not pollute the global registry", async () => {
    await mount({ layout: "instance-only" }, customLayout({ name: "instance-only", rows: layoutA }));

    const builtinNames = KioskKeyboard.getRegisteredLayoutNames();
    expect(builtinNames).to.not.include("instance-only");
  });

  it("mixed-case layout names resolve through lowercase lookup", async () => {
    // A mixed-case name must shadow the built-in 'qwerty' just as a lowercase one
    // would, since the lookup path normalizes to lowercase.
    const el = await mount({ layout: "qwerty" }, customLayout({ name: "Qwerty", rows: layoutA }));

    expect(readDataKeys(el)).to.deep.equal([["ax", "bx"]]);
  });

  it("a middleware swap after the first key resolves the new factory", async () => {
    const noopMw: CompositionMiddleware = {
      handleKey: () => false,
      commit: () => null,
      reset: () => {},
    };

    let firstFactoryCalls = 0;
    const firstFactory = (): CompositionMiddleware => {
      firstFactoryCalls += 1;
      return noopMw;
    };

    const entry = customLayout({ name: "qwerty", middleware: firstFactory });
    const el = await mount({ layout: "qwerty" }, entry);

    // First key click lazy-creates the middleware via the first factory.
    tapKey(el, "a");
    expect(firstFactoryCalls).to.equal(1);

    // Subsequent clicks reuse the cached middleware.
    tapKey(el, "b");
    expect(firstFactoryCalls).to.equal(1);

    let secondFactoryCalls = 0;
    const secondFactory = (): CompositionMiddleware => {
      secondFactoryCalls += 1;
      return noopMw;
    };
    entry.middleware = secondFactory;
    await nextRender();

    // Next click resolves through the new factory.
    tapKey(el, "c");
    expect(secondFactoryCalls).to.equal(1);
    expect(firstFactoryCalls).to.equal(1);
  });

  it("a middleware swap commits the in-progress composition instead of discarding it", async () => {
    const calls = { commits: 0, resets: 0 };
    const factory = (): CompositionMiddleware => ({
      handleKey: () => true,
      commit: () => {
        calls.commits += 1;
        return null;
      },
      reset: () => {
        calls.resets += 1;
      },
    });

    const entry = customLayout({ name: "qwerty", middleware: factory });
    const el = await mount({ layout: "qwerty" }, entry);

    tapKey(el, "a");

    entry.middleware = otherFactory;
    await nextRender();

    // The swap is committed at the next composition-affecting key rather than at
    // assignment: `commit()` finalises a preedit already written into the target, so
    // deferring keeps it visible and never drops it.
    tapKey(el, "b");

    expect(calls.commits, "the half-typed syllable reaches the target").to.equal(1);
    expect(calls.resets, "the composition is flushed, not dropped").to.equal(0);
  });

  it("a middleware swap that leaves the resolved layout's factory alone keeps the composition", async () => {
    const calls = { created: 0, commits: 0, resets: 0 };
    const factory = (): CompositionMiddleware => {
      calls.created += 1;
      return {
        handleKey: () => true,
        commit: () => {
          calls.commits += 1;
          return null;
        },
        reset: () => {
          calls.resets += 1;
        },
      };
    };

    const other = customLayout({ name: "ko-hangul" });
    const el = await mount({ layout: "qwerty" }, customLayout({ name: "qwerty", middleware: factory }), other);

    tapKey(el, "a");
    expect(calls.created).to.equal(1);

    // A real edit, but to a custom layout the resolved layout never reads.
    other.middleware = otherFactory;
    await nextRender();

    tapKey(el, "b");
    expect(calls.commits, "the composition is left in progress").to.equal(0);
    expect(calls.resets, "the composition is not dropped").to.equal(0);
    expect(calls.created, "the cached middleware is reused, not rebuilt").to.equal(1);
  });

  it("a layout name that stopped resolving reads the middleware of the rendered surface", async () => {
    let qwertyCalls = 0;
    let pinpadCalls = 0;
    const factory = (count: () => void): (() => CompositionMiddleware) => {
      return () => {
        count();
        return { handleKey: () => false, commit: () => null, reset: () => {} };
      };
    };

    // The custom layout declaring pinpad's rows is dropped, so the surface falls back
    // to qwerty and the middleware has to follow it, not the name still on the property.
    const rows = customLayout({ name: "pinpad", rows: layoutB });
    const el = await mount(
      { layout: "pinpad" },
      rows,
      customLayout({
        name: "qwerty",
        middleware: factory(() => (qwertyCalls += 1)),
      }),
      customLayout({
        name: "pinpad",
        middleware: factory(() => (pinpadCalls += 1)),
      }),
    );
    expect(readDataKeys(el), "precondition: the custom layout is the active one").to.deep.equal([["two"]]);

    rows.remove();
    await nextRender();

    tapKey(el, "a");
    expect(qwertyCalls, "the rendered layout's factory runs").to.equal(1);
    expect(pinpadCalls, "the unresolved name's factory does not").to.equal(0);
  });

  it("suppress=Middleware disables the built-in composer for the layout", async () => {
    // `ko-hangul` arms the built-in Hangul composer. Suppressing the facet is the
    // only way to type its rows directly.
    const { el, input } = await mountWithTarget(
      { layout: "ko-hangul" },
      customLayout({ name: "ko-hangul", suppress: "Middleware" }),
    );

    tapKey(el, "ㄱ");
    tapKey(el, "ㅏ");

    expect(input.value, "the jamo are typed uncomposed rather than forming 가").to.equal("ㄱㅏ");
  });

  it("suppress accepts whitespace around a comma-separated entry", async () => {
    // The README publishes the comma-or-space tolerance as a guarantee, and nothing
    // exercised the padding it exists to absorb.
    const { el, input } = await mountWithTarget(
      { layout: "ko-hangul" },
      customLayout({ name: "ko-hangul", suppress: "Variants, Middleware" }),
    );

    tapKey(el, "ㄱ");
    tapKey(el, "ㅏ");

    expect(input.value, "the padded facet still suppresses the composer").to.equal("ㄱㅏ");
  });

  it("picks up a child edit made while a language change is pending", async () => {
    // The host is `languageAware`, and UI5Element drops an invalidation entirely while a
    // language change is in flight. A fold keyed off the host's own hook would miss the
    // edit and stay stale for good, because the recovery re-render does not replay it.
    const el = await mount({ layout: "probe" }, customLayout({ name: "probe", rows: [[{ value: "old" }]] }));
    const child = el.querySelector("kiosk-keyboard-custom-layout") as CustomLayout;
    expect(readDataKeys(el).flat()).to.deep.equal(["old"]);

    const pending = setLanguage("de");
    child.rows = [[{ value: "new" }]];
    await pending;
    await nextRender();
    await nextRender();

    expect(readDataKeys(el).flat(), "the edit survives the suppressed invalidation").to.deep.equal(["new"]);
    await configureLanguage(null);
  });

  it("accepts a layout appended and selected in the same task", async () => {
    // `_processChildren` fills the slot a microtask later, so a registry check at
    // assignment time would reject a name that is about to be perfectly valid - and
    // silently leave the previous layout rendering while `layout` claimed otherwise.
    const el = await mount({ layout: "qwertz-de" });
    await withCapturedWarnings(async (messages) => {
      el.appendChild(customLayout({ name: "warehouse-pos", rows: [[{ value: "ax" }, { value: "bx" }]] }));
      el.layout = "warehouse-pos";
      await nextRender();
      await nextRender();
      expect(
        messages.filter((m) => m.includes("not registered")),
        "nothing is reported",
      ).to.deep.equal([]);
    });

    expect(el.layout, "the property holds the assignment").to.equal("warehouse-pos");
    expect(readDataKeys(el).flat(), "and the appended layout is what renders").to.deep.equal(["ax", "bx"]);
  });

  it("reports a layout that stays unregistered once the slot has settled", async () => {
    await withCapturedWarnings(async (messages) => {
      const el = await mount({ layout: "qwertz-de" });
      el.layout = "no-such-layout";
      await nextRender();
      await nextRender();

      expect(
        messages.some((m) => m.includes("no-such-layout") && m.includes("is not registered")),
        "the fallback is reported once the fold is authoritative",
      ).to.equal(true);
      expect(readDataKeys(el).flat(), "and the fallback layout renders").to.contain("q");
    });
  });

  it("reports an overlay whose layout does not exist, listing the built-ins", async () => {
    await withCapturedWarnings(async (messages) => {
      await mount({ layout: "qwerty" }, customLayout({ name: "typo-only", locales: "zz" }));

      const reported = messages.find((m) => m.includes("typo-only"));
      expect(reported, "the overlay that resolves nothing is named").to.not.equal(undefined);
      // The remedy quotes the real registry rather than a literal, so a vocabulary wired
      // to nothing would render "the built-ins are: ." and help no one.
      expect(reported, "and the remedy lists the built-ins it could have meant").to.contain("qwertz-de");
    });
  });

  it("an invalid variant table is reported and skipped", async () => {
    await withCapturedWarnings(async (messages) => {
      const el = await mount(
        { layout: "qwerty", "accent-variants": "" },
        // An empty glyph makes the table unusable.
        customLayout({ name: "qwerty", variants: { a: [""] } }),
      );
      expect(messages.length, "an invalid table is logged").to.be.greaterThan(0);
      expect(
        requireKey(el, "a").hasAttribute(DOM.attributes.hasVariants),
        "the invalid table is dropped, so 'a' falls through to the built-in Latin table",
      ).to.equal(true);
    });
  });

  it("mixed-case layout names resolve the variant table through lowercase lookup", async () => {
    const el = await mount(
      { layout: "qwerty", "accent-variants": "" },
      customLayout({ name: "QWERTY", variants: { b: ["ḃ"] } }),
    );

    expect(
      requireKey(el, "b").hasAttribute(DOM.attributes.hasVariants),
      "mixed-case 'QWERTY' resolves the table onto built-in 'qwerty'",
    ).to.equal(true);
    expect(
      requireKey(el, "a").hasAttribute(DOM.attributes.hasVariants),
      "the table merges, so built-in 'a' survives",
    ).to.equal(true);
  });

  it("a base letter mapped to an empty list loses its popup", async () => {
    const el = await mount(
      { layout: "qwerty", "accent-variants": "" },
      customLayout({ name: "qwerty", variants: { a: [] } }),
    );

    expect(
      requireKey(el, "a").hasAttribute(DOM.attributes.hasVariants),
      "the letter mapped to an empty list loses its popup",
    ).to.equal(false);
    expect(
      requireKey(el, "o").hasAttribute(DOM.attributes.hasVariants),
      "every other built-in letter is untouched",
    ).to.equal(true);
  });

  it("table-shaped impostors are rejected rather than read as an empty table", async () => {
    // Each has no own enumerable values, so a validator that only inspects
    // Object.values would accept it, shadow the built-in table and arm nothing.
    const impostors = {
      array: [],
      map: new Map([["a", ["ä"]]]),
      date: new Date(),
      empty: {},
    } satisfies Record<string, NotAVariantTable>;
    for (const [label, table] of Object.entries(impostors)) {
      await withCapturedWarnings(async (messages) => {
        const el = await mount(
          { layout: "qwerty", "accent-variants": "" },
          // @ts-expect-error a table only plain JS can assign, which is what the validator screens
          customLayout({ name: "qwerty", variants: table }),
        );
        expect(messages.length, `${label} is logged as invalid`).to.be.greaterThan(0);
        expect(
          requireKey(el, "a").hasAttribute(DOM.attributes.hasVariants),
          `${label} is skipped, so 'a' keeps the built-in table`,
        ).to.equal(true);
      });
    }
  });

  it("base letters that are not lowercase are rejected rather than silently normalized", async () => {
    // The table is matched against key.value.toLowerCase(), so an uppercased or padded
    // base letter would arm nothing while shadowing the tier below.
    for (const base of ["A", "a "]) {
      await withCapturedWarnings(async (messages) => {
        const el = await mount(
          { layout: "qwerty", "accent-variants": "" },
          customLayout({ name: "qwerty", variants: { [base]: ["ä"] } }),
        );
        expect(
          messages.some((message) => message.includes("lowercase base letters")),
          `"${base}" is logged as invalid`,
        ).to.equal(true);
        expect(
          requireKey(el, "a").hasAttribute(DOM.attributes.hasVariants),
          `"${base}" is skipped, so 'a' keeps the built-in table`,
        ).to.equal(true);
      });
    }
  });

  it("a variant table without accent-variants warns once and applies nothing", async () => {
    await withCapturedWarnings(async (messages) => {
      const el = await mount({ layout: "qwerty" }, customLayout({ name: "qwerty", variants: { b: ["ḃ"] } }));
      const disarmed = (): number => messages.filter((message) => message.includes("accentVariants is false")).length;
      expect(
        requireKey(el, "b").hasAttribute(DOM.attributes.hasVariants),
        "the disarmed gate applies no table",
      ).to.equal(false);
      expect(disarmed(), "the diagnostic is emitted exactly once").to.equal(1);

      el.layout = "qwertz-de";
      await nextRender();
      expect(disarmed(), "and is not repeated on re-render").to.equal(1);
    });
  });

  it("a layout name that stopped resolving reads the table of the rendered surface", async () => {
    // The custom layout declaring pinpad's rows is dropped, so the surface falls back
    // to qwerty. The table has to follow the fallback, not the name still on the property.
    const rows = customLayout({ name: "pinpad", rows: layoutB });
    const el = await mount(
      { layout: "pinpad", "accent-variants": "" },
      rows,
      customLayout({ name: "pinpad", variants: { a: [] } }),
      customLayout({ name: "qwerty", variants: { b: ["ḃ"] } }),
    );
    expect(readDataKeys(el), "precondition: the custom layout is the active one").to.deep.equal([["two"]]);

    rows.remove();
    await nextRender();

    expect(
      requireKey(el, "b").hasAttribute(DOM.attributes.hasVariants),
      "the rendered layout's own table applies",
    ).to.equal(true);
    expect(
      requireKey(el, "a").hasAttribute(DOM.attributes.hasVariants),
      "the unresolved name's table does not",
    ).to.equal(true);
  });

  it("editing a custom layout's variants re-resolves on the next render", async () => {
    const entry = customLayout({ name: "qwerty" });
    const el = await mount({ layout: "qwerty", "accent-variants": "" }, entry);
    const aKey = (): HTMLElement => requireKey(el, "a");
    expect(aKey().hasAttribute(DOM.attributes.hasVariants), "built-in 'a' armed before the suppression").to.equal(true);

    entry.suppress = "Variants";
    await nextRender();
    expect(aKey().hasAttribute(DOM.attributes.hasVariants), "opted out after the property write").to.equal(false);

    entry.suppress = "";
    await nextRender();
    expect(aKey().hasAttribute(DOM.attributes.hasVariants), "built-in restored after clearing it").to.equal(true);
  });
});

describe("layout attributes declared on a custom layout", () => {
  /** An auxiliary surface a consumer declares, reachable only through a custom layout. */
  const symbolSurface: LayoutDefinition = [
    [{ value: "§" }, { value: "{layout:base}", label: "ABC", type: "modifier" }],
  ];

  it("does not track a layout marked Secondary as the base", async () => {
    const el = await mount(
      { layout: "qwertz-de" },
      customLayout({
        name: "my-symbols",
        rows: symbolSurface,
        layoutRole: "Secondary",
      }),
    );
    el.layout = "my-symbols";
    await nextRender();

    tapKey(el, "{layout:base}");
    await nextRender();

    expect(readDataKeys(el).flat(), "{layout:base} returns to the alphabetic layout").to.include("q");
  });

  it("does track the same layout as the base when it declares no role", async () => {
    // The negative control: an omitted layoutRole with no built-in of that name reads
    // as an alphabetic layout and strands {layout:base} on itself.
    const el = await mount({ layout: "qwertz-de" }, customLayout({ name: "my-symbols", rows: symbolSurface }));
    el.layout = "my-symbols";
    await nextRender();

    tapKey(el, "{layout:base}");
    await nextRender();

    expect(readDataKeys(el).flat(), "there is no way back to the alphabetic layout").to.include("§");
  });

  it("keeps the built-in attributes a custom layout does not declare", async () => {
    const el = await mount({ layout: "qwertz-de" }, customLayout({ name: "numeric", rows: symbolSurface }));
    el.layout = "numeric";
    await nextRender();

    tapKey(el, "{layout:base}");
    await nextRender();

    expect(readDataKeys(el).flat(), "the built-in secondary flag still applies to the shadowed name").to.include("q");
  });

  it("un-marks a built-in secondary flag with layoutRole=Base", async () => {
    const el = await mount(
      { layout: "qwertz-de" },
      customLayout({ name: "numeric", rows: symbolSurface, layoutRole: "Base" }),
    );
    el.layout = "numeric";
    await nextRender();

    tapKey(el, "{layout:base}");
    await nextRender();

    expect(readDataKeys(el).flat(), "a declared Base makes the shadowed name the base").to.include("§");
  });

  it("inherits when layoutRole names a role that does not exist", async () => {
    // Nothing can throw on an attribute here the way the UI5 twin's enum validation
    // does, so an unrecognised role has to fall back to the tier below rather than
    // silently promoting an auxiliary surface to the base layout.
    const el = await mount(
      { layout: "qwertz-de" },
      customLayout({ name: "numeric", rows: symbolSurface, layoutRole: "base" as "Base" }),
    );
    el.layout = "numeric";
    await nextRender();

    tapKey(el, "{layout:base}");
    await nextRender();

    expect(readDataKeys(el).flat(), "the built-in secondary flag still applies").to.include("q");
  });

  it("keeps a layout whose declared attributes are the wrong type", async () => {
    await withCapturedWarnings(async (messages) => {
      // A mistyped attribute degrades to the default; it must not cost the rows.
      const el = await mount(
        {},
        customLayout({
          name: "bogus",
          rows: layoutB,
          // @ts-expect-error a value only plain JS can assign; a mistyped one degrades to the default
          keycapLang: 42,
        }),
      );
      el.layout = "bogus";
      await nextRender();

      expect(readDataKeys(el), "the rows still render").to.deep.equal([["two"]]);
      const label = el.shadowRoot!.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`)!;
      expect(label.hasAttribute("lang"), "the mistyped language is dropped").to.be.false;
      expect(messages, "a usable custom layout does not warn").to.deep.equal([]);
    });
  });

  it("reports a custom layout that declares facets but resolves no layout, warning once", async () => {
    await withCapturedWarnings(async (messages) => {
      await mount({}, customLayout({ name: "bogus", keycapLang: "he" }));

      expect(messages.length, "warned exactly once for the one bad custom layout").to.equal(1);
      expect(messages[0]).to.contain("bogus");
    });
  });
});
