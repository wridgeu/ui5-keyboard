# Feature: Arrow and Navigation Key Layouts

> Status: Implemented

## Problem

The kiosk keyboard currently ships built-in support for text, symbols, numpad, and function keys, but not dedicated navigation keys.

In SAP-style and terminal workflows, users frequently need directional and cursor-navigation commands (Arrow keys, Home/End, PageUp/PageDown) without relying on a physical keyboard.

## Proposal

Add navigation-key support in two forms:

1. Standalone secondary layout: `nav`
2. Integrated variants: `qwerty-nav`, `qwertz-de-nav`

## Naming

- Standalone: `nav`
- Variant suffix: `-nav`

This matches the existing variant naming pattern (`-fk`) while keeping the layout names concise.

## Composability and Modularity

Navigation support follows the same row-composition pattern already used by function keys.

- `qwerty-fk` = `fkey-row + qwerty`
- `qwerty-nav` = `nav-row + qwerty`
- custom `qwerty-fk-nav` = `fkey-row + nav-row + qwerty`

Runtime behavior remains unchanged:

- one active layout at a time
- layout definitions may contain any number of rows
- secondary panels (`fkeys`, `nav`) are entered via `{layout:name}` and return via `{layout:base}`

### Consumer Composition

Consumers can register any layered custom layout with `KioskKeyboard.registerLayout(name, definition)`.

The built-in reusable row modules are intended for composition:

- `ui5/kiosk/layouts/fkey-row`
- `ui5/kiosk/layouts/nav-row` (new)

## Navigation Keys

Use existing `{fkey:*}` semantics (no text insertion, fire `keyPress`) for nav commands:

- `{fkey:ArrowLeft}`
- `{fkey:ArrowRight}`
- `{fkey:ArrowUp}`
- `{fkey:ArrowDown}`
- `{fkey:Home}`
- `{fkey:End}`
- `{fkey:PageUp}`
- `{fkey:PageDown}`

No new parser syntax is needed.

## Scope

### In scope

- Add `nav` built-in layout
- Add reusable `nav-row` module
- Add `qwerty-nav` and `qwertz-de-nav` built-in variants
- Add `nav` to secondary-layout tracking
- Extend keyboard layout enum values
- Add QUnit coverage for registration, rendering, events, and composability
- Update kiosk README and architecture docs
- Update programmatic demo to showcase function and nav layouts, plus composed variants

### Out of scope

- New special-key syntax such as `{arrow:left}`
- Shipping every combination (`*-fk-nav`) as built-ins
- Native browser action execution for nav keys

## Implementation Notes

- Added built-in layouts `nav`, `qwerty-nav`, and `qwertz-de-nav`.
- Added reusable `ui5/kiosk/layouts/nav-row` for custom composition.
- Updated secondary layout tracking so `{layout:base}` returns correctly from `nav`.
- Extended keyboard layout enums and physical-key highlight mapping for navigation keys.
- Added QUnit coverage in `NavKeys.qunit.ts` and included it in `testsuite.qunit.ts`.
- Updated programmatic demo to showcase all registered layouts and composed `qwerty-fk-nav-demo`.
- Updated README and architecture/API-stability documentation.

## Migration

Non-breaking. Existing layouts and behavior remain unchanged; navigation layouts are opt-in.
