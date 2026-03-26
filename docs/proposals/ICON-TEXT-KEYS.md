# Combined Icon + Text on Modifier and Action Keys

Design spec for [#34](https://github.com/wridgeu/ui5-lib-keyboard/issues/34).

## Scope

Allow action and modifier keys (Shift, Enter, Backspace) to display both an icon and a text label simultaneously, and render the Space bar label visibly. Applies to both packages (`kiosk-keyboard` and `kiosk-keyboard-webc`).

### In scope

- Renderer changes to support combined icon + label rendering when both resolve
- JSDoc updates to remove stale mutually-exclusive icon/label references
- CSS for stacking icon above label in dual-content keys
- Visible Space bar label from i18n ("Space", "Leertaste", etc.)
- Renderer method decomposition for override-ability (UI5 package)
- Unit tests covering all icon/label permutations
- Visual regression baseline updates for all affected layouts
- Documentation updates: architecture docs, inline code comments, generated type definitions

### Out of scope

- New properties on `KeyDefinition` (no `iconPosition`, no `labelMode`)
- CSS positioning variants (left/right/below) -- consumers handle via CSS overrides
- Layout file changes (behavior change is in the renderer; layouts pick it up automatically)
- Changes to the `KeyDefinition` TypeScript interface itself

## Approach

Rendering-only change. The `KeyDefinition` type already has optional `icon` and `label` properties. The renderer currently treats them as mutually exclusive (if/else). This spec changes the renderer to emit both elements when both resolve, and adds CSS for the stacked layout.

## Data Model

No changes to `KeyDefinition`. The existing properties cover all cases:

| `icon`  | `label`    | Rendered output                                         |
| ------- | ---------- | ------------------------------------------------------- |
| omitted | omitted    | Label from i18n / value fallback only                   |
| omitted | `"Custom"` | Custom label only                                       |
| omitted | `""`       | Blank key (no content)                                  |
| set     | omitted    | Icon + i18n / value label (dual)                        |
| set     | `"Custom"` | Icon + custom label (dual)                              |
| set     | `""`       | Icon only                                               |
| `""`    | omitted    | Label from i18n / value fallback only (icon suppressed) |
| `""`    | `""`       | Blank key (no content)                                  |

**Icon value types.** The `icon` property accepts two kinds of values:

- **SAP icon URI** (e.g. `"sap-icon://arrow-top"`) -- rendered via `rm.icon()` / `<ui5-icon>` as today
- **Unicode character or emoji** (e.g. `"⇧"`, `"⏎"`, `"🔍"`) -- rendered as a text `<span>` with the `__icon` class, styled at icon font size. The renderer detects the type: if the value starts with `"sap-icon://"`, it is a SAP icon; otherwise it is treated as a Unicode/emoji glyph.

This allows layout authors to use standard Unicode keyboard symbols (`⇧` U+21E7, `⏎` U+23CE, `⌫` U+232B) or emojis without depending on the SAP icon font.

**JSDoc updates required.** The `icon` and `label` doc comments currently describe mutually-exclusive behavior. Update to reflect combined rendering and the expanded icon value types:

- `icon`: "SAP icon URI (e.g. `sap-icon://accept`) or a Unicode character / emoji (e.g. `⏎`). When both `icon` and a non-empty `label` are present, both render (icon above label by default). Set `label` to `""` for icon-only display."
- `label`: "Display label shown on the key face. Defaults to `value`. When an icon is also present, both render together."

All stale references to the old mutually-exclusive behavior must be updated across both packages, including generated `.gen.d.ts` files.

## Renderer Changes

### UI5 Package (`KioskKeyboardRenderer.ts`)

Decompose `renderKeyContent` into three methods for composability and override-ability:

- **`renderKeyIcon(rm, oControl, key)`** -- renders the icon `<span>` with `aria-hidden="true"`, or nothing if no icon resolves. Individually overridable by subclasses.
- **`renderKeyLabel(rm, oControl, key)`** -- renders the label `<span>`, or nothing if label is empty. Individually overridable by subclasses.
- **`renderKeyContent(rm, oControl, key)`** -- orchestrator. Resolves icon and label, applies `__key--dual` class when both are present, calls `renderKeyIcon` then `renderKeyLabel`. Main override point for consumers who want to restructure the composition entirely.

The Caps Lock special case remains: when Shift is in caps-lock state, the lock icon replaces the shift icon; the label ("Shift") still renders below it.

### Invalid icon handling

When an `icon` value is provided but cannot be resolved (e.g. typo in the icon URI, non-existent SAP icon), the renderer must:

1. Log a warning to the console (e.g. `Log.warning("KioskKeyboard: icon '{icon}' could not be resolved for key '{value}', skipping icon rendering")`)
2. Skip the icon element entirely -- do not render a broken/empty icon placeholder
3. Continue rendering the label if one exists -- the key degrades gracefully to label-only
4. Do not throw or break the rendering cycle

This applies to both built-in icons (from `SPECIAL_KEY_ICONS`) and explicit `icon` property values. The `__key--dual` class is only applied when the icon actually renders successfully, not when it was merely requested.

### WebC Package (`kiosk-keyboard-webc`)

The WebC package must implement the full feature set with parity to the UI5 package:

- **Template (`KioskKeyboardTemplate.tsx`)**: Replace the if/else icon-vs-label logic with two independent conditional renders. When both icon and label resolve, both render. Apply the `__key--dual` class when both are present.
- **Icon type detection**: Same `sap-icon://` prefix check. SAP icons render via `<ui5-icon>`, Unicode/emoji icons render as a text `<span>`.
- **Invalid icon handling**: Same console warning and graceful skip as the UI5 package.
- **`types.ts`**: Same JSDoc updates to `icon` and `label` properties on `KeyDefinition`.
- **CSS/LESS**: Same `__key--dual` styling for stacked icon + label layout. Same `clamp()` scaling.
- **i18n**: Same visible label resolution for Space/Shift/Enter/Backspace from the i18n bundle.
- **Accessibility**: Same `aria-hidden="true"` on icons, same removal of redundant `aria-label` when visible text is present.

No method decomposition needed in the WebC package -- consumers customize via CSS and slots, not renderer subclassing. But the rendering output and behavior must be identical to the UI5 package.

## CSS / Styling

### Dual-content layout

When both icon and label render, the key container needs `flex-direction: column` and a small `gap`. A `__key--dual` class on the key element drives this:

```less
&--dual {
  flex-direction: column;
  gap: 0.1em;
}

&--dual &__icon {
  font-size: 0.85em;
}

&--dual &__label {
  font-size: ~"clamp(0.4rem, calc(100cqi * 0.28), 0.75em)";
  line-height: 1;
}
```

Exact values to be refined during implementation against visual baselines.

### No breaking changes

Key widths (`KeyWidth` values) are unchanged. Content becomes richer within the same dimensions. The existing `container-type: inline-size` on key elements supports the `clamp()` scaling.

### Consumer overrides

Since icon and label are separate DOM elements with distinct CSS classes, consumers can restyle freely:

- `flex-direction: row` for side-by-side
- `order` to swap icon/label position
- Custom `gap`, `font-size`, or hiding either element

No renderer involvement needed for positional changes.

## Space Bar

The Space key label becomes visible. Resolution path:

1. `_getKeyLabel` checks `_SPECIAL_KEY_I18N` for value `" "`
2. Finds i18n key `KEY_SPACE`
3. Returns the localized string: "Space" (en), "Leertaste" (de), etc.

This was previously used only for `aria-label`. Now it renders visibly. Title case "Space" is the English default, matching KioskBoard and kiosk best-practice conventions.

No layout file changes needed -- the resolution is automatic.

## Accessibility

When both icon and label are visible:

- Icon retains `aria-hidden="true"`
- The visible text label provides the accessible name naturally
- The explicit `aria-label` attribute on the key button element should be removed for keys that now have visible text, since the visible label becomes the accessible name (satisfies WCAG 2.5.3 Label in Name). Keeping both would cause screen readers to announce the `aria-label` and ignore the visible text.

When icon-only (`label: ""`):

- `aria-label` remains necessary (existing behavior, unchanged)

## Affected Keys by Default

| Key       | Icon source                        | Label source         | Current   | After               |
| --------- | ---------------------------------- | -------------------- | --------- | ------------------- |
| Shift     | `SPECIAL_KEY_ICONS["{shift}"]`     | i18n `KEY_SHIFT`     | Icon only | Icon + "Shift"      |
| Enter     | `SPECIAL_KEY_ICONS["{enter}"]`     | i18n `KEY_ENTER`     | Icon only | Icon + "Enter"      |
| Backspace | `SPECIAL_KEY_ICONS["{backspace}"]` | i18n `KEY_BACKSPACE` | Icon only | Icon + "Backspace"  |
| Space     | none                               | i18n `KEY_SPACE`     | Blank     | "Space" (text only) |

## Testing

### Unit tests -- icon/label permutation matrix

All eight combinations from the data model table, tested for:

- Correct DOM structure (which elements are present/absent)
- Correct CSS class (`__key--dual` only when both icon and label render)
- Correct accessibility attributes (`aria-hidden` on icon, no redundant `aria-label` when visible text exists)
- Correct label text (i18n resolution, custom overrides, shift-state variants)

Additionally:

- **SAP icon rendering**: key with `icon: "sap-icon://accept"` renders via `rm.icon()` / `<ui5-icon>`
- **Unicode/emoji icon rendering**: key with `icon: "⇧"` or `icon: "🔍"` renders as a text `<span>` with `__icon` class
- **Invalid icon handling**: key with `icon: "sap-icon://nonexistent"` logs a console warning, skips icon, renders label only, no error thrown
- **Invalid icon with no label**: key with `icon: "sap-icon://nonexistent"` and `label: ""` renders a blank key with console warning

Applies to both the UI5 renderer and the WebC template.

### Visual regression

Update baselines for all layouts in both packages:

- qwerty, qwertz-de, numeric, special, numpad, nav
- Upcoming: ja-romaji, arabic (if merged before this work)
- Desktop and device viewports

### Manual / exploratory

- Screen reader verification: keys announce correctly with visible labels
- RTL layout check: icon/label stacking works in RTL context
- Shift state transitions: label updates correctly when toggling Shift/Caps Lock

## Documentation Updates

The following documentation must be updated to reflect the new icon+label behavior:

### Per-package

- **`packages/kiosk-keyboard/src/types.ts`** -- JSDoc on `icon` and `label` properties (see Data Model section)
- **`packages/kiosk-keyboard-webc/src/types.ts`** -- same JSDoc updates
- **`packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts`** -- regenerated from updated source
- **`packages/kiosk-keyboard/src/KioskKeyboardRenderer.ts`** -- inline comments on `renderKeyContent`, `renderKeyIcon`, `renderKeyLabel`

### Architecture docs

- **`docs/kiosk/ARCHITECTURE.md`** (line ~239) -- update the `KeyDefinition` description to mention that `icon` and `label` render together when both are present, and that `icon` accepts SAP icon URIs or Unicode characters/emojis
- **`docs/kiosk-webc/ARCHITECTURE.md`** (line ~237) -- same update to the `KeyDefinition` snippet and `icon` comment

### Stale reference sweep

Search both packages and `docs/` for any remaining references to the old mutually-exclusive icon/label behavior (e.g. "renders the icon instead of text", "icon-only keys") and update or remove them.
