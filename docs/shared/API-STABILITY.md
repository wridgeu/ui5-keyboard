# API Stability Policy

This repository ships three library packages:

- `ui5.hotkeys` - UI5 library for keyboard shortcut management
- `ui5.kiosk` - UI5 library providing a virtual keyboard control
- `kiosk-keyboard-webc` - Native web component variant of the kiosk keyboard, built on UI5 Web Components

The public API contract is intentionally small. Anything outside that contract may change without a semver-stable compatibility guarantee.

## Stable Consumer API

### `ui5.hotkeys`

Use these imports for application code:

- `ui5/hotkeys/HotkeyManager`
- `ui5/hotkeys/RegistrationGroup`
- `ui5/hotkeys/KeyStateTracker` (type import; construct via `manager.getKeyStateTracker()`)
- `ui5/hotkeys/HotkeyRecorder` (type import; construct via `manager.createRecorder()`)
- `ui5/hotkeys/format`
- `ui5/hotkeys/library`
- `ui5/hotkeys/types`

### `ui5.kiosk`

Use these imports for application code:

- `ui5/kiosk/KioskKeyboard`
- `ui5/kiosk/library`
- `ui5/kiosk/types`

### `kiosk-keyboard-webc`

The stable consumer surface consists of the package entry points and the `<kiosk-keyboard>` custom element:

- `kiosk-keyboard-webc/bundle` - ESM entry point that registers the custom element and re-exports the class and public types
- `kiosk-keyboard-webc` - bare component class (without asset registration); prefer the bundle entry for most use cases

Stable exports from the bundle entry:

- `KioskKeyboard` class (custom element, tag `<kiosk-keyboard>`)
- Type exports: `FKeyMode`, `KeyPressEventDetail`, `LayoutChangeEventDetail`, `KeyboardTypeChangeEventDetail`, `KeyDefinition`, `KeyRow`, `LayoutDefinition`, `KeyWidth`, `KeyType`, `SpecialKeyValue`

Static methods on `KioskKeyboard` (layout and locale registry):

- `registerLayout` / `unregisterLayout` / `resetCustomLayouts`
- `getRegisteredLayout` / `getRegisteredLayoutNames` / `isBuiltInLayout` / `isSecondaryLayout`
- `registerLocaleLayout` / `unregisterLocaleLayout` / `resetLocaleLayouts` / `getLocaleLayout`
- `setI18nResolver`

Instance convenience methods that delegate to the same shared registry are also stable (`registerLayout`, `unregisterLayout`, `registerLocaleLayout`, `unregisterLocaleLayout`).

## Internal Modules

### `ui5.hotkeys` and `ui5.kiosk`

Modules under `ui5/hotkeys/internal/*` and `ui5/kiosk/internal/*` are internal implementation details.

- They can change shape, behavior, and location.
- They can be removed without deprecation.
- They are not a supported integration surface.

Some non-`internal/*` modules are currently importable but non-stable. In `ui5.hotkeys`, this currently includes top-level utility/helper paths (`ui5/hotkeys/parse`, `ui5/hotkeys/match`, `ui5/hotkeys/platform`, `ui5/hotkeys/validate`, `ui5/hotkeys/constants`). Unless explicitly listed in the stable API above, treat them as advanced/unsupported. Higher-level implementation modules (for example `SequenceManager`) are consumed via `HotkeyManager` and are not part of the supported direct import surface.

For `ui5.kiosk`, these two layout row modules are additionally treated as stable for custom layout composition:

- `ui5/kiosk/layouts/fkey-row`
- `ui5/kiosk/layouts/nav-row`

### `kiosk-keyboard-webc`

Modules under `core/*` (`shift-state`, `dom-utils`, `input-operations`, `keyboard-type-detector`, `layout-registry`, `grapheme`, `i18n`) are internal implementation details. The same rules apply: they can change shape, behavior, and location without deprecation.

The `layouts/*` directory contains built-in layout definitions. Individual layout files (e.g. `layouts/qwerty`, `layouts/numeric`) are not a stable import surface; layouts are consumed by name through the `layout` attribute or the `registerLayout` API. The two shared row modules are additionally treated as stable for composing custom variant layouts:

- `kiosk-keyboard-webc/dist/layouts/fkey-row.js`
- `kiosk-keyboard-webc/dist/layouts/nav-row.js`

The `generated/*` directory (themes, i18n bundles) is build output and must never be imported directly.

## Maintainer Guidance

When adding new code:

- In the UI5 packages, put implementation-only modules in `src/internal/`.
- In `kiosk-keyboard-webc`, put implementation-only modules in `src/core/`.
- Keep stable exports and examples focused on the supported imports above.
- Prefer adding wrappers/facades rather than exposing low-level helpers directly.
