# LayoutPreset — implementation specification for issue #216 (customLayouts aggregation + slot)

Issue: [#216](https://github.com/wridgeu/ui5-keyboard/issues/216) — Extension surface: four parallel `instance*` maps vs a cohesive preset/plugin unit.

> **Status: design, not yet verified.** The two adversarial critics that were to attack this
> specification did not run (session limit). Every framework claim below carries a `file:line`
> citation from the pinned sources, but the spec as a whole has not been through the refutation
> pass that CLAUDE.md §5 requires. Treat it as the plan of record, not as cleared.

## Decisions taken by the repo owner

- **D1.** XML declarability is a requirement for the UI5 twin: a Fiori developer must configure a complete layout extension in an XML view without touching a controller. It is explicitly _not_ a requirement for the web component, which instead uses the closest idiom its own framework offers.
- **D2.** The surface is renamed; `instanceLayouts` is retired in favour of `customLayouts`. Breaking changes across both keyboards, the demo apps and the GitHub-Pages demos are accepted — nothing is published.
- **D3.** The `"*"` wildcard variant tier is re-layered in this change: built-in → wildcard → named, with `[]` suppression honoured at each tier.
- **D4.** The new unit absorbs per-layout metadata and any future per-layout concern; a fifth concern folds into an existing level rather than becoming a sixth sibling map.

## Surface

## 0. Names, decided once

| thing            | kiosk                                                                    | webc                                                                                             |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| collection       | `customLayouts` 0..n aggregation                                         | `customLayouts` named slot                                                                       |
| child class      | `ui5.kiosk.LayoutPreset` (`packages/kiosk-keyboard/src/LayoutPreset.ts`) | `LayoutPreset` (`packages/kiosk-keyboard-webc/src/LayoutPreset.ts`), tag `kiosk-keyboard-preset` |
| shared fold      | `src/internal/preset-fold.ts`                                            | `src/core/preset-fold.ts`                                                                        |
| shared spec type | `LayoutPresetSpec` in `types.ts`                                         | same, byte-identical text                                                                        |

**Picked `LayoutPreset` over `CustomLayout` / `KioskKeyboardCustomLayout`** (the tristate + blast-radius clusters vs the webc-lifecycle + semantics clusters). Deciding reason: it is the chosen design's own name, it does not collide with the _aggregation_ name `customLayouts` (a class and a collection called the same thing reads badly in `getCustomLayouts()[0] instanceof CustomLayout`), and it keeps the child/collection distinction visible in XML (`<kiosk:customLayouts><kiosk:LayoutPreset/></kiosk:customLayouts>`).

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
 * A per-layout facet whose inherited value a preset discards. A listed facet resolves
 * to nothing at that preset's position: the built-in tier and every earlier preset's
 * contribution are dropped, and only a value the same preset declares survives.
 *
 * Rows are not listed: the built-in registry is sealed, so a preset shadows rows and
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

/** A layout's rows, or `null` for a preset that overlays an existing layout. */
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
DataType.createType("ui5.kiosk.VariantTable", { defaultValue: null, isValid: isVariantTable }, "object");
```

`Lib.init` (`library.ts:211-230`): `types` becomes `["ui5.kiosk.KeyboardLayout", "ui5.kiosk.KeyboardType", "ui5.kiosk.MobileKeyboard", "ui5.kiosk.FKeyMode", "ui5.kiosk.LayoutRole", "ui5.kiosk.LayoutFacet", "ui5.kiosk.LayoutRows", "ui5.kiosk.VariantTable"]`; `elements: []` (`:228`) becomes `elements: ["ui5.kiosk.LayoutPreset"]`.

Registered-type count is unchanged at 4→4 in kind but the two coarse record types are gone; `Inherit` is declared first so it is also the `DataType` default (`DataType.js:414-421`, "the first entry will become the default value"). `ui5.kiosk.LayoutFacet[]` is **not** registered — `DataType.getType` derives the array form on demand (`DataType.js:531-537`), exactly as `sap.m` registers `sap.m.Sticky` and never `sap.m.Sticky[]`.

---

## 2. `packages/kiosk-keyboard/src/LayoutPreset.ts` (new)

```ts
import Element from "sap/ui/core/Element";
import type { MetadataOptions } from "sap/ui/core/Element";
import { LayoutFacet, LayoutRole } from "./library";
import type { CompositionMiddleware, LayoutDefinition, LayoutPresetSpec } from "./types";
import type { VariantTable } from "./internal/latin-variants";

/**
 * One layout and everything that belongs with it: its rows, the locales that select
 * it, its keycap language, its role, its composition middleware and its long-press
 * variants.
 *
 * A preset that declares `rows` declares a layout. A preset without them overlays the
 * layout its `name` already resolves to, so a built-in can be given different variants,
 * a different middleware or a different locale binding without restating its keys.
 * Presets apply in aggregation order.
 *
 * The name `*` addresses every layout at once and carries `variants` only.
 *
 * @namespace ui5.kiosk
 * @extends sap.ui.core.Element
 * @public
 * @since 0.1.0
 */
export default class LayoutPreset extends Element {
  // The following three lines were generated and should remain as-is to make TypeScript aware of the constructor signatures
  constructor(idOrSettings?: string | $LayoutPresetSettings);
  constructor(id?: string, settings?: $LayoutPresetSettings);
  // oxlint-disable-next-line no-useless-constructor -- required by @ui5/ts-interface-generator overloads
  constructor(id?: string, settings?: $LayoutPresetSettings) {
    super(id, settings);
  }

  static readonly metadata: MetadataOptions = {
    library: "ui5.kiosk",
    properties: {
      /**
       * The layout this preset declares or overlays, matched after trim and lowercase.
       * `*` addresses every layout.
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
      lang: { type: "string", defaultValue: "", group: "Behavior" },
      /** Whether the layout is an auxiliary surface or a base alphabetic layout. */
      layoutRole: { type: "ui5.kiosk.LayoutRole", defaultValue: "Inherit", group: "Behavior" },
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
      variants: { type: "ui5.kiosk.VariantTable", defaultValue: null, group: "Behavior" },
      /**
       * Facets whose inherited value this preset discards, e.g.
       * `suppress="Variants,Middleware"`. A listed facet resolves to nothing at this
       * preset's position; a value this same preset declares still applies.
       */
      suppress: { type: "ui5.kiosk.LayoutFacet[]", defaultValue: [], group: "Behavior" },
    },
  };

  /** The framework-agnostic record this preset declares. The control's fold is its only reader. */
  toSpec(): LayoutPresetSpec {
    const rows = this.getRows() as LayoutDefinition | null;
    const lang = this.getLang();
    const role = this.getLayoutRole();
    const locales = this.getLocales();
    const middleware = this.getMiddleware() as (() => CompositionMiddleware) | null;
    const variants = this.getVariants() as VariantTable | null;
    const suppress = this.getSuppress();
    return {
      name: this.getName(),
      ...(rows !== null && { rows }),
      ...(lang && { lang }),
      ...(role !== "Inherit" && { secondary: role === "Secondary" }),
      ...(locales.length > 0 && { locales }),
      ...(middleware !== null && { middleware }),
      ...(variants !== null && { variants }),
      ...(suppress.length > 0 && { suppress }),
    };
  }
}
```

`role !== "Inherit"` / `role === "Secondary"` are string-literal comparisons per CLAUDE.md. Conditional spread everywhere: `exactOptionalPropertyTypes` is off in this repo, so `{ secondary: undefined }` would type-check and then clobber the built-in in `layout-meta.ts`'s `{...builtIn, ...instance}` (`layout-meta.ts:78-84`).

`LayoutPreset` declares **no** `invalidate()` override, **no** `setProperty` override, and **no** parent protocol. Properties keep the default `invalidate: true` — do **not** copy `sap.ui.core.dnd.DragDropBase`'s `invalidate: false` (`dnd/DragDropBase.js:54,60,71`), which is exactly what would sever the only content-change signal the control has.

`packages/kiosk-keyboard/src/LayoutPreset.gen.d.ts` is generated by `npm run generate` and **committed**, by CLAUDE.md's stated principle: `LayoutPreset.ts` uses `$LayoutPresetSettings` in its constructor overloads without importing it, so the IDE and a bare `tsc --noEmit` need it on disk before any build, and kiosk ships `src/` to npm. `.gitattributes` already globs `*.gen.d.ts linguist-generated`; no change there.

---

## 3. `KioskKeyboard` metadata (kiosk)

Delete the four property blocks at `KioskKeyboard.ts:387-460`. Extend `metadata.aggregations` (`:462-474`, today only `_variantPopover`):

```ts
    aggregations: {
      /**
       * Per-instance layouts. Each preset declares a layout, or overlays the one its
       * `name` already resolves to. Applied in aggregation order: for rows, locales,
       * metadata and middleware the last declaration wins; long-press variants
       * accumulate per base letter.
       *
       * @since 0.1.0
       */
      customLayouts: {
        type: "ui5.kiosk.LayoutPreset",
        multiple: true,
        singularName: "customLayout",
        bindable: "bindable",
        defaultClass: LayoutPreset,
      },
      _variantPopover: { type: "sap.m.Popover", multiple: false, visibility: "hidden" },
    },
```

`defaultClass` (since 1.120; `ManagedObject.js:812` typedef, `:1076` `FnClass ??= oKeyInfo?.defaultClass`) lets a plain object literal be coerced into a real `LayoutPreset`. It is kept for the plain-JS consumers that exist in this repo (`packages/kiosk-keyboard/test/e2e/visual/init.js`) and for `applySettings` phase 1. Known gap, stated rather than hidden: `@ui5/ts-interface-generator` 0.11.1 does not model `defaultClass`, so the generated union is `LayoutPreset[] | LayoutPreset | AggregationBindingInfo | \`{${string}}\``and **TypeScript consumers construct`new LayoutPreset({...})`**. Every TS fixture in this repo does so.

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

`packages/kiosk-keyboard-webc/src/LayoutPreset.ts`:

```ts
import UI5Element from "@ui5/webcomponents-base/dist/UI5Element.js";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import createInstanceChecker from "@ui5/webcomponents-base/dist/util/createInstanceChecker.js";
import type { CompositionMiddleware, LayoutDefinition, LayoutPresetSpec, LayoutRole } from "./types.js";
import type { VariantTable } from "./core/latin-variants.js";

/**
 * One layout and everything that belongs with it, slotted into a `<kiosk-keyboard>`'s
 * `customLayouts` slot. A preset with `rows` declares a layout; one without them
 * overlays the layout its `name` already resolves to. Applied in DOM order.
 *
 * Renders nothing: no renderer, template or styles, so it never attaches a shadow root
 * and is never projected. Configuration, read by the host - the shape `ui5-table` uses
 * for its `features` slot.
 *
 * @slot customLayouts
 * @public
 * @since 0.1.0
 */
@customElement({ tag: "kiosk-keyboard-preset" })
class LayoutPreset extends UI5Element {
  /**
   * Identifies this element to the host without `instanceof` or a tag-name check: UI5
   * rewrites tags under scoping (UI5ElementMetadata.js:50-60) and a cross-bundle
   * duplicate defeats `instanceof`.
   */
  readonly isKioskKeyboardPreset = true;

  /** The layout this preset declares or overlays. `*` addresses every layout. */
  @property() name = "";
  /** BCP-47 language of the keycaps. Empty takes the built-in layout's value. */
  @property() lang = "";
  /** BCP-47 prefixes that select this layout, comma- or space-separated. */
  @property() locales = "";
  /** Whether the layout is an auxiliary surface or a base alphabetic layout. */
  @property() layoutRole: `${LayoutRole}` = "Inherit";
  /** Facets whose inherited value this preset discards, comma- or space-separated. */
  @property() suppress = "";
  /** The layout's rows, or absent to make this an overlay. Assign a new array to change them. */
  @property({ type: Object }) rows?: LayoutDefinition;
  /** Long-press variants, merged per base letter onto the tier below. `null` opts the layout out. */
  @property({ type: Object }) variants?: VariantTable | null;
  /** Composition middleware factory. `null` disables the built-in for this layout. */
  @property({ type: Object }) middleware?: (() => CompositionMiddleware) | null;

  /** The framework-agnostic record this preset declares. The host's fold is its only reader. */
  toSpec(): LayoutPresetSpec {
    const suppress = splitTokens(this.suppress);
    if (this.variants === null && !suppress.includes("Variants")) suppress.push("Variants");
    if (this.middleware === null && !suppress.includes("Middleware")) suppress.push("Middleware");
    const locales = splitTokens(this.locales);
    return {
      name: this.name,
      ...(this.rows !== undefined && { rows: this.rows }),
      ...(this.lang && { lang: this.lang }),
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

LayoutPreset.define();
export default LayoutPreset;

/** The host-facing contract, duck-typed so an element from another bundle still matches. */
export interface ILayoutPreset extends HTMLElement {
  readonly isKioskKeyboardPreset: boolean;
  toSpec(): LayoutPresetSpec;
}

export const isLayoutPreset = createInstanceChecker<ILayoutPreset>("isKioskKeyboardPreset");
```

`locales` and `suppress` are token **strings**, not `type: Array`: `UI5ElementMetadata.hasAttribute` excludes only `Object` (`UI5ElementMetadata.js:66-68`) and `defaultConverter.toAttribute` JSON-stringifies arrays (`UI5Element.js:49-56`), so a public `type: Array` property reflects a live JSON attribute — the trap already documented at `docs/kiosk-webc/CUSTOM-ELEMENTS-MANIFEST.md:73`. Both separators are accepted so a `suppress="Variants,Middleware"` copied out of an XML view works verbatim; the reverse throws loudly on kiosk (`createArrayType.parseValue` splits only on `","`, `DataType.js:389-395`, and an unknown member fails `isValid` at `ManagedObject.js:1635-1638` — the same behaviour `mobileKeyboard="Bogus"` already has).

`variants = null` / `middleware = null` are accepted as suppression alongside `suppress`, because `UI5Element`'s generated setter (`UI5Element.js:975-1000`) stores the value verbatim with no null-collapse. `toSpec()` normalizes both spellings to the one `suppress` field, so the byte-compared fold sees exactly one representation.

The slot on `KioskKeyboard.ts`, replacing the four `@property({ type: Object })` blocks at `:514-592`:

```ts
import slot from "@ui5/webcomponents-base/dist/decorators/slot-strict.js";
import type { Slot } from "@ui5/webcomponents-base/dist/UI5Element.js";
import { isLayoutPreset, type ILayoutPreset } from "./LayoutPreset.js";

  /**
   * Per-instance layouts. Each `<kiosk-keyboard-preset>` declares a layout, or overlays
   * the one its `name` already resolves to. Applied in DOM order.
   *
   * Not projected: these are configuration, so the shadow template renders no
   * `<slot name="customLayouts">` for them.
   *
   * @public
   * @since 0.1.0
   */
  @slot({ type: HTMLElement, invalidateOnChildChange: { properties: true, slots: false } })
  customLayouts!: Slot<ILayoutPreset>;
```

`slot-strict.js` is present in the installed 2.22.0 tree (verified by listing `node_modules/@ui5/webcomponents-base/dist/decorators/`) and must be imported under the local identifier `slot` — the CEM analyzer detects slots by `findDecorator(member, "slot")` (`custom-elements-manifest.config.mjs:197,212`), which is why upstream writes `import { slotStrict as slot }` (`Table.js:9`). Both keys of `SlotInvalidation` are required (`UI5ElementMetadata.d.ts:3-6`); `{ properties: true }` alone does not compile. `individualSlots` is **not** set — nothing renders into an individual slot, and `_assignIndividualSlotsToChildren` (`UI5Element.js:720-727`) would stamp `slot="customLayouts-1"` onto React/Vue-managed light DOM for no benefit. `KioskKeyboardTemplate.tsx` is unchanged.

`KioskKeyboard.ts` **value-imports** `isLayoutPreset` from `./LayoutPreset.js`. That is load-bearing, not stylistic: `customElements.define` runs synchronously inside `UI5Element.define()` (`:1121-1125`), so the child tag is always defined by the time a `<kiosk-keyboard>` connects and `_processChildren` never enters the `Promise.race([whenDefined, setTimeout(1000)])` at `UI5Element.js:369-379` (measured: 1004 ms to first paint for an undefined child tag).

---

## 5. The shared spec type (`types.ts`, byte-identical text in both twins)

```ts
/**
 * What one layout preset declares. A preset without `rows` overlays the layout its
 * `name` already resolves to; the name `*` addresses every layout and carries
 * `variants` only.
 */
export interface LayoutPresetSpec {
  readonly name: string;
  readonly rows?: LayoutDefinition;
  readonly lang?: string;
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
   * Facets whose inherited value this preset discards. A listed facet resolves to
   * nothing at this preset's position; a value this same preset declares still applies.
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

  <kiosk:KioskKeyboard id="kb" controls="name,email" accentVariants="true">
    <kiosk:customLayouts>

      <!-- A whole custom layout: rows, locale binding, keycap language, IME, accents. -->
      <kiosk:LayoutPreset core:require="{ Warehouse: 'demo/hotkeys/middleware/warehouse' }"
        name="pl-warehouse" locales="pl,pl-PL" lang="pl"
        rows="{layouts>/plWarehouse}"
        middleware="Warehouse.createMiddleware"
        variants="{layouts>/plVariants}" />

      <!-- Rows-less overlay: point the Japanese locale at the BUILT-IN kana layout. -->
      <kiosk:LayoutPreset name="ja-kana" locales="ja" />

      <!-- Opt a layout out of accents entirely. -->
      <kiosk:LayoutPreset name="arabic" suppress="Variants" />

      <!-- Disable the built-in Hangul composer for directly-typed rows. -->
      <kiosk:LayoutPreset name="ko-hangul" suppress="Middleware" rows="{layouts>/hangulDirect}" />

      <!-- Promote the built-in secondary `numeric` to a base alphabetic layout. -->
      <kiosk:LayoutPreset name="numeric" layoutRole="Base" rows="{layouts>/symbolSurface}" />

      <!-- House accent set for every layout that has none of its own. -->
      <kiosk:LayoutPreset name="*" variants="{layouts>/houseAccents}" />

    </kiosk:customLayouts>
  </kiosk:KioskKeyboard>
</mvc:View>
```

`middleware="Warehouse.createMiddleware"` resolves because `type: "function"` properties are XML-declarable via `core:require`: `DataType.js:314-347` (`parseValue` → `resolveReference(sValue, Object.assign({".": oContext}, oLocals))`) and `XMLTemplateProcessor.js:87-91`. Precedent: `sap.m.Dialog#escapeHandler`.

**UI5 TypeScript:**

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import LayoutPreset from "ui5/kiosk/LayoutPreset";
import { LayoutFacet, LayoutRole } from "ui5/kiosk/library";

const kb = new KioskKeyboard({
  controls: ["name"],
  customLayouts: [
    new LayoutPreset({
      name: "pl-warehouse",
      locales: ["pl", "pl-PL"],
      lang: "pl",
      rows: PL_ROWS,
      middleware: createWarehouseMiddleware,
      variants: PL_VARIANTS,
    }),
    new LayoutPreset({ name: "numeric", layoutRole: LayoutRole.Base, rows: SYMBOL_SURFACE }),
    new LayoutPreset({ name: "arabic", suppress: [LayoutFacet.Variants] }),
  ],
});
kb.addCustomLayout(new LayoutPreset({ name: "ja-kana", locales: ["ja"] }));
```

The generated interface reads `layoutRole?: LayoutRole | PropertyBindingInfo | \`{${string}}\`` and `suppress?: LayoutFacet[] | PropertyBindingInfo | \`{${string}}\``—`astGenerationHelper.js:431-435`maps a dotted`X[]`to`createArrayTypeNode`over a named import and`:437-439`maps a dotted scalar to a named import, the same path that already yields`import { MobileKeyboard } from "ui5/kiosk/library"`at`KioskKeyboard.gen.d.ts:3`.

**Plain HTML + JS** (the webc twin's first declarative extension surface — all four of today's properties are markup-invisible):

```html
<script type="module">
  import "kiosk-keyboard-webc/bundle";
</script>

<kiosk-keyboard accent-variants controls="user,pin">
  <kiosk-keyboard-preset slot="customLayouts" name="ja-kana" locales="ja"></kiosk-keyboard-preset>
  <kiosk-keyboard-preset slot="customLayouts" name="numeric" layout-role="Base"></kiosk-keyboard-preset>
  <kiosk-keyboard-preset slot="customLayouts" name="arabic" suppress="Variants"></kiosk-keyboard-preset>
  <kiosk-keyboard-preset slot="customLayouts" name="*" id="house"></kiosk-keyboard-preset>
</kiosk-keyboard>

<script type="module">
  document.getElementById("house").variants = { a: ["ä", "å"], z: ["ź", "ż"] };
</script>
```

**Zero-JS HTML, by shipping a layout as its own element module** (the `TableSelectionMulti` model):

```ts
import LayoutPreset from "kiosk-keyboard-webc/LayoutPreset";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";

@customElement({ tag: "acme-pl-warehouse-preset" })
class PlWarehousePreset extends LayoutPreset {
  name = "pl-warehouse";
  locales = "pl,pl-PL";
  lang = "pl";
  rows = PL_ROWS;
  variants = PL_VARIANTS;
  middleware = createWarehouseMiddleware;
}
PlWarehousePreset.define();
```

```html
<kiosk-keyboard accent-variants>
  <acme-pl-warehouse-preset slot="customLayouts"></acme-pl-warehouse-preset>
</kiosk-keyboard>
```

The subclass keeps `isKioskKeyboardPreset` and `toSpec()`, so the duck-typed host accepts it unchanged.

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
      <kiosk-keyboard-preset ref={pl} slot="customLayouts" name="pl-warehouse" locales="pl,pl-PL" lang="pl" />
      <kiosk-keyboard-preset slot="customLayouts" name="ja-kana" locales="ja" />
      <kiosk-keyboard-preset slot="customLayouts" name="numeric" layout-role="Base" />
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
    <kiosk-keyboard-preset
      slot="customLayouts"
      name="pl-warehouse"
      locales="pl,pl-PL"
      lang="pl"
      :rows.prop="plRows"
      :variants.prop="plVariants"
      :middleware.prop="plMw"
    />
    <kiosk-keyboard-preset slot="customLayouts" name="arabic" suppress="Variants" />
  </kiosk-keyboard>
</template>
```

**Angular** (`CUSTOM_ELEMENTS_SCHEMA`): `<kiosk-keyboard-preset slot="customLayouts" name="pl-warehouse" locales="pl,pl-PL" [rows]="plRows" [variants]="plVariants" [middleware]="plMw">`.

## Semantics

## 1. The fold — `preset-fold.ts` (new byte-compared pair)

`packages/kiosk-keyboard/src/internal/preset-fold.ts` ↔ `packages/kiosk-keyboard-webc/src/core/preset-fold.ts`. Framework-free leaf: imports `mergeVariantTables` / types from `./latin-variants` and `LayoutMeta` from `./layout-meta`, and **nothing else**. It must not import `layout-registry` (its `normalizeLowerString` logs, `layout-registry.ts:61-71`) or `middleware-registry` (which pulls the 8.9 KB Hangul composer into the leaf tier). `isBuiltIn` is injected by the host for the same reason.

```ts
/** The facets a preset can discard the inherited value of. */
export const SUPPRESSIBLE_FACETS = ["Variants", "Middleware"] as const;
export type SuppressibleFacet = (typeof SUPPRESSIBLE_FACETS)[number];

/** The preset name that addresses every layout. */
export const WILDCARD_LAYOUT = "*";

/** The lookup maps a control resolves through, folded from its presets. */
export interface PresetFold {
  readonly layouts?: InstanceLayouts;
  readonly layoutMeta?: InstanceLayoutMeta;
  readonly localeLayouts?: InstanceLocaleLayouts;
  readonly middleware?: InstanceMiddleware;
  readonly variants?: InstanceVariants;
  /** The `*` tier, applied below every named entry. */
  readonly defaultVariants?: VariantOverlay;
  readonly diagnostics: readonly LayoutDiagnostic[];
}

/** The fold of no presets. Shared, so a control with none allocates nothing. */
export const EMPTY_FOLD: PresetFold = Object.freeze({ diagnostics: Object.freeze([]) });
```

Every map is `undefined` rather than an empty `Map` when nothing was declared — the repo's settled derived-cache convention, and what keeps `resolveVariantTable`'s `if (!instanceVariants) return builtIn` fast path and its identity guarantee (`latin-variants.qunit.ts:187` asserts `strictEqual(..., LATIN_DIACRITIC_VARIANTS)`).

```ts
export function foldPresets(specs: readonly LayoutPresetSpec[], isBuiltIn: (name: string) => boolean): PresetFold {
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
  let defaultVariants: VariantOverlay | undefined;

  for (const spec of specs) {
    const name = spec.name.trim().toLowerCase();
    const facets = readSuppress(spec.suppress, name, diagnostics);

    if (name === WILDCARD_LAYOUT) {
      defaultVariants = foldVariantOverlay(
        defaultVariants,
        facets.has("Variants"),
        readVariants(spec.variants, name, diagnostics),
      );
      reportWildcardFields(spec, facets, diagnostics);
      continue;
    }
    if (!name) {
      diagnostics.push({ code: "empty-name", layout: "" });
      continue;
    }
    addressed.add(name);

    if (spec.rows !== undefined) {
      if (!isValidLayoutDefinition(spec.rows)) diagnostics.push({ code: "invalid-rows", layout: name });
      else {
        if (rowsDeclared.has(name)) diagnostics.push({ code: "duplicate-rows", layout: name });
        rowsDeclared.add(name);
        layouts.set(name, spec.rows);
      }
    }

    const lang = typeof spec.lang === "string" ? spec.lang.trim() : "";
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

  // Resolvability is a property of the complete list: an overlay may precede the preset
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
    ...(defaultVariants !== undefined && { defaultVariants }),
    diagnostics,
  };
}
```

`isValidLayoutDefinition` and `isValidVariantTable` move here from the two host classes. That is a real drift fix, not tidying: they are semantically identical but **textually different** today — kiosk `KioskKeyboard.ts:1233` `typeof key?.value === "string" && key.value` vs webc `:1362` `key && typeof (key as KeyDefinition).value === "string" && (key as KeyDefinition).value` — two spellings of one predicate in the unguarded host tier.

## 2. Resolution order, per facet

| facet        | across presets with the same name                                                                                          | across tiers                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `rows`       | last declaration wins; a preset that declares none leaves the previous standing                                            | named → built-in (`layout-registry.ts:95`, unchanged)                             |
| `lang`       | last declaration wins, per attribute                                                                                       | named → built-in (`layout-meta.ts:78-84`, unchanged)                              |
| `secondary`  | last declaration wins, per attribute                                                                                       | named → built-in                                                                  |
| `locales`    | additive union; per prefix, last wins                                                                                      | instance index → `BUILTIN_LOCALE_LAYOUT_MAP` (`layout-registry.ts:79`, unchanged) |
| `middleware` | last declaration wins                                                                                                      | named → built-in                                                                  |
| `variants`   | additive per base letter (`mergeVariantTables`); `[]` deletes a letter                                                     | built-in → `*` → named, each merged                                               |
| `suppress`   | resets the accumulator for that facet at this preset's position; a value the same preset declares then layers onto nothing | applies at the preset's own tier                                                  |

Three different rules is not sloppiness — the code already has three (`layout-registry.ts:95` shadow, `layout-meta.ts:83` per-attribute merge, `latin-variants.ts:76-84` per-letter merge) and no design can flatten them without breaking shipped behaviour. Ordering is aggregation index on kiosk, DOM order on webc. Keys are `name.trim().toLowerCase()`, mirroring the storage normalisation at `KioskKeyboard.ts:1196` and the lookup normalisation at `latin-variants.ts:96`, `middleware-registry.ts:34`, `layout-registry.ts:66`.

**Duplicate `name` is legal and is the overlay mechanism.** Duplicating a _facet_ across two presets for one name is reported (`duplicate-rows`, `duplicate-middleware`, `duplicate-locale`) and the later one wins.

**One forced semantic change, to be documented and tested:** `_readLayoutInput` (kiosk `:1215-1225`, webc `:1342-1352`) today rejects a whole entry when `rows` is malformed, discarding that entry's `lang` and `secondary` with it. Under a per-facet fold that is inexpressible: a bad `rows` drops only `rows` (`invalid-rows`) and the preset's other facets still apply.

## 3. The tri-states (DEF-5), all three solved

The rule, stated once: **when a facet's value space is a closed set of strings, the tri-state is a member of that set; when the value is an object or a function, the value space cannot host a sentinel and the opt-out moves to the shared `suppress` list.**

UI5 has no `null`-carries-meaning idiom for control properties at all. `ManagedObject.prototype.validateProperty` collapses a top-level `null` to `getDefaultValue()` unconditionally and type-independently, **before** `isValid` runs (`ManagedObject.js:1611-1614`), so no custom `DataType` can opt out. Every first-party tri-state is instead a named sentinel member: `TextDirection.Inherit` (`sap.ui.core/1.136.18/src/sap/ui/core/library.js:1748-1751`), `TitleLevel.Auto` (`:1764-1770`), `ValueState.None`, `ImeMode.Auto`, `TextAlign.Initial`, `BarDesign.Auto`, `ToolbarDesign.Auto`, the five `Flex*.Inherit`, `IconTabDensityMode.Inherit`, `Priority.None`, `GrowingMode.None` — 14+ instances across `sap.m`, `sap.ui.core`, `sap.ui.mdc`.

| lost tri-state         | new spelling                                     | resolved value                                  |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------- |
| (c) `secondary: false` | `layoutRole="Base"` (vs `Inherit` / `Secondary`) | `LayoutPresetSpec.secondary = false`            |
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

## 4. D3 — the wildcard re-layering

### 4a. What HEAD does, and what breaks

`latin-variants.ts:102-105` (read at HEAD):

```ts
if (instanceVariants.has(name)) entry = instanceVariants.get(name) ?? null;
else if (instanceVariants.has(WILDCARD_LAYOUT)) entry = instanceVariants.get(WILDCARD_LAYOUT) ?? null;
```

An either/or: a named entry silently discards the entire `*` tier — its table, its `[]` suppressions and its `null` opt-out. Documented at kiosk `README.md:366,626` and webc `README.md:302,512`.

**The existing coverage is vacuous and must be called out by name.** `latin-variants.qunit.ts:192` and `latin-variants.test.ts:170` are both titled _"an explicit entry beats the wildcard"_ but pass `["qwerty", null]` — the one case the re-layering does **not** change. They stay green through the whole change. Rename them to what they assert and add the four cases that do change.

### 4b. The replacement, in `latin-variants.ts` (both twins, one commit — byte-compared)

```ts
/**
 * One tier's contribution to a layout's long-press variants. `replace` discards
 * everything the tiers below contributed before `table` is merged, which is what
 * suppressing the facet on the declaring preset means; a `table` of `null` contributes
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
 * The variant table in effect for `layoutName`, layered built-in -> `*` -> named. Each
 * tier merges onto the one below per base letter, so a letter mapped to `[]` drops that
 * letter and a table for one layout extends the tier below instead of replacing it. A
 * tier that suppresses discards everything below it; a tier that suppresses and then
 * declares a table stands that table alone. With no tier declared the built-in stands:
 * the layout's own declared table, or the Latin table when it declares none. A `null`
 * result fills no variants, so the keys carry no long-press affordance.
 */
export function resolveVariantTable(
  layoutName: string,
  instanceVariants?: InstanceVariants,
  defaults?: VariantOverlay,
): VariantTable | null {
  const name = layoutName.trim().toLowerCase();
  // A declared `null` opts the layout out; an absent declaration is distinct from it
  // and leaves the Latin table in force.
  const declared = BUILTIN_LAYOUT_META.get(name)?.variants;
  let table: VariantTable | null = declared === undefined ? LATIN_DIACRITIC_VARIANTS : declared;
  table = applyVariantOverlay(table, defaults);
  if (instanceVariants !== undefined) table = applyVariantOverlay(table, instanceVariants.get(name));
  return table;
}
```

`mergeVariantTables` is promoted to `export` (the fold uses it). `WILDCARD_LAYOUT` moves out of `latin-variants.ts:65` into `preset-fold.ts` — the resolver no longer knows the name exists, which is the structural point of the re-layering.

The child-level accumulator, in `preset-fold.ts`:

```ts
/** Folds one preset's variant declaration onto the overlay accumulated so far. */
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

With `WILD = {z:["ź"], q:["ǫ"]}` and `NAMED = {a:["ą"]}`:

| case                                                | HEAD               | new                               |             |
| --------------------------------------------------- | ------------------ | --------------------------------- | ----------- |
| no tier, `qwerty`                                   | `LATIN` (identity) | same                              | —           |
| no tier, `arabic`/`ja-kana`/`ko-hangul`/`ja-romaji` | `null`             | same                              | —           |
| `*` only, latin layout                              | latin + q,z        | same                              | —           |
| `*` only, `arabic`                                  | `{q,z}`            | same                              | —           |
| named only, that layout                             | latin + a          | same                              | —           |
| named only, another layout                          | `LATIN` (identity) | same                              | —           |
| **`*` + named, the named layout**                   | wildcard **lost**  | both tiers compose                | **CHANGED** |
| `*` + named, an unnamed layout                      | latin + q,z        | same                              | —           |
| `{s: []}` at `*` alone                              | `s` dropped        | same                              | —           |
| `{s: []}` at named alone                            | `s` dropped        | same                              | —           |
| **`{s: []}` at `*`, table at named**                | `s` **survives**   | `s` dropped **and** named applied | **CHANGED** |
| `*` suppressed alone                                | `null`             | `null`                            | —           |
| **`*` suppressed, table at named**                  | latin + a          | `{a}` alone                       | **CHANGED** |
| table at `*`, named suppressed                      | `null`             | `null`                            | —           |
| named table on `arabic`                             | `{a}`              | same                              | —           |
| `*` table on `arabic`                               | `{a}`              | same                              | —           |
| **`*` + named on `arabic`**                         | `{a}`              | `{a,q,z}`                         | **CHANGED** |
| named `suppress="Variants"` + `variants`            | inexpressible      | `{a}` alone                       | **NEW**     |
| `*` table, named suppress + table                   | inexpressible      | `{a}` alone                       | **NEW**     |
| `*` suppress + table                                | inexpressible      | `{a}` alone                       | **NEW**     |

Invariants preserved: identity when no tier applies (`strictEqual(..., LATIN_DIACRITIC_VARIANTS)`), and the null-prototype guard for a `__proto__`-keyed table.

## 5. Where `*` lives — decision

**`*` stays as a reserved `name` on a `LayoutPreset` in the single `customLayouts` collection.** Rejected: the semantics cluster's dedicated `layoutDefaults` 0..1 aggregation/slot carrying the same class.

Deciding reason: D3 names the wildcard tier as an existing published concept being **re-layered**, not renamed; a second aggregation and a second slot is a second public surface name and a second idiom in both twins for what is one tier of one concern. The special-casing the second aggregation removes collapses to exactly **one partition at the top of the fold loop** (the `if (name === WILDCARD_LAYOUT)` branch above, which `continue`s before any named-facet code runs, so a `*` preset's rows can never reach `fold.layouts` and `getRegisteredLayout("*")` can never return them) plus one diagnostic. The cluster's two strongest objections are answered rather than dismissed: the _"name lies"_ objection is answered by the branch being the first thing the loop does, and the _"position lies"_ objection is answered by `wildcard-field`, which reports every per-layout facet declared on a `*` preset instead of silently ignoring it.

**A `*` preset carries `variants` and `suppress="Variants"` only.** `name`, `rows`, `lang`, `layoutRole`, `locales`, `middleware` and `suppress="Middleware"` on a `*` preset are reported (`wildcard-field`) and ignored. Deciding reason for excluding middleware: D3 scopes the wildcard to the variants tier, admitting it would add a third parameter to `getMiddlewareFactory` in the hand-synced `UNCHECKED_CORE_TWINS` tier, and nobody asked for it (CLAUDE.md §1).

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

Verified at HEAD: `getRegisteredLayout` (`:95`) is `instanceLayouts?.get(name) ?? BUILTIN_LAYOUTS.get(name)`, so a rows-less preset already falls through to the built-in; `resolveLocaleMappedLayout` (`:79-81`) already accepts a locale pointed at a built-in via `instanceLayouts?.has(mapped) || BUILTIN_LAYOUTS.has(mapped)`. Only the doc comments at `:20-23` and `:41` change (they name `instanceLayouts` / `instanceLocaleLayouts`). The brief's complaint that an unresolvable locale mapping returns `null` without a word is fully covered by the fold's `unknown-target`, which fires once at authoring time instead of silently on every resolution.

## 8. D4 — the fifth concern

Say the fifth concern is a per-layout keycap label map. It folds in as a **facet**, not a surface:

1. `types.ts` — one field on `LayoutPresetSpec` (both twins).
2. `LayoutPreset` — one property + one line in `toSpec()` (both twins).
3. `preset-fold.ts` — one branch in the loop, one field on `PresetFold`, and, if it is disableable, one member on `SUPPRESSIBLE_FACETS` **and** one on `library.ts`'s `LayoutFacet` enum.
4. One resolver consuming it, in the `(name, instanceMap, defaults?)` shape.

Zero new top-level surface on the control, zero new diagnostic codes (`duplicate-*` and `unknown-suppress` fall out of the generic machinery). The apply-to-all case, if wanted, is one more admitted field in the `*` branch.

## Lifecycle

## A. Kiosk — construction, invalidation, first render, cloning, destroy

### A.1 Fields and `init()`

Delete the five `_instance*Map` fields (`KioskKeyboard.ts:158-167`) and their five `init()` resets (`:873-877`). Add:

```ts
  /** Presets folded into the lookup maps; `null` while the cache is cold or stale. */
  private _fold: PresetFold | null = null;
  /** The elements the cached fold was built from, compared element-wise on read. */
  private _foldChildren: LayoutPreset[] = [];
  /** Diagnostics already reported for the current configuration, keyed by content. */
  private _reportedDiagnostics = new Set<string>();
  /** The factory that produced `_middleware`, so a re-resolve onto the same factory is a no-op. */
  private _middlewareFactory: (() => CompositionMiddleware) | null = null;
```

`init()` seeds `this._fold = null; this._foldChildren = []; this._reportedDiagnostics.clear(); this._middlewareFactory = null;` in the existing `:872-878` block.

### A.2 The lazy memoized fold — the DEF-3 and DEF-4 fix

```ts
  /**
   * The folded view of `customLayouts`: the lookup maps every resolution path reads,
   * rebuilt only when the aggregation or one of its presets actually changed.
   *
   * Two signals, one per axis. Structure - adds, inserts, removals, reorders - is read
   * off the element list here, because `removeAggregation` (ManagedObject.js:2434),
   * `removeAllAggregation` (:2495) and `destroyAggregation` (:2587) invalidate without
   * naming a child. Content - a property write inside a parented preset - arrives as
   * `invalidate(preset)` and drops the cache there.
   *
   * Never call this from `invalidate`.
   */
  private _getFold(): PresetFold {
    const children = this.getCustomLayouts();
    if (this._fold && this._sameChildren(children)) return this._fold;
    this._foldChildren = children;
    this._fold = foldPresets(
      children.map((preset) => preset.toSpec()),
      registryIsBuiltInLayout,
    );
    this._reportDiagnostics(this._fold.diagnostics);
    return this._fold;
  }

  private _sameChildren(children: readonly LayoutPreset[]): boolean {
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
   * A property write inside a parented preset reaches this control as an invalidation
   * naming that element (ManagedObject.js:1509 -> :2623 -> Control.js:348). Dropping the
   * cache is the entire reaction; the fold is rebuilt on the next read.
   */
  override invalidate(oOrigin?: ManagedObject): void {
    if (oOrigin instanceof LayoutPreset) this._fold = null;
    super.invalidate(oOrigin);
  }
```

The flag is dropped **before** `super`, because `Control.prototype.invalidate` returns early during `_bOnBeforeRenderingPhase` (`Control.js:352-354`). `oOrigin` is a real, typed parameter on `Control` (`Control.js:348`; `@openui5/types` `sap.ui.core.d.ts:22029`) — DEF-4's "mis-states the base signature" complaint applies only to the Element-level zero-arg form at `:13330`, which this never touches. `invalidate` is a hand-written prototype method, not a generated accessor, so `super.invalidate(oOrigin)` is safe from the DEF-2 mechanism. `instanceof` is cycle-free: `KioskKeyboard.ts` already value-imports `LayoutPreset` for `defaultClass`, and `LayoutPreset.ts` imports nothing from `KioskKeyboard.ts`. Subclassed presets (the "ship a preset as a named unit" pattern) satisfy it.

`ManagedObjectObserver` was considered and is unusable: `@private @ui5-restricted sap.ui.model.base` (`ManagedObjectObserver.js:111-114`) and typed as `undefined` in `@openui5/types` (`sap.ui.core.d.ts:88124`).

**Rejected alternative (blast-radius's `_markFoldDirty` reached from five mutator overrides plus a `setProperty` override on the child).** Deciding reason: it re-incurs the DEF-2 hazard surface for five accessors it has to hand-reimplement, and it reaches into the parent by duck-typing `(this.getParent() as {_markFoldDirty?}).._markFoldDirty?.()`. The two-axis cache needs neither and additionally closes the removal-path hole that an origin-only dirty flag leaves open.

### A.3 DEF-2 — dissolved, with the escape hatch recorded and not shipped

Under the lazy fold the kiosk twin overrides **zero** aggregation mutators, so `super.addCustomLayout` is never written. `ManagedObjectMetadata.js:1782-1794` installs every accessor through `function add(name, fn, info) { if (!proto[name]) { ... } }`, and `generateAccessors()` runs from the metadata constructor (`:912`) on first `getMetadata()` — long after a TS class body populated the prototype. A TS method of the same name permanently blocks the generated one and `super.addX` resolves to `undefined`. The repo already lives with this at `KioskKeyboard.ts:1141` (`return this.setProperty("instanceLayouts", value) as this;`, never `super.setInstanceLayouts`).

For the record only — **this code does not ship** — the correct form if an override ever becomes unavoidable is the generic low-level API, transcribed from `Aggregation.prototype.generate` (`ManagedObjectMetadata.js:1811-1815`):

```ts
addCustomLayout(p: LayoutPreset): this { this.addAggregation("customLayouts", p); return this; }
insertCustomLayout(p: LayoutPreset, i: number): this { this.insertAggregation("customLayouts", p, i); return this; }
removeCustomLayout(v: number | string | LayoutPreset): LayoutPreset | null { return this.removeAggregation("customLayouts", v) as LayoutPreset | null; }
removeAllCustomLayouts(): LayoutPreset[] { return this.removeAllAggregation("customLayouts") as LayoutPreset[]; }
destroyCustomLayouts(): this { this.destroyAggregation("customLayouts"); return this; }
```

### A.4 `applySettings` — two-phase, canon-backed

Replaces `KioskKeyboard.ts:786-814` including the false doc comment at `:796-799` (`ManagedObject.js:534` calls `applySettings` unconditionally).

```ts
  /**
   * Applies `customLayouts` in its own pass before everything else, then injects the
   * locale-detected layout when the caller named none.
   *
   * The presets go through `super.applySettings` rather than being read out of
   * `mSettings`: that is what makes an object literal and a `LayoutPreset` instance the
   * same input. A literal is constructed through the aggregation's `defaultClass`
   * (ManagedObject.js:1076) and each value passes `validateProperty` exactly once, so
   * `locales: "pl"` widens to `["pl"]` (ManagedObject.js:1621-1624) whichever form the
   * caller wrote. By the time `layout` is applied, `setLayout`'s registry validation and
   * the locale default below both resolve through the complete set of presets.
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

**Rejected alternatives:** (i) normalizing inside a pre-read — constructing throwaway `LayoutPreset`s duplicates any author-supplied `id` and throws on the second construction, while hand-mirroring the coercions means keeping a normalizer permanently in sync with `validateProperty`'s `string[]` widening, `null` collapse and array `slice`; (ii) resolving the locale default lazily at `onBeforeRendering` — `new KioskKeyboard({customLayouts:[…]}).getLayout()` would return `"qwerty"` until first paint and the unregistered-layout warning would move to a render that may never happen; (iii) a read-only pre-read — the divergence is a coercion problem, not a diagnostics problem.

**Behaviour delta: none observable.** `getLayout()` immediately after `new` still returns the locale-derived name; the unregistered-layout warning still fires at construction; `instance-overrides.qunit.ts:198/217/236/260/366/385` and `KioskKeyboard-layout.qunit.ts:912/935/952/1154` keep their answers. Residual cost, stated: the view settings-preprocessor (`ManagedObject.js:1274`, installed by `View.js:562`) runs twice when phase 1 fires. It is idempotent, and SAP ships the identical exposure. Phase 1 is skipped entirely when no `customLayouts` is given, so the no-preset path is a single `super` call.

### A.5 DEF-3 — dead by arithmetic

Constructing `new KioskKeyboard({ layout, customLayouts: [a, b, c] })`: phase 1 runs `addAllToAggregation` (`ManagedObject.js:1251-1259`), whose three mutator calls only null the cache; the fold then runs **once**, over the complete list, between the phases; every later read is a cache hit. **One fold, one diagnostic pass** — against N folds and N prefix-list diagnostic passes, including the spurious `unknown-target` that the flagship diagnostic would otherwise emit on correct input when an overlay precedes the preset declaring its rows.

The ordering constraint the semantics cluster hands over is therefore satisfied structurally, not by the dedupe set: `_reportDiagnostics` is called only from `_getFold`, and `_getFold` is never called from a mutator. The dedupe key-set additionally makes repeated emission idempotent for the incremental case (`kb.addCustomLayout(a)` then a render then `kb.addCustomLayout(b)`), where a transient `unknown-target` is genuine and clears itself when `b` lands.

### A.6 Read sites

`_performLayoutSwitch` (`:1071`) → `this._getFold().layouts`; `_resolvedLayoutName` (`:1896`); `_getLayoutLang` (`:1906`) → `.layoutMeta`; `_getResolvedLayout` (`:1912`, `:1929`) → `.layouts` / `resolveVariantTable(name, fold.variants, fold.defaultVariants)`; `_tryCompositionMiddleware` (`:2274`) → `.middleware`; `_warnDisarmedVariants` (`:1937-1945`) → `fold.variants !== undefined || fold.defaultVariants !== undefined`. The public statics (`KioskKeyboard.isSecondaryLayout` `:643`, `.getLocaleLayout` `:735`, `.getRegisteredLayout` `:748`) pass no instance tier and are unchanged.

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

`_endComposition` (`:1118-1123`) already commits. Both fields start `null`, so the first key on `ko-hangul` takes the change branch with a no-op `_endComposition`. Null `_middlewareFactory` alongside every existing `this._middleware = null` site.

**The invariant:** the only code that can end a composition is (a) `_applyLayout` on a real layout switch (`:1109`), (b) a target/keyboardType switch (`:1343-1345`), (c) this factory-identity check at the next composition-affecting key. Nothing runs from `invalidate`, from a setter, or from the fold. `preset.setLang("pl")` nulls a cache and returns; a half-typed Hangul syllable is untouched.

### A.8 Cloning

`ManagedObject.prototype.clone` (`:4520 ff.`) iterates `mProperties` first and `mAggregations` second, so `layout` precedes `customLayouts` in the clone's settings — a single-phase `applySettings` would run `setLayout("pl-warehouse")` against an empty fold and warn and bail. The two-phase form makes `kb.clone()` correct, and it must be a regression test: it is the one path that exercises the hoist without any consumer writing settings in that order. Each preset is deep-cloned with a derived id and its property _values_ shared by reference — strictly better than HEAD, where two clones share one mutable `Record`. The `BindingInfo.UI5ObjectMarker` stamp applied to non-frozen object property values during clone is a `Symbol` (`BindingInfo.js:20`), so it is invisible to `Object.entries` and cannot corrupt variant-table validation.

### A.9 Destroy

`exit` needs nothing: `ManagedObject.prototype.destroy` (`:2964`) calls `this.exit()` at `:2999-3001` and only then runs the aggregation-destroy loop at `:3009-3011`. `KioskKeyboard.ts:936-970` changes only where the deleted fields were referenced.

### A.10 One exotic hazard the aggregation newly exposes

`BindingInfo.extract` treats any object with `oValue.path != undefined || oValue.parts` as a binding info (`BindingInfo.js:184`), and `applySettings`'s PROPERTY branch calls `extractBindingInfo` (`ManagedObject.js:1330-1336`). Today the exposed object is the outer `{layoutName: table}` map, so only a _layout named_ `path` collides; as a top-level `LayoutPreset#variants` the table itself is inspected, so a variant table with a base letter `path` or `parts` is mis-read. `rows` is an array and is unaffected. Document the `ui5object: true` escape hatch (`BindingInfo.js:181-183`) in the `variants` doc-block.

---

## B. webc — construction, invalidation, first render, cloning, destroy

### B.1 DEF-1 — the fatal defect, and the fix

Confirmed in the installed `@ui5/webcomponents-base@2.22.0`: `_invalidate` returns early on `this._suppressInvalidation` (`UI5Element.js:69-74`), which is initialised `true` in the constructor (`:121`) and first cleared inside `_render`'s `finally` **after** `onBeforeRendering()` (`:669-684`). `connectedCallback` runs `_startObservingDOMChildren()` (`:213`) then `await this._processChildren()` (`:214`) **before** `renderImmediately(this)` (`:222`), and `_processChildren` writes `this._state[propertyName]` directly (`:346-349`) with its own `_invalidate` (`:397-410`) inside the suppression window. A prior probe under the package's own vitest/jsdom logged exactly this: `onBeforeRendering` fired with `presets.length === 1` and `onInvalidation` was never called.

**The array is populated before first render; only the notification is missing.** So the fold is **lazy and memoized, read on demand** — never assembled from `onInvalidation`. That is also the first-party idiom: `ui5-table` declares no `onInvalidation` at all and reads `this.features` lazily at `Table.js:171, 191, 197, 203, 217`.

`onEnterDOM` runs at `:225`, **after** `renderImmediately` at `:222`, so `KioskKeyboard.ts:867-872`'s `_baseLayout = this.layout || this._localeLayout()` seed is evaluated during the first render. With an eager fold a `<kiosk-keyboard-preset locales="pl">` present at connect time is ignored on first paint; with the lazy fold it is honoured with no pre-population hack.

```ts
  private _foldCache: PresetFold = EMPTY_FOLD;
  private _foldKey: readonly ILayoutPreset[] = [];
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
   * `onBeforeRendering` onward. The lazy contract `ui5-table` uses for `this.features`.
   *
   * Rebuilt only when the slotted elements change identity or one of them reports a
   * property change, so diagnostics are emitted once per real change, not once per read.
   */
  private _getFold(): PresetFold {
    const children = this.customLayouts;
    if (this._foldedEpoch === this._foldEpoch && sameElements(this._foldKey, children)) return this._foldCache;
    this._foldKey = children;
    this._foldedEpoch = this._foldEpoch;

    const specs: LayoutPresetSpec[] = [];
    for (const child of children) {
      if (isLayoutPreset(child)) specs.push(child.toSpec());
      else console.warn(`[kiosk-keyboard] Ignoring <${child.localName}> in the customLayouts slot: not a <kiosk-keyboard-preset>.`);
    }
    this._foldCache = foldPresets(specs, isBuiltInLayout);
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
    // branch covers a preset being added, removed, reordered or edited. It never fires for
    // the slot content present at connect time, which is why the fold above is lazy.
    if (changeInfo.type === "slot" && changeInfo.name === "customLayouts") this._foldEpoch++;
  }
```

`invalidateOnChildChange: { properties: true, slots: false }` — both keys are required by `SlotInvalidation` (`UI5ElementMetadata.d.ts:3-6`); `{ properties: true }` alone does not compile (`TS2322: Property 'slots' is missing`). The listener is attached only `if (instanceOfUI5Element(child) && slotData.invalidateOnChildChange)` (`UI5Element.js:385-388`), which is why the child **must** extend `UI5Element`.

`managedSlots` is unavoidable and is newly incurred: both `slot-strict.js:50` and the deprecated `slot.js:51` set `ctor.metadata.managedSlots = true`, and without it `getInitialState` never seeds `_state` (`UI5ElementMetadata.js:17-26`), `_generateAccessors` never defines the accessor (`UI5Element.js:1014-1017`) and `connectedCallback` never calls `_processChildren` (`:209-215`). Measured cost (jsdom, warm, 2.22.0): 0.271 ms `appendChild`→first `onBeforeRendering` with zero children, 1.017 ms with one defined child. The real change is that first render stops being synchronous inside `appendChild`, not latency.

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

**Picked the kiosk shape over the webc-lifecycle cluster's `_syncMiddlewareToFold()` in `onInvalidation`.** Deciding reason: symmetry across the twins for a behaviour that lives in the hand-synced host tier and would otherwise silently diverge, plus it never commits a preedit from inside an invalidation or a render pass. Null `_middlewareFactory` alongside the three existing `this._middleware = null` sites (`:907`, `:983`, `:1787`).

### B.4 Rendering, cloning, destroy

`KioskKeyboardTemplate.tsx` renders no `<slot name="customLayouts">`: presets are configuration and are never projected, mirroring `TableTemplate.js` omitting `features`. `LayoutPreset` has no renderer/template/styles, so `_needsShadowDOM()` (`UI5Element.js:951-953`) is false and it attaches no shadow root — no CSS, no layout impact, no visual-regression surface. There is no clone concept; `cloneNode(true)` on the host copies the light-DOM children as ordinary elements. Teardown is the platform's: removing a preset fires `_updateSlots`, the array identity changes, the next read refolds.

---

## C. The six defects, and where each is fixed

| defect                                                          | fix                                                                                                                                                                                                                | file:line of the fix                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| **DEF-1** webc fold empty for the first render                  | fold is lazy and memoized, read on demand from `_getFold()`; `onInvalidation` only bumps an epoch                                                                                                                  | webc `KioskKeyboard.ts` `_getFold()` / `onInvalidation` (§B.1) |
| **DEF-2** `super.addPreset` does not exist                      | zero mutator overrides on kiosk; all nine accessors stay generated. Escape-hatch form recorded, not shipped                                                                                                        | §A.3                                                           |
| **DEF-3** N folds, N diagnostic passes over partial lists       | lazy fold + two-phase `applySettings`: exactly one fold over the complete list between the phases; `_reportDiagnostics` is reachable only from `_getFold`                                                          | §A.2, §A.4, §A.5                                               |
| **DEF-4** re-fold from `invalidate` can tear down an IME buffer | `invalidate(oOrigin)` body is one statement — drop a cache; the composition invariant moves to the next composition-affecting key. Base signature taken from `Control.js:348`, not the Element-level zero-arg form | §A.2, §A.7                                                     |
| **DEF-5** three lost tri-states                                 | `layoutRole` sentinel enum for (c); shared `suppress: LayoutFacet[]` for (a) and (b); `middleware-registry` widened to `\| null` with a `.has()` read                                                              | semantics §3, §6                                               |
| **DEF-6** a second generated interface unguarded                | staged CI gate over a glob (`git add -A` then `git diff --cached`), probed — a plain `git diff` passes an untracked `*.gen.d.ts`                                                                                   | migration §5                                                   |

## Module layout

## New modules

| path                                                   | tier                     | notes                                                                          |
| ------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------ |
| `packages/kiosk-keyboard/src/LayoutPreset.ts`          | kiosk host (framework)   | `sap.ui.core.Element` subclass. Top level, **not** `internal/`                 |
| `packages/kiosk-keyboard/src/LayoutPreset.gen.d.ts`    | generated, **committed** | see below                                                                      |
| `packages/kiosk-keyboard/src/internal/preset-fold.ts`  | **byte-compared**        | new `CORE_MODULES` entry                                                       |
| `packages/kiosk-keyboard-webc/src/LayoutPreset.ts`     | webc host (framework)    | `UI5Element` subclass, tag `kiosk-keyboard-preset`. Top level, **not** `core/` |
| `packages/kiosk-keyboard-webc/src/core/preset-fold.ts` | **byte-compared**        | twin of the above                                                              |

Both `LayoutPreset.ts` files sit at `src/` top level deliberately: `tools/check-twin-drift.mjs:261-262` reconciles the intersection of `internal/` and `core/` basenames, and the completeness guard fails on any same-named pair not listed in `CORE_MODULES` or `UNCHECKED_CORE_TWINS`. Two framework-specific classes must never be paired.

`preset-fold.ts` contents: `LayoutPresetSpec` re-export surface, `PresetFold`, `EMPTY_FOLD`, `foldPresets`, `foldVariantOverlay`, `SUPPRESSIBLE_FACETS` / `SuppressibleFacet`, `WILDCARD_LAYOUT`, `LayoutDiagnostic` + `DiagnosticCode`, `DiagnosticVocabulary`, `describeDiagnostic`, and the two validators `isValidLayoutDefinition` / `isValidVariantTable` moved off the host classes.

Import graph, verified framework-free: `preset-fold` → `latin-variants` (value: `mergeVariantTables`; types) → `layout-meta` (value: `BUILTIN_LAYOUT_META`). It must **not** import `layout-registry` (`normalizeLowerString` logs, `:61-71`) or `middleware-registry` (which pulls the 8.9 KB Hangul composer into the leaf tier). Zero `Log.` / `console.` — mandatory, because all nine current `CORE_MODULES` contain zero logging and `normalize()` in the drift checker cannot reconcile kiosk's `Log.warning` with webc's `console.warn`.

## Deleted modules

| path                                                                                        | reason                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/kiosk-keyboard-webc/src/core/memo-map-view.ts`                                    | its only consumers were the five `MemoMapView`s at `KioskKeyboard.ts:1290-1332` |
| `packages/kiosk-keyboard-webc/test/unit/memo-map-view.test.ts`                              | 6 tests / 64 lines, deleted with the module                                     |
| `packages/kiosk-keyboard-webc/test/unit/zz-probe-managedslots.test.ts`, `zz-probe2.test.ts` | stray untracked probe files inside vitest's include glob (Stage 0)              |

`memo-map-view` is webc-only, so it is absent from `sharedCoreNames` (`check-twin-drift.mjs:261`) and its removal moves neither `EXPECTED_PAIR_COUNT` nor `reconcile()`. Also delete its line at `docs/kiosk-webc/ARCHITECTURE.md:36`.

## Changed modules

### Byte-compared tier (`CORE_MODULES`) — **must land in both twins in one commit or CI is red**

| module               | change                                                                                                                                                                                                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `latin-variants.ts`  | `VariantOverlay` added; `InstanceVariants` retyped to `ReadonlyMap<string, VariantOverlay>`; `mergeVariantTables` exported; `applyVariantOverlay` added; `resolveVariantTable` gains a third `defaults?: VariantOverlay` parameter and becomes a three-tier apply; `WILDCARD_LAYOUT` (`:65`) deleted (it moves to `preset-fold.ts`) |
| `layout-meta.ts`     | **doc only** — `:61-66` (`InstanceLayoutMeta` provenance names `instanceLayouts`) and `:75-76` (the "`variants` is not resolved here … that tier is `instanceVariants`" sentence). No code change: `resolveLayoutMeta` `:78-84` and `isSecondaryLayout` `:87-89` already carry the (c) tri-state correctly                          |
| **`preset-fold.ts`** | new                                                                                                                                                                                                                                                                                                                                 |

`WILDCARD_LAYOUT`'s other usages today are `latin-variants.ts:104` and the four tests (`latin-variants.qunit.ts:4,180,195`; `latin-variants.test.ts:5,163,172`) — nothing else in `src/`.

### Unchecked tier (`UNCHECKED_CORE_TWINS`, still 7 entries) — hand-mirrored, CI will not catch a one-sided landing

| module                   | change                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `middleware-registry.ts` | `InstanceMiddleware` widened to `ReadonlyMap<string, (() => CompositionMiddleware) \| null>`; `getMiddlewareFactory` `:30-35` switches from the `??` chain to a `.has()` read; the `:13-14` doc comment names `customLayouts` |
| `layout-registry.ts`     | **comments and parameter doc only** (`:20-23`, `:41`). Signatures and logic unchanged                                                                                                                                         |

### Host tier

`packages/kiosk-keyboard/src/KioskKeyboard.ts` — delete the four property blocks (`:387-460`), the four setters (`:1131-1171`), `_readInstanceLayouts` (`:1183-1205`), `_readLayoutInput` (`:1215-1225`), `_toStringMap` (`:1238-1248`), `_toMiddlewareMap` (`:1250-1260`), `_toVariantMap` (`:1262-1280`), `_isValidLayoutDefinition`, `_isValidVariantTable`, the five cache fields (`:158-167`), the five `init()` resets (`:873-877`), and the four now-orphaned imports. Add the `customLayouts` aggregation, `_fold`/`_foldChildren`/`_reportedDiagnostics`/`_middlewareFactory`, `_getFold`/`_sameChildren`/`_reportDiagnostics`, the `invalidate` override, the two-phase `applySettings`. Rewrite the six read sites and the JSDoc examples at `:185, 299, 628-629, 668, 676, 726, 742`.

`packages/kiosk-keyboard-webc/src/KioskKeyboard.ts` — delete the four `@property({type: Object})` blocks (`:514-592`), the `MemoMapView` block (`:1290-1332`) and its import (`:39`), `_readLayoutInput` (`:1334-1352`), the `instanceMiddleware` `onInvalidation` branch (`:1019-1027`). Add the `@slot`, the lazy fold, `_reportDiagnostics`, `_ensureMiddleware`, the `customLayouts` `onInvalidation` branch, and the **missing registry check on the `layout` property** at `:962-965` (Stage 0). Rewrite reads at `:1218-1219, 1239, 1251, 1255, 1269, 1658, 1774, 1795` and JSDoc at `:272, 278, 387, 501, 634`.

`packages/kiosk-keyboard/src/library.ts` — see surface §1.
Both `types.ts` — delete `LayoutSpec` / `LayoutInput`, add `LayoutPresetSpec`; webc `types.ts` additionally houses `LayoutRole` / `LayoutFacet`.
`packages/kiosk-keyboard-webc/src/bundle.esm.ts` — add `export { default as LayoutPreset } from "./LayoutPreset.js";` and `LayoutPresetSpec` / `LayoutRole` / `LayoutFacet` to the type re-exports; remove `LayoutSpec` / `LayoutInput` (`:16-17`).
`packages/kiosk-keyboard-webc/package.json` — add `"./dist/LayoutPreset.js"` to `sideEffects` and a `"./LayoutPreset"` entry to `exports`.

## `tools/check-twin-drift.mjs`

```js
const CORE_MODULES = [
  "grapheme", "auto-repeat", "shift-state", "composition-utils", "key-token",
  "key-action-meta", "layout-constraint", "latin-variants", "layout-meta",
  "preset-fold",
];
...
const EXPECTED_PAIR_COUNT = 28;   // LAYOUTS(18) + CORE_MODULES(10)
```

Both edits in one commit — the guard at `:220-223` fails if they disagree, and `reconcile()` at `:262` fails if `preset-fold` exists in both directories without being listed. Also refresh the stale header comment at `:26-29` ("registry is static-class-based in webc" — false at HEAD; both are module-scoped `const Map`s). Baseline verified green right now: 27 pairs in sync, style-twin 40/44, dom-contract in parity.

## Generated artifacts

| artifact                                                                                                      | status                                                                        | requirement                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts`                                                          | committed, `linguist-generated`                                               | regenerate; the 47 occurrences at `:5-8, 96, 155-215, 510, 531, 682-852` collapse to the aggregation's nine accessors                                                                                                                                                                                                                                                                               |
| `packages/kiosk-keyboard/src/LayoutPreset.gen.d.ts`                                                           | **new, committed**                                                            | CLAUDE.md's deciding principle applies verbatim — the class uses `$LayoutPresetSettings` without importing it, so the IDE and a bare `tsc --noEmit` need it on disk, and kiosk ships `src/` to npm. `.gitattributes` already globs it. Do **not** import it as `"./LayoutPreset.gen"`: these are ambient `declare module "./X"` augmentations (`KioskKeyboard.gen.d.ts:13`), not importable modules |
| `packages/kiosk-keyboard-webc/src/generated/**`                                                               | gitignored (`.gitignore:10`)                                                  | no action; `LayoutPreset` needs no i18n or theme entry                                                                                                                                                                                                                                                                                                                                              |
| `packages/kiosk-keyboard-webc/dist/custom-elements.json` (+ `vscode.html-custom-data.json`, `web-types.json`) | gitignored (`.gitignore:2`), asserted present by `check-package-smoke.mjs:40` | must newly report `slots: [{name: "customLayouts"}]` on `kiosk-keyboard` and a second declaration for `kiosk-keyboard-preset`                                                                                                                                                                                                                                                                       |

**There is no DEF-6 analogue on the webc twin** — every generated manifest is gitignored, matching CLAUDE.md's asymmetry rule.

**Do not claim zero phantom attributes.** `custom-elements-manifest.config.mjs:245-260` pushes an `attributes` entry for every member gated only on `member.privacy === "public"`, and `_ui5noAttribute` (recorded at `:238`) is never consulted. The four phantom `instance-*` attributes are replaced by three on the child (`rows`, `variants`, `middleware`): **4 → 3, not 4 → 0**. Either land the generator-side suppression or update `docs/kiosk-webc/CUSTOM-ELEMENTS-MANIFEST.md:69-71` to name the new three.

## Diagnostics

## Design

The catalogue lives in the **byte-compared** `preset-fold.ts` as structured data plus a vocabulary-injected formatter, so the two twins cannot disagree on facts while still spelling their own surface names. It contains zero `Log.` / `console.`. There is no free-text `detail` field — everything is structured, so `describeDiagnostic` is total.

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
  | "duplicate-locale"
  | "wildcard-field";

export interface LayoutDiagnostic {
  readonly code: DiagnosticCode;
  /** The layout the offending preset names; "" for the `*` preset or an unnamed one. */
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
  /** `"<kiosk:LayoutPreset>"` / `"<kiosk-keyboard-preset>"`. */
  readonly preset: string;
  /** Every built-in layout name, for the "did you mean" tail of `unknown-target`. */
  readonly builtInLayouts: readonly string[];
}

export function describeDiagnostic(d: LayoutDiagnostic, vocab: DiagnosticVocabulary): string;
```

## The catalogue — 11 fold codes

| code                   | trigger                                                                                                               | message                                                                                                              | remediation                                                                                                                                                                                        | today                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `empty-name`           | a preset whose `name` is empty after trim                                                                             | _"A {preset} in the {customLayouts} declares no name, so nothing resolves it."_                                      | _"Set `name` to the layout it declares or overlays, or `\*` to address every layout."_                                                                                                             | silent                                                                                                                         |
| `invalid-rows`         | `rows` declared, fails `isValidLayoutDefinition`                                                                      | _"`rows` on the {preset} for \"X\" is not a layout definition."_                                                     | _"Expected a non-empty array of non-empty rows where every key has a non-empty string `value`. The preset's other facets still apply."_                                                            | warns **and drops the whole entry** (`:1134`)                                                                                  |
| `invalid-variants`     | `variants` declared, fails `isValidVariantTable`                                                                      | _"`variants` on the {preset} for \"X\" is not a variant table."_                                                     | _"Expected a non-empty object mapping lowercase base letters to arrays of non-empty glyph strings; an empty array suppresses that letter. To opt \"X\" out entirely use `suppress=\"Variants\"`."_ | warns (`:1268`)                                                                                                                |
| `invalid-middleware`   | `middleware` declared, not a function                                                                                 | _"`middleware` on the {preset} for \"X\" is not a function."_                                                        | _"Supply a factory returning a `CompositionMiddleware`; to disable the built-in use `suppress=\"Middleware\"`."_                                                                                   | **silent** (`_toMiddlewareMap:1254` skips non-functions)                                                                       |
| `invalid-locale`       | a `locales` token empty after trim                                                                                    | _"`locales` on the {preset} for \"X\" contains an empty entry."_                                                     | _"Every entry must be a non-empty BCP-47 prefix, e.g. `pl` or `de-at`."_                                                                                                                           | **silent** (`:1243-1244`)                                                                                                      |
| `unknown-target`       | a preset declares facets but no `rows`, and `name` is neither a built-in nor declared with `rows` by any other preset | _"The {preset} for \"X\" declares facets but no `rows`, and no layout of that name exists, so nothing resolves it."_ | _"Add `rows`, or correct the name — the built-ins are: {builtInLayouts}."_                                                                                                                         | **silent** — the flagship                                                                                                      |
| `unknown-suppress`     | a `suppress` token outside `SUPPRESSIBLE_FACETS`                                                                      | _"`suppress` on the {preset} for \"X\" names \"Y\", which is not a suppressible facet."_                             | _"Valid facets are: Variants, Middleware. Rows cannot be suppressed: a preset shadows a built-in layout, it never removes it."_                                                                    | n/a                                                                                                                            |
| `duplicate-rows`       | two presets declare `rows` for one name                                                                               | _"Two presets declare `rows` for \"X\"; the later one wins."_                                                        | _"Remove one, or give them different names."_                                                                                                                                                      | unrepresentable                                                                                                                |
| `duplicate-middleware` | two presets declare `middleware` for one name                                                                         | same shape                                                                                                           | same                                                                                                                                                                                               | unrepresentable                                                                                                                |
| `duplicate-locale`     | two presets claim one BCP-47 prefix for different layouts                                                             | _"Both \"X\" and \"Y\" claim the locale \"pl\"; \"Y\" wins."_                                                        | _"Remove the prefix from one of them."_                                                                                                                                                            | unrepresentable (an object literal cannot repeat a key) — **a hazard the N-preset fold introduces, so this code is mandatory** |
| `wildcard-field`       | a `*` preset declares `rows`, `lang`, `layoutRole`, `locales` or `middleware`, or `suppress="Middleware"`             | _"A `\*` preset applies to every layout, so it cannot declare `<facet>`."_                                           | _"Move it to a preset that names one layout."_                                                                                                                                                     | today those fields are silently meaningless under `"*"`                                                                        |

`unknown-target` subsumes and improves on `resolveLocaleMappedLayout` returning `null` without a word (`layout-registry.ts:79-84`): it fires once at authoring time instead of silently on every locale resolution, which is why `layout-registry.ts` needs no code change.

**Three codes from the grafted catalogue are deliberately absent, and each absence is a win:**

- `unknown-field` (and its edit-distance suggester) is **structurally impossible** under child elements: `ManagedObject.applySettings` throws on an unknown setting, and a custom element ignores an unknown attribute.
- `shadowed-wildcard` existed only to report the D3 defect; the re-layering retires it — the tiers now compose.
- `variants-reopt` described suppress-then-redeclare, which under `suppress` as an ordered operator is the intended idiom, not an error.

## Host-side codes (not fold diagnostics)

- **`disarmed-variants`** survives where it is (kiosk `:1937-1945`, webc `:1283-1288`) with its own once-per-instance boolean: its trigger reads `accentVariants`, a host property the fold cannot see. Trigger re-expressed as `fold.variants !== undefined || fold.defaultVariants !== undefined`. It gains the ability to name the offending presets.
- **`unregistered-layout`** exists on kiosk (`:1071-1077`) and is **missing entirely on webc** (`:962-965` has no registry check). Adding it is Stage 0, independent of this design. The structured vocabulary also fixes an existing divergence: kiosk's message names the remedy, webc's does not.

## Where diagnostics are logged, and the emission cap

The fold is pure and returns every diagnostic; each host owns the cap.

- kiosk: `Log.warning(describeDiagnostic(d, KIOSK_DIAGNOSTIC_VOCABULARY), undefined, "ui5.kiosk.KioskKeyboard")`, from `_reportDiagnostics`, called only from `_getFold()`.
- webc: `console.warn("[kiosk-keyboard] " + describeDiagnostic(d, WEBC_DIAGNOSTIC_VOCABULARY))`, same shape.

Cap: **once per control per distinct diagnostic**, keyed `${code}|${layout}|${facet}|${other}|${value}` in a per-instance `Set`, cleared when a fold produces zero diagnostics so a fault re-introduced later is reported again. This generalises the existing `_warnDisarmedVariants` boolean.

**Ordering is guaranteed structurally, not by the cap.** `unknown-target` and the `duplicate-*` codes are second-pass properties of the _complete_ preset list: an overlay preset added before the preset that declares its rows would produce a spurious `unknown-target`, and a dedupe set cannot retract a warning. The kiosk two-phase `applySettings` folds exactly once, after phase 1 has added every child; the webc lazy fold reads the fully-populated slot array. Neither ever folds a prefix during construction. For genuinely incremental imperative authoring (`kb.addCustomLayout(a)`, render, `kb.addCustomLayout(b)`) a transient `unknown-target` is correct and clears itself when `b` lands.

## `library.ts:197-200` policy change, stated deliberately

Today's comment explains that the four record types are coarse-validated because _"ManagedObject throws when a type rejects a value, which would turn one bad entry into a broken control"_. Under the new surface a **typo in a closed enum throws**: `createArrayType.isValid` rejects any member failing the component type (`DataType.js:371-384`), `createEnumType.parseValue` yields `undefined` for an unknown XML token (`:445-447`), and `validateProperty` throws at `ManagedObject.js:1635-1638`. That is intentional and narrow — it applies to closed enum attributes (`layoutRole`, `suppress`), not to arbitrary consumer record data, and it has in-control precedent: `mobileKeyboard="Bogus"` throws today. Loud failure is the direct answer to DEF-5's silent-semantics grievance and gets its own test so the behaviour is pinned rather than accidental. On webc, where nothing can throw, `unknown-suppress` covers the same typo.

## Migration

## Blast radius (re-verified at HEAD `cc34a371`, clean tree)

**67 files / 677 occurrences** of the four names, case-insensitive: kiosk `src` 11/187, kiosk `test` 18/171, webc `src` 8/74, webc `test` 14/77, `demo-app` 3/6, `docs` 11/73, kiosk `README.md` 39, webc `README.md` 50. Under D2's rename **all 677 are rewrites** — the ~76 incidental `instanceLayouts`-only sites that a plain-Record design would have left alone do not survive. Per name: `instanceLayouts` 282/51 files, `instanceVariants` 131/21, `instanceLocaleLayouts` 84/16, `instanceMiddleware` 78/23.

`check:base` = `fmt:check → lint → lint:ui5 → typecheck → test:patches → test:lint-plugins → test:twin-drift → test:style-twin-drift → test:dom-contract → test:qunit → test:kiosk-webc → test:kiosk-webc:component → test:packages:smoke`. It does **not** include e2e or visual. Every stage below must leave it green.

---

## Stage 0 — HEAD bug fixes. No API change, no design commitment.

Independently valuable and independently revertable.

1. **Data-loss fix, failing test first (CLAUDE.md §3).** kiosk `KioskKeyboard.ts:1155-1161` and webc `:1019-1027` unconditionally `reset()` the composition on any identity change to `instanceMiddleware`; `types.ts:247` documents `reset()` as clearing state _without committing_. Fix on the existing property: cache the factory, act only when the factory in effect for the **resolved** layout actually changed, and commit (kiosk `_endComposition()` `:1118-1123`; webc the `:981-984` commit+null path). Test: type a partial Hangul syllable, swap the middleware, assert the syllable reached the target.
2. Delete the false `applySettings` doc comment, `KioskKeyboard.ts:796-799` (`ManagedObject.js:534` calls `applySettings` unconditionally).
3. Fix `packages/kiosk-keyboard/README.md:344`'s stale `object | null` claim (falsified by `KioskKeyboard.gen.d.ts:172,730`).
4. Add webc's missing registry check on the `layout` property (`KioskKeyboard.ts:962-965`), matching kiosk `:1071-1077`, with a regression test in `test/component/`.
5. **DEF-6 — `.github/workflows/ci.yml:57-63`.** The widened-glob fix alone is insufficient: probed, an untracked `packages/kiosk-keyboard/src/ZZTest.gen.d.ts` **passes** `git diff --exit-code -- ':(glob)packages/kiosk-keyboard/src/**/*.gen.d.ts'` (exit 0), because `git diff` does not see untracked files — precisely the DEF-6 scenario. Staging first is required and does fail correctly:

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
8. Add `src/LayoutPreset.gen.d.ts` to `tools/check-package-smoke.mjs`'s kiosk `requiredFiles` (`:25-30`) — do this in Stage 3, when the file exists.
9. **Do NOT touch `instance-property-types.tsd.ts` here.** Its polarity is correct against HEAD's metadata; it only inverts when the metadata changes.

## Stage 1 — D3: `*` becomes the lower variant tier. Cannot be split across packages.

`latin-variants.ts` in **both** twins (byte-compared: a one-sided landing is red). `VariantOverlay`, `InstanceVariants` retyped, `mergeVariantTables` exported, `applyVariantOverlay`, the three-tier `resolveVariantTable`, `WILDCARD_LAYOUT` moved out. Host call sites adapt their existing `_instanceVariantsMap` to build overlays — still entirely on the four-property API.

Tests: rename `latin-variants.qunit.ts:192` / `latin-variants.test.ts:170` to what they actually assert (a `null` named entry, unchanged by the re-layering) and add the four changed cases plus the three newly-expressible ones. Docs: kiosk `README.md:610,623,626`, webc `README.md:497,509,512`. The doc-only `layout-meta.ts` touch rides here or in Stage 2 — **never** with Stage 3, because it is byte-compared.

Run the §7 adversarial pass (H1) before trusting this stage.

## Stage 2 — `preset-fold.ts` in both packages, unwired. Cannot be split across packages.

New byte-compared pair; `CORE_MODULES` + `EXPECTED_PAIR_COUNT` 27 → 28 in one edit. `LayoutPresetSpec` added to both `types.ts` alongside the still-shipping `LayoutSpec`. Two new unit suites (`preset-fold.qunit.ts`, `preset-fold.test.ts`) covering document order, every per-facet rule, `suppress` at each tier, `*`-field rejection, and **every diagnostic code**. Nothing else changes, so nothing can regress. Adversarial pass required before Stage 3 — the fold is the single point where every semantic is enforced.

## Stage 3 — kiosk cutover. Atomic within the kiosk package; webc untouched and green.

Files, exhaustively:

- **new** `src/LayoutPreset.ts`; `npm run generate`; **commit both** `src/KioskKeyboard.gen.d.ts` and `src/LayoutPreset.gen.d.ts`
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
- `tools/check-package-smoke.mjs` (`src/LayoutPreset.gen.d.ts`)
- the demo-app rewrite (below)

**Demo app.** 3 files / 6 occurrences; **zero i18n keys** (`webapp/i18n/i18n.properties` is 2 lines), **zero fragments**, **zero manifest entries touching the properties** (only the name-only route `manifest.json:153-157` and target `:260-264`). `deploy-pages.yml:89` copies all of `packages/demo-app/dist/.` and `tools/trim-pages-dist.mjs` prunes only `resources/sap/*`, so all 21 routes ship including `#/kiosk/custom-layouts`.

- `webapp/view/KioskCustomLayouts.view.xml` — rewritten as the headline declarative example (see the surface section's XML snippet), plus the prose `<Text>` at `:14`
- **new** `webapp/layouts/custom-layouts.ts` — the five `LayoutDefinition` constants moved out of the controller (`:7-107`) so they can feed a `JSONModel`
- **new** `webapp/middleware/warehouse.ts` — a real `CompositionMiddleware` factory (port the emoticon one already in `packages/kiosk-keyboard-webc/test/pages/index.js:104-135`), so `middleware="Warehouse.createMiddleware"` resolves
- **new** `webapp/preset/PlWarehousePreset.ts` — `extends LayoutPreset`, `static metadata = { library: "demo.hotkeys" }`, demonstrating the "ship a preset as a named unit" claim rather than asserting it
- `webapp/Component.ts` — register the `layouts>` JSONModel
- `webapp/controller/KioskCustomLayouts.controller.ts` — delete `CUSTOM_LAYOUTS` (`:121-127`), the `kb.setInstanceLayouts(...)` call (`:139`), the `LayoutInput` import (`:3`); keep `LAYOUT_DESCRIPTIONS` (`:109-119`)
- `webapp/controller/KioskProgrammatic.controller.ts` (`:3, 107-108, 119-120, 140, 152-153, 187-194`) — the aggregation removes the read-modify-write of a whole record

**Demo guardrail gap, closed in this stage.** `packages/demo-app` is covered in `check:base` by `typecheck:demo` and `lint:ui5` **only**: `flp-lifecycle.spec.ts` is in `SEPARATE_CONFIG_SPECS` (`playwright.config.ts:93,98`), `test:e2e:flp` uses a separate config and is not in CI, and no spec references `custom-layouts`. A broken aggregation name in XML would fail silently on GitHub Pages. `packages/kiosk-keyboard/test/qunit/customLayouts-xml.qunit.ts` uses `XMLView.create({ definition })` — the pattern already at `KioskKeyboard-focus.qunit.ts:317,349,428,464` — and runs inside `check:base`. It asserts: (1) a preset node lands in the aggregation and its rows render; (2) `locales="pl,pl-PL"` comma-splits and drives the construction-time default layout; (3) `middleware="Mw.create"` under `core:require` resolves to the actual function; (4) `suppress="Variants"` reaches the fold; (5) `layoutRole="Base"` promotes the built-in `numeric`; (6) `suppress="Varients"` throws.

## Stage 4 — webc cutover. Atomic within the webc package; kiosk green.

`src/LayoutPreset.ts`; `src/types.ts` (enums, `LayoutPresetSpec`, delete `LayoutSpec`/`LayoutInput`); `src/KioskKeyboard.ts` (slot, lazy fold, `onInvalidation` branch, `_ensureMiddleware`, eight read sites); `src/core/middleware-registry.ts` (hand-mirror of Stage 3); `src/core/layout-registry.ts` (comments); **delete** `src/core/memo-map-view.ts` + `test/unit/memo-map-view.test.ts`; `bundle.esm.ts`; `package.json` (`exports`, `sideEffects`); `test/component/instance-overrides.test.ts` (2 describes / 24 `it` / 409 lines) → **`custom-layouts.test.ts`**, rewritten, with `:372` → `layout-role="Base"` and `:358` as its negative half; **new** `test/component/custom-layouts-first-paint.test.ts`; the ~10 incidental suites (`variant-popup.test.ts` 8, `kiosk-keyboard.test.ts` 7, `kiosk-keyboard-icon-label.test.ts` 4, `keyboard-type-middleware.test.ts` 3, `variant-composition-seed.test.ts` 2, plus 1 each in `variant-composition-flush.test.ts`, `test/helpers/fixtures.ts:33`, `test/helpers/seed-compose-middleware.ts:21`, `test/pages/visual.js:120`, `test/pages/key-style-demo.js:38`); `test/pages/index.js:73,140,146,155` and `index.html:431,433,533,535,548,550,553` — **simultaneously the deployed public "Raw Web Components Demo" and the `component.spec.ts:8` e2e fixture**; `test/unit/latin-variants.test.ts`, `layout-registry.test.ts`, `layout-meta.test.ts`, `middleware-registry.test.ts`; add `expect(code).toContain("kiosk-keyboard-preset")` to `test/unit/bundle-tree-shaking.test.ts`; rebuild and verify `dist/custom-elements.json`.

**Why 3 and 4 can genuinely land separately:** `latin-variants.ts` and `layout-meta.ts` are byte-compared, so any edit to them must be a both-package commit — which is exactly why D3 is pulled out into Stage 1 and `preset-fold.ts` into Stage 2. With those pre-landed, Stages 3 and 4 touch only unchecked-tier and package-local files.

## Stage 5 — docs and stability surface

- `packages/kiosk-keyboard/README.md` — `80, 327, 331-334, 340, 342, 344, 363-366, 423, 484, 601, 603, 610, 626, 630, 649, 673, 710, 721, 732, 858, 910, 916-917, 1487`. `:325-344` becomes "Custom Layouts" with the field → merge-rule table and the diagnostic catalogue; `:363-366` loses four property rows and gains an Aggregations table; `:596-630` carries the D3 break; `:732` `bindAggregation("customLayouts", { path, factory })`.
- `packages/kiosk-keyboard-webc/README.md` — `25, 34, 240, 269, 278, 299-302, 348, 397, 403, 425, 442, 476, 479, 491, 493, 497, 512, 516, 520, 524-527, 535, 620, 630, 647, 658, 682, 701, 763, 828`. `:535`'s "read by object identity" caveat is deleted for the collection — a real DX win worth stating.
- `docs/shared/API-STABILITY.md` — `:33, 38, 40, 42, 45, 61, 66, 67, 77, 80`; **add** `ui5/kiosk/LayoutPreset` and `kiosk-keyboard-webc/LayoutPreset` to the stable-surface lists and record `<kiosk-keyboard-preset>` as a public tag.
- `docs/kiosk/ARCHITECTURE.md` — `:259-263` (a verbatim `applySettings` snippet, already stale: it names `_toLayoutMap`), `:280, 284, 569, 596-597`.
- `docs/kiosk-webc/ARCHITECTURE.md` — `:17, 28, 36` (delete the `memo-map-view.ts` line), `:147-152, 303-310, 317, 328, 550`.
- `docs/kiosk-webc/CONSUMPTION.md` `:173,182,189,203`; `docs/GLOSSARY.md` `:123,135,161`; `docs/kiosk/RESPONSIVE-LAYOUT-PATTERNS.md` `:49,116,133,157-160`; `docs/kiosk-webc/CUSTOM-ELEMENTS-MANIFEST.md` `:69` + the closing "declares no array-typed properties" claim + a new slots section.
- Two new dated specs, indexed in `docs/specs/README.md`: `docs/specs/2026-08-03-layout-preset-design.md` and the adversarial record below.
- **Frozen, do not touch:** `docs/specs/2026-07-26-issue-187-variant-extensibility.md`, `2026-08-01-layout-meta-lang-adversarial-hypotheses.md`, `2026-07-03-keyboard-key-action-model-design.md`, `2026-04-08-middleware-instance-isolation.md`.

---

## Guardrails: exactly what breaks

| guardrail                      | breaks?                                                                                                                                                     | action                                                                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-twin-drift.mjs`         | **yes, twice** — `latin-variants` / `layout-meta` are `CORE_MODULES` (one-sided landing red); `preset-fold` trips `reconcile()` at `:262` unless registered | add `"preset-fold"` and bump `EXPECTED_PAIR_COUNT` 27→28 **in one edit** (`:220-223` fails if they disagree)                                                                       |
| `ci.yml:57-63` generate gate   | **yes** (DEF-6 + the untracked hole)                                                                                                                        | Stage 0                                                                                                                                                                            |
| `ci.yml:51-52` typecheck       | **yes** — `instance-property-types.tsd.ts` inverted polarity                                                                                                | rewrite in the same commit as the kiosk metadata                                                                                                                                   |
| `check-style-twin-drift.mjs`   | no — CSS custom-property names only, zero overlap                                                                                                           | none                                                                                                                                                                               |
| `check-dom-contract-drift.mjs` | no — no new DOM key; `LayoutPreset` renders nothing                                                                                                         | none                                                                                                                                                                               |
| `check-package-smoke.mjs`      | no, if the new artifacts land                                                                                                                               | add `src/LayoutPreset.gen.d.ts` to `requiredFiles` (Stage 3)                                                                                                                       |
| `lint:ui5`                     | possibly — a new `sap.ui.core.Element` subclass and new XML aggregation nodes are new input                                                                 | run it in Stage 3 before pushing                                                                                                                                                   |
| visual baselines (118 PNGs)    | **no**                                                                                                                                                      | every affected fixture is a constructor-settings rewrite producing identical DOM; no `<slot>` is added to the template. **Do not run `*:update`** — a diff means a real regression |

Baseline confirmed green at HEAD: `check-twin-drift` 27 pairs in sync; `check-style-twin-drift` 40 kiosk / 44 webc; `check-dom-contract-drift` in parity.

---

## Tests, in full

### Rewritten (the capability is shipped and must stay green in its new spelling)

`KioskKeyboard-layout.qunit.ts:1517` ("a descriptor shadowing a built-in can un-mark its secondary flag", asserting `kb.getBaseLayout() === "numeric"`) → `new LayoutPreset({ name: "numeric", layoutRole: LayoutRole.Base, rows: SYMBOL_SURFACE })`, same assertion. `instance-overrides.test.ts:372` → `<kiosk-keyboard-preset name="numeric" layout-role="Base">`, same assertion. Their inherit-siblings (`:1498`, `:358`) are the negative half of the tri-state and must be kept adjacent — together they are the only proof the three states are distinct.

### New

1. **`preset-fold` unit suites** (Stage 2) — document order; every per-facet rule; `suppress` at each tier; `*`-field rejection; every diagnostic code.
2. **D3 re-layering** — the four changed cases and the three newly-expressible ones from the semantics table, per twin, plus the identity and null-prototype invariants.
3. **All three `layoutRole` states** against the built-in secondary `numeric`: omitted → secondary, `Base` → base, `Secondary` → secondary; plus `Base` on a custom name with no built-in.
4. **`suppress="Variants"`** on a layout inheriting the Latin table → no long-press affordance; with a `*` table present → still nothing; **with a `variants` table on the same preset** → exactly that table, no built-in and no `*` letters.
5. **`suppress="Middleware"`** on `ko-hangul` → uncomposed jamo, proving `getMiddlewareFactory` no longer falls through `??`. **This capability does not exist at HEAD**, so a green run before the feature lands means the test asserts nothing.
6. **Separator round-trip** — `suppress="Variants,Middleware"` (kiosk XML) and `suppress="Variants Middleware"` (webc) both yield the two-member array; `suppress="Varients"` **throws** on kiosk and emits `unknown-suppress` on webc.
7. **XML authoring** — `customLayouts-xml.qunit.ts`, the only CI guard on D1.
8. **DEF-1 first paint (webc)** — build the whole subtree **before** `appendChild`, wrap `onAfterRendering` to capture paints, assert on `paints[0]`, not the settled state. Plus the locale variant (`locales="pl"`, no `layout`), which `onEnterDOM` cannot rescue because it runs at `:225`, after `renderImmediately` at `:222`.
9. **DEF-3 (kiosk)** — spy `foldPresets`: exactly **two** calls during `new KioskKeyboard({layout, customLayouts:[a,b,c]})` (the cold `EMPTY_FOLD` in `init()` and the real one between the phases), and exactly **one** `Log.warning` for a fixture with one bad preset among three, with an overlay placed before its rows-declaring sibling and **zero** `unknown-target`.
10. **Cache liveness (kiosk)** — `preset.setRows(x)` refolds once, a second read does not; `removeCustomLayout` / `destroyCustomLayouts` / `preset.destroy()` each make the next resolution fall back.
11. **Construction ordering** — `new KioskKeyboard({layout:"pl-warehouse", customLayouts:[…]})` with `layout` written first sets the layout with no warning; `kb.clone().getLayout()` matches with no warning.
12. **Coercion parity** — `locales: "pl"` on a literal and `new LayoutPreset({locales:["pl"]})` produce the same construction-time layout.
13. **DEF-4 IME safety** — mid-composition, `preset.setLang("pl")` on an _unrelated_ preset: the preedit survives; then change the middleware for the _resolved_ layout: the buffer was **committed to the target**, not reset.
14. **Tree-shaking (webc)** — `expect(code).toContain("kiosk-keyboard-preset")`.

---

## CLAUDE.md §7 adversarial-validation plan

File: `docs/specs/2026-08-03-custom-layouts-adversarial-hypotheses.md`, written **before** any suite is trusted. Each hypothesis is cleared only after the suite has been **seen red**, then reverted.

**H1 — "an explicit entry beats the wildcard" is vacuous.** _Confirmed live at HEAD, not hypothetical._ `latin-variants.qunit.ts:192-199` and `latin-variants.test.ts:170-176` pass `["qwerty", null]`, the one case the re-layering does not change. **Red proof:** land the three-tier resolver with the old bodies untouched and watch both suites pass; then add the named-table + `*`-table case and confirm it goes red against the old resolver.

**H2 — the `instance-property-types.tsd.ts` inverted-polarity trap.** **Red proof:** change the kiosk metadata without touching the tsd file; `typecheck:kiosk:test` must fail with six "Unused '@ts-expect-error'" errors. After rewriting, delete one directive and confirm the positive direction also fails.

**H3 — the locale facet is covered vacuously.** At HEAD `instanceLocaleLayouts`'s only reader is the `applySettings` pre-population (`:805,810`), making it the facet most likely asserted without being exercised. **Red proof:** delete the `locales` branch from `foldPresets` and confirm at least one kiosk and one webc test fails. If both stay green, the coverage is fake.

**H4 — DEF-1: the first-render fold is empty.** _The existing webc component suite is structurally blind here — every case in `instance-overrides.test.ts` assigns config after `fixture()` and awaits `nextRender()` (`:38-39,46-47,60-61`)._ **Red proof:** move the fold behind the `onInvalidation` slot branch only; the connect-time-children test must go red. If it stays green, the test is asserting after an extra microtask and is not testing first paint.

**H5 — DEF-3: N folds, N diagnostics.** **Red proof:** call `_getFold()` eagerly from an `addCustomLayout` override; the "exactly two folds, one warning, zero `unknown-target`" test must go red.

**H6 — DEF-4: a property write tears down an IME buffer.** **Red proof:** put `this._getFold()` inside `invalidate()`; the "edit an unrelated preset mid-composition" test must go red with a lost preedit.

**H7 — the `layoutRole` tri-state actually collapses.** **Red proof:** replace `layoutRole` with `secondary: { type: "boolean", defaultValue: false }` and confirm the "absent inherits the built-in" test goes red — `numeric` must stay secondary when the preset declares nothing. This is `ManagedObject.js:1611-1614` being exercised directly.

**H8 — `suppress` is a no-op.** **Red proof:** make `toSpec()` drop `suppress`; both the variants-suppress and middleware-suppress tests must go red. The middleware one is the sharper probe.

**H9 — the XML path is never actually parsed.** **Red proof:** rename the aggregation in `metadata` to `customLayoutsX` without touching the view definition; `customLayouts-xml.qunit.ts` must fail. Then break `core:require` and confirm the `middleware` assertion fails specifically, not the whole view.

**H10 — the runner passes while running zero tests.** After renaming `instance-overrides.qunit.ts` → `custom-layouts.qunit.ts`, `testsuite.qunit.ts` must gain the new key. **Red proof:** omit the registration and confirm the QUnit total assertion count drops — `ui5-test-runner` exits 0 on a suite it never loads.

**H11 — visual baselines are not actually compared.** The "no baseline changes" claim is load-bearing. **Red proof:** corrupt one committed PNG and confirm `test:e2e` (not `test:e2e:ci`, which passes `--ignore-snapshots`) goes red; revert.

**H12 — the twin-drift count guard is inert.** **Red proof, both directions:** bump `EXPECTED_PAIR_COUNT` to 28 without adding `preset-fold` to `CORE_MODULES` (must fail at `:220-223`); then add the module without bumping the count (must fail at `:262`).

**H13 — the CI generate gate is blind to a new file.** **Already probed red-worthy:** untracked `*.gen.d.ts` passes a plain `git diff`. **Red proof:** with the staged form in place, delete `LayoutPreset.gen.d.ts` from git, regenerate, and confirm CI fails.

**H14 — a variants assertion passes because the popup never opened.** **Red proof:** flip the assertion in each of the suppress tests once and confirm red; a test that reads an empty popup can pass for the wrong reason.

## Open decisions

Five things the repo owner must still choose. Each is stated as an either/or with one named recommendation; nothing below blocks an implementer from starting, and each is a local edit if reversed.

**1. `*` as a reserved name vs a dedicated `layoutDefaults` collection.**
Either the wildcard tier stays a `LayoutPreset` named `*` in the single `customLayouts` collection (specified above), or it moves to a `layoutDefaults` 0..1 aggregation / named slot carrying the same class.
**Recommendation: keep `*`.** D3 describes the wildcard tier as an existing, README-documented concept being re-layered rather than renamed; the second collection is a second public surface name and a second idiom in both twins for one tier of one concern. The special-casing it removes is one `if (name === WILDCARD_LAYOUT) { … continue; }` at the top of the fold loop, which already prevents a `*` preset's rows from reaching `fold.layouts`, plus the `wildcard-field` diagnostic that answers the "position lies" objection out loud instead of silently ignoring the field. If the owner takes `layoutDefaults` instead, the change is contained: delete that branch and the diagnostic, add a second metadata entry and a second slot, and pass a second `readonly LayoutPresetSpec[]` argument to `foldPresets`. Nothing below `toSpec()` moves.

**2. `suppress: LayoutFacet[]` vs two booleans `noVariants` / `noMiddleware`.**
**Recommendation: the enum list.** CLAUDE.md §2 genuinely argues for the two booleans at two call sites, and I am reporting that rather than burying it; D4 overrides §2, because two booleans become three and a fourth, whereas a third facet is one enum member and one array entry. If the owner prefers §2's default, the booleans are a drop-in: `LayoutPresetSpec.suppress` becomes `noVariants?: boolean` / `noMiddleware?: boolean`, the fold's `readSuppress` disappears, and the `unknown-suppress` code goes with it. The `layoutRole` decision is independent and stands either way.

**3. Which facets `LayoutFacet` admits today.**
Specified: `Variants` and `Middleware` only. The semantics cluster showed that `Lang`, `Locales` and `Secondary` fall out of the same machinery for free.
**Recommendation: ship the two.** CLAUDE.md §1 — every changed line traces to the request, and nothing in #216 or D1–D4 asks to disable a layout's inherited keycap language. Adding a member later costs one line in `library.ts`, one in `SUPPRESSIBLE_FACETS`, one branch in the fold, and — for `Lang`/`Secondary` — widening `LayoutMeta` to `| null`, which is a byte-compared change to `layout-meta.ts` that the current design deliberately avoids. Note that `Secondary` would duplicate `layoutRole="Base"`; if it is ever added, retire one of the two spellings rather than shipping both.

**4. Whether the demo ships `PlWarehousePreset` (a `LayoutPreset` subclass) as a named unit.**
Either the demo demonstrates "hand a teammate one tag" with a real subclass in `packages/demo-app/webapp/preset/` plus its webc counterpart, or the XML/HTML examples stay attribute-only.
**Recommendation: ship it.** It is the only thing that makes the "a preset is an authoring unit, not a bag of properties" claim checkable rather than asserted, it exercises the `instanceof LayoutPreset` path in `invalidate()` against a subclass, and it costs one small file per twin. If it is dropped, add a test that a subclassed preset still satisfies `instanceof LayoutPreset` (kiosk) and `isLayoutPreset` (webc) — that path must not go uncovered either way.

**5. Whether to hand-widen the aggregation's generated type for object literals.**
`@ui5/ts-interface-generator` 0.11.1 does not model `defaultClass`, so `customLayouts?: LayoutPreset[] | LayoutPreset | AggregationBindingInfo | \`{${string}}\`` — an object literal that works at runtime is a TypeScript error. The workaround would be a hand-written declaration merging a wider union onto `$KioskKeyboardSettings`.
**Recommendation: do not.** It would be a second hand-maintained shape sitting next to a file CLAUDE.md forbids hand-editing, for an ergonomic that no TypeScript consumer in this repo uses — every TS fixture and the demo construct `new LayoutPreset(...)`. `defaultClass` is still kept, because it is what makes the plain-JS call sites (`packages/kiosk-keyboard/test/e2e/visual/init.js`) and `applySettings`phase 1 work. Document the asymmetry in the kiosk README's aggregation section: "JavaScript callers may pass object literals; TypeScript callers construct`LayoutPreset`."

**One thing I decided rather than deferred, flagged because two clusters disagreed and the loser had a real argument.** The child class is named `LayoutPreset` (tag `kiosk-keyboard-preset`), not `CustomLayout` / `KioskKeyboardCustomLayout`. The losing argument — that the class should share the collection's noun — is legitimate; it lost because `getCustomLayouts()[0] instanceof CustomLayout` reads worse than `instanceof LayoutPreset`, and because a class and a collection with the same name make the XML nesting (`<kiosk:customLayouts><kiosk:LayoutPreset/>`) ambiguous to skim. If the owner reverses this, it is a mechanical rename across the two new source files, the two new fold modules' spec-type name, the tag, the marker property, the bundle export and the docs — do it before Stage 3, not after.

## Review notes

A review pass against the UI5 TypeScript-conversion guidance, a slop pass over the code sketches, and the modern-web-guidance corpus. This is not the refutation pass the status banner still asks for.

### Corrected in this document

`LayoutPreset` was sketched without three things every control-like class in this repo carries, all of them load-bearing for `@ui5/ts-interface-generator`:

- **`@namespace ui5.kiosk`** and **`@extends sap.ui.core.Element`** in the class doc-block. The namespace annotation is what the transformer reads to build the runtime class name; `KioskKeyboard.ts:101-102` carries the same pair.
- **The three generated constructor overloads.** Without them TypeScript sees only `Element`'s constructor, so `new LayoutPreset({ name: "pl-warehouse", … })` — the form this design tells TypeScript consumers to use, since `defaultClass` object literals are not modelled by the generator — would not compile. Copied in the shape `KioskKeyboard.ts:117-122` already uses, including the `oxlint-disable` for the otherwise-useless constructor body. `$LayoutPresetSettings` is referenced without an import, matching the rule in CLAUDE.md and the existing `$KioskKeyboardSettings` usage.
- **`static readonly metadata: MetadataOptions`**, with `import type { MetadataOptions } from "sap/ui/core/Element"`. Untyped metadata is what lets a subclass silently restate an inherited property.

### Guidance that does NOT apply here

Generic UI5 library guidance says every enum must be attached to the global library object via `ObjectPath.get(...)`, calling it critical for runtime type validation and an XSS risk otherwise. **Do not apply it to `LayoutRole` or `LayoutFacet`.** CLAUDE.md records the verified position for this repo: with `Lib.init({ apiVersion: 2 })` plus `DataType.registerEnum`, the auto-attachment is skipped by design (`sap/ui/core/Lib.js`), XML `core:require` binds to the module's named exports, and runtime validation resolves through the `DataType` registry rather than the global namespace. The existing enums in `library.ts` already follow the registry-only form; a future implementer reading the generic guidance should not "fix" them back.

### Reconciling with the Stage 0 fix already on `main`

The middleware data-loss bug was fixed independently of this design (`fix(keyboard): keep a composition alive across an unrelated middleware swap`). That fix compares the factory the resolved layout reads on either side of the property assignment and needs no cached field, because the setter has both values in hand.

This document's `_middlewareFactory` is a different mechanism, not a contradiction. Under `customLayouts` the setter disappears, so the check moves to the next composition-affecting key press (`_tryCompositionMiddleware`), where there is no before-and-after to compare and the previously-used factory must be remembered. It also strictly improves on the shipped fix: nothing ends a composition from inside a setter, an invalidation or a render pass. When Stage 4 lands, the shipped setter-local comparison is superseded rather than merged.

### Slop pass

No `as any`, no try/catch around trusted paths, no defensive `typeof x !== "undefined"` guards, no orphaned TODOs. The conditional-spread idiom in `toSpec()` matches the shipped `KioskKeyboard.ts:1221`. The two twins deliberately use different fold-invalidation mechanisms — kiosk `_fold`/`_foldChildren` keyed off `invalidate(origin)`, webc `_foldEpoch`/`_foldKey` keyed off `onInvalidation` — which is the per-environment idiom this design was chosen for, not an inconsistency.

### Modern-web-guidance

Searched for custom-element configuration APIs, slots carrying non-rendered configuration, and property-versus-attribute handling of object and function values. **No applicable guide exists in that corpus** — top similarity 0.41 across two queries, every result CSS or visual-design. The web-component half of this design rests on the installed `@ui5/webcomponents-base` 2.22.0 sources and first-party precedent (`ui5-table`'s `features` slot) instead. Recorded so the search is not repeated expecting a result.
