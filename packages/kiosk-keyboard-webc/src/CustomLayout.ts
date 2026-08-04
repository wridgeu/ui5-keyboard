import UI5Element from "@ui5/webcomponents-base/dist/UI5Element.js";
import customElement from "@ui5/webcomponents-base/dist/decorators/customElement.js";
import property from "@ui5/webcomponents-base/dist/decorators/property.js";
import createInstanceChecker from "@ui5/webcomponents-base/dist/util/createInstanceChecker.js";
import type { CompositionMiddleware, CustomLayoutSpec, LayoutDefinition, LayoutRole } from "./types.js";
import type { VariantTable } from "./core/latin-variants.js";

/**
 * One layout and everything that belongs with it, slotted into a `<kiosk-keyboard>`'s
 * `customLayouts` slot. A custom layout with `rows` declares a layout; one without them
 * overlays the layout its `name` already resolves to. Applied in DOM order.
 *
 * Renders nothing: no renderer, template or styles, so it never attaches a shadow root
 * and is never projected. Configuration, read by the host - the shape `ui5-table`'s
 * `features` children use.
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
   * rewrites tags under scoping and a cross-bundle duplicate defeats `instanceof`.
   *
   * @private
   */
  readonly isKioskKeyboardCustomLayout = true;

  /**
   * The layout this custom layout declares or overlays, matched after trim and lowercase.
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() name = "";

  /**
   * BCP-47 language of the keycaps, emitted as `lang` on the key labels so assistive
   * tech announces them with the script's own pronunciation rules (WCAG 2.2 SC 3.1.2).
   * Empty takes the built-in layout's value.
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() keycapLang = "";

  /**
   * The layout rendered instead of this one on a keyboard too narrow to seat its rows,
   * read only when the host's `autoCompact` is on. Names the same key set in a denser
   * arrangement, matched after trim and lowercase. Empty takes the built-in layout's
   * counterpart.
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() compact = "";

  /**
   * BCP-47 prefixes that select this layout when the element has no explicit `layout`,
   * comma- or space-separated, e.g. `locales="pl,pl-PL"`.
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() locales = "";

  /**
   * Whether the layout is an auxiliary surface or a base alphabetic layout. `Inherit`
   * takes the built-in layout of the same name's role, and the base alphabetic role
   * when there is no built-in of that name.
   *
   * @default "Inherit"
   * @public
   * @since 0.1.0
   */
  @property() layoutRole: `${LayoutRole}` = "Inherit";

  /**
   * Facets whose inherited value this custom layout discards, comma- or space-separated,
   * e.g. `suppress="Variants,Middleware"`. A listed facet resolves to nothing at this
   * custom layout's position; a value this same custom layout declares still applies.
   *
   * @default ""
   * @public
   * @since 0.1.0
   */
  @property() suppress = "";

  /**
   * The layout's rows, or `null` to make this an overlay on the layout `name` already
   * resolves to. Assign a new array to change them; mutating in place is not observed.
   *
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object }) rows: LayoutDefinition | null = null;

  /**
   * Long-press variants, merged onto the tier below per base letter, so the table extends
   * the defaults rather than replacing them and a base letter mapped to `[]` drops that
   * letter. Base letters must be lowercase. Assign a new object to change the table.
   *
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object }) variants: VariantTable | null = null;

  /**
   * Factory for the layout's composition middleware. To disable the built-in composer for
   * this layout use `suppress="Middleware"` rather than clearing this.
   *
   * @default null
   * @public
   * @since 0.1.0
   */
  @property({ type: Object }) middleware: (() => CompositionMiddleware) | null = null;

  /**
   * Bumped on every property change. The host folds this into its cache key instead of
   * listening for the change itself: a host that is `languageAware` has its own
   * `_invalidate` suppressed while a language change is pending, so a child edit made in
   * that window would never reach it and the fold would stay stale for good. This
   * element is not language-aware, so its own hook always runs.
   *
   * @private
   */
  revision = 0;

  override onInvalidation(): void {
    this.revision++;
  }

  /** The framework-agnostic record this custom layout declares. The host's fold is its only reader. */
  toSpec(): CustomLayoutSpec {
    const suppress = splitTokens(this.suppress);
    const locales = splitTokens(this.locales);
    // Conditional spread throughout: an explicit `undefined` would clobber the built-in
    // tier the absent facet should inherit.
    return {
      name: this.name,
      ...(this.rows !== null && { rows: this.rows }),
      ...(this.keycapLang && { keycapLang: this.keycapLang }),
      ...(this.compact && { compact: this.compact }),
      ...(isDeclaredRole(this.layoutRole) && { secondary: this.layoutRole === "Secondary" }),
      ...(locales.length > 0 && { locales }),
      ...(this.middleware !== null && { middleware: this.middleware }),
      ...(this.variants !== null && { variants: this.variants }),
      ...(suppress.length > 0 && { suppress }),
    };
  }
}

/**
 * Whether the role names a concrete role rather than deferring to the tier below.
 * An unrecognised value inherits, which is the safe reading: nothing can throw here the
 * way the UI5 twin's enum validation does, and silently flipping a layout to a base
 * alphabetic surface is the one outcome a typo must not produce.
 */
function isDeclaredRole(role: string): boolean {
  return role === "Base" || role === "Secondary";
}

/**
 * Splits a comma- or space-separated attribute list, dropping empty entries. Both
 * separators are accepted so a `suppress="Variants,Middleware"` copied out of a UI5 XML
 * view works verbatim here.
 */
function splitTokens(value: string): string[] {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/[\s,]+/) : [];
}

CustomLayout.define();
export default CustomLayout;

/** The host-facing contract, duck-typed so an element from another bundle still matches. */
export interface ICustomLayout extends HTMLElement {
  readonly isKioskKeyboardCustomLayout: boolean;
  readonly revision: number;
  toSpec(): CustomLayoutSpec;
}

export const isCustomLayout = createInstanceChecker<ICustomLayout>("isKioskKeyboardCustomLayout");
