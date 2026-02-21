# API Stability Policy

This repository ships two UI5 libraries:

- `ui5.hotkeys`
- `ui5.kiosk`

The public API contract is intentionally small. Anything outside that contract may change without a semver-stable compatibility guarantee.

## Stable Consumer API

### `ui5.hotkeys`

Use these imports for application code:

- `ui5/hotkeys/HotkeyManager`
- `ui5/hotkeys/RegistrationGroup`
- `ui5/hotkeys/library`
- `ui5/hotkeys/types`

### `ui5.kiosk`

Use these imports for application code:

- `ui5/kiosk/KioskKeyboard`
- `ui5/kiosk/library`
- `ui5/kiosk/types`

## Internal Modules

Modules under `ui5/hotkeys/internal/*` and `ui5/kiosk/internal/*` are internal implementation details.

- They can change shape, behavior, and location.
- They can be removed without deprecation.
- They are not a supported integration surface.

Some non-`internal/*` utility modules are currently importable for historical reasons. Unless explicitly listed in the stable API above, treat them as advanced/unsupported.

For `ui5.kiosk`, these two layout row modules are additionally treated as stable for custom layout composition:

- `ui5/kiosk/layouts/fkey-row`
- `ui5/kiosk/layouts/nav-row`

## Maintainer Guidance

When adding new code:

- Put implementation-only modules in `src/internal/`.
- Keep stable exports and examples focused on the supported imports above.
- Prefer adding wrappers/facades rather than exposing low-level helpers directly.
