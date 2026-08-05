import { LayoutRows } from "ui5/kiosk/library";
import { LayoutRole } from "ui5/kiosk/library";
import { VariantOverrideTable } from "ui5/kiosk/library";
import { LayoutFacet } from "ui5/kiosk/library";
import { PropertyBindingInfo } from "sap/ui/base/ManagedObject";
import { $ElementSettings } from "sap/ui/core/Element";

declare module "./CustomLayout" {

    /**
     * Interface defining the settings object used in constructor calls
     */
    interface $CustomLayoutSettings extends $ElementSettings {

        /**
         * The layout this custom layout declares or overlays, matched after trim and
        lowercase.
         */
        name?: string | PropertyBindingInfo;

        /**
         * The layout's rows. Absent makes this an overlay on the layout `name` already
        resolves to.
        
        Read by object identity: assign a new array to change the rows. Mutating the
        array already assigned is not observed.
         */
        rows?: LayoutRows | PropertyBindingInfo | `{${string}}`;

        /**
         * BCP-47 language of the keycaps, emitted as `lang` on the key labels so assistive
        tech announces them with the script's own pronunciation rules (WCAG 2.2 SC 3.1.2
        Language of Parts). Empty takes the built-in layout's value.
         */
        keycapLang?: string | PropertyBindingInfo;

        /**
         * The layout rendered instead of this one on a keyboard too narrow to seat its
        rows, read only when the control's `autoCompact` is on. Names the same key set in
        a denser arrangement, matched after trim and lowercase. Empty takes the built-in
        layout's counterpart.
         */
        compact?: string | PropertyBindingInfo;

        /**
         * Whether the layout is an auxiliary surface or a base alphabetic layout. `Inherit`
        takes the built-in layout of the same name's role, and the base alphabetic role
        when there is no built-in of that name.
         */
        layoutRole?: LayoutRole | PropertyBindingInfo | `{${string}}`;

        /**
         * BCP-47 prefixes that select this layout when the control has no explicit
        `layout`, e.g. `locales="pl,pl-PL"`.
         */
        locales?: string[] | PropertyBindingInfo | `{${string}}`;

        /**
         * Factory for the layout's composition middleware. Resolvable in an XML view
        through `core:require`.
         */
        middleware?: (Function | null) | PropertyBindingInfo | `{${string}}`;

        /**
         * Long-press variants, merged onto the tier below per base letter, so the table
        extends the defaults rather than replacing them and a base letter mapped to `[]`
        drops that letter. Base letters must be lowercase.
        
        Read by object identity: assign a new object to change the table. A table with a
        base letter named `path` or `parts` is read as a binding info; mark such a table
        `ui5object: true` to pass it through verbatim.
         */
        variants?: VariantOverrideTable | PropertyBindingInfo | `{${string}}`;

        /**
         * Facets whose inherited value this custom layout discards, e.g.
        `suppress="Variants, Middleware"`. A listed facet resolves to nothing at this
        custom layout's position; a value this same custom layout declares still applies.
        
        Comma-separated, with whitespace around an entry allowed. A token that names no
        facet is rejected rather than ignored.
         */
        suppress?: LayoutFacet[] | PropertyBindingInfo | `{${string}}`;
    }

    export default interface CustomLayout {

        // property: name

        /**
         * Gets current value of property "name".
         *
         * The layout this custom layout declares or overlays, matched after trim and
        lowercase.
         *
         * Default value is: ""
         * @returns Value of property "name"
         */
        getName(): string;

        /**
         * Sets a new value for property "name".
         *
         * The layout this custom layout declares or overlays, matched after trim and
        lowercase.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: ""
         * @param [name=""] New value for property "name"
         * @returns Reference to "this" in order to allow method chaining
         */
        setName(name: string): this;

        // property: rows

        /**
         * Gets current value of property "rows".
         *
         * The layout's rows. Absent makes this an overlay on the layout `name` already
        resolves to.
        
        Read by object identity: assign a new array to change the rows. Mutating the
        array already assigned is not observed.
         *
         * @returns Value of property "rows"
         */
        getRows(): LayoutRows;

        /**
         * Sets a new value for property "rows".
         *
         * The layout's rows. Absent makes this an overlay on the layout `name` already
        resolves to.
        
        Read by object identity: assign a new array to change the rows. Mutating the
        array already assigned is not observed.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * @param rows New value for property "rows"
         * @returns Reference to "this" in order to allow method chaining
         */
        setRows(rows: LayoutRows): this;

        // property: keycapLang

        /**
         * Gets current value of property "keycapLang".
         *
         * BCP-47 language of the keycaps, emitted as `lang` on the key labels so assistive
        tech announces them with the script's own pronunciation rules (WCAG 2.2 SC 3.1.2
        Language of Parts). Empty takes the built-in layout's value.
         *
         * Default value is: ""
         * @returns Value of property "keycapLang"
         */
        getKeycapLang(): string;

        /**
         * Sets a new value for property "keycapLang".
         *
         * BCP-47 language of the keycaps, emitted as `lang` on the key labels so assistive
        tech announces them with the script's own pronunciation rules (WCAG 2.2 SC 3.1.2
        Language of Parts). Empty takes the built-in layout's value.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: ""
         * @param [keycapLang=""] New value for property "keycapLang"
         * @returns Reference to "this" in order to allow method chaining
         */
        setKeycapLang(keycapLang: string): this;

        // property: compact

        /**
         * Gets current value of property "compact".
         *
         * The layout rendered instead of this one on a keyboard too narrow to seat its
        rows, read only when the control's `autoCompact` is on. Names the same key set in
        a denser arrangement, matched after trim and lowercase. Empty takes the built-in
        layout's counterpart.
         *
         * Default value is: ""
         * @returns Value of property "compact"
         */
        getCompact(): string;

        /**
         * Sets a new value for property "compact".
         *
         * The layout rendered instead of this one on a keyboard too narrow to seat its
        rows, read only when the control's `autoCompact` is on. Names the same key set in
        a denser arrangement, matched after trim and lowercase. Empty takes the built-in
        layout's counterpart.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: ""
         * @param [compact=""] New value for property "compact"
         * @returns Reference to "this" in order to allow method chaining
         */
        setCompact(compact: string): this;

        // property: layoutRole

        /**
         * Gets current value of property "layoutRole".
         *
         * Whether the layout is an auxiliary surface or a base alphabetic layout. `Inherit`
        takes the built-in layout of the same name's role, and the base alphabetic role
        when there is no built-in of that name.
         *
         * Default value is: "Inherit"
         * @returns Value of property "layoutRole"
         */
        getLayoutRole(): LayoutRole;

        /**
         * Sets a new value for property "layoutRole".
         *
         * Whether the layout is an auxiliary surface or a base alphabetic layout. `Inherit`
        takes the built-in layout of the same name's role, and the base alphabetic role
        when there is no built-in of that name.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: "Inherit"
         * @param [layoutRole="Inherit"] New value for property "layoutRole"
         * @returns Reference to "this" in order to allow method chaining
         */
        setLayoutRole(layoutRole: LayoutRole): this;

        // property: locales

        /**
         * Gets current value of property "locales".
         *
         * BCP-47 prefixes that select this layout when the control has no explicit
        `layout`, e.g. `locales="pl,pl-PL"`.
         *
         * Default value is: []
         * @returns Value of property "locales"
         */
        getLocales(): string[];

        /**
         * Sets a new value for property "locales".
         *
         * BCP-47 prefixes that select this layout when the control has no explicit
        `layout`, e.g. `locales="pl,pl-PL"`.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: []
         * @param [locales=[]] New value for property "locales"
         * @returns Reference to "this" in order to allow method chaining
         */
        setLocales(locales: string[]): this;

        // property: middleware

        /**
         * Gets current value of property "middleware".
         *
         * Factory for the layout's composition middleware. Resolvable in an XML view
        through `core:require`.
         *
         * @returns Value of property "middleware"
         */
        getMiddleware(): Function | null;

        /**
         * Sets a new value for property "middleware".
         *
         * Factory for the layout's composition middleware. Resolvable in an XML view
        through `core:require`.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * @param middleware New value for property "middleware"
         * @returns Reference to "this" in order to allow method chaining
         */
        setMiddleware(middleware: Function | null): this;

        // property: variants

        /**
         * Gets current value of property "variants".
         *
         * Long-press variants, merged onto the tier below per base letter, so the table
        extends the defaults rather than replacing them and a base letter mapped to `[]`
        drops that letter. Base letters must be lowercase.
        
        Read by object identity: assign a new object to change the table. A table with a
        base letter named `path` or `parts` is read as a binding info; mark such a table
        `ui5object: true` to pass it through verbatim.
         *
         * @returns Value of property "variants"
         */
        getVariants(): VariantOverrideTable;

        /**
         * Sets a new value for property "variants".
         *
         * Long-press variants, merged onto the tier below per base letter, so the table
        extends the defaults rather than replacing them and a base letter mapped to `[]`
        drops that letter. Base letters must be lowercase.
        
        Read by object identity: assign a new object to change the table. A table with a
        base letter named `path` or `parts` is read as a binding info; mark such a table
        `ui5object: true` to pass it through verbatim.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * @param variants New value for property "variants"
         * @returns Reference to "this" in order to allow method chaining
         */
        setVariants(variants: VariantOverrideTable): this;

        // property: suppress

        /**
         * Gets current value of property "suppress".
         *
         * Facets whose inherited value this custom layout discards, e.g.
        `suppress="Variants, Middleware"`. A listed facet resolves to nothing at this
        custom layout's position; a value this same custom layout declares still applies.
        
        Comma-separated, with whitespace around an entry allowed. A token that names no
        facet is rejected rather than ignored.
         *
         * Default value is: []
         * @returns Value of property "suppress"
         */
        getSuppress(): LayoutFacet[];

        /**
         * Sets a new value for property "suppress".
         *
         * Facets whose inherited value this custom layout discards, e.g.
        `suppress="Variants, Middleware"`. A listed facet resolves to nothing at this
        custom layout's position; a value this same custom layout declares still applies.
        
        Comma-separated, with whitespace around an entry allowed. A token that names no
        facet is rejected rather than ignored.
         *
         * When called with a value of "null" or "undefined", the default value of the property will be restored.
         *
         * Default value is: []
         * @param [suppress=[]] New value for property "suppress"
         * @returns Reference to "this" in order to allow method chaining
         */
        setSuppress(suppress: LayoutFacet[]): this;
    }
}
