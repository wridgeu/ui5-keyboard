# CustomLayout — implementation specification for issue #216 (customLayouts aggregation + slot)

Issue: [#216](https://github.com/wridgeu/ui5-keyboard/issues/216) — Extension surface: four parallel `instance*` maps vs a cohesive custom layout/plugin unit.

> **Status: refuted, corrected, cleared for implementation.** Two adversarial critics — a
> framework-reality lens and a behaviour-regression lens — attacked this specification against
> the pinned sources. Neither could refute the design: the tri-state argument, the kiosk
> invalidation chain, the XML authoring path, the generator's output shapes, `defaultClass`,
> the two-phase `applySettings`, clone ordering and DEF-1 all survived. They confirmed eight
> implementation blockers and roughly thirty citation errors, all folded in below.

## Start here

Nothing in this branch is code. It is one design document; `main` carries the only shipped change.

**Citation base.** Every `file:line` below is relative to the branch tip. An earlier revision was written against `cc34a371`, one commit before the branch base. `5a5f2c2f` shifted `packages/kiosk-keyboard/src/KioskKeyboard.ts` by **+12 below line 1151** and `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts` by **+10 below line 1017**. Citations above those lines are exact; where a citation below them still reads low, apply the offset rather than trusting the number.

**Already on `main`, do not redo.** `fix(keyboard): keep a composition alive across an unrelated middleware swap` (`5a5f2c2f`) landed **three** of what were Stage 0's nine items, not one — its commit message enumerates them:

1. the composition data-loss fix itself: `reset()` erased a half-typed Hangul syllable out of the input on any `instanceMiddleware` reassignment, including one that never touched the active layout's entry;
2. the two `applySettings` doc comments claiming `ManagedObject` skips `applySettings` when no settings are passed;
3. `packages/kiosk-keyboard/README.md:344`'s stale `object | null` claim.

Item 1's setter-local comparison is **changed, not superseded**, by the key-press-time factory check in §A.7. It commits at swap time; §A.7 commits at the next composition-affecting key. See "Reconciling with the fix already on `main`" at the end, which states the delta instead of claiming there is none.

**All open decisions are closed** (D5–D10 below). The two that were expensive to reverse — the class name and the wildcard's home — were both decided **against** the original draft. If you are working from memory of an earlier revision, re-read the decisions section first.

**Do these in order:** Stages 0–5 as laid out in Migration. The refutation pass CLAUDE.md §5 requires has been run; its findings are already applied.

**Traps, each of which will cost an afternoon if hit cold:**

- **Kiosk fields use definite assignment with no initialiser** (`private _x!: T;`), seeded in `init()`. The root `tsconfig.json` targets ES2022 and never sets `useDefineForClassFields`, so it defaults to `true`; the kiosk package does not override it (webc does, `packages/kiosk-keyboard-webc/tsconfig.json:9`). `ManagedObject` calls `init()` (`:530`) and `applySettings()` (`:534`) _inside_ `super()`, so a derived field initialiser runs **after** both. An initialised `_reportedDiagnostics` makes `init()` throw on `undefined`; an initialised `_fold` silently discards the single fold built between the `applySettings` phases — the property §A.5 and its test are built on. Every field at `KioskKeyboard.ts:149-173` already follows this; the lone exception (`_layoutSource`, `:148`) is benign only because its initial value equals its construction-time value.
- **A registered `DataType` needs a matching exported TypeScript alias, and the alias is where `| null` lives.** `library.ts:247-258` states the rule: the generator emits no `| null` union of its own for a custom type. A `createType` name with no exported alias makes the generator emit `import X from "ui5/kiosk/X"` — a module that does not exist — and `tsc --noEmit` fails (`astGenerationHelper.js:458-478`).
- `packages/kiosk-keyboard/test/qunit/instance-property-types.tsd.ts` **will go red, and that is the file doing its job** — but not the way earlier revisions claimed. Because D2 _deletes_ the four setters, each `@ts-expect-error`-guarded line stays an error (now "Property does not exist") and the directives are still consumed. The file fails on its **unguarded** accepted-shapes block at `:27-36`. Rewrite it against the new surface. Do not delete it and do not "fix the polarity".
- **The webc CEM analyzer throws, and it is not in CI.** `displayDocumentationErrors()` (`node_modules/@ui5/webcomponents-tools/lib/cem/utils.mjs:385-399`) throws on a public member with no `@default`, on a public boolean initialised to `true`, and on a class with no `@extends` tag. It runs in `build` → `test:packages:smoke` → `check:base`. **CI does not run `check:base`**: it re-implements it with `lint:ci --deny-warnings` and omits `test:packages:smoke` entirely, so a green CI run does not mean the webc package builds.
- A **second generated interface** (`CustomLayout.gen.d.ts`) appears the first time `npm run generate` runs. `.github/workflows/ci.yml:60` is a path literal naming only `KioskKeyboard.gen.d.ts` (and the step is named "Verify generated interface is in sync", singular), so CI will not notice it drifting. Widen that glob in the same commit that adds the class. Never hand-edit either file.
- **Stage 4 cannot be split.** The twin-drift check and the `generate && git diff --exit-code` gate both fail on a partial landing, so the property flip, the regenerated artefacts, the test rewrites, the docs and the demo go in one commit. Stages 1–3 are each independently mergeable and green; Stage 4 is not divisible.
- The webc twin's **first render** is the one place this design has previously been wrong. `_suppressInvalidation` is true from `UI5Element.js:121` until `:681`, so slot content present at connect time never fires `onInvalidation`. The lazy fold is what makes this safe — keep it lazy; an eager fold driven by mutators reintroduces DEF-1 through DEF-4 together.
- Generic UI5 guidance — including the `ui5-typescript-conversion` skill, which calls it "CRITICAL to avoid XSS issues" — will tell you to attach the new enums to the library object via `ObjectPath`. **It is wrong for this repo** — see "Guidance that does NOT apply here".

**Verification budget.** CLAUDE.md §7 applies: the adversarial-hypotheses file is part of Stage 3, and each hypothesis must be _seen_ red, not argued. Note that an earlier revision pre-announced H3's answer — "the locale facet is covered vacuously" — as fact. **That is false.** Nine kiosk tests drive layout selection purely through `instanceLocaleLayouts` (`instance-overrides.qunit.ts:212,240,259,281,309,389,408`; `KioskKeyboard-layout.qunit.ts:902,948,1145`), and `instance-overrides.test.ts:87-110` does so on the webc side, deliberately assigning before `appendChild`. H3 is still worth probing; expect it to go red on the first try.

## Decisions taken by the repo owner

- **D1.** XML declarability is a requirement for the UI5 twin: a Fiori developer must configure a complete layout extension in an XML view without touching a controller. It is explicitly _not_ a requirement for the web component, which instead uses the closest idiom its own framework offers.
- **D2.** The surface is renamed; `instanceLayouts` is retired in favour of `customLayouts`. Breaking changes across both keyboards, the demo apps and the GitHub-Pages demos are accepted — nothing is published.
- **D3.** The wildcard variant tier is re-layered in this change: built-in → defaults → named, with `[]` suppression honoured at each tier.
- **D4.** The new unit absorbs per-layout metadata and any future per-layout concern; a fifth concern folds into an existing level rather than becoming a sixth sibling map.
- **D5.** The child class is **`CustomLayout`** (kiosk `ui5.kiosk.CustomLayout`, webc tag `kiosk-keyboard-custom-layout`), not `LayoutPreset`. Deciding reason: singular class plus plural aggregation is the first-party pattern. `sap.ui.table/1.136.0/src/sap/ui/table/Table.js:459` declares `columns: {type: "sap.ui.table.Column", defaultClass: Column, multiple: true, singularName: "column", bindable: "bindable", …}` — very nearly the declaration this design needs — and `addCustomLayout(new CustomLayout({…}))` reads as UI5 is meant to read. The earlier draft's objection, that a class and a collection sharing a noun reads badly, does not survive that precedent.
- **D6.** The defaults tier is a **host property `defaultVariants`** on `KioskKeyboard`, not a reserved `name="*"` and not a second collection. Deciding reasons, in order: (i) under D5 a `<kiosk:CustomLayout name="*">` is a custom layout that is not a layout, and the `wildcard-field` diagnostic existed only to apologise for that; (ii) a dedicated `layoutDefaults` collection reusing `CustomLayout` would merely relocate the same six meaningless properties, and doing it honestly costs a third public class per twin for one table; (iii) the tier carries exactly one value, because global suppression is not part of it (D7), so it has no tri-state and needs no element at all. It pairs with the `accentVariants` switch already at that level. Cost, accepted: a future per-layout facet's apply-to-all case loses its free ride — but D3 scopes the defaults tier to variants, and the earlier draft had already declined to admit middleware there.
- **D7.** Suppression is **per layout only**: `suppress="Variants,Middleware"` on the `CustomLayout` that names the layout. The defaults tier cannot suppress. "No long-press affordance anywhere" is already `accentVariants="false"`, which is the default (`KioskKeyboard.ts:311-315`), and the README's opt-out ladder (`README.md:618-624`) documents exactly three recipes — one base letter, one layout, one key — none global. `{"*": null}` works at HEAD only as a side effect of the either/or short-circuit at `latin-variants.ts:104-105`, the line D3 deletes; its HEAD meaning does not survive the re-layering wherever the tier lives.
- **D8.** `LayoutFacet` admits `Variants` and `Middleware` only (CLAUDE.md §1 — nothing in #216 asks to disable an inherited keycap language). Adding a member later costs one line in `library.ts`, one in `SUPPRESSIBLE_FACETS`, one branch in the fold, and — for `Lang`/`Secondary` — widening `LayoutMeta` to `| null`, a byte-compared change to `layout-meta.ts` this design deliberately avoids. `Secondary` would duplicate `layoutRole="Base"`; if it is ever added, retire one spelling rather than shipping both.
- **D9.** The aggregation's generated type is **not** hand-widened for object literals. `@ui5/ts-interface-generator` 0.11.1 does not model `defaultClass`, so `customLayouts` types as the four-way union and TypeScript consumers construct `new CustomLayout({…})`. A hand-written declaration merge would be a second hand-maintained shape next to a file CLAUDE.md forbids hand-editing, for an ergonomic no TypeScript consumer in this repo uses. `defaultClass` is still declared, because it is what makes the plain-JS call sites and `applySettings` phase 1 work. Document the asymmetry in the kiosk README: "JavaScript callers may pass object literals; TypeScript callers construct `CustomLayout`."
- **D10.** The demo ships a `CustomLayout` subclass as a named unit (`PlWarehouseCustomLayout`) in both twins. It is the only thing that makes the "a custom layout is an authoring unit, not a bag of properties" claim checkable rather than asserted, and it exercises the subclass path through `instanceof CustomLayout` (kiosk) and `isCustomLayout` (webc).

**Standing authoring constraint.** Types and accessors come from the tooling, never from hand-written equivalents: declare the property or aggregation in `metadata` and use the generated accessor. This is not style. `ManagedObjectMetadata`'s `generateAccessors` installs each accessor through `if (!proto[name])`, and a TS class body populates the prototype long before the metadata constructor runs, so a hand-written method of the same name does not duplicate the generated one — it **replaces** it, and `super.<accessor>` then resolves to `undefined`. That mechanism is why DEF-2 dissolves rather than needing engineering around, and why D9 refuses the hand-widened type.

## Surface

## 0. Names, decided once

| thing            | kiosk                                                                    | webc                                                                                                    |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| collection       | `customLayouts` 0..n aggregation                                         | `customLayouts` named slot                                                                              |
| child class      | `ui5.kiosk.CustomLayout` (`packages/kiosk-keyboard/src/CustomLayout.ts`) | `CustomLayout` (`packages/kiosk-keyboard-webc/src/CustomLayout.ts`), tag `kiosk-keyboard-custom-layout` |
| shared fold      | `src/internal/custom-layout-fold.ts`                                     | `src/core/custom-layout-fold.ts`                                                                        |
| shared spec type | `CustomLayoutSpec` in `types.ts`                                         | same, byte-identical text                                                                               |

**Picked `CustomLayout` over `LayoutPreset` / `KioskKeyboardCustomLayout`** (the tristate + blast-radius clusters vs the webc-lifecycle + semantics clusters). Deciding reason: it is the chosen design's own name, it does not collide with the _aggregation_ name `customLayouts` (a class and a collection called the same thing reads badly in `getCustomLayouts()[0] instanceof CustomLayout`), and it keeps the child/collection distinction visible in XML (`<kiosk:customLayouts><kiosk:CustomLayout/></kiosk:customLayouts>`).

Both files sit at `src/` top level, **not** in `internal/` / `core/`: `tools/check-twin-drift.mjs:261-262` reconciles only the intersection of those two directories' basenames, and two deliberately framework-specific classes must never be paired.

---

## 1. `packages/kiosk-keyboard/src/library.ts`

Delete `isOverrideRecord` (`:202-204`), the four `DataType.createType` calls (`:206-209`), the four `types` entries (`:221-224`), the four alias exports (`:255-258`, `InstanceLayoutMap` / `InstanceLocaleLayoutMap` / `InstanceMiddlewareMap` / `InstanceVariantMap`). Add:

```ts
/**
 * Whether a layout is an auxiliary surface or a base alphabetic layout. A secondary
 * layout is never tracked as the base, so `{layout:base}` returns to the alphabetic
 * layout it was reached from.
 *
 * @enum {string}
 * @public
 * @since 0.1.0
 */
export enum LayoutRole {
  /**
   * Takes the built-in layout of the same name's role, and the base alphabetic role
   * when there is no built-in of that name.
   */
  Inherit = "Inherit",
  /** A base alphabetic layout, even when the built-in of the same name is secondary. */
  Base = "Base",
  /** An auxiliary surface: numbers, symbols, F-keys, navigation. */
  Secondary = "Secondary",
}

/**
 * A per-layout facet whose inherited value a custom layout discards. A listed facet resolves
 * to nothing at that custom layout's position: the built-in tier and every earlier custom layout's
 * contribution are dropped, and only a value the same custom layout declares survives.
 *
 * Rows are not listed: the built-in registry is sealed, so a custom layout shadows rows and
 * never removes them.
 *
 * @enum {string}
 * @public
 * @since 0.1.0
 */
export enum LayoutFacet {
  /** Long-press accent variants. Suppressed, the layout's keys carry no long-press affordance. */
  Variants = "Variants",
  /** Composition (IME / dead-key) middleware. Suppressed, the layout's keys type directly. */
  Middleware = "Middleware",
}

/** A layout's rows, or `null` for a custom layout that overlays an existing layout. */
function isLayoutRows(value: unknown): boolean {
  return value === null || Array.isArray(value);
}
/** A long-press variant table, or `null` for none. Per-entry validation is the fold's. */
function isVariantTable(value: unknown): boolean {
  return value === null || (typeof value === "object" && !Array.isArray(value));
}

DataType.registerEnum("ui5.kiosk.LayoutRole", LayoutRole);
DataType.registerEnum("ui5.kiosk.LayoutFacet", LayoutFacet);
DataType.createType("ui5.kiosk.LayoutRows", { defaultValue: null, isValid: isLayoutRows }, "object");
DataType.createType("ui5.kiosk.VariantOverrideTable", { defaultValue: null, isValid: isVariantTable }, "object");

/**
 * The shapes the row and variant-table properties accept, each `null` for "not supplied".
 * The interface generator emits no `| null` union of its own for a custom type, so — as
 * for the four record types these replace — the null lives in the alias.
 *
 * @public
 * @since 0.1.0
 */
export type LayoutRows = LayoutDefinition | null;
export type VariantOverrideTable = VariantTable | null;
```

**Every registered `DataType` name must have an exported TypeScript alias of the same name, and the alias is where `| null` lives.** This is the rule `library.ts:247-258` already states for the four record types being deleted, and it is load-bearing twice over. Without an export, `addSourceExports.js:54-63` never learns the name, and `astGenerationHelper.js:437-439` falls through to `uniqueImport`'s unknown-name branch (`:458-478`), which emits `import LayoutRows from "ui5/kiosk/LayoutRows";` — a module that does not exist — and logs _"an import is created with module name … Is this correct? Usually this indicates some kind of issue."_ `tsc --noEmit` then fails. With an export whose type is non-nullable, the generator instead emits a confident lie: `getVariants(): VariantTable` against `defaultValue: null`.

That second trap is why the variant table's registered name is **`ui5.kiosk.VariantOverrideTable`**, not `ui5.kiosk.VariantTable`. `library.ts:245` already exports `VariantTable` as the **non-nullable** table type, re-exported for consumers to spread; reusing that name would silently bind the property to it. The new alias is distinct and nullable, and `toSpec()` therefore needs no `as` cast on either property.

`Lib.init` (`library.ts:211-230`): `types` becomes `["ui5.kiosk.KeyboardLayout", "ui5.kiosk.KeyboardType", "ui5.kiosk.MobileKeyboard", "ui5.kiosk.FKeyMode", "ui5.kiosk.LayoutRole", "ui5.kiosk.LayoutFacet", "ui5.kiosk.LayoutRows", "ui5.kiosk.VariantOverrideTable"]`; `elements: []` (`:228`) becomes `elements: ["ui5.kiosk.CustomLayout"]`. `elements` is what lets `XMLTemplateProcessor.findControlClass` (`:854-863`) resolve `<kiosk:CustomLayout>` out of the library namespace, so it is not optional.

Registered-type count is unchanged at 4→4 in kind but the two coarse record types are gone; `Inherit` is declared first so it is also the `DataType` default (`DataType.js:419`, "the first entry will become the default value"). `ui5.kiosk.LayoutFacet[]` is **not** registered — `DataType.getType` derives the array form on demand (`DataType.js:545-552`), exactly as `sap.m` registers `sap.m.Sticky` and never `sap.m.Sticky[]`.

---

## 2. `packages/kiosk-keyboard/src/CustomLayout.ts` (new)

```ts
import Element from "sap/ui/core/Element";
import type { MetadataOptions } from "sap/ui/core/Element";
import { LayoutRole } from "./library"; // side-effect: ensures Lib.init() runs
import type { LayoutRows, VariantOverrideTable } from "./library";
import type { CompositionMiddleware, CustomLayoutSpec } from "./types";

/**
 * One layout and everything that belongs with it: its rows, the locales that select
 * it, its keycap language, its role, its composition middleware and its long-press
 * variants.
 *
 * A custom layout that declares `rows` declares a layout. One without them overlays the
 * layout its `name` already resolves to, so a built-in can be given different variants,
 * a different middleware or a different locale binding without restating its keys.
 * Custom layouts apply in aggregation order.
 *
 * @namespace ui5.kiosk
 * @extends sap.ui.core.Element
 * @public
 * @since 0.1.0
 */
export default class CustomLayout extends Element {
  // The following three lines were generated and should remain as-is to make TypeScript aware of the constructor signatures
  constructor(idOrSettings?: string | $CustomLayoutSettings);
  constructor(id?: string, settings?: $CustomLayoutSettings);
  // oxlint-disable-next-line no-useless-constructor -- required by @ui5/ts-interface-generator overloads
  constructor(id?: string, settings?: $CustomLayoutSettings) {
    super(id, settings);
  }

  static readonly metadata: MetadataOptions = {
    library: "ui5.kiosk",
    properties: {
      /**
       * The layout this custom layout declares or overlays, matched after trim and
       * lowercase.
       */
      name: { type: "string", defaultValue: "", group: "Behavior" },
      /**
       * The layout's rows. Absent makes this an overlay on the layout `name` already
       * resolves to.
       *
       * Read by object identity: assign a new array to change the rows. Mutating the
       * array already assigned is not observed.
       */
      rows: { type: "ui5.kiosk.LayoutRows", defaultValue: null, group: "Behavior" },
      /**
       * BCP-47 language of the keycaps, emitted as `lang` on the key labels so assistive
       * tech announces them with the script's own pronunciation rules (WCAG 2.2 SC 3.1.2).
       * Empty takes the built-in layout's value.
       */
      keycapLang: { type: "string", defaultValue: "", group: "Behavior" },
      /** Whether the layout is an auxiliary surface or a base alphabetic layout. */
      layoutRole: { type: "ui5.kiosk.LayoutRole", defaultValue: LayoutRole.Inherit, group: "Behavior" },
      /**
       * BCP-47 prefixes that select this layout when the control has no explicit
       * `layout`, e.g. `locales="pl,pl-PL"`.
       */
      locales: { type: "string[]", defaultValue: [], group: "Behavior" },
      /**
       * Factory for the layout's composition middleware. Resolvable in an XML view
       * through `core:require`.
       */
      middleware: { type: "function", defaultValue: null, group: "Behavior" },
      /**
       * Long-press variants, merged onto the tier below per base letter, so the table
       * extends the defaults rather than replacing them and a base letter mapped to `[]`
       * drops that letter. Base letters must be lowercase.
       *
       * Read by object identity: assign a new object to change the table.
       */
      variants: { type: "ui5.kiosk.VariantOverrideTable", defaultValue: null, group: "Behavior" },
      /**
       * Facets whose inherited value this custom layout discards, e.g.
       * `suppress="Variants,Middleware"`. A listed facet resolves to nothing at this
       * custom layout's position; a value this same custom layout declares still applies.
       */
      suppress: { type: "ui5.kiosk.LayoutFacet[]", defaultValue: [], group: "Behavior" },
    },
  };

  /** The framework-agnostic record this custom layout declares. The control's fold is its only reader. */
  toSpec(): CustomLayoutSpec {
    const rows = this.getRows();
    const keycapLang = this.getKeycapLang();
    const role = this.getLayoutRole();
    const locales = this.getLocales();
    const middleware = this.getMiddleware() as (() => CompositionMiddleware) | null;
    const variants = this.getVariants();
    const suppress = this.getSuppress();
    return {
      name: this.getName(),
      ...(rows !== null && { rows }),
      ...(keycapLang && { keycapLang }),
      ...(role !== "Inherit" && { secondary: role === "Secondary" }),
      ...(locales.length > 0 && { locales }),
      ...(middleware !== null && { middleware }),
      ...(variants !== null && { variants }),
      ...(suppress.length > 0 && { suppress }),
    };
  }
}
```

`role !== "Inherit"` / `role === "Secondary"` are string-literal comparisons per CLAUDE.md. `rows` and `variants` need no `as` cast: their registered `DataType` names resolve to the nullable aliases exported alongside them in §1, so the generated accessors already return `LayoutDefinition | null` and `VariantTable | null`. Conditional spread everywhere: `exactOptionalPropertyTypes` is off in this repo, so `{ secondary: undefined }` would type-check and then clobber the built-in in `layout-meta.ts`'s `{...builtIn, ...instance}` (`layout-meta.ts:78-84`).

**The keycap-language property is `keycapLang`, not `lang`, in both twins.** On webc, `@property() lang` is rejected outright: `isValidPropertyName` (`node_modules/@ui5/webcomponents-base/dist/util/isValidPropertyName.js:16-25`) allow-lists only `disabled`, `title`, `hidden`, `role`, `draggable` and `aria*`, and returns false for anything owned by `HTMLElement.prototype` — which owns `lang`. `UI5Element.js:963-965` then `console.warn`s _"is not a valid property name. Use a name that does not collide with DOM APIs"_ on every import of the bundle, and the UI5 accessor shadows the reflected global attribute. The kiosk twin has no such collision, but the name is mirrored anyway: an asymmetric public name across the twins is the drift class that produced #98 and #108, and D2 makes the rename free. The DOM attribute the renderer emits on key labels is still `lang` — only the authoring property is renamed.

`CustomLayout` declares **no** `invalidate()` override, **no** `setProperty` override, and **no** parent protocol. Properties keep the default `invalidate: true` — do **not** copy `sap.ui.core.dnd.DragDropBase`'s `invalidate: false` (`dnd/DragDropBase.js:54,60,71`), which is exactly what would sever the only content-change signal the control has.

`packages/kiosk-keyboard/src/CustomLayout.gen.d.ts` is generated by `npm run generate` and **committed**, by CLAUDE.md's stated principle: `CustomLayout.ts` uses `$CustomLayoutSettings` in its constructor overloads without importing it, so the IDE and a bare `tsc --noEmit` need it on disk before any build, and kiosk ships `src/` to npm. `.gitattributes` already globs `*.gen.d.ts linguist-generated`; no change there.

---

## 3. `KioskKeyboard` metadata (kiosk)

Delete the four property blocks at `KioskKeyboard.ts:387-460`. Extend `metadata.aggregations` (`:462-474`, today only `_variantPopover`):

```ts
    aggregations: {
      /**
       * Per-instance layouts. Each custom layout declares a layout, or overlays the one its
       * `name` already resolves to. Applied in aggregation order: for rows, locales,
       * metadata and middleware the last declaration wins; long-press variants
       * accumulate per base letter.
       *
       * @since 0.1.0
       */
      customLayouts: {
        type: "ui5.kiosk.CustomLayout",
        multiple: true,
        singularName: "customLayout",
        bindable: "bindable",
        defaultClass: CustomLayout,
      },
      _variantPopover: { type: "sap.m.Popover", multiple: false, visibility: "hidden" },
    },
```

`defaultClass` (since 1.120; `ManagedObject.js:812` typedef, `:1076` `FnClass ??= oKeyInfo?.defaultClass`) lets a plain object literal be coerced into a real `CustomLayout`. It is kept for the plain-JS consumers that exist in this repo (`packages/kiosk-keyboard/test/e2e/visual/init.js`) and for `applySettings` phase 1. Known gap, stated rather than hidden: `@ui5/ts-interface-generator` 0.11.1 does not model `defaultClass`, so the generated union is `CustomLayout[] | CustomLayout | AggregationBindingInfo | \`{${string}}\``and **TypeScript consumers construct`new CustomLayout({...})`**. Every TS fixture in this repo does so.

Nine accessors are generated and **none is overridden**: `getCustomLayouts`, `addCustomLayout`, `insertCustomLayout`, `removeCustomLayout`, `removeAllCustomLayouts`, `indexOfCustomLayout`, `destroyCustomLayouts`, `bindCustomLayouts`, `unbindCustomLayouts`.

---

## 4. webc surface

`packages/kiosk-keyboard-webc/src/types.ts` gains the two enums with identical string values (its existing home for `KeyboardType` `:259`, `MobileKeyboard` `:274`, `FKeyMode` `:289`):

```ts
export enum LayoutRole {
  Inherit = "Inherit",
  Base = "Base",
  Secondary = "Secondary",
}
export enum LayoutFacet {
  Variants = "Variants",
  Middleware = "Middleware",
}
```

`packages/kiosk-keyboard-webc/src/CustomLayout.ts`:

```ts
import UI5Element from "@ui5/webcomponents-base/dist/UI5Element.js";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import createInstanceChecker from "@ui5/webcomponents-base/dist/util/createInstanceChecker.js";
import type { CompositionMiddleware, LayoutDefinition, CustomLayoutSpec, LayoutRole } from "./types.js";
import type { VariantTable } from "./core/latin-variants.js";

/**
 * One layout and everything that belongs with it, slotted into a `<kiosk-keyboard>`'s
 * `customLayouts` slot. A custom layout with `rows` declares a layout; one without them
 * overlays the layout its `name` already resolves to. Applied in DOM order.
 *
 * Renders nothing: no renderer, template or styles, so it never attaches a shadow root
 * and is never projected. Configuration, read by the host - the shape `ui5-table`'s
 * `features` children use: `ui5-table-selection-multi` and `ui5-table-selection-single`
 * are registered with `@customElement({tag})` and no renderer, template or styles.
 *
 * @class
 * @extends UI5Element
 * @public
 * @since 0.1.0
 */
@customElement({ tag: "kiosk-keyboard-custom-layout" })
class CustomLayout extends UI5Element {
  /**
   * Identifies this element to the host without `instanceof` or a tag-name check: UI5
   * rewrites tags under scoping (UI5ElementMetadata.js:50-60) and a cross-bundle
   * duplicate defeats `instanceof`.
   *
   * @private
   */
  readonly isKioskKeyboardCustomLayout = true;

  /**
   * The layout this custom layout declares or overlays.
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() name = "";
  /**
   * BCP-47 language of the keycaps. Empty takes the built-in layout's value.
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() keycapLang = "";
  /**
   * BCP-47 prefixes that select this layout, comma- or space-separated.
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() locales = "";
  /**
   * Whether the layout is an auxiliary surface or a base alphabetic layout.
   * @default "Inherit"
   * @public
   * @since 0.1.0
   */
  @property() layoutRole: `${LayoutRole}` = "Inherit";
  /**
   * Facets whose inherited value this custom layout discards, comma- or space-separated.
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() suppress = "";
  /**
   * The layout's rows, or `null` to make this an overlay. Assign a new array to change them.
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object }) rows: LayoutDefinition | null = null;
  /**
   * Long-press variants, merged per base letter onto the tier below. `null` opts the layout out.
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object }) variants: VariantTable | null = null;
  /**
   * Composition middleware factory. `null` disables the built-in for this layout.
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object }) middleware: (() => CompositionMiddleware) | null = null;

  /** The framework-agnostic record this custom layout declares. The host's fold is its only reader. */
  toSpec(): CustomLayoutSpec {
    const suppress = splitTokens(this.suppress);
    const locales = splitTokens(this.locales);
    return {
      name: this.name,
      ...(this.rows !== null && { rows: this.rows }),
      ...(this.keycapLang && { keycapLang: this.keycapLang }),
      ...(this.layoutRole !== "Inherit" && { secondary: this.layoutRole === "Secondary" }),
      ...(locales.length > 0 && { locales }),
      ...(this.middleware != null && { middleware: this.middleware }),
      ...(this.variants != null && { variants: this.variants }),
      ...(suppress.length > 0 && { suppress }),
    };
  }
}

/** Splits a comma- or space-separated attribute list, dropping empty entries. */
function splitTokens(value: string): string[] {
  return value.trim() ? value.trim().split(/[\s,]+/) : [];
}

CustomLayout.define();
export default CustomLayout;

/** The host-facing contract, duck-typed so an element from another bundle still matches. */
export interface ICustomLayout extends HTMLElement {
  readonly isKioskKeyboardCustomLayout: boolean;
  toSpec(): CustomLayoutSpec;
}

export const isCustomLayout = createInstanceChecker<ICustomLayout>("isKioskKeyboardCustomLayout");
```

`locales` and `suppress` are token **strings**, not `type: Array`: `UI5ElementMetadata.hasAttribute` excludes only `Object` (`UI5ElementMetadata.js:64-67`) and `defaultConverter.toAttribute` JSON-stringifies arrays (`UI5Element.js:49-56`), so a public `type: Array` property reflects a live JSON attribute — the trap already documented at `docs/kiosk-webc/CUSTOM-ELEMENTS-MANIFEST.md:73`. Both separators are accepted so a `suppress="Variants,Middleware"` copied out of an XML view works verbatim; the reverse throws loudly on kiosk (`createArrayType.parseValue` splits only on `","`, `DataType.js:389-396`, and an unknown member fails `isValid` at `ManagedObject.js:1635-1638` — the same behaviour `mobileKeyboard="Bogus"` already has).

**Every public member carries `@default`, `@public` and `@since`, and the class carries `@class` and `@extends`, because the CEM analyzer throws without them.** `displayDocumentationErrors()` (`node_modules/@ui5/webcomponents-tools/lib/cem/utils.mjs:385-399`) throws `Found N errors in the description of the public API.` on: a public field with no `default` and no `@default` tag (`custom-elements-manifest.config.mjs:279-281`); a public boolean field initialised to `true` (`:245-247`); and a class extending something with no `@extends` tag (`:143`). An earlier revision's sketch tripped all three — three optional properties with no initialiser, the `readonly isKioskKeyboardCustomLayout = true` marker, and a class doc-block with neither tag. The shipped house form is `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts:532-537`; every public member in that file already carries all three tags. The marker is annotated `@private`, which takes it out of the public-API check entirely and, per `:196`/`:241`, also keeps it from becoming a phantom `is-kiosk-keyboard-custom-layout` attribute.

This runs in `generateAPI` (`packages/kiosk-keyboard-webc/package-scripts.mjs:31-33`) → `build` → `test:packages:smoke` → `check:base`. **CI omits `test:packages:smoke`**, so a green CI run does not prove the webc package builds; run `check:base` locally before pushing Stage 4.

**Suppression has exactly one spelling: `suppress`.** An earlier revision additionally accepted `variants = null` / `middleware = null` as suppression, relying on `UI5Element`'s generated setter storing the value verbatim. That alias cannot survive the `@default null` the CEM requires — with `null` as the declared default, "not declared" and "declared null" become indistinguishable again, the same collapse `ManagedObject.validateProperty` forces on the kiosk twin. Losing it costs nothing: D7 makes `suppress` the canonical spelling in both twins, and `toSpec()` gets simpler rather than normalising two representations into one.

The slot on `KioskKeyboard.ts`, replacing the four `@property({ type: Object })` blocks at `:514-592`:

```ts
import slot from "@ui5/webcomponents-base/dist/decorators/slot-strict.js";
import type { Slot } from "@ui5/webcomponents-base/dist/UI5Element.js";
import { isCustomLayout, type ICustomLayout } from "./CustomLayout.js";

  /**
   * Per-instance layouts. Each `<kiosk-keyboard-custom-layout>` declares a layout, or overlays
   * the one its `name` already resolves to. Applied in DOM order.
   *
   * Not projected: these are configuration, so the shadow template renders no
   * `<slot name="customLayouts">` for them.
   *
   * @public
   * @since 0.1.0
   */
  @slot({ type: HTMLElement, invalidateOnChildChange: { properties: true, slots: false } })
  customLayouts!: Slot<ICustomLayout>;
```

`slot-strict.js` is present in the installed 2.22.0 tree (verified by listing `node_modules/@ui5/webcomponents-base/dist/decorators/`) and must be imported under the local identifier `slot` — the CEM analyzer detects slots by `findDecorator(member, "slot")` (`custom-elements-manifest.config.mjs:197,212`), which is why upstream writes `import { slotStrict as slot }` (`Table.js:9`). Both keys of `SlotInvalidation` are required (`UI5ElementMetadata.d.ts:2-5`); `{ properties: true }` alone does not compile.

**Two deliberate deviations from `ui5-table`, stated because the precedent is cited elsewhere in this document and does not extend this far.** `Table.js:436` declares its `features` slot as `slot({ type: HTMLElement, individualSlots: true })` — no `invalidateOnChildChange`, and `individualSlots` on.

- **`individualSlots` is not set here.** First-party needs it because one of its features renders: `TableGrowing` is declared with `renderer: jsxRenderer`, a template and styles (`TableGrowing.js:229-231`), so it needs a real slot position in the host's shadow DOM. `CustomLayout` renders nothing, and `_assignIndividualSlotsToChildren` (`UI5Element.js:720-727`) would stamp `slot="customLayouts-1"` onto React/Vue-managed light DOM for no benefit. `KioskKeyboardTemplate.tsx` is unchanged.
- **`invalidateOnChildChange` is set here, and first-party does not use it.** Its config children push upward instead: `TableSelectionBase` holds `this._table`, assigned in `onTableActivate` and otherwise recovered by sniffing `isInstanceOfTable(this.parentElement)` in its own `onBeforeRendering`, then increments `this._table._invalidate++` (`TableSelectionBase.js:43-56, 114-118`). That is the same shape as the `_markFoldDirty` design §A.2 rejects on the kiosk twin — a child duck-typing its way into its parent — and it makes the child's correctness depend on being a direct child. The declarative route keeps the child ignorant of its host, needs no activation protocol, and is symmetric with the kiosk twin's `invalidate(oOrigin)`: in both twins the framework tells the host that a child changed. It is fully supported (`UI5Element.js:385-388` attaches the listener; `_onChildChange` emits `{type:"slot", name, reason:"childchange"}` at `:465-477`), just less trodden.

`KioskKeyboard.ts` **value-imports** `isCustomLayout` from `./CustomLayout.js`. That is load-bearing, not stylistic: `customElements.define` runs synchronously inside `UI5Element.define()` (`:1121-1125`), so the child tag is always defined by the time a `<kiosk-keyboard>` connects and `_processChildren` never enters the `Promise.race([whenDefined, setTimeout(1000)])` at `UI5Element.js:369-379` (measured: 1004 ms to first paint for an undefined child tag).

---

## 5. The shared spec type (`types.ts`, byte-identical text in both twins)

```ts
/**
 * What one custom layout declares. A custom layout without `rows` overlays the layout its
 * `name` already resolves to. The tier applied under every layout is the host's
 * `defaultVariants` property, not a member of this collection.
 */
export interface CustomLayoutSpec {
  readonly name: string;
  readonly rows?: LayoutDefinition;
  readonly keycapLang?: string;
  /**
   * Whether the layout is an auxiliary surface rather than a base alphabetic layout.
   * Absent takes the built-in of the same name's value, and the base alphabetic role
   * when there is no built-in of that name.
   */
  readonly secondary?: boolean;
  readonly locales?: readonly string[];
  readonly middleware?: () => CompositionMiddleware;
  readonly variants?: VariantTable;
  /**
   * Facets whose inherited value this custom layout discards. A listed facet resolves to
   * nothing at this custom layout's position; a value this same custom layout declares still applies.
   * Entries outside `SUPPRESSIBLE_FACETS` are reported and ignored.
   */
  readonly suppress?: readonly string[];
}
```

`suppress` is `readonly string[]`, not the enum type. Deciding reason: the enum must live in `library.ts` on kiosk (`DataType.registerEnum` requires it) and `library.ts` pulls `sap/ui/base/DataType` and `sap/ui/core/Lib`, which must never reach the framework-free byte-compared tier. The fold owns the one validator (`SUPPRESSIBLE_FACETS`), so both twins validate identically; on kiosk `validateProperty` has already rejected typos, so the branch is unreachable there and harmless.

`LayoutSpec` (kiosk `types.ts:356-381`) and `LayoutInput` (`:390`) are deleted from both twins.

---

## 6. Consumer snippets

**UI5 XML view** — the D1 target, a complete extension with no controller:

```xml
<mvc:View controllerName="demo.hotkeys.controller.KioskCustomLayouts"
  xmlns:mvc="sap.ui.core.mvc" xmlns:core="sap.ui.core" xmlns:kiosk="ui5.kiosk">

  <!-- `defaultVariants` is the house accent set, merged under every layout. -->
  <kiosk:KioskKeyboard id="kb" controls="name,email" accentVariants="true"
    defaultVariants="{layouts>/houseAccents}">
    <kiosk:customLayouts>

      <!-- A whole custom layout: rows, locale binding, keycap language, IME, accents. -->
      <kiosk:CustomLayout core:require="{ Warehouse: 'demo/hotkeys/middleware/warehouse' }"
        name="pl-warehouse" locales="pl,pl-PL" keycapLang="pl"
        rows="{layouts>/plWarehouse}"
        middleware="Warehouse.createMiddleware"
        variants="{layouts>/plVariants}" />

      <!-- Rows-less overlay: point the Japanese locale at the BUILT-IN kana layout. -->
      <kiosk:CustomLayout name="ja-kana" locales="ja" />

      <!-- Opt a layout out of accents entirely. -->
      <kiosk:CustomLayout name="arabic" suppress="Variants" />

      <!-- Disable the built-in Hangul composer for directly-typed rows. -->
      <kiosk:CustomLayout name="ko-hangul" suppress="Middleware" rows="{layouts>/hangulDirect}" />

      <!-- Promote the built-in secondary `numeric` to a base alphabetic layout. -->
      <kiosk:CustomLayout name="numeric" layoutRole="Base" rows="{layouts>/symbolSurface}" />

    </kiosk:customLayouts>
  </kiosk:KioskKeyboard>
</mvc:View>
```

`middleware="Warehouse.createMiddleware"` resolves because `type: "function"` properties are XML-declarable via `core:require`: `DataType.js:314-347` (`parseValue` → `resolveReference(sValue, Object.assign({".": oContext}, oLocals))`) and `XMLTemplateProcessor.js:87-91`. Precedent: `sap.m.Dialog#escapeHandler`.

**UI5 TypeScript:**

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import CustomLayout from "ui5/kiosk/CustomLayout";
import { LayoutFacet, LayoutRole } from "ui5/kiosk/library";

const kb = new KioskKeyboard({
  controls: ["name"],
  customLayouts: [
    new CustomLayout({
      name: "pl-warehouse",
      locales: ["pl", "pl-PL"],
      keycapLang: "pl",
      rows: PL_ROWS,
      middleware: createWarehouseMiddleware,
      variants: PL_VARIANTS,
    }),
    new CustomLayout({ name: "numeric", layoutRole: LayoutRole.Base, rows: SYMBOL_SURFACE }),
    new CustomLayout({ name: "arabic", suppress: [LayoutFacet.Variants] }),
  ],
});
kb.addCustomLayout(new CustomLayout({ name: "ja-kana", locales: ["ja"] }));
```

The generated interface reads `layoutRole?: LayoutRole | PropertyBindingInfo | \`{${string}}\`` and `suppress?: LayoutFacet[] | PropertyBindingInfo | \`{${string}}\``—`astGenerationHelper.js:431-435`maps a dotted`X[]`to`createArrayTypeNode`over a named import and`:437-439`maps a dotted scalar to a named import, the same path that already yields`import { MobileKeyboard } from "ui5/kiosk/library"`at`KioskKeyboard.gen.d.ts:3`.

**Plain HTML + JS** (the webc twin's first declarative extension surface — all four of today's properties are markup-invisible):

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<kiosk-keyboard id="kb" accent-variants controls="user,pin">
  <kiosk-keyboard-custom-layout slot="customLayouts" name="ja-kana" locales="ja"></kiosk-keyboard-custom-layout>
  <kiosk-keyboard-custom-layout slot="customLayouts" name="numeric" layout-role="Base"></kiosk-keyboard-custom-layout>
  <kiosk-keyboard-custom-layout slot="customLayouts" name="arabic" suppress="Variants"></kiosk-keyboard-custom-layout>
</kiosk-keyboard>

<script type="module">
  // The house accent set is a host property, not a slotted element.
  document.getElementById("kb").defaultVariants = { a: ["ä", "å"], z: ["ź", "ż"] };
</script>
```

**Zero-JS HTML, by shipping a layout as its own element module** (the `TableSelectionMulti` model):

```ts
import CustomLayout from "kiosk-keyboard-webc/CustomLayout";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";

@customElement({ tag: "acme-pl-warehouse-layout" })
class PlWarehouseCustomLayout extends CustomLayout {
  name = "pl-warehouse";
  locales = "pl,pl-PL";
  keycapLang = "pl";
  rows = PL_ROWS;
  variants = PL_VARIANTS;
  middleware = createWarehouseMiddleware;
}
PlWarehouseCustomLayout.define();
```

```html
<kiosk-keyboard accent-variants>
  <acme-pl-warehouse-layout slot="customLayouts"></acme-pl-warehouse-layout>
</kiosk-keyboard>
```

The subclass keeps `isKioskKeyboardCustomLayout` and `toSpec()`, so the duck-typed host accepts it unchanged.

**React 19:**

```jsx
import "kiosk-keyboard-webc/bundle";

function Keyboard() {
  const pl = useRef(null);
  useEffect(() => {
    if (!pl.current) return;
    pl.current.rows = PL_ROWS;
    pl.current.variants = PL_VARIANTS;
    pl.current.middleware = createWarehouseMiddleware;
  }, []);
  return (
    <kiosk-keyboard accent-variants="" controls="user,pin">
      <kiosk-keyboard-custom-layout
        ref={pl}
        slot="customLayouts"
        name="pl-warehouse"
        locales="pl,pl-PL"
        keycap-lang="pl"
      />
      <kiosk-keyboard-custom-layout slot="customLayouts" name="ja-kana" locales="ja" />
      <kiosk-keyboard-custom-layout slot="customLayouts" name="numeric" layout-role="Base" />
    </kiosk-keyboard>
  );
}
```

**Vue 3** — `markRaw` on the object/function values, or the middleware factory's identity changes on every re-wrap and `_syncMiddlewareToFold`'s identity comparison misfires:

```vue
<script setup>
import { markRaw } from "vue";
const plRows = markRaw(PL_ROWS),
  plVariants = markRaw(PL_VARIANTS),
  plMw = markRaw(createWarehouseMiddleware);
</script>
<template>
  <kiosk-keyboard accent-variants controls="user,pin">
    <kiosk-keyboard-custom-layout
      slot="customLayouts"
      name="pl-warehouse"
      locales="pl,pl-PL"
      keycap-lang="pl"
      :rows.prop="plRows"
      :variants.prop="plVariants"
      :middleware.prop="plMw"
    />
    <kiosk-keyboard-custom-layout slot="customLayouts" name="arabic" suppress="Variants" />
  </kiosk-keyboard>
</template>
```

**Angular** (`CUSTOM_ELEMENTS_SCHEMA`): `<kiosk-keyboard-custom-layout slot="customLayouts" name="pl-warehouse" locales="pl,pl-PL" [rows]="plRows" [variants]="plVariants" [middleware]="plMw">`.

## Semantics

## 1. The fold — `custom-layout-fold.ts` (new byte-compared pair)

`packages/kiosk-keyboard/src/internal/custom-layout-fold.ts` ↔ `packages/kiosk-keyboard-webc/src/core/custom-layout-fold.ts`.

**The import list, stated exactly** — an earlier revision said "and nothing else", which its own `CustomLayoutFold` interface contradicted:

```ts
import { mergeVariantTables } from "./latin-variants";
import type { InstanceVariants, VariantOverlay, VariantTable } from "./latin-variants";
import type { InstanceLayoutMeta, LayoutMeta } from "./layout-meta";
import type { InstanceLayouts, InstanceLocaleLayouts } from "./layout-registry";
import type { InstanceMiddleware } from "./middleware-registry";
import type { CompositionMiddleware, CustomLayoutSpec, LayoutDefinition } from "../types";
```

Only `mergeVariantTables` is a **value** import; everything else is `import type` and is erased at compile time. That distinction is what makes the allow-list coherent. The reasons to keep `layout-registry` and `middleware-registry` out of the leaf tier are both runtime reasons — `normalizeLowerString` logs (`layout-registry.ts:61-71`), and `middleware-registry` pulls the 8.9 KB Hangul composer in through its `BUILTIN_FACTORIES` value bindings — and neither survives type erasure. `isBuiltIn` is still injected by the host, because that one is a genuine value dependency.

The framework-free property is unchanged and still load-bearing: zero `Log.` / `console.` in this module, because all nine current `CORE_MODULES` contain zero logging and `normalize()` in the drift checker cannot reconcile kiosk's `Log.warning` with webc's `console.warn`.

```ts
/** The facets a custom layout can discard the inherited value of. */
export const SUPPRESSIBLE_FACETS = ["Variants", "Middleware"] as const;
export type SuppressibleFacet = (typeof SUPPRESSIBLE_FACETS)[number];

/** The lookup maps a control resolves through, folded from its custom layouts. */
export interface CustomLayoutFold {
  readonly layouts?: InstanceLayouts;
  readonly layoutMeta?: InstanceLayoutMeta;
  readonly localeLayouts?: InstanceLocaleLayouts;
  readonly middleware?: InstanceMiddleware;
  readonly variants?: InstanceVariants;
  readonly diagnostics: readonly LayoutDiagnostic[];
}

/** The fold of no custom layouts. Shared, so a control with none allocates nothing. */
export const EMPTY_FOLD: CustomLayoutFold = Object.freeze({ diagnostics: Object.freeze([]) });
```

Every map is `undefined` rather than an empty `Map` when nothing was declared — the repo's settled derived-cache convention, and what keeps `resolveVariantTable`'s `if (!instanceVariants) return builtIn` fast path and its identity guarantee (`latin-variants.qunit.ts:187` asserts `strictEqual(..., LATIN_DIACRITIC_VARIANTS)`).

```ts
export function foldCustomLayouts(
  specs: readonly CustomLayoutSpec[],
  isBuiltIn: (name: string) => boolean,
): CustomLayoutFold {
  if (specs.length === 0) return EMPTY_FOLD;

  const layouts = new Map<string, LayoutDefinition>();
  const meta = new Map<string, LayoutMeta>();
  const localeLayouts = new Map<string, string>();
  const middleware = new Map<string, (() => CompositionMiddleware) | null>();
  const variants = new Map<string, VariantOverlay>();
  const diagnostics: LayoutDiagnostic[] = [];
  const rowsDeclared = new Set<string>();
  const middlewareDeclared = new Set<string>();
  const localeOwner = new Map<string, string>();
  const addressed = new Set<string>();

  for (const spec of specs) {
    const name = spec.name.trim().toLowerCase();
    const facets = readSuppress(spec.suppress, name, diagnostics);

    if (!name) {
      diagnostics.push({ code: "empty-name", layout: "" });
      continue;
    }
    addressed.add(name);

    if (spec.rows !== undefined) {
      // `rowsDeclared` records that a `rows` was present, not that it was accepted. A
      // rejected `rows` therefore reports `invalid-rows` alone: recording only the valid
      // branch would let the second pass add `unknown-target` for the same fault, two
      // warnings for one mistake.
      if (rowsDeclared.has(name)) diagnostics.push({ code: "duplicate-rows", layout: name });
      rowsDeclared.add(name);
      if (!isValidLayoutDefinition(spec.rows)) diagnostics.push({ code: "invalid-rows", layout: name });
      else layouts.set(name, spec.rows);
    }

    const lang = typeof spec.keycapLang === "string" ? spec.keycapLang.trim() : "";
    const patch: LayoutMeta = {
      ...(lang && { lang }),
      ...(typeof spec.secondary === "boolean" && { secondary: spec.secondary }),
    };
    if (Object.keys(patch).length > 0) meta.set(name, { ...meta.get(name), ...patch });

    for (const raw of spec.locales ?? []) {
      const tag = raw.trim().toLowerCase();
      if (!tag) {
        diagnostics.push({ code: "invalid-locale", layout: name });
        continue;
      }
      const owner = localeOwner.get(tag);
      if (owner !== undefined && owner !== name) {
        diagnostics.push({ code: "duplicate-locale", layout: owner, other: name, value: tag });
      }
      localeOwner.set(tag, name);
      localeLayouts.set(tag, name);
    }

    if (facets.has("Middleware")) middleware.set(name, null);
    if (spec.middleware !== undefined) {
      if (typeof spec.middleware !== "function") diagnostics.push({ code: "invalid-middleware", layout: name });
      else {
        if (middlewareDeclared.has(name)) diagnostics.push({ code: "duplicate-middleware", layout: name });
        middlewareDeclared.add(name);
        middleware.set(name, spec.middleware);
      }
    }

    const table = readVariants(spec.variants, name, diagnostics);
    const overlay = foldVariantOverlay(variants.get(name), facets.has("Variants"), table);
    if (overlay !== undefined) variants.set(name, overlay);
  }

  // Resolvability is a property of the complete list: an overlay may precede the custom layout
  // that declares its rows.
  for (const name of addressed) {
    if (!rowsDeclared.has(name) && !isBuiltIn(name)) diagnostics.push({ code: "unknown-target", layout: name });
  }

  return {
    ...(layouts.size > 0 && { layouts }),
    ...(meta.size > 0 && { layoutMeta: meta }),
    ...(localeLayouts.size > 0 && { localeLayouts }),
    ...(middleware.size > 0 && { middleware }),
    ...(variants.size > 0 && { variants }),
    diagnostics,
  };
}
```

The fold knows nothing about a defaults tier. Under D6 the house table is the host property `defaultVariants`, read straight off the control and handed to `resolveVariantTable` as its third argument, so it never enters the aggregation, never needs a reserved name, and never needs a diagnostic to police fields that would be meaningless on it. `foldCustomLayouts` therefore takes and returns only per-layout data.

`isValidLayoutDefinition` and `isValidVariantTable` move here from the two host classes. That is a real drift fix, not tidying: they are semantically identical but **textually different** today — kiosk `KioskKeyboard.ts:1245` `typeof key?.value === "string" && key.value` vs webc `:1372` `key && typeof (key as KeyDefinition).value === "string" && (key as KeyDefinition).value` — two spellings of one predicate in the unguarded host tier. The host still uses `isValidVariantTable` on its own `defaultVariants` before passing it down.

## 2. Resolution order, per facet

| facet        | across custom layouts with the same name                                                                                                 | across tiers                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `rows`       | last declaration wins; a custom layout that declares none leaves the previous standing                                                   | named → built-in (`layout-registry.ts:95`, unchanged)                             |
| `lang`       | last declaration wins, per attribute                                                                                                     | named → built-in (`layout-meta.ts:78-84`, unchanged)                              |
| `secondary`  | last declaration wins, per attribute                                                                                                     | named → built-in                                                                  |
| `locales`    | additive union; per prefix, last wins                                                                                                    | instance index → `BUILTIN_LOCALE_LAYOUT_MAP` (`layout-registry.ts:79`, unchanged) |
| `middleware` | last declaration wins                                                                                                                    | named → built-in                                                                  |
| `variants`   | additive per base letter (`mergeVariantTables`); `[]` deletes a letter                                                                   | built-in → `*` → named, each merged                                               |
| `suppress`   | resets the accumulator for that facet at this custom layout's position; a value the same custom layout declares then layers onto nothing | applies at the custom layout's own tier                                           |

Three different rules is not sloppiness — the code already has three (`layout-registry.ts:95` shadow, `layout-meta.ts:83` per-attribute merge, `latin-variants.ts:76-84` per-letter merge) and no design can flatten them without breaking shipped behaviour. Ordering is aggregation index on kiosk, DOM order on webc. Keys are `name.trim().toLowerCase()`, mirroring the storage normalisation at `KioskKeyboard.ts:1196` and the lookup normalisation at `latin-variants.ts:96`, `middleware-registry.ts:34`, `layout-registry.ts:66`.

**Duplicate `name` is legal and is the overlay mechanism.** Duplicating a _facet_ across two custom layouts for one name is reported (`duplicate-rows`, `duplicate-middleware`, `duplicate-locale`) and the later one wins.

**One forced semantic change, to be documented and tested:** `_readLayoutInput` (kiosk `:1215-1225`, webc `:1342-1352`) today rejects a whole entry when `rows` is malformed, discarding that entry's `lang` and `secondary` with it. Under a per-facet fold that is inexpressible: a bad `rows` drops only `rows` (`invalid-rows`) and the custom layout's other facets still apply.

## 3. The tri-states (DEF-5), all three solved

The rule, stated once: **when a facet's value space is a closed set of strings, the tri-state is a member of that set; when the value is an object or a function, the value space cannot host a sentinel and the opt-out moves to the shared `suppress` list.**

UI5 has no `null`-carries-meaning idiom for control properties at all. `ManagedObject.prototype.validateProperty` collapses a top-level `null` to `getDefaultValue()` unconditionally and type-independently, **before** `isValid` runs (`ManagedObject.js:1611-1614`), so no custom `DataType` can opt out. Every first-party tri-state is instead a named sentinel member: `TextDirection.Inherit` (`sap.ui.core/1.136.18/src/sap/ui/core/library.js:1748-1751`), `TitleLevel.Auto` (`:1764-1770`), `ValueState.None`, `ImeMode.Auto`, `TextAlign.Initial`, `BarDesign.Auto`, `ToolbarDesign.Auto`, the five `Flex*.Inherit`, `IconTabDensityMode.Inherit`, `Priority.None`, `GrowingMode.None` — 14+ instances across `sap.m`, `sap.ui.core`, `sap.ui.mdc`.

| lost tri-state         | new spelling                                     | resolved value                                  |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------- |
| (c) `secondary: false` | `layoutRole="Base"` (vs `Inherit` / `Secondary`) | `CustomLayoutSpec.secondary = false`            |
| (a) `variants: null`   | `suppress="Variants"`                            | `VariantOverlay { replace: true, table: null }` |
| (b) `middleware: null` | `suppress="Middleware"`                          | `InstanceMiddleware` entry of `null`            |

The load-bearing insight: **the tri-state never had to survive on the Element property.** It only has to survive into the fold's output, which is plain `Map`s that hold `null` perfectly well. The Element surface needs only a _spelling_ for "declared null"; `suppress` is one and `layoutRole` is the other.

Consequences:

- **`internal/layout-meta.ts` needs zero code changes.** `resolveLayoutMeta` (`:78-84`) already spreads `{...builtIn, ...instance}` — an absent key inherits, a present `false` overrides — and `isSecondaryLayout` (`:88`) already compares `=== true`. Only its doc block at `:61-66` and `:75-76` is refreshed (`instanceLayouts` → `customLayouts`; the "`variants` is not resolved here" sentence must name the new tier). Comments are stripped by `normalize()` in the drift checker, but mirror both files anyway.
- The `.has()`-first tri-state-Map hazard disappears from `InstanceVariants` (values become non-null records) and is introduced deliberately in `InstanceMiddleware`, where it is read with `.has()`.

**Rejected alternatives, each verified rather than asserted:**

- `isPropertyInitial` (`ManagedObject.js:1662-1664`) works and is typed (`sap.ui.core.d.ts:13379`), but it is `@ui5-protected Do not call from applications` (`:13375`); `applySettings` calls the mutator for every own key with no `undefined` guard (`ManagedObject.js:1326-1333`), so an ordinary `{...spec, secondary: undefined}` spread silently means "declared"; `resetProperty` is the only route back and is also protected; and there is no webc counterpart.
- `defaultValue: undefined` genuinely works for a boolean (`ManagedObjectMetadata.js:200`, `Property.getDefaultValue` `:245-257`; one first-party instance, `sap/ui/core/util/ExportType.js:53`) but cannot rescue (a) or (b), and `astGenerationHelper.js:409-411` maps `"boolean"` to a bare keyword, so the committed `.gen.d.ts` would type `getLayoutRole(): boolean` — an invisible lie in a file CLAUDE.md requires be readable before any build.
- `type: "object"` preserves nested nulls (the collapse is non-recursive; `byValue` cloning at `:1641` keeps them) but `DataType.js:302-311`'s `parseValue` is `JSON.parse`, so it is unauthorable in XML — it fails D1, which is the whole point.
- Three per-facet mode enums fail D4: a fifth facet costs a fourth enum plus a fourth property.
- Two booleans (`noVariants` + `noMiddleware`) are what CLAUDE.md §2 argues for at two call sites. **D4 overrides §2 here**, and the tension is reported rather than buried: `suppress` absorbs a third facet as one enum member, two booleans become three properties.

## 4. D3 — the defaults tier re-layering

### 4a. What HEAD does, and what breaks

`latin-variants.ts:104-105` (read at HEAD):

```ts
if (instanceVariants.has(name)) entry = instanceVariants.get(name) ?? null;
else if (instanceVariants.has(WILDCARD_LAYOUT)) entry = instanceVariants.get(WILDCARD_LAYOUT) ?? null;
```

An either/or: a named entry silently discards the entire `"*"` tier — its table and its `[]` suppressions. Documented at kiosk `README.md:366,626` and webc `README.md:302,512`.

Under D6 the tier survives as the host property `defaultVariants` and the reserved name does not. `WILDCARD_LAYOUT` is **deleted outright** rather than relocated: no module needs the constant once the defaults tier is a property, which is the structural point of the re-layering — the resolver stops knowing that a magic layout name exists, and so does the fold.

**One shipped capability is deliberately not carried over.** `instanceVariants: { "*": null }` currently opts every layout without a named entry out of variants entirely. That behaviour is an artefact of the `else if` above, not a designed feature: the README's opt-out ladder (`README.md:618-624`) documents three recipes — one base letter, one layout, one key — and none of them is global. Its meaning could not survive the re-layering wherever the tier lived, since `null` is no longer an either/or short-circuit. Global opt-out remains `accentVariants="false"`, which is the default (`KioskKeyboard.ts:311-315`). Per D7, `defaultVariants` therefore has no suppression spelling at all.

**The existing coverage is vacuous and must be called out by name.** `latin-variants.qunit.ts:192` and `latin-variants.test.ts:170` are both titled _"an explicit entry beats the wildcard"_ but pass `["qwerty", null]` — the one case the re-layering does **not** change. They stay green through the whole change. Rename them to what they assert and add the cases that do change.

### 4b. The replacement, in `latin-variants.ts` (both twins, one commit — byte-compared)

```ts
/**
 * One tier's contribution to a layout's long-press variants. `replace` discards
 * everything the tiers below contributed before `table` is merged, which is what
 * suppressing the facet on the declaring custom layout means; a `table` of `null` contributes
 * nothing, so `{ replace: true, table: null }` opts the layout out.
 */
export interface VariantOverlay {
  readonly replace: boolean;
  readonly table: VariantTable | null;
}

/** Per-instance, per-layout variant overlays, keyed by normalized layout name. */
export type InstanceVariants = ReadonlyMap<string, VariantOverlay>;

/** Applies one tier to the table resolved so far. An absent tier is transparent. */
function applyVariantOverlay(base: VariantTable | null, overlay: VariantOverlay | undefined): VariantTable | null {
  if (overlay === undefined) return base;
  const under = overlay.replace ? null : base;
  return overlay.table === null ? null : mergeVariantTables(under, overlay.table);
}

/**
 * The variant table in effect for `layoutName`, layered built-in -> defaults -> named.
 * Each tier merges onto the one below per base letter, so a letter mapped to `[]` drops
 * that letter and a table for one layout extends the tier below instead of replacing it.
 * A named tier that suppresses discards everything below it; one that suppresses and then
 * declares a table stands that table alone. With no tier declared the built-in stands:
 * the layout's own declared table, or the Latin table when it declares none. A `null`
 * result fills no variants, so the keys carry no long-press affordance.
 */
export function resolveVariantTable(
  layoutName: string,
  instanceVariants?: InstanceVariants,
  defaults?: VariantTable | null,
): VariantTable | null {
  const name = layoutName.trim().toLowerCase();
  // A declared `null` opts the layout out; an absent declaration is distinct from it
  // and leaves the Latin table in force.
  const declared = BUILTIN_LAYOUT_META.get(name)?.variants;
  let table: VariantTable | null = declared === undefined ? LATIN_DIACRITIC_VARIANTS : declared;
  // The defaults tier only ever adds, so it is a plain table rather than an overlay:
  // per D7 it cannot suppress, and there is no spelling for it to do so.
  if (defaults != null) table = mergeVariantTables(table, defaults);
  if (instanceVariants !== undefined) table = applyVariantOverlay(table, instanceVariants.get(name));
  return table;
}
```

`mergeVariantTables` is promoted to `export` (the fold uses it). `WILDCARD_LAYOUT` (`latin-variants.ts:65`) is **deleted**, not moved: under D6 no module needs it.

The third parameter is a `VariantTable | null`, not a `VariantOverlay`, and that asymmetry is deliberate. Only the named tier can suppress (D7), so only the named tier needs the `{replace, table}` shape. The identity guarantee survives exactly as before: with no defaults and no named entry, `resolveVariantTable("qwerty")` returns `LATIN_DIACRITIC_VARIANTS` by reference, which `latin-variants.qunit.ts:187` asserts with `strictEqual`.

The child-level accumulator, in `custom-layout-fold.ts`:

```ts
/** Folds one custom layout's variant declaration onto the overlay accumulated so far. */
function foldVariantOverlay(
  acc: VariantOverlay | undefined,
  suppressed: boolean,
  table: VariantTable | undefined,
): VariantOverlay | undefined {
  if (!suppressed && table === undefined) return acc;
  const replace = suppressed || (acc?.replace ?? false);
  if (table === undefined) return { replace, table: null };
  const under = suppressed || acc === undefined ? null : acc.table;
  return { replace, table: mergeVariantTables(under, table) };
}
```

### 4c. Behaviour delta — the exact new test expectations

With `DEF = {z:["ź"], q:["ǫ"]}` supplied as `defaultVariants` and `NAMED = {a:["ą"]}` on a `CustomLayout`. "HEAD" spells the defaults tier `instanceVariants: {"*": DEF}`:

| case                                                | HEAD               | new                               |             |
| --------------------------------------------------- | ------------------ | --------------------------------- | ----------- |
| no tier, `qwerty`                                   | `LATIN` (identity) | same                              | —           |
| no tier, `arabic`/`ja-kana`/`ko-hangul`/`ja-romaji` | `null`             | same                              | —           |
| defaults only, latin layout                         | latin + q,z        | same                              | —           |
| defaults only, `arabic`                             | `{q,z}`            | same                              | —           |
| named only, that layout                             | latin + a          | same                              | —           |
| named only, another layout                          | `LATIN` (identity) | same                              | —           |
| **defaults + named, the named layout**              | defaults **lost**  | both tiers compose                | **CHANGED** |
| defaults + named, an unnamed layout                 | latin + q,z        | same                              | —           |
| `{s: []}` in defaults alone                         | `s` dropped        | same                              | —           |
| `{s: []}` at named alone                            | `s` dropped        | same                              | —           |
| **`{s: []}` in defaults, table at named**           | `s` **survives**   | `s` dropped **and** named applied | **CHANGED** |
| defaults table, named `suppress="Variants"`         | `null`             | `null`                            | —           |
| named table on `arabic`                             | `{a}`              | same                              | —           |
| defaults table on `arabic`                          | `{a}`              | same                              | —           |
| **defaults + named on `arabic`**                    | `{a}`              | `{a,q,z}`                         | **CHANGED** |
| named `suppress="Variants"` + `variants`            | inexpressible      | `{a}` alone                       | **NEW**     |
| defaults table, named suppress + table              | inexpressible      | `{a}` alone                       | **NEW**     |
| **`{"*": null}` (global opt-out)**                  | `null` everywhere  | **retired** — see 4a              | **REMOVED** |

Three rows the earlier revision carried are gone with the reserved name, because the defaults tier can no longer suppress (D7): "`*` suppressed alone", "`*` suppressed, table at named", and "`*` suppress + table". The last row above records the one shipped behaviour that is deliberately not carried over; it needs a line in both READMEs, not just a test.

Invariants preserved: identity when no tier applies (`strictEqual(..., LATIN_DIACRITIC_VARIANTS)`), and the null-prototype guard for a `__proto__`-keyed table.

## 5. The defaults tier — `defaultVariants`

Per D6 the tier is a property on the host, not a member of the collection. Kiosk, alongside `accentVariants` in `KioskKeyboard.metadata.properties`:

```ts
      /**
       * Long-press variants applied under every layout, merged per base letter beneath
       * anything a `customLayouts` entry declares for that layout, so a house accent set
       * extends the built-in table rather than replacing it and a base letter mapped to
       * `[]` drops that letter everywhere. Base letters must be lowercase. Effective only
       * while `accentVariants` is set.
       *
       * Read by object identity: assign a new object to change the table.
       */
      defaultVariants: { type: "ui5.kiosk.VariantOverrideTable", defaultValue: null, group: "Behavior" },
```

webc, on `KioskKeyboard`:

```ts
  /**
   * Long-press variants applied under every layout, merged per base letter beneath
   * anything a slotted `<kiosk-keyboard-custom-layout>` declares.
   *
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object }) defaultVariants: VariantTable | null = null;
```

Read sites pass it straight through: `resolveVariantTable(name, fold.variants, this.getDefaultVariants())` on kiosk and `…, this.defaultVariants)` on webc. It is validated with the same `isValidVariantTable` the fold uses, and an invalid table reports `invalid-variants` with `layout: ""` — the one diagnostic the host raises on its own behalf rather than the fold's.

**What this decision buys, stated against what it costs.** It removes the `if (name === WILDCARD_LAYOUT)` partition from the fold, the `wildcard-field` diagnostic and its six-field rejection list, the `WILDCARD_LAYOUT` constant, the `defaultVariants` field on `CustomLayoutFold`, and the `VariantOverlay` shape from the defaults tier's parameter. It costs one top-level property per twin, and it forfeits the free apply-to-all case a future facet would have inherited from the `*` branch — that facet would need its own property. D3 scopes this tier to variants and the earlier revision had already refused to admit middleware to it, so the forfeited generality was never going to be exercised.

## 6. `middleware-registry.ts` (both twins, hand-mirrored)

```ts
export type InstanceMiddleware = ReadonlyMap<string, (() => CompositionMiddleware) | null>;

export function getMiddlewareFactory(
  layout: string,
  instanceFactories?: InstanceMiddleware,
): (() => CompositionMiddleware) | null {
  const name = layout.trim().toLowerCase();
  // A declared `null` disables composition for the layout; an absent entry is distinct
  // from it and leaves the built-in factory in force.
  if (instanceFactories?.has(name)) return instanceFactories.get(name) ?? null;
  return BUILTIN_FACTORIES.get(name) ?? null;
}
```

Read at HEAD, `:34` is `return instanceFactories?.get(name) ?? BUILTIN_FACTORIES.get(name) ?? null;` — with `??`, a stored `null` falls straight through to the built-in, so the disable is unrepresentable. This is the missed call site the chosen design deferred on a "nobody has asked" basis: `BUILTIN_FACTORIES` (`:16-19`) arms `ja-kana` and `ko-hangul`, and a consumer overlaying `ko-hangul` with direct-typing rows has no way today to turn the Hangul composer off. `middleware-registry` is in `UNCHECKED_CORE_TWINS` (`check-twin-drift.mjs:108-116`), so a one-sided landing is **not** caught by CI.

## 7. `layout-registry.ts` — no logic change

Verified at HEAD: `getRegisteredLayout` (`:95`) is `instanceLayouts?.get(name) ?? BUILTIN_LAYOUTS.get(name)`, so a rows-less custom layout already falls through to the built-in; `resolveLocaleMappedLayout` (`:79-81`) already accepts a locale pointed at a built-in via `instanceLayouts?.has(mapped) || BUILTIN_LAYOUTS.has(mapped)`. Only the doc comments at `:20-23` and `:41` change (they name `instanceLayouts` / `instanceLocaleLayouts`). The brief's complaint that an unresolvable locale mapping returns `null` without a word is fully covered by the fold's `unknown-target`, which fires once at authoring time instead of silently on every resolution.

## 8. D4 — the fifth concern

Say the fifth concern is a per-layout keycap label map. It folds in as a **facet**, not a surface:

1. `types.ts` — one field on `CustomLayoutSpec` (both twins).
2. `CustomLayout` — one property + one line in `toSpec()` (both twins).
3. `custom-layout-fold.ts` — one branch in the loop, one field on `CustomLayoutFold`, and, if it is disableable, one member on `SUPPRESSIBLE_FACETS` **and** one on `library.ts`'s `LayoutFacet` enum.
4. One resolver consuming it, in the `(name, instanceMap, defaults?)` shape.

Zero new top-level surface on the control for the per-layout case, and zero new diagnostic codes (`duplicate-*` and `unknown-suppress` fall out of the generic machinery). The **apply-to-all** case is the one thing D6 makes non-free: it would need its own host property alongside `defaultVariants`, rather than riding along on a wildcard entry. That is the priced cost of D6, recorded here so a future facet's author meets it in the D4 section rather than discovering it.

## Lifecycle

## A. Kiosk — construction, invalidation, first render, cloning, destroy

### A.1 Fields and `init()`

Delete the five `_instance*Map` fields (`KioskKeyboard.ts:158-167`) and their five `init()` resets (`:873-877`). Add:

```ts
  /** Custom layouts folded into the lookup maps; `null` while the cache is cold or stale. */
  private _fold!: CustomLayoutFold | null;
  /** The elements the cached fold was built from, compared element-wise on read. */
  private _foldChildren!: CustomLayout[];
  /** Diagnostics already reported for the current configuration, keyed by content. */
  private _reportedDiagnostics!: Set<string>;
  /** The factory that produced `_middleware`, so a re-resolve onto the same factory is a no-op. */
  private _middlewareFactory!: (() => CompositionMiddleware) | null;
```

`init()` seeds `this._fold = null; this._foldChildren = []; this._reportedDiagnostics = new Set(); this._middlewareFactory = null;` in the existing `:872-878` block — **constructing** the `Set`, not clearing one.

**Definite assignment with no initialiser is mandatory here, not stylistic.** The root `tsconfig.json` sets `"target": "ES2022"` and never sets `useDefineForClassFields`, so it defaults to `true`; the kiosk package does not override it, while webc does (`packages/kiosk-keyboard-webc/tsconfig.json:9` `"useDefineForClassFields": false`). `ManagedObject`'s constructor calls `that.init()` (`ManagedObject.js:530`) and `that.applySettings(mSettings, oScope)` (`:534`) — **both inside `super()`** — so a derived field initialiser runs _after_ both. Two concrete failures if initialisers are used:

- `init()`'s `this._reportedDiagnostics` is still `undefined`, so seeding it throws a `TypeError` on every `new KioskKeyboard()`;
- the single fold built between the `applySettings` phases (§A.4) is overwritten by `_fold = null` running afterwards, silently destroying the "exactly one fold, one diagnostic pass" property §A.5 rests on and test 9 asserts.

Every field at `KioskKeyboard.ts:149-173` already follows this form. The one exception, `_layoutSource` at `:148`, is benign only by coincidence: its initialiser writes `"external"`, which is also its construction-time value. Do not read it as licence.

### A.2 The lazy memoized fold — the DEF-3 and DEF-4 fix

```ts
  /**
   * The folded view of `customLayouts`: the lookup maps every resolution path reads,
   * rebuilt only when the aggregation or one of its custom layouts actually changed.
   *
   * Two signals, one per axis. Structure - adds, inserts, removals, reorders - is read
   * off the element list here, because `removeAggregation` (ManagedObject.js:2434),
   * `removeAllAggregation` (:2495) and `destroyAggregation` (:2587) invalidate without
   * naming a child. Content - a property write inside a parented custom layout - arrives as
   * `invalidate(customLayout)` and drops the cache there.
   *
   * Never call this from `invalidate`.
   */
  private _getFold(): CustomLayoutFold {
    const children = this.getCustomLayouts();
    if (this._fold && this._sameChildren(children)) return this._fold;
    this._foldChildren = children;
    this._fold = foldCustomLayouts(
      children.map((child) => child.toSpec()),
      registryIsBuiltInLayout,
    );
    this._reportDiagnostics(this._fold.diagnostics);
    return this._fold;
  }

  private _sameChildren(children: readonly CustomLayout[]): boolean {
    const cached = this._foldChildren;
    if (children.length !== cached.length) return false;
    for (let i = 0; i < children.length; i++) {
      if (children[i] !== cached[i]) return false;
    }
    return true;
  }

  /** Logs what the fold rejected, once per distinct complaint per configuration. */
  private _reportDiagnostics(diagnostics: readonly LayoutDiagnostic[]): void {
    if (diagnostics.length === 0) {
      // Everything resolves: a fault re-introduced later is reported again.
      this._reportedDiagnostics.clear();
      return;
    }
    for (const d of diagnostics) {
      const key = `${d.code}|${d.layout}|${d.facet ?? ""}|${d.other ?? ""}|${d.value ?? ""}`;
      if (this._reportedDiagnostics.has(key)) continue;
      this._reportedDiagnostics.add(key);
      Log.warning(describeDiagnostic(d, KIOSK_DIAGNOSTIC_VOCABULARY), undefined, "ui5.kiosk.KioskKeyboard");
    }
  }
```

`getCustomLayouts()` returns `aChildren.slice()` (ManagedObject `getAggregation`), a fresh array each call, so storing it directly as the snapshot is safe and needs no defensive copy.

```ts
  /**
   * A property write inside a parented custom layout reaches this control as an invalidation
   * naming that element (ManagedObject.js:1511 -> :2623 -> Control.js:348). Dropping the
   * cache is the entire reaction; the fold is rebuilt on the next read.
   */
  override invalidate(oOrigin?: ManagedObject): void {
    if (oOrigin instanceof CustomLayout) this._fold = null;
    super.invalidate(oOrigin);
  }
```

The flag is dropped **before** `super`, because `Control.prototype.invalidate` returns early during `_bOnBeforeRenderingPhase` (`Control.js:353-355`). `oOrigin` is a real, typed parameter on `Control` (`Control.js:348`; `@openui5/types` `sap.ui.core.d.ts:22029`) — DEF-4's "mis-states the base signature" complaint applies only to the Element-level zero-arg form at `:13330`, which this never touches. `invalidate` is a hand-written prototype method, not a generated accessor, so `super.invalidate(oOrigin)` is safe from the DEF-2 mechanism. `instanceof` is cycle-free: `KioskKeyboard.ts` already value-imports `CustomLayout` for `defaultClass`, and `CustomLayout.ts` imports nothing from `KioskKeyboard.ts`. Subclassed custom layouts (the "ship a custom layout as a named unit" pattern) satisfy it.

`ManagedObjectObserver` was considered and is unusable: `@private @ui5-restricted sap.ui.model.base` (`ManagedObjectObserver.js:111-114`) and typed as `undefined` in `@openui5/types` (`sap.ui.core.d.ts:88124`).

**Rejected alternative (blast-radius's `_markFoldDirty` reached from five mutator overrides plus a `setProperty` override on the child).** Deciding reason: it re-incurs the DEF-2 hazard surface for five accessors it has to hand-reimplement, and it reaches into the parent by duck-typing `(this.getParent() as {_markFoldDirty?}).._markFoldDirty?.()`. The two-axis cache needs neither and additionally closes the removal-path hole that an origin-only dirty flag leaves open.

### A.3 DEF-2 — dissolved, with the escape hatch recorded and not shipped

Under the lazy fold the kiosk twin overrides **zero** aggregation mutators, so `super.addCustomLayout` is never written. `ManagedObjectMetadata.js:1782-1794` installs every accessor through `function add(name, fn, info) { if (!proto[name]) { ... } }`, and `generateAccessors()` runs from the metadata constructor (`:912`) on first `getMetadata()` — long after a TS class body populated the prototype. A TS method of the same name permanently blocks the generated one and `super.addX` resolves to `undefined`. The repo already lives with this at `KioskKeyboard.ts:1141` (`return this.setProperty("instanceLayouts", value) as this;`, never `super.setInstanceLayouts`).

For the record only — **this code does not ship** — the correct form if an override ever becomes unavoidable is the generic low-level API, transcribed from `Aggregation.prototype.generate` (`ManagedObjectMetadata.js:332`):

```ts
addCustomLayout(p: CustomLayout): this { this.addAggregation("customLayouts", p); return this; }
insertCustomLayout(p: CustomLayout, i: number): this { this.insertAggregation("customLayouts", p, i); return this; }
removeCustomLayout(v: number | string | CustomLayout): CustomLayout | null { return this.removeAggregation("customLayouts", v) as CustomLayout | null; }
removeAllCustomLayouts(): CustomLayout[] { return this.removeAllAggregation("customLayouts") as CustomLayout[]; }
destroyCustomLayouts(): this { this.destroyAggregation("customLayouts"); return this; }
```

### A.4 `applySettings` — two-phase, canon-backed

Replaces `KioskKeyboard.ts:786-814` including the false doc comment at `:796-799` (`ManagedObject.js:534` calls `applySettings` unconditionally).

```ts
  /**
   * Applies `customLayouts` in its own pass before everything else, then injects the
   * locale-detected layout when the caller named none.
   *
   * The custom layouts go through `super.applySettings` rather than being read out of
   * `mSettings`: that is what makes an object literal and a `CustomLayout` instance the
   * same input. A literal is constructed through the aggregation's `defaultClass`
   * (ManagedObject.js:1076) and each value passes `validateProperty` exactly once, so
   * `locales: "pl"` widens to `["pl"]` (ManagedObject.js:1621-1624) whichever form the
   * caller wrote. By the time `layout` is applied, `setLayout`'s registry validation and
   * the locale default below both resolve through the complete set of custom layouts.
   *
   * A `customLayouts` bound to a model populates asynchronously and therefore does not
   * contribute to the layout chosen here.
   */
  override applySettings(mSettings: Record<string, unknown>, oScope?: object): this {
    const { customLayouts, ...rest } = mSettings ?? {};
    if (customLayouts !== undefined) {
      super.applySettings({ customLayouts }, oScope);
    }
    const fold = this._getFold();
    // `layout` first so the locale default is the first setting applied; the spread
    // overwrites its value, not its position, when the caller named a layout.
    return super.applySettings(
      { layout: registryGetLocaleLayout(fold.localeLayouts, fold.layouts), ...rest },
      oScope,
    );
  }
```

Canon: `sap.ui.table.Table.prototype.applySettings` (`sap.ui.table/1.136.0/src/sap/ui/table/Table.js:1107-1136`), which applies the `plugins` **aggregation** in an early `Control.prototype.applySettings.call` and runs `initDefaultRowMode(this)` between the passes. SAP mutates the caller's object with `delete`; this repo must not — the destructure keeps `mSettings` untouched, preserving the intent already documented at `:807-808`.

**Rejected alternatives:** (i) normalizing inside a pre-read — constructing throwaway `CustomLayout`s duplicates any author-supplied `id` and throws on the second construction, while hand-mirroring the coercions means keeping a normalizer permanently in sync with `validateProperty`'s `string[]` widening, `null` collapse and array `slice`; (ii) resolving the locale default lazily at `onBeforeRendering` — `new KioskKeyboard({customLayouts:[…]}).getLayout()` would return `"qwerty"` until first paint and the unregistered-layout warning would move to a render that may never happen; (iii) a read-only pre-read — the divergence is a coercion problem, not a diagnostics problem.

**Behaviour delta: none observable.** `getLayout()` immediately after `new` still returns the locale-derived name; the unregistered-layout warning still fires at construction; `instance-overrides.qunit.ts:198/217/236/260/366/385` and `KioskKeyboard-layout.qunit.ts:912/935/952/1154` keep their answers. Residual cost, stated: the view settings-preprocessor (`ManagedObject.js:1274`, installed by `View.js:562`) runs twice when phase 1 fires. It is idempotent, and SAP ships the identical exposure. Phase 1 is skipped entirely when no `customLayouts` is given, so the no-custom-layout path is a single `super` call.

### A.5 DEF-3 — dead by arithmetic

Constructing `new KioskKeyboard({ layout, customLayouts: [a, b, c] })`: phase 1 runs `addAllToAggregation` (`ManagedObject.js:1251-1259`), whose three mutator calls only null the cache; the fold then runs **once**, over the complete list, between the phases; every later read is a cache hit. **One fold, one diagnostic pass** — against N folds and N prefix-list diagnostic passes, including the spurious `unknown-target` that the flagship diagnostic would otherwise emit on correct input when an overlay precedes the custom layout declaring its rows.

The ordering constraint the semantics cluster hands over is therefore satisfied structurally, not by the dedupe set: `_reportDiagnostics` is called only from `_getFold`, and `_getFold` is never called from a mutator. The dedupe key-set additionally makes repeated emission idempotent for the incremental case (`kb.addCustomLayout(a)` then a render then `kb.addCustomLayout(b)`), where a transient `unknown-target` is genuine and clears itself when `b` lands.

### A.6 Read sites

`_performLayoutSwitch` (`:1071`) → `this._getFold().layouts`; `_resolvedLayoutName` (`:1908`); `_getLayoutLang` (`:1918`) → `.layoutMeta`; `_getResolvedLayout` (`:1924`, `:1941`) → `.layouts` / `resolveVariantTable(name, fold.variants, this.getDefaultVariants())`; `_tryCompositionMiddleware` (`:2286`) → `.middleware`; `_warnDisarmedVariants` (`:1949-1957`) → `fold.variants !== undefined || this.getDefaultVariants() !== null`. The public statics (`KioskKeyboard.isSecondaryLayout` `:643`, `.getLocaleLayout` `:735`, `.getRegisteredLayout` `:748`) pass no instance tier and are unchanged.

### A.7 IME safety — an invariant, not a rule scattered across setters

```ts
  private _tryCompositionMiddleware(keyValue: string): boolean {
    if (!this._keyAffectsComposition(keyValue)) return false;
    const factory = registryGetMiddlewareFactory(this._resolvedLayoutName(), this._getFold().middleware);
    if (factory !== this._middlewareFactory) {
      this._endComposition();          // commits, then drops - never reset()
      this._middlewareFactory = factory;
    }
    if (!this._middleware && factory) this._middleware = factory();
    // ...unchanged
  }
```

`_endComposition` (`:1119-1124`) already commits. Both fields start `null`, so the first key on `ko-hangul` takes the change branch with a no-op `_endComposition`. Null `_middlewareFactory` alongside every existing `this._middleware = null` site.

**The invariant:** the only code that can end a composition is (a) `_applyLayout` on a real layout switch (`:1106`), (b) a target switch (`:1410`), (c) a keyboardType switch (`:1510`), (d) the public `reset()` (`:1352-1358`), which deliberately **discards** rather than commits, and (e) this factory-identity check at the next composition-affecting key. An earlier revision listed only three paths and cited `:1343-1345`, which is inside `reset()` rather than at either switch. Nothing runs from `invalidate`, from a setter, or from the fold. `customLayout.setKeycapLang("pl")` nulls a cache and returns; a half-typed Hangul syllable is untouched.

### A.8 Cloning

`ManagedObject.prototype.clone` (`:4520 ff.`) iterates `mProperties` first and `mAggregations` second, so `layout` precedes `customLayouts` in the clone's settings — a single-phase `applySettings` would run `setLayout("pl-warehouse")` against an empty fold and warn and bail. The two-phase form makes `kb.clone()` correct, and it must be a regression test: it is the one path that exercises the hoist without any consumer writing settings in that order. Each custom layout is deep-cloned with a derived id and its property _values_ shared by reference — strictly better than HEAD, where two clones share one mutable `Record`. The `BindingInfo.UI5ObjectMarker` stamp applied to non-frozen object property values during clone is a `Symbol` (`BindingInfo.js:20`), so it is invisible to `Object.entries` and cannot corrupt variant-table validation.

### A.9 Destroy

`exit` needs nothing: `ManagedObject.prototype.destroy` (`:2964`) calls `this.exit()` at `:2999-3001` and only then runs the aggregation-destroy loop at `:3009-3011`. `KioskKeyboard.ts:936-970` changes only where the deleted fields were referenced.

### A.10 One exotic hazard the aggregation newly exposes

`BindingInfo.extract` treats any object with `oValue.path != undefined || oValue.parts` as a binding info (`BindingInfo.js:185`), and `applySettings`'s PROPERTY branch calls `extractBindingInfo` (`ManagedObject.js:1330-1336`). Today the exposed object is the outer `{layoutName: table}` map, so only a _layout named_ `path` collides; as a top-level `CustomLayout#variants` the table itself is inspected, so a variant table with a base letter `path` or `parts` is mis-read. `rows` is an array and is unaffected. Document the `ui5object: true` escape hatch (`BindingInfo.js:181-184`) in the `variants` doc-block.

---

## B. webc — construction, invalidation, first render, cloning, destroy

### B.1 DEF-1 — the fatal defect, and the fix

Confirmed in the installed `@ui5/webcomponents-base@2.22.0`: `_invalidate` returns early on `this._suppressInvalidation` (`UI5Element.js:69-74`), which is initialised `true` in the constructor (`:121`) and first cleared inside `_render`'s `finally` **after** `onBeforeRendering()` (`:669-684`). `connectedCallback` runs `_startObservingDOMChildren()` (`:213`) then `await this._processChildren()` (`:214`) **before** `renderImmediately(this)` (`:222`), and `_processChildren` writes `this._state[propertyName]` directly (`:346-349`) with its own `_invalidate` (`:397-410`) inside the suppression window. A prior probe under the package's own vitest/jsdom logged exactly this: `onBeforeRendering` fired with `custom layouts.length === 1` and `onInvalidation` was never called.

**The array is populated before first render; only the notification is missing.** So the fold is **lazy and memoized, read on demand** — never assembled from `onInvalidation`. That is also the first-party idiom: `ui5-table` declares no `onInvalidation` at all and reads `this.features` lazily at `Table.js:171, 191, 197, 203, 217`.

`onEnterDOM` runs at `:225`, **after** `renderImmediately` at `:222`, so `KioskKeyboard.ts:867-872`'s `_baseLayout = this.layout || this._localeLayout()` seed is evaluated during the first render. With an eager fold a `<kiosk-keyboard-custom-layout locales="pl">` present at connect time is ignored on first paint; with the lazy fold it is honoured with no pre-population hack.

```ts
  private _foldCache: CustomLayoutFold = EMPTY_FOLD;
  private _foldKey: readonly ICustomLayout[] = [];
  private _foldEpoch = 0;
  private _foldedEpoch = -1;
  private _reportedDiagnostics = new Set<string>();
  private _middlewareFactory: (() => CompositionMiddleware) | null = null;

  /**
   * The lookup maps the resolution pipeline reads, folded from the `customLayouts` slot.
   *
   * Read on demand rather than assembled on invalidation: `_invalidate` is suppressed
   * until the first render completes (UI5Element.js:69-74, :121, :681) while
   * `_processChildren` populates the slot before it (:211-215), so an
   * invalidation-driven fold would be empty for the whole first frame. The slot array
   * itself is populated by then, so reading it here is correct from the first
   * `onBeforeRendering` onward. This is the lazy read `ui5-table` performs on
   * `this.features` (Table.js:171, 191, 197, 203, 217), which declares no
   * `onInvalidation` of its own.
   *
   * Rebuilt only when the slotted elements change identity or one of them reports a
   * property change, so diagnostics are emitted once per real change, not once per read.
   */
  private _getFold(): CustomLayoutFold {
    const children = this.customLayouts;
    if (this._foldedEpoch === this._foldEpoch && sameElements(this._foldKey, children)) return this._foldCache;
    this._foldKey = children;
    this._foldedEpoch = this._foldEpoch;

    const specs: CustomLayoutSpec[] = [];
    for (const child of children) {
      if (isCustomLayout(child)) specs.push(child.toSpec());
      else console.warn(`[kiosk-keyboard] Ignoring <${child.localName}> in the customLayouts slot: not a <kiosk-keyboard-custom-layout>.`);
    }
    this._foldCache = foldCustomLayouts(specs, isBuiltInLayout);
    this._reportDiagnostics(this._foldCache.diagnostics);
    return this._foldCache;
  }
```

with, at module scope:

```ts
const sameElements = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((el, i) => el === b[i]);
```

`_updateSlots` assigns a **new array** to `this._state[propertyName]` on every run (`:348-349`, `_clearSlot` `:437`), so the element-wise comparison catches every structural change including the initial population, with no notification. A child _property_ write does not touch the array, so `_foldEpoch` covers it:

```ts
  override onInvalidation(changeInfo: ChangeInfo): void {
    // ...existing layout / keyboardType / fKeyMode / mobileKeyboard / docked / autoShow branches
    // UI5Element.js:465-477 folds a child property change into a slot change, so this one
    // branch covers a custom layout being added, removed, reordered or edited. It never fires for
    // the slot content present at connect time, which is why the fold above is lazy.
    if (changeInfo.type === "slot" && changeInfo.name === "customLayouts") this._foldEpoch++;
  }
```

`invalidateOnChildChange: { properties: true, slots: false }` — both keys are required by `SlotInvalidation` (`UI5ElementMetadata.d.ts:2-5`); `{ properties: true }` alone does not compile (`TS2322: Property 'slots' is missing`). The listener is attached only `if (instanceOfUI5Element(child) && slotData.invalidateOnChildChange)` (`UI5Element.js:385-388`), which is why the child **must** extend `UI5Element`.

`managedSlots` is unavoidable and is newly incurred: both `slot-strict.js:50` and the deprecated `slot.js:51` set `ctor.metadata.managedSlots = true`, and without it `getInitialState` never seeds `_state` (`UI5ElementMetadata.js:17-26`), `_generateAccessors` never defines the accessor (`UI5Element.js:1017-1021`) and `connectedCallback` never calls `_processChildren` (`:209-215`). Measured cost (jsdom, warm, 2.22.0): 0.271 ms `appendChild`→first `onBeforeRendering` with zero children, 1.017 ms with one defined child. The real change is that first render stops being synchronous inside `appendChild`, not latency.

### B.2 DEF-3 and DEF-4 have no webc analogue

DEF-3 is an artefact of `ManagedObject.applySettings` → `addAllToAggregation` calling the mutator per child; the webc slot fires one coalesced `_invalidate` per `_processChildren` run (`UI5Element.js:397-410`). DEF-4 is an `invalidate()` override, which does not exist on `UI5Element`. Nothing to engineer here.

### B.3 IME safety — the same invariant, the same shape

Delete the `instanceMiddleware` `onInvalidation` branch at `KioskKeyboard.ts:1019-1027` (it unconditionally `reset()`s, documented at `types.ts:247` as clearing without committing — user-visible loss of a half-typed Hangul syllable). Replace with the kiosk shape, at the next composition-affecting key:

```ts
  private _ensureMiddleware(): CompositionMiddleware | null {
    const factory = getMiddlewareFactory(this._resolvedLayoutName(), this._getFold().middleware);
    if (factory !== this._middlewareFactory) {
      if (this._middleware) {
        // Commit the buffer to the target; `reset()` would drop a half-typed syllable.
        this._middleware.commit();
        this._middleware = null;
      }
      this._middlewareFactory = factory;
    }
    if (!this._middleware && factory) this._middleware = factory();
    return this._middleware;
  }
```

**Picked the kiosk shape over the webc-lifecycle cluster's `_syncMiddlewareToFold()` in `onInvalidation`.** Deciding reason: symmetry across the twins for a behaviour that lives in the hand-synced host tier and would otherwise silently diverge, plus it never commits a preedit from inside an invalidation or a render pass. Null `_middlewareFactory` alongside every existing `this._middleware = null` site. There are **six** at HEAD (`:685`, `:908`, `:983`, `:1035`, `:1175`, `:1797`), not the three an earlier revision listed, and five survive the Stage 4 deletion of the `instanceMiddleware` branch at `:1029-1037`. Note `:907` is `this._middleware.reset();` — the assignment is `:908`.

### B.4 Rendering, cloning, destroy

`KioskKeyboardTemplate.tsx` renders no `<slot name="customLayouts">`: custom layouts are configuration and are never projected, mirroring `TableTemplate.js` omitting `features`. `CustomLayout` has no renderer/template/styles, so `_needsShadowDOM()` (`UI5Element.js:951-953`) is false and it attaches no shadow root — no CSS, no layout impact, no visual-regression surface. There is no clone concept; `cloneNode(true)` on the host copies the light-DOM children as ordinary elements. Teardown is the platform's: removing a custom layout fires `_updateSlots`, the array identity changes, the next read refolds.

---

## C. The six defects, and where each is fixed

| defect                                                          | fix                                                                                                                                                                                                                | file:line of the fix                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **DEF-1** webc fold empty for the first render                  | fold is lazy and memoized, read on demand from `_getFold()`; `onInvalidation` only bumps an epoch                                                                                                                  | webc `KioskKeyboard.ts` `_getFold()` / `onInvalidation` (§B.1) |
| **DEF-2** `super.addCustomLayout` does not exist                | zero mutator overrides on kiosk; all nine accessors stay generated. Escape-hatch form recorded, not shipped                                                                                                        | §A.3                                                           |
| **DEF-3** N folds, N diagnostic passes over partial lists       | lazy fold + two-phase `applySettings`: exactly one fold over the complete list between the phases; `_reportDiagnostics` is reachable only from `_getFold`                                                          | §A.2, §A.4, §A.5                                               |
| **DEF-4** re-fold from `invalidate` can tear down an IME buffer | `invalidate(oOrigin)` body is one statement — drop a cache; the composition invariant moves to the next composition-affecting key. Base signature taken from `Control.js:348`, not the Element-level zero-arg form | §A.2, §A.7                                                     |
| **DEF-5** three lost tri-states                                 | `layoutRole` sentinel enum for (c); shared `suppress: LayoutFacet[]` for (a) and (b); `middleware-registry` widened to `\| null` with a `.has()` read                                                              | semantics §3, §6                                               |
| **DEF-6** a second generated interface unguarded                | staged CI gate over a glob (`git add -A` then `git diff --cached`), probed — a plain `git diff` passes an untracked `*.gen.d.ts`                                                                                   | migration §5                                                   |

## Module layout

## New modules

| path                                                          | tier                     | notes                                                                                 |
| ------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `packages/kiosk-keyboard/src/CustomLayout.ts`                 | kiosk host (framework)   | `sap.ui.core.Element` subclass. Top level, **not** `internal/`                        |
| `packages/kiosk-keyboard/src/CustomLayout.gen.d.ts`           | generated, **committed** | see below                                                                             |
| `packages/kiosk-keyboard/src/internal/custom-layout-fold.ts`  | **byte-compared**        | new `CORE_MODULES` entry                                                              |
| `packages/kiosk-keyboard-webc/src/CustomLayout.ts`            | webc host (framework)    | `UI5Element` subclass, tag `kiosk-keyboard-custom-layout`. Top level, **not** `core/` |
| `packages/kiosk-keyboard-webc/src/core/custom-layout-fold.ts` | **byte-compared**        | twin of the above                                                                     |

Both `CustomLayout.ts` files sit at `src/` top level deliberately: `tools/check-twin-drift.mjs:261-262` reconciles the intersection of `internal/` and `core/` basenames, and the completeness guard fails on any same-named pair not listed in `CORE_MODULES` or `UNCHECKED_CORE_TWINS`. Two framework-specific classes must never be paired.

`custom-layout-fold.ts` contents: `CustomLayoutSpec` re-export surface, `CustomLayoutFold`, `EMPTY_FOLD`, `foldCustomLayouts`, `foldVariantOverlay`, `SUPPRESSIBLE_FACETS` / `SuppressibleFacet`, `LayoutDiagnostic` + `DiagnosticCode`, `DiagnosticVocabulary`, `describeDiagnostic`, and the two validators `isValidLayoutDefinition` / `isValidVariantTable` moved off the host classes. No `WILDCARD_LAYOUT`: under D6 the constant is deleted, not relocated.

Import graph, verified framework-free — the exact list is in semantics §1. Only `mergeVariantTables` (from `latin-variants`, which itself value-imports `BUILTIN_LAYOUT_META` from `layout-meta`) is a value import; the type imports from `layout-registry`, `middleware-registry` and `types` are erased and carry no runtime edge. That is what keeps `normalizeLowerString`'s logging (`layout-registry.ts:61-71`) and the 8.9 KB Hangul composer behind `middleware-registry`'s `BUILTIN_FACTORIES` out of the leaf tier. Zero `Log.` / `console.` — mandatory, because all nine current `CORE_MODULES` contain zero logging and `normalize()` in the drift checker cannot reconcile kiosk's `Log.warning` with webc's `console.warn`.

## Deleted modules

| path                                                                                        | reason                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/kiosk-keyboard-webc/src/core/memo-map-view.ts`                                    | its only consumers were the five `MemoMapView`s at `KioskKeyboard.ts:1290-1332` |
| `packages/kiosk-keyboard-webc/test/unit/memo-map-view.test.ts`                              | 6 tests / 64 lines, deleted with the module                                     |
| `packages/kiosk-keyboard-webc/test/unit/zz-probe-managedslots.test.ts`, `zz-probe2.test.ts` | stray untracked probe files inside vitest's include glob (Stage 0)              |

`memo-map-view` is webc-only, so it is absent from `sharedCoreNames` (`check-twin-drift.mjs:261`) and its removal moves neither `EXPECTED_PAIR_COUNT` nor `reconcile()`. Also delete its line at `docs/kiosk-webc/ARCHITECTURE.md:36`.

## Changed modules

### Byte-compared tier (`CORE_MODULES`) — **must land in both twins in one commit or CI is red**

| module                      | change                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `latin-variants.ts`         | `VariantOverlay` added; `InstanceVariants` retyped to `ReadonlyMap<string, VariantOverlay>`; `mergeVariantTables` exported; `applyVariantOverlay` added; `resolveVariantTable` gains a third `defaults?: VariantTable \| null` parameter and becomes a three-tier apply; `WILDCARD_LAYOUT` (`:65`) **deleted outright** — under D6 nothing needs it |
| `layout-meta.ts`            | **doc only** — `:61-66` (`InstanceLayoutMeta` provenance names `instanceLayouts`) and `:75-76` (the "`variants` is not resolved here … that tier is `instanceVariants`" sentence). No code change: `resolveLayoutMeta` `:78-84` and `isSecondaryLayout` `:87-89` already carry the (c) tri-state correctly                                          |
| **`custom-layout-fold.ts`** | new                                                                                                                                                                                                                                                                                                                                                 |

`WILDCARD_LAYOUT`'s other usages today are `latin-variants.ts:104` and the four test sites (`latin-variants.qunit.ts:4,180,195`; `latin-variants.test.ts:5,163,172`) — nothing else in `src/`. Deleting it is therefore a Stage 1 edit with no forwarding address; what it did semantically is absorbed by the host lifting its `"*"` entry into the new third argument (see Stage 1).

### Unchecked tier (`UNCHECKED_CORE_TWINS`, still 7 entries) — hand-mirrored, CI will not catch a one-sided landing

| module                   | change                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `middleware-registry.ts` | `InstanceMiddleware` widened to `ReadonlyMap<string, (() => CompositionMiddleware) \| null>`; `getMiddlewareFactory` `:30-35` switches from the `??` chain to a `.has()` read; the `:13-14` doc comment names `customLayouts` |
| `layout-registry.ts`     | **comments and parameter doc only** (`:20-23`, `:41`). Signatures and logic unchanged                                                                                                                                         |

### Host tier

`packages/kiosk-keyboard/src/KioskKeyboard.ts` — delete the four property blocks (`:387-460`), the four setters (`:1131-1183`), `_readInstanceLayouts` (`:1195-1217`), `_readLayoutInput` (`:1227-1237`), `_toStringMap` (`:1250-1260`), `_toMiddlewareMap` (`:1262-1272`), `_toVariantMap` (`:1274-1292`), `_isValidLayoutDefinition`, `_isValidVariantTable`, the five cache fields (`:158-167`), the five `init()` resets (`:873-877`), and the four now-orphaned imports. Add the `customLayouts` aggregation, `_fold`/`_foldChildren`/`_reportedDiagnostics`/`_middlewareFactory`, `_getFold`/`_sameChildren`/`_reportDiagnostics`, the `invalidate` override, the two-phase `applySettings`. Rewrite the six read sites and the JSDoc examples at `:185, 299, 628-629, 668, 676, 726, 742`.

`packages/kiosk-keyboard-webc/src/KioskKeyboard.ts` — delete the four `@property({type: Object})` blocks (`:514-592`), the `MemoMapView` block (`:1300-1342`) and its import (`:39`), `_readLayoutInput` (`:1344-1362`), the `instanceMiddleware` `onInvalidation` branch (`:1029-1037` — note it **commits** at HEAD, since `5a5f2c2f`; an earlier revision described it as unconditionally `reset()`ing). Add the `@slot`, the lazy fold, `_reportDiagnostics`, `_ensureMiddleware`, the `customLayouts` `onInvalidation` branch, the `defaultVariants` property, and the **missing registry check on the `layout` property** at `:962-965` (Stage 0). Rewrite reads at `:1228-1229, 1249, 1261, 1265, 1279, 1668, 1784, 1805` and JSDoc at `:272, 278, 387, 501, 634`.

`packages/kiosk-keyboard/src/library.ts` — see surface §1.
Both `types.ts` — delete `LayoutSpec` / `LayoutInput`, add `CustomLayoutSpec`; webc `types.ts` additionally houses `LayoutRole` / `LayoutFacet`.
`packages/kiosk-keyboard-webc/src/bundle.esm.ts` — add `export { default as CustomLayout } from "./CustomLayout.js";` and `CustomLayoutSpec` / `LayoutRole` / `LayoutFacet` to the type re-exports; remove `LayoutSpec` / `LayoutInput` (`:16-17`).
`packages/kiosk-keyboard-webc/package.json` — add `"./dist/CustomLayout.js"` to `sideEffects` and a `"./CustomLayout"` entry to `exports`.

## `tools/check-twin-drift.mjs`

```js
const CORE_MODULES = [
  "grapheme", "auto-repeat", "shift-state", "composition-utils", "key-token",
  "key-action-meta", "layout-constraint", "latin-variants", "layout-meta",
  "custom-layout-fold",
];
...
const EXPECTED_PAIR_COUNT = 28;   // LAYOUTS(18) + CORE_MODULES(10)
```

Both edits in one commit — the guard at `:220-223` fails if they disagree, and `reconcile()` at `:262` fails if `custom-layout-fold` exists in both directories without being listed. Also refresh the stale header comment at `:26-29` ("registry is static-class-based in webc" — false at HEAD; both are module-scoped `const Map`s). Baseline verified green right now: 27 pairs in sync, style-twin 40/44, dom-contract in parity.

## Generated artifacts

| artifact                                                                                                      | status                                                                        | requirement                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts`                                                          | committed, `linguist-generated`                                               | regenerate; the 47 occurrences at `:5-8, 96, 155-215, 510, 531, 682-852` collapse to the aggregation's nine accessors                                                                                                                                                                                                                                                                               |
| `packages/kiosk-keyboard/src/CustomLayout.gen.d.ts`                                                           | **new, committed**                                                            | CLAUDE.md's deciding principle applies verbatim — the class uses `$CustomLayoutSettings` without importing it, so the IDE and a bare `tsc --noEmit` need it on disk, and kiosk ships `src/` to npm. `.gitattributes` already globs it. Do **not** import it as `"./CustomLayout.gen"`: these are ambient `declare module "./X"` augmentations (`KioskKeyboard.gen.d.ts:13`), not importable modules |
| `packages/kiosk-keyboard-webc/src/generated/**`                                                               | gitignored (`.gitignore:10`)                                                  | no action; `CustomLayout` needs no i18n or theme entry                                                                                                                                                                                                                                                                                                                                              |
| `packages/kiosk-keyboard-webc/dist/custom-elements.json` (+ `vscode.html-custom-data.json`, `web-types.json`) | gitignored (`.gitignore:2`), asserted present by `check-package-smoke.mjs:40` | must newly report `slots: [{name: "customLayouts"}]` on `kiosk-keyboard` and a second declaration for `kiosk-keyboard-custom-layout`                                                                                                                                                                                                                                                                |

**There is no DEF-6 analogue on the webc twin** — every generated manifest is gitignored, matching CLAUDE.md's asymmetry rule.

**Do not claim zero phantom attributes.** `node_modules/@ui5/webcomponents-tools/lib/cem/custom-elements-manifest.config.mjs:241-259` pushes an `attributes` entry for every member gated only on `member.privacy === "public"` (`:196`), and `_ui5noAttribute` (recorded at `:238`) is never consulted. The four phantom `instance-*` attributes are replaced by three on the child (`rows`, `variants`, `middleware`): **4 → 3, not 4 → 0**. That count holds only because the `isKioskKeyboardCustomLayout` marker is annotated `@private` (§4); left public it would become a fourth phantom attribute and the change would be 4 → 4. `defaultVariants` on the host adds a fifth — it is `type: Object`, so `hasAttribute` gives it no real attribute, but the CEM lists it anyway.

The config file is **not in this repo** — it ships inside the pinned `@ui5/webcomponents-tools` dependency and is invoked from `package-scripts.mjs:32`. "Land the generator-side suppression" would therefore mean carrying a `patch-package` patch against a dependency, a cost worth naming before choosing it. The cheaper option is to update `docs/kiosk-webc/CUSTOM-ELEMENTS-MANIFEST.md:69-71` to name the new set.

## Diagnostics

## Design

The catalogue lives in the **byte-compared** `custom-layout-fold.ts` as structured data plus a vocabulary-injected formatter, so the two twins cannot disagree on facts while still spelling their own surface names. It contains zero `Log.` / `console.`. There is no free-text `detail` field — everything is structured, so `describeDiagnostic` is total.

```ts
export type DiagnosticCode =
  | "empty-name"
  | "invalid-rows"
  | "invalid-variants"
  | "invalid-middleware"
  | "invalid-locale"
  | "unknown-target"
  | "unknown-suppress"
  | "duplicate-rows"
  | "duplicate-middleware"
  | "duplicate-locale";

export interface LayoutDiagnostic {
  readonly code: DiagnosticCode;
  /** The layout the offending custom layout names; "" for an unnamed one, or for the host's own `defaultVariants`. */
  readonly layout: string;
  /** The facet involved, for the codes that report one. */
  readonly facet?: string;
  /** The other layout in a collision. */
  readonly other?: string;
  /** The offending token or value. */
  readonly value?: string;
}

/** How one twin spells the surface names a message has to quote. */
export interface DiagnosticVocabulary {
  /** `"accentVariants"` / `"accent-variants"`. */
  readonly accentVariants: string;
  /** `"customLayouts aggregation"` / `"customLayouts slot"`. */
  readonly customLayouts: string;
  /** `"<kiosk:CustomLayout>"` / `"<kiosk-keyboard-custom-layout>"`. */
  readonly customLayout: string;
  /** Every built-in layout name, for the "did you mean" tail of `unknown-target`. */
  readonly builtInLayouts: readonly string[];
}

export function describeDiagnostic(d: LayoutDiagnostic, vocab: DiagnosticVocabulary): string;
```

## The catalogue — 10 fold codes

| code                   | trigger                                                                                                                             | message                                                                                                                     | remediation                                                                                                                                                                                        | today                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `empty-name`           | a custom layout whose `name` is empty after trim                                                                                    | _"A {custom layout} in the {customLayouts} declares no name, so nothing resolves it."_                                      | _"Set `name` to the layout it declares or overlays, or `\*` to address every layout."_                                                                                                             | silent                                                                                                                                |
| `invalid-rows`         | `rows` declared, fails `isValidLayoutDefinition`                                                                                    | _"`rows` on the {custom layout} for \"X\" is not a layout definition."_                                                     | _"Expected a non-empty array of non-empty rows where every key has a non-empty string `value`. The custom layout's other facets still apply."_                                                     | warns **and drops the whole entry** (`:1134`)                                                                                         |
| `invalid-variants`     | `variants` declared, fails `isValidVariantTable`                                                                                    | _"`variants` on the {custom layout} for \"X\" is not a variant table."_                                                     | _"Expected a non-empty object mapping lowercase base letters to arrays of non-empty glyph strings; an empty array suppresses that letter. To opt \"X\" out entirely use `suppress=\"Variants\"`."_ | warns (`:1268`)                                                                                                                       |
| `invalid-middleware`   | `middleware` declared, not a function                                                                                               | _"`middleware` on the {custom layout} for \"X\" is not a function."_                                                        | _"Supply a factory returning a `CompositionMiddleware`; to disable the built-in use `suppress=\"Middleware\"`."_                                                                                   | **silent** (`_toMiddlewareMap:1254` skips non-functions)                                                                              |
| `invalid-locale`       | a `locales` token empty after trim                                                                                                  | _"`locales` on the {custom layout} for \"X\" contains an empty entry."_                                                     | _"Every entry must be a non-empty BCP-47 prefix, e.g. `pl` or `de-at`."_                                                                                                                           | **silent** (`:1243-1244`)                                                                                                             |
| `unknown-target`       | a custom layout declares facets but no `rows`, and `name` is neither a built-in nor declared with `rows` by any other custom layout | _"The {custom layout} for \"X\" declares facets but no `rows`, and no layout of that name exists, so nothing resolves it."_ | _"Add `rows`, or correct the name — the built-ins are: {builtInLayouts}."_                                                                                                                         | **silent** — the flagship                                                                                                             |
| `unknown-suppress`     | a `suppress` token outside `SUPPRESSIBLE_FACETS`                                                                                    | _"`suppress` on the {custom layout} for \"X\" names \"Y\", which is not a suppressible facet."_                             | _"Valid facets are: Variants, Middleware. Rows cannot be suppressed: a custom layout shadows a built-in layout, it never removes it."_                                                             | n/a                                                                                                                                   |
| `duplicate-rows`       | two custom layouts declare `rows` for one name                                                                                      | _"Two custom layouts declare `rows` for \"X\"; the later one wins."_                                                        | _"Remove one, or give them different names."_                                                                                                                                                      | unrepresentable                                                                                                                       |
| `duplicate-middleware` | two custom layouts declare `middleware` for one name                                                                                | same shape                                                                                                                  | same                                                                                                                                                                                               | unrepresentable                                                                                                                       |
| `duplicate-locale`     | two custom layouts claim one BCP-47 prefix for different layouts                                                                    | _"Both \"X\" and \"Y\" claim the locale \"pl\"; \"Y\" wins."_                                                               | _"Remove the prefix from one of them."_                                                                                                                                                            | unrepresentable (an object literal cannot repeat a key) — **a hazard the N-custom-layout fold introduces, so this code is mandatory** |

`unknown-target` subsumes and improves on `resolveLocaleMappedLayout` returning `null` without a word (`layout-registry.ts:79-84`): it fires once at authoring time instead of silently on every locale resolution, which is why `layout-registry.ts` needs no code change.

**Four codes from the grafted catalogue are deliberately absent, and each absence is a win:**

- `unknown-field` (and its edit-distance suggester) is **structurally impossible** under child elements: `ManagedObject.applySettings` throws on an unknown setting, and a custom element ignores an unknown attribute.
- `shadowed-wildcard` existed only to report the D3 defect; the re-layering retires it — the tiers now compose.
- `wildcard-field` existed only to report per-layout facets declared on a `*` entry. D6 removes the entry, so the fields it policed are unreachable: the defaults tier is a property that carries a table and nothing else, and a `CustomLayout` named `*` is now just a layout named `*` — resolvable or not like any other, and reported by `unknown-target` if not.
- `variants-reopt` described suppress-then-redeclare, which under `suppress` as an ordered operator is the intended idiom, not an error.

## Host-side codes (not fold diagnostics)

- **`disarmed-variants`** survives where it is (kiosk `:1949-1957`, webc `:1293-1298`) with its own once-per-instance boolean: its trigger reads `accentVariants`, a host property the fold cannot see. Trigger re-expressed as `fold.variants !== undefined || this.getDefaultVariants() !== null`. It gains the ability to name the offending custom layouts.
- **`invalid-variants` on `defaultVariants`** is raised by the host, not the fold, because the value never enters the aggregation. Same code, same message, `layout: ""`.
- **`unregistered-layout`** exists on kiosk (`:1071-1077`) and is **missing entirely on webc** (`:962-965` has no registry check). Adding it is Stage 0, independent of this design. The structured vocabulary also fixes an existing divergence: kiosk's message names the remedy, webc's does not.

## Where diagnostics are logged, and the emission cap

The fold is pure and returns every diagnostic; each host owns the cap.

- kiosk: `Log.warning(describeDiagnostic(d, KIOSK_DIAGNOSTIC_VOCABULARY), undefined, "ui5.kiosk.KioskKeyboard")`, from `_reportDiagnostics`, called only from `_getFold()`.
- webc: `console.warn("[kiosk-keyboard] " + describeDiagnostic(d, WEBC_DIAGNOSTIC_VOCABULARY))`, same shape.

Cap: **once per control per distinct diagnostic**, keyed `${code}|${layout}|${facet}|${other}|${value}` in a per-instance `Set`, cleared when a fold produces zero diagnostics so a fault re-introduced later is reported again. This generalises the existing `_warnDisarmedVariants` boolean.

**Ordering is guaranteed structurally, not by the cap.** `unknown-target` and the `duplicate-*` codes are second-pass properties of the _complete_ custom layout list: an overlay custom layout added before the custom layout that declares its rows would produce a spurious `unknown-target`, and a dedupe set cannot retract a warning. The kiosk two-phase `applySettings` folds exactly once, after phase 1 has added every child; the webc lazy fold reads the fully-populated slot array. Neither ever folds a prefix during construction. For genuinely incremental imperative authoring (`kb.addCustomLayout(a)`, render, `kb.addCustomLayout(b)`) a transient `unknown-target` is correct and clears itself when `b` lands.

## `library.ts:197-200` policy change, stated deliberately

Today's comment explains that the four record types are coarse-validated because _"ManagedObject throws when a type rejects a value, which would turn one bad entry into a broken control"_. Under the new surface a **typo in a closed enum throws**: `createArrayType.isValid` rejects any member failing the component type (`DataType.js:371-384`), `createEnumType.parseValue` yields `undefined` for an unknown XML token (`:445-447`), and `validateProperty` throws at `ManagedObject.js:1635-1638`. That is intentional and narrow — it applies to closed enum attributes (`layoutRole`, `suppress`), not to arbitrary consumer record data, and it has in-control precedent: `mobileKeyboard="Bogus"` throws today. Loud failure is the direct answer to DEF-5's silent-semantics grievance and gets its own test so the behaviour is pinned rather than accidental. On webc, where nothing can throw, `unknown-suppress` covers the same typo.

## Migration

## Blast radius (re-verified at HEAD `cc34a371`, clean tree)

**67 files / 675 occurrences** of the four names, case-insensitive: kiosk `src` 11/187, kiosk `test` 18/171, webc `src` 8/74, webc `test` 14/77, `demo-app` 3/6, `docs` 11/**71**, kiosk `README.md` 39, webc `README.md` 50. Under D2's rename **all 675 are rewrites** — the ~76 incidental `instanceLayouts`-only sites that a plain-Record design would have left alone do not survive. Per name, **case-sensitive** (these do not sum to the case-insensitive headline): `instanceLayouts` 282/51 files, `instanceVariants` 131/21, `instanceLocaleLayouts` 84/16, `instanceMiddleware` 78/23. The per-area figures and the 67-file total are exact; only `docs` and the headline were off, and the two counting modes were previously presented under one label.

`check:base` = `fmt:check → lint → lint:ui5 → typecheck → test:patches → test:lint-plugins → test:twin-drift → test:style-twin-drift → test:dom-contract → test:qunit → test:kiosk-webc → test:kiosk-webc:component → test:packages:smoke`. It does **not** include e2e or visual. Every stage below must leave it green.

**CI is not `check:base`, and the difference matters twice.** `.github/workflows/ci.yml` re-implements the chain rather than calling it: it uses the stricter `lint:ci --deny-warnings` (`:46`) and **omits `test:packages:smoke` entirely**. Everything that step gates is therefore local-only — the webc `build`, the CEM analyzer that throws (§4), and `check-package-smoke.mjs`'s `requiredFiles` check that Stage 3 extends with `src/CustomLayout.gen.d.ts`. Run `check:base` locally before pushing Stages 3 and 4; a green CI is not evidence.

---

## Stage 0 — HEAD bug fixes. No API change, no design commitment.

Independently valuable and independently revertable. **Three of the original nine items already landed in `5a5f2c2f`** and are struck rather than renumbered, so a reader comparing against an earlier revision can see what happened:

1. ~~Composition data-loss fix.~~ **Landed.** Both twins now compare the factory the resolved layout reads on either side of the swap and commit rather than `reset()`. Do not re-derive it; §A.7 _changes_ its timing, which is stated in "Reconciling with the fix already on `main`".
2. ~~Delete the false `applySettings` doc comment.~~ **Landed** — and it was never false in the way an earlier revision claimed. `KioskKeyboard.ts:786-798` asserts only that pre-population precedes `super.applySettings` and that `init()` runs before it; both are true (`ManagedObject.js:530` then `:534`). "`applySettings` is called unconditionally" refutes neither. What `5a5f2c2f` actually corrected was the separate claim that `ManagedObject` _skips_ `applySettings` when no settings are passed.
3. ~~`README.md:344`'s stale `object | null` claim.~~ **Landed.**
4. Add webc's missing registry check on the `layout` property (`KioskKeyboard.ts:962-965`), matching kiosk `:1071-1077`, with a regression test in `test/component/`.
5. **DEF-6 — `.github/workflows/ci.yml:57-63`** (the step is named "Verify generated interface is in sync", singular, and the path literal is `:60`). The widened-glob fix alone is insufficient: probed, an untracked `packages/kiosk-keyboard/src/ZZTest.gen.d.ts` **passes** `git diff --exit-code -- ':(glob)packages/kiosk-keyboard/src/**/*.gen.d.ts'` (exit 0), because `git diff` does not see untracked files — precisely the DEF-6 scenario. Staging first is required and does fail correctly:

```yaml
# The kiosk interfaces are committed (see CONTRIBUTING.md "Generated files in
# version control"); regenerate them and fail on drift so the silent JSDoc-strip
# class (#142/#143/#149) is a red build, not a stripped diff in a commit.
# `git add -A` first: `git diff` alone is blind to a generated file that was never
# committed, so a new *.gen.d.ts would pass an unstaged check.
- name: Verify generated interfaces are in sync
  run: |
    npm run generate -w packages/kiosk-keyboard
    git add -A -- packages/kiosk-keyboard/src
    if ! git diff --cached --exit-code -- ':(glob)packages/kiosk-keyboard/src/**/*.gen.d.ts'; then
      echo "::error::A generated interface under packages/kiosk-keyboard/src is out of sync (see diff above). Run 'npm run generate -w packages/kiosk-keyboard' and commit the result."
      exit 1
    fi
```

6. Refresh the stale twin-drift header comment at `tools/check-twin-drift.mjs:26-29`.
7. Delete the two stray untracked probe files `packages/kiosk-keyboard-webc/test/unit/zz-probe-managedslots.test.ts` and `zz-probe2.test.ts`.
8. Add `src/CustomLayout.gen.d.ts` to `tools/check-package-smoke.mjs`'s kiosk `requiredFiles` (`:25-30`) — do this in Stage 3, when the file exists.
9. **Do NOT touch `instance-property-types.tsd.ts` here.** Its polarity is correct against HEAD's metadata; it only inverts when the metadata changes.

## Stage 1 — D3: the defaults tier is re-layered. Cannot be split across packages.

`latin-variants.ts` in **both** twins (byte-compared: a one-sided landing is red). `VariantOverlay` added, `InstanceVariants` retyped, `mergeVariantTables` exported, `applyVariantOverlay` added, `resolveVariantTable` gains its third parameter.

**`WILDCARD_LAYOUT` is deleted in this stage, and the host must absorb what it did.** An earlier revision said the constant "moves to `custom-layout-fold.ts`" — a module Stage 2 creates, which would have left Stage 1 unable to compile. Under D6 it moves nowhere. At HEAD `"*"` is a _payload_ key: kiosk `_toVariantMap` (`KioskKeyboard.ts:1274-1292`) and webc `_variantsView` (`:1334-1342`) copy it verbatim into the map, and the resolver reads it at `latin-variants.ts:104`. Once the resolver stops knowing the name, each host must lift the `"*"` entry out of its own map and pass it as the third argument. That is a real host-side change in Stage 1, still entirely on the four-property API, and it is where the `{"*": null}` retirement (§4a) becomes observable.

**Tests: nine per twin, not two.** Retyping `InstanceVariants` to `ReadonlyMap<string, VariantOverlay>` stops every map-building test compiling: `latin-variants.qunit.ts:139,146,151,158,166,174,180,188,194` and `latin-variants.test.ts:123,130,135,142,149,158,163,171,179` all construct `new Map<string, VariantTable | null>`. Two more import the deleted constant (`latin-variants.qunit.ts:4`, `latin-variants.test.ts:5`). On top of that: rename `latin-variants.qunit.ts:192` / `latin-variants.test.ts:170` to what they actually assert (a `null` named entry, unchanged by the re-layering), and add the three changed cases plus the two newly-expressible ones from §4c.

Docs: kiosk `README.md:610,623,626`, webc `README.md:497,509,512`, including the `{"*": null}` retirement. The doc-only `layout-meta.ts` touch may ride with **any** stage: `normalize()` in the drift checker strips comments before comparing, so a one-sided doc change is invisible to CI. (An earlier revision claimed both that comments are stripped and that this touch must never ride with Stage 3. Only the first is true.)

Run the §7 adversarial pass (H1) before trusting this stage.

## Stage 2 — `custom-layout-fold.ts` in both packages, unwired. Cannot be split across packages.

New byte-compared pair; `CORE_MODULES` + `EXPECTED_PAIR_COUNT` 27 → 28 in one edit. `CustomLayoutSpec` added to both `types.ts` alongside the still-shipping `LayoutSpec`. Two new unit suites (`custom-layout-fold.qunit.ts`, `custom-layout-fold.test.ts`) covering document order, every per-facet rule, `suppress` at the named tier, and **every diagnostic code** — including that a rejected `rows` reports `invalid-rows` alone and never also `unknown-target`. Nothing else changes, so nothing can regress. Adversarial pass required before Stage 3 — the fold is the single point where every semantic is enforced.

## Stage 3 — kiosk cutover. Atomic within the kiosk package; webc untouched and green.

Files, exhaustively:

- **new** `src/CustomLayout.ts`; `npm run generate`; **commit both** `src/KioskKeyboard.gen.d.ts` and `src/CustomLayout.gen.d.ts`
- `src/library.ts` (enums, types, `elements`, deleted `createType`s and aliases)
- `src/KioskKeyboard.ts` (aggregation, lazy fold, `invalidate`, two-phase `applySettings`, six read sites, JSDoc at `:185, 299, 628-629, 668, 676, 726, 742`)
- `src/types.ts` (delete `LayoutSpec` / `LayoutInput`)
- `src/internal/middleware-registry.ts` (suppress support — **hand-mirror into webc in Stage 4**, CI will not catch a one-sided landing)
- `src/internal/layout-registry.ts` (comments only)
- `src/layouts/fkey-row.ts`, `fkey-row-compact.ts`, `nav-row-compact.ts` (1 JSDoc example each; comments are stripped by `normalize()` so these may diverge from the webc twins for one stage at no cost)
- **`test/qunit/instance-property-types.tsd.ts` rewritten in this same commit.** Non-negotiable: it has inverted failure polarity — its six `@ts-expect-error` directives go red when the metadata changes correctly, and `typecheck:kiosk:test` (`ci.yml:51-52`) treats an unused directive as a hard error. A partial landing cannot compile.
- `test/qunit/instance-overrides.qunit.ts` (8 modules / 33 tests / 860 lines) → **`custom-layouts.qunit.ts`**, rewritten; the four `composeLayout` tests (`:783-808`) move to their own module; register the new name in `testsuite.qunit.ts`
- `test/qunit/KioskKeyboard-layout.qunit.ts` (`:1517` `secondary: false` → `layoutRole="Base"`; `:1498` inherit-case rewritten as its negative half, kept adjacent)
- `test/qunit/KioskKeyboard-variants.qunit.ts` (`:284`), `layout-registry.qunit.ts`, `layout-meta.qunit.ts`, `middleware-registry.qunit.ts`
- the ~13 incidental suites: `KioskKeyboard-renderer-blackbox.qunit.ts` (16), `FKeys.qunit.ts` (5), `NavKeys.qunit.ts` (4), `Grapheme.qunit.ts` (4), `keyboard-type-middleware.qunit.ts` (3), `custom-keys.qunit.ts` (2), plus 1 each in `unknown-token`, `KioskKeyboard`, `KioskKeyboard-reset`, `KioskKeyboard-capslock-shiftvalue`, `KioskKeyboard-capslock-sharp-s`, `KioskKeyboard-autotype-mobile`
- `test/e2e/visual/init.js:121,127,133,138,144,215` (plain JS — object literals here work via `defaultClass`)
- **new** `test/qunit/customLayouts-xml.qunit.ts` (below)
- `tools/check-package-smoke.mjs` (`src/CustomLayout.gen.d.ts`)
- the demo-app rewrite (below)

**Demo app.** 3 files / 6 occurrences; **zero i18n keys** (`webapp/i18n/i18n.properties` is 2 lines), **zero fragments**, **zero manifest entries touching the properties** (only the name-only route `manifest.json:153-157` and target `:260-264`). `deploy-pages.yml:89` copies all of `packages/demo-app/dist/.` and `tools/trim-pages-dist.mjs` prunes only `resources/sap/*`, so all 21 routes ship including `#/kiosk/custom-layouts`.

- `webapp/view/KioskCustomLayouts.view.xml` — rewritten as the headline declarative example (see the surface section's XML snippet), plus the prose `<Text>` at `:14`
- **new** `webapp/layouts/custom-layouts.ts` — the five `LayoutDefinition` constants moved out of the controller (`:7-107`) so they can feed a `JSONModel`
- **new** `webapp/middleware/warehouse.ts` — a real `CompositionMiddleware` factory (port the emoticon one already in `packages/kiosk-keyboard-webc/test/pages/index.js:104-135`), so `middleware="Warehouse.createMiddleware"` resolves
- **new** `webapp/customLayout/PlWarehouseCustomLayout.ts` — `extends CustomLayout`, `static metadata = { library: "demo.hotkeys" }`, demonstrating the "ship a custom layout as a named unit" claim rather than asserting it
- `webapp/Component.ts` — register the `layouts>` JSONModel
- `webapp/controller/KioskCustomLayouts.controller.ts` — delete `CUSTOM_LAYOUTS` (`:121-127`), the `kb.setInstanceLayouts(...)` call (`:139`), the `LayoutInput` import (`:3`); keep `LAYOUT_DESCRIPTIONS` (`:109-119`)
- `webapp/controller/KioskProgrammatic.controller.ts` (`:3, 107-108, 119-120, 140, 152-153, 187-194`) — the aggregation removes the read-modify-write of a whole record

**Demo guardrail gap, closed in this stage.** `packages/demo-app` is covered in `check:base` by `typecheck:demo` and `lint:ui5` **only**: `flp-lifecycle.spec.ts` is in `SEPARATE_CONFIG_SPECS` (`playwright.config.ts:93,98`), `test:e2e:flp` uses a separate config and is not in CI, and no spec references `custom-layouts`. A broken aggregation name in XML would fail silently on GitHub Pages. `packages/kiosk-keyboard/test/qunit/customLayouts-xml.qunit.ts` uses `XMLView.create({ definition })` — the pattern already at `KioskKeyboard-focus.qunit.ts:317,349,428,464` — and runs inside `check:base`. It asserts: (1) a custom layout node lands in the aggregation and its rows render; (2) `locales="pl,pl-PL"` comma-splits and drives the construction-time default layout; (3) `middleware="Mw.create"` under `core:require` resolves to the actual function; (4) `suppress="Variants"` reaches the fold; (5) `layoutRole="Base"` promotes the built-in `numeric`; (6) `suppress="Varients"` throws.

## Stage 4 — webc cutover. Atomic within the webc package; kiosk green.

`src/CustomLayout.ts`; `src/types.ts` (enums, `CustomLayoutSpec`, delete `LayoutSpec`/`LayoutInput`); `src/KioskKeyboard.ts` (slot, lazy fold, `onInvalidation` branch, `_ensureMiddleware`, eight read sites); `src/core/middleware-registry.ts` (hand-mirror of Stage 3); `src/core/layout-registry.ts` (comments); **delete** `src/core/memo-map-view.ts` + `test/unit/memo-map-view.test.ts`; `bundle.esm.ts`; `package.json` (`exports`, `sideEffects`); `test/component/instance-overrides.test.ts` (2 describes / 23 `it` / 409 lines) → **`custom-layouts.test.ts`**, rewritten, with `:372` → `layout-role="Base"` and `:358` as its negative half; **new** `test/component/custom-layouts-first-paint.test.ts`; the ~10 incidental suites (`variant-popup.test.ts` 8, `kiosk-keyboard.test.ts` 7, `kiosk-keyboard-icon-label.test.ts` 4, `keyboard-type-middleware.test.ts` 3, `variant-composition-seed.test.ts` 2, plus 1 each in `variant-composition-flush.test.ts`, `test/helpers/fixtures.ts:33`, `test/helpers/seed-compose-middleware.ts:21`, `test/pages/visual.js:120`, `test/pages/key-style-demo.js:38`); `test/pages/index.js:73,140,146,155` and `index.html:431,433,533,535,548,550,553` — **simultaneously the deployed public "Raw Web Components Demo" and the `component.spec.ts:8` e2e fixture**; `test/unit/latin-variants.test.ts`, `layout-registry.test.ts`, `layout-meta.test.ts`, `middleware-registry.test.ts`; add `expect(code).toContain("kiosk-keyboard-custom-layout")` to `test/unit/bundle-tree-shaking.test.ts`; rebuild and verify `dist/custom-elements.json`.

**Why 3 and 4 can genuinely land separately:** `latin-variants.ts` and `layout-meta.ts` are byte-compared, so any edit to them must be a both-package commit — which is exactly why D3 is pulled out into Stage 1 and `custom-layout-fold.ts` into Stage 2. With those pre-landed, Stages 3 and 4 touch only unchecked-tier and package-local files.

## Stage 5 — docs and stability surface

- `packages/kiosk-keyboard/README.md` — `80, 327, 331-334, 340, 342, 344, 363-366, 423, 484, 601, 603, 610, 626, 630, 649, 673, 710, 721, 732, 858, 910, 916-917, 1487`. `:325-344` becomes "Custom Layouts" with the field → merge-rule table and the diagnostic catalogue; `:363-366` loses four property rows and gains an Aggregations table; `:596-630` carries the D3 break; `:732` `bindAggregation("customLayouts", { path, factory })`.
- `packages/kiosk-keyboard-webc/README.md` — `25, 34, 240, 269, 278, 299-302, 348, 397, 403, 425, 442, 476, 479, 491, 493, 497, 512, 516, 520, 524-527, 535, 620, 630, 647, 658, 682, 701, 763, 828`. `:535`'s "read by object identity" caveat is deleted for the collection — a real DX win worth stating.
- `docs/shared/API-STABILITY.md` — `:33, 38, 40, 42, 45, 61, 66, 67, 77, 80`; **add** `ui5/kiosk/CustomLayout` and `kiosk-keyboard-webc/CustomLayout` to the stable-surface lists and record `<kiosk-keyboard-custom-layout>` as a public tag.
- `docs/kiosk/ARCHITECTURE.md` — `:259-263` (a verbatim `applySettings` snippet, already stale: it names `_toLayoutMap`), `:280, 284, 569, 596-597`.
- `docs/kiosk-webc/ARCHITECTURE.md` — `:17, 28, 36` (delete the `memo-map-view.ts` line), `:147-152, 303-310, 317, 328, 550`.
- `docs/kiosk-webc/CONSUMPTION.md` `:173,182,189,203`; `docs/GLOSSARY.md` `:123,135,161`; `docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md` `:49,116,133,157-160`; `docs/kiosk-webc/CUSTOM-ELEMENTS-MANIFEST.md` `:69` + the closing "declares no array-typed properties" claim + a new slots section.
- Two new dated specs, indexed in `docs/specs/README.md`: `docs/specs/2026-08-03-issue-216-custom-layouts-design.md` and the adversarial record below.
- **Frozen, do not touch:** `docs/specs/2026-07-26-issue-187-variant-extensibility.md`, `2026-08-01-layout-meta-lang-adversarial-hypotheses.md`, `2026-07-03-keyboard-key-action-model-design.md`, `2026-04-08-middleware-instance-isolation.md`.

---

## Guardrails: exactly what breaks

| guardrail                      | breaks?                                                                                                                                                            | action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-twin-drift.mjs`         | **yes, twice** — `latin-variants` / `layout-meta` are `CORE_MODULES` (one-sided landing red); `custom-layout-fold` trips `reconcile()` at `:262` unless registered | add `"custom-layout-fold"` and bump `EXPECTED_PAIR_COUNT` 27→28 **in one edit** (`:220-223` fails if they disagree)                                                                                                                                                                                                                                                                                                                                                                               |
| `ci.yml:57-63` generate gate   | **yes** (DEF-6 + the untracked hole)                                                                                                                               | Stage 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `ci.yml:51-52` typecheck       | **yes** — `instance-property-types.tsd.ts` inverted polarity                                                                                                       | rewrite in the same commit as the kiosk metadata                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `check-style-twin-drift.mjs`   | no — CSS custom-property names only, zero overlap                                                                                                                  | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `check-dom-contract-drift.mjs` | no — no new DOM key; `CustomLayout` renders nothing                                                                                                                | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `check-package-smoke.mjs`      | no, if the new artifacts land                                                                                                                                      | add `src/CustomLayout.gen.d.ts` to `requiredFiles` (Stage 3)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `lint:ui5`                     | possibly — a new `sap.ui.core.Element` subclass and new XML aggregation nodes are new input                                                                        | run it in Stage 3 before pushing                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| visual baselines (553 PNGs)    | **no**                                                                                                                                                             | 270 kiosk + 283 webc across `packages/*/test/e2e/__baselines__/{desktop,phone-lg,phone-md,phone-sm,tablet}` — the "118" an earlier revision gave was desktop-only. Every affected fixture is a settings rewrite producing identical DOM, and no `<slot>` is added to the template, but the risk is **not** kiosk-only: Stage 4 rewrites `packages/kiosk-keyboard-webc/test/pages/visual.js:120` and `index.html`, which drive the 283. **Do not run `*:update`** — a diff means a real regression |

Baseline confirmed green at HEAD: `check-twin-drift` 27 pairs in sync; `check-style-twin-drift` 40 kiosk / 44 webc; `check-dom-contract-drift` in parity.

---

## Tests, in full

### Rewritten (the capability is shipped and must stay green in its new spelling)

`KioskKeyboard-layout.qunit.ts:1517` ("a descriptor shadowing a built-in can un-mark its secondary flag", asserting `kb.getBaseLayout() === "numeric"`) → `new CustomLayout({ name: "numeric", layoutRole: LayoutRole.Base, rows: SYMBOL_SURFACE })`, same assertion. `instance-overrides.test.ts:372` → `<kiosk-keyboard-custom-layout name="numeric" layout-role="Base">`, same assertion. Their inherit-siblings (`:1498`, `:358`) are the negative half of the tri-state and must be kept adjacent — together they are the only proof the three states are distinct.

### New

1. **`custom-layout-fold` unit suites** (Stage 2) — document order; every per-facet rule; `suppress` on the named tier; every diagnostic code; and that a rejected `rows` yields `invalid-rows` **alone**, never also `unknown-target`.
2. **D3 re-layering** — the three changed cases and the two newly-expressible ones from the §4c table, per twin, plus the identity and null-prototype invariants, plus the retirement of `{"*": null}`.
3. **All three `layoutRole` states** against the built-in secondary `numeric`: omitted → secondary, `Base` → base, `Secondary` → secondary; plus `Base` on a custom name with no built-in.
4. **`suppress="Variants"`** on a layout inheriting the Latin table → no long-press affordance; with a `defaultVariants` table present → still nothing; **with a `variants` table on the same custom layout** → exactly that table, no built-in and no `defaultVariants` letters.
5. **`suppress="Middleware"`** on `ko-hangul` → uncomposed jamo, proving `getMiddlewareFactory` no longer falls through `??`. **This capability does not exist at HEAD**, so a green run before the feature lands means the test asserts nothing.
6. **Separator round-trip** — `suppress="Variants,Middleware"` (kiosk XML) and `suppress="Variants Middleware"` (webc) both yield the two-member array; `suppress="Varients"` **throws** on kiosk and emits `unknown-suppress` on webc.
7. **XML authoring** — `customLayouts-xml.qunit.ts`, the only CI guard on D1.
8. **DEF-1 first paint (webc)** — build the whole subtree **before** `appendChild`, wrap `onAfterRendering` to capture paints, assert on `paints[0]`, not the settled state. Plus the locale variant (`locales="pl"`, no `layout`), which `onEnterDOM` cannot rescue because it runs at `:225`, after `renderImmediately` at `:222`.
9. **DEF-3 (kiosk)** — exactly **one** fold during `new KioskKeyboard({layout, customLayouts:[a,b,c]})`, and exactly **one** `Log.warning` for a fixture with one bad custom layout among three, with an overlay placed before its rows-declaring sibling and **zero** `unknown-target`. Two corrections to an earlier revision of this item. The count is one, not two: `init()` only assigns `this._fold = null` and never calls `_getFold()`, so the only fold is the one between the `applySettings` phases. And it **cannot be observed by spying `foldCustomLayouts`** — the UI5 AMD transpile captures named imports into module-scope consts at define time (`dist/resources/ui5/kiosk/internal/latin-variants-dbg.js:17`, `const BUILTIN_LAYOUT_META = ___layout_meta["BUILTIN_LAYOUT_META"];`), so `sinon.stub(mod, "foldCustomLayouts")` cannot intercept the caller's binding. Observe it through `sandbox.stub(Log, "warning")` instead, which the repo already does elsewhere; exporting a call counter from the fold would violate CLAUDE.md §4.
10. **Cache liveness (kiosk)** — `customLayout.setRows(x)` refolds once, a second read does not; `removeCustomLayout` / `destroyCustomLayouts` / `customLayout.destroy()` each make the next resolution fall back.
11. **Construction ordering** — `new KioskKeyboard({layout:"pl-warehouse", customLayouts:[…]})` with `layout` written first sets the layout with no warning; `kb.clone().getLayout()` matches with no warning.
12. **Coercion parity** — `locales: "pl"` on a literal and `new CustomLayout({locales:["pl"]})` produce the same construction-time layout.
13. **DEF-4 IME safety** — mid-composition, `customLayout.setKeycapLang("pl")` on an _unrelated_ custom layout: the preedit survives; then change the middleware for the _resolved_ layout: the buffer was **committed to the target**, not reset.
14. **Tree-shaking (webc)** — `expect(code).toContain("kiosk-keyboard-custom-layout")`.

---

## CLAUDE.md §7 adversarial-validation plan

File: `docs/specs/2026-08-03-custom-layouts-adversarial-hypotheses.md`, written **before** any suite is trusted. Each hypothesis is cleared only after the suite has been **seen red**, then reverted.

**H1 — "an explicit entry beats the wildcard" is vacuous.** _Confirmed live at HEAD, not hypothetical._ `latin-variants.qunit.ts:192-199` and `latin-variants.test.ts:170-176` pass `["qwerty", null]`, the one case the re-layering does not change. **Red proof:** land the three-tier resolver with the old bodies untouched and watch both suites pass; then add the named-table + `*`-table case and confirm it goes red against the old resolver.

**H2 — the `instance-property-types.tsd.ts` trap.** Not "inverted polarity", which is what an earlier revision called it. Because D2 **deletes** the four setters rather than retyping them, every `@ts-expect-error`-guarded line stays an error — now "Property 'setInstanceLayouts' does not exist" — so the directives are still consumed and no "Unused '@ts-expect-error'" is ever emitted. **Red proof:** change the kiosk metadata without touching the tsd file; `typecheck:kiosk:test` must fail on the file's **unguarded** accepted-shapes block at `:27-36`. After rewriting, delete one directive and confirm the positive direction also fails.

**H3 — the locale facet is covered vacuously.** At HEAD `instanceLocaleLayouts`'s only reader is the `applySettings` pre-population (`:805,810`), making it the facet most likely asserted without being exercised. **Red proof:** delete the `locales` branch from `foldCustomLayouts` and confirm at least one kiosk and one webc test fails. If both stay green, the coverage is fake.

**H4 — DEF-1: the first-render fold is empty.** _Most cases in `instance-overrides.test.ts` assign config after `fixture()` and await `nextRender()` (`:38-39,46-47,60-61`), so they cannot see this._ An earlier revision said "every case", which is false: `:87-110` deliberately assigns **before** `appendChild`, with the comment "Properties must be assigned before the element connects so `onEnterDOM` sees them". Model the new test on that one. **Red proof:** move the fold behind the `onInvalidation` slot branch only; the connect-time-children test must go red. If it stays green, the test is asserting after an extra microtask and is not testing first paint.

**H5 — DEF-3: N folds, N diagnostics.** **Red proof:** call `_getFold()` eagerly from an `addCustomLayout` override; the "one fold, one warning, zero `unknown-target`" test must go red — observed through `Log.warning` counts, per test 9, not through a spy on `foldCustomLayouts`.

**H6 — DEF-4: a property write tears down an IME buffer.** **Red proof:** put `this._getFold()` inside `invalidate()`; the "edit an unrelated custom layout mid-composition" test must go red with a lost preedit.

**H7 — the `layoutRole` tri-state actually collapses.** **Red proof:** replace `layoutRole` with `secondary: { type: "boolean", defaultValue: false }` and confirm the "absent inherits the built-in" test goes red — `numeric` must stay secondary when the custom layout declares nothing. This is `ManagedObject.js:1611-1614` being exercised directly.

**H8 — `suppress` is a no-op.** **Red proof:** make `toSpec()` drop `suppress`; both the variants-suppress and middleware-suppress tests must go red. The middleware one is the sharper probe.

**H9 — the XML path is never actually parsed.** **Red proof:** rename the aggregation in `metadata` to `customLayoutsX` without touching the view definition; `customLayouts-xml.qunit.ts` must fail. Then break `core:require` and confirm the `middleware` assertion fails specifically, not the whole view.

**H10 — the runner passes while running zero tests.** After renaming `instance-overrides.qunit.ts` → `custom-layouts.qunit.ts`, `testsuite.qunit.ts` must gain the new key. **Red proof:** omit the registration and confirm the QUnit total assertion count drops — `ui5-test-runner` exits 0 on a suite it never loads.

**H11 — visual baselines are not actually compared.** The "no baseline changes" claim is load-bearing. **Red proof:** corrupt one committed PNG and confirm `test:e2e` (not `test:e2e:ci`, which passes `--ignore-snapshots`) goes red; revert.

**H12 — the twin-drift count guard is inert.** **Red proof, both directions:** bump `EXPECTED_PAIR_COUNT` to 28 without adding `custom-layout-fold` to `CORE_MODULES` (must fail at `:220-223`); then add the module without bumping the count (must fail at `:262`).

**H13 — the CI generate gate is blind to a new file.** **Already probed red-worthy:** untracked `*.gen.d.ts` passes a plain `git diff`. **Red proof:** with the staged form in place, delete `CustomLayout.gen.d.ts` from git, regenerate, and confirm CI fails.

**H14 — a variants assertion passes because the popup never opened.** **Red proof:** flip the assertion in each of the suppress tests once and confirm red; a test that reads an empty popup can pass for the wrong reason.

## Decisions, closed

The six questions this document once left open are decided and recorded as D5–D10 in "Decisions taken by the repo owner" at the top. Two were resolved against the original draft: the child class is `CustomLayout`, not `LayoutPreset` (D5), and the defaults tier is the host property `defaultVariants`, not a reserved `name="*"` (D6). The reasoning and the accepted costs are stated there.

## Review notes

A review pass against the UI5 TypeScript-conversion guidance, a slop pass over the code sketches, and the modern-web-guidance corpus, followed by the two-critic refutation pass.

### Corrected in this document

`CustomLayout` was sketched without three things every control-like class in this repo carries, all of them load-bearing for `@ui5/ts-interface-generator`:

- **`@namespace ui5.kiosk`** and **`@extends sap.ui.core.Element`** in the class doc-block. The namespace annotation is what the transformer reads to build the runtime class name; `KioskKeyboard.ts:101-102` carries the same pair.
- **The three generated constructor overloads.** Without them TypeScript sees only `Element`'s constructor, so `new CustomLayout({ name: "pl-warehouse", … })` — the form this design tells TypeScript consumers to use, since `defaultClass` object literals are not modelled by the generator — would not compile. Copied in the shape `KioskKeyboard.ts:117-122` already uses, including the `oxlint-disable` for the otherwise-useless constructor body. `$CustomLayoutSettings` is referenced without an import, matching the rule in CLAUDE.md and the existing `$KioskKeyboardSettings` usage.
- **`static readonly metadata: MetadataOptions`**, with `import type { MetadataOptions } from "sap/ui/core/Element"`. Untyped metadata is what lets a subclass silently restate an inherited property.

### Guidance that does NOT apply here

Generic UI5 library guidance says every enum must be attached to the global library object via `ObjectPath.get(...)`, calling it critical for runtime type validation and an XSS risk otherwise. **Do not apply it to `LayoutRole` or `LayoutFacet`.** CLAUDE.md records the verified position for this repo: with `Lib.init({ apiVersion: 2 })` plus `DataType.registerEnum`, the auto-attachment is skipped by design (`sap/ui/core/Lib.js`), XML `core:require` binds to the module's named exports, and runtime validation resolves through the `DataType` registry rather than the global namespace. The existing enums in `library.ts` already follow the registry-only form; a future implementer reading the generic guidance should not "fix" them back.

### Reconciling with the fix already on `main`

The middleware data-loss bug was fixed independently of this design (`fix(keyboard): keep a composition alive across an unrelated middleware swap`, `5a5f2c2f`). That fix compares the factory the resolved layout reads on either side of the property assignment and needs no cached field, because the setter has both values in hand.

This document's `_middlewareFactory` is a different mechanism, and — stated plainly, because an earlier revision claimed otherwise — **it changes observable timing.** Under `customLayouts` the setter disappears, so the check moves to the next composition-affecting key press (`_tryCompositionMiddleware`), where there is no before-and-after to compare and the previously-used factory must be remembered. The shipped fix commits **at the swap**; this design commits **at the next composition-affecting key**.

Two tests that landed with `5a5f2c2f` pin the shipped timing and will go red:

- `packages/kiosk-keyboard/test/qunit/instance-overrides.qunit.ts:467`, asserting `first.calls.commits === 1` at `:485` immediately after `kb.setInstanceMiddleware(…)`, with no key press in between;
- `packages/kiosk-keyboard-webc/test/component/instance-overrides.test.ts:176`, asserting `calls.commits === 1` at `:198`.

Both must be **rewritten to the new timing**, not deleted, and both belong in the Stage 3 / Stage 4 rewrite lists.

**Why the change is acceptable, and what would make it unacceptable.** It is not a return of the data-loss bug. `commit()` finalises a preedit that `commitPreedit(target)` has _already written into the input_ (`packages/kiosk-keyboard/src/middleware/hangul-compose.ts:309-317`); the bug `5a5f2c2f` fixed was `reset()`, which _erases_ it via `updateComposition(target, "")` (`:319-325`). Under deferral the preedit stays visible in the target and is still committed by the next key, a layout switch, a target switch or a keyboardType switch. No path drops it.

**One ordering consequence the §A.7 sketch gets wrong.** `_tryCompositionMiddleware` early-returns on `!this._keyAffectsComposition(keyValue)` _before_ the factory check, so a non-composition key pressed after a swap would skip the commit entirely and leave a stale composition attached to a middleware the resolved layout no longer reads. The factory-identity check must run **before** the `_keyAffectsComposition` gate, not after it. The same applies to webc's `_ensureMiddleware` call site.

### Slop pass

No `as any`, no try/catch around trusted paths, no defensive `typeof x !== "undefined"` guards, no orphaned TODOs. The conditional-spread idiom in `toSpec()` matches the shipped `KioskKeyboard.ts:1221`. The two twins deliberately use different fold-invalidation mechanisms — kiosk `_fold`/`_foldChildren` keyed off `invalidate(origin)`, webc `_foldEpoch`/`_foldKey` keyed off `onInvalidation` — which is the per-environment idiom this design was chosen for, not an inconsistency.

### Modern-web-guidance

Searched for custom-element configuration APIs, slots carrying non-rendered configuration, property-versus-attribute handling of object and function values, and duck-typing across bundles. **No applicable guide exists in that corpus** — top similarity 0.41, then 0.449 on a re-run against a later corpus version, every result CSS or performance. Recorded so the search is not repeated expecting a result.

The web-component half of this design therefore rests on the installed `@ui5/webcomponents-base` 2.22.0 sources, the package's own `AGENTS.md`, and first-party precedent — all three re-checked, with the precedent narrowed to what it actually supports:

| claim                                                                                        | first-party evidence                                                                                                                                                          | verdict                               |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| a registered custom element with no renderer/template/styles is the shape for a config child | `TableSelectionMulti.js:288`, `TableSelectionSingle.js:63` — `@customElement({tag})` and nothing else                                                                         | **precedented**, adopt as-is          |
| the host reads its config slot lazily rather than from `onInvalidation`                      | `Table.js:171,191,197,203,217`; `ui5-table` declares no `onInvalidation`                                                                                                      | **precedented**, adopt as-is          |
| duck-typing marker instead of `instanceof` / tag comparison                                  | `AGENTS.md` "No `instanceof` checks" + `createInstanceChecker`; `TableSelectionBase` carries `identifier = "TableSelection"` and resolves its host with `isInstanceOfTable()` | **precedented**, adopt as-is          |
| template-literal enum types, `import type` for enums                                         | `AGENTS.md` "Always Use Template Literal Types for Enums" — `design: \`${ButtonDesign}\` = "Default"`, compared with string literals                                          | **precedented**, already followed     |
| `invalidateOnChildChange` on the config slot                                                 | **none** — `Table.js:436` sets `slot({type: HTMLElement, individualSlots: true})` and its children push `this._table._invalidate++` instead                                   | **deviation**, reasoned in surface §4 |
| `individualSlots` omitted                                                                    | **none** — first-party sets it, because `TableGrowing` actually renders (`TableGrowing.js:229-231`)                                                                           | **deviation**, reasoned in surface §4 |

Both deviations are recorded rather than smoothed over. The first-party alternative to `invalidateOnChildChange` is a child that reaches into its parent, which is precisely the shape §A.2 rejects on the kiosk twin; taking it here would have made the twins inconsistent for no gain.

`AGENTS.md` also prescribes `noAttribute: true` for properties not used in CSS selectors. It is not applied to `rows` / `variants` / `middleware`: `hasAttribute` already excludes `Object` (`UI5ElementMetadata.js:64-67`), so no attribute is created either way, and the CEM's phantom-attribute listing ignores `_ui5noAttribute` entirely (§"Generated artifacts"). Adding it would be inert on both paths.
