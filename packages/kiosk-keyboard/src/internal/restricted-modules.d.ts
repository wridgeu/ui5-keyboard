// Ambient declarations for @ui5-restricted UI5 modules that @openui5/types does
// not expose as importable ES modules. Keep the surface minimal: only the
// members this package actually uses.

declare module "sap/ui/dom/units/Rem" {
  /**
   * `@ui5-restricted sap.m`. Rem/px conversion against the live root font-size.
   * Used by `responsive-sizing-controller` for content-height thresholds.
   */
  const Rem: {
    toPx(vRem: number | string): number;
    fromPx(vPx: number | string): number;
  };
  export default Rem;
}

declare module "sap/m/Button" {
  export default interface Button {
    /**
     * Framework-internal roving-tabindex flag. When `true`, `ButtonRenderer`
     * emits `tabindex="-1"` so the button is kept out of the tab chain (the
     * same mechanism `sap.m.GenericTile`/`HeaderContainer` use). The variant
     * popup sets it so only the active option button is a tab stop.
     */
    _bExcludeFromTabChain: boolean;
  }
}
