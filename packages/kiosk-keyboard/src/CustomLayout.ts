import Element from "sap/ui/core/Element";
import type { MetadataOptions } from "sap/ui/core/Element";
import "./library"; // side-effect: registers the library types and ensures Lib.init() runs
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
 * @example <caption>XML view</caption>
 * <kiosk:KioskKeyboard controls="name">
 *   <kiosk:customLayouts>
 *     <kiosk:CustomLayout name="pl-warehouse" locales="pl,pl-PL" keycapLang="pl"
 *       rows="{layouts>/plWarehouse}" />
 *   </kiosk:customLayouts>
 * </kiosk:KioskKeyboard>
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
       * tech announces them with the script's own pronunciation rules (WCAG 2.2 SC 3.1.2
       * Language of Parts). Empty takes the built-in layout's value.
       */
      keycapLang: { type: "string", defaultValue: "", group: "Behavior" },
      /**
       * The layout rendered instead of this one on a keyboard too narrow to seat its
       * rows, read only when the control's `autoCompact` is on. Names the same key set in
       * a denser arrangement, matched after trim and lowercase. Empty takes the built-in
       * layout's counterpart.
       */
      compact: { type: "string", defaultValue: "", group: "Behavior" },
      /**
       * Whether the layout is an auxiliary surface or a base alphabetic layout. `Inherit`
       * takes the built-in layout of the same name's role, and the base alphabetic role
       * when there is no built-in of that name.
       */
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
       * Read by object identity: assign a new object to change the table. A table with a
       * base letter named `path` or `parts` is read as a binding info; mark such a table
       * `ui5object: true` to pass it through verbatim.
       */
      variants: { type: "ui5.kiosk.VariantOverrideTable", defaultValue: null, group: "Behavior" },
      /**
       * Facets whose inherited value this custom layout discards, e.g.
       * `suppress="Variants, Middleware"`. A listed facet resolves to nothing at this
       * custom layout's position; a value this same custom layout declares still applies.
       *
       * In XML the facets are comma-separated, and whitespace around a name is not part
       * of it. A token naming no facet is rejected rather than ignored.
       */
      suppress: { type: "ui5.kiosk.LayoutFacet[]", defaultValue: [], group: "Behavior" },
    },
  };

  /** The framework-agnostic record this custom layout declares. The control's fold is its only reader. */
  toSpec(): CustomLayoutSpec {
    const rows = this.getRows();
    const keycapLang = this.getKeycapLang();
    const compact = this.getCompact();
    const role = this.getLayoutRole();
    const locales = this.getLocales();
    // SAFETY: `middleware` is declared `type: "function"`, so UI5 has already rejected a
    // non-callable value; the zero-argument factory signature is the property's documented
    // contract with the fold, which is its only caller.
    const middleware = this.getMiddleware() as (() => CompositionMiddleware) | null;
    const variants = this.getVariants();
    const suppress = this.getSuppress();
    // Conditional spread throughout: `exactOptionalPropertyTypes` is off, so an explicit
    // `undefined` would type-check and then clobber the built-in tier it should inherit.
    return {
      name: this.getName(),
      ...(rows !== null && { rows }),
      // A control is constructed before it joins a view, so a model-bound `rows` is
      // still null here on the first fold. Say so rather than letting the name read as
      // unresolvable.
      ...(rows === null && this.getBindingInfo("rows") !== undefined && { rowsPending: true }),
      ...(keycapLang && { keycapLang }),
      ...(compact && { compact }),
      ...(role !== "Inherit" && { secondary: role === "Secondary" }),
      ...(locales.length > 0 && { locales }),
      ...(middleware !== null && { middleware }),
      ...(variants !== null && { variants }),
      ...(suppress.length > 0 && { suppress }),
    };
  }
}
