# Feature Proposal: `ui5-kiosk-keyboard` Web Component

## Why

`KioskKeyboard` is currently a SAPUI5 control. It works well inside UI5 apps,
but cannot be consumed directly in framework-agnostic pages (plain HTML,
React, Vue, etc.) without loading the UI5 runtime.

Adding a native web component variant would enable:

- use in non-UI5 frontend stacks
- simpler embedding in mixed micro-frontend setups
- broader adoption while keeping the current UI5 control as first-class

## Goal

Ship a **new optional** web component package for kiosk keyboard behavior,
while preserving the existing UI5 control API and behavior in
`ui5-lib-kiosk-keyboard`.

## Non-Goals

- No breaking changes to `ui5.kiosk.KioskKeyboard`
- No immediate 1:1 parity on day one for every UI5-only integration detail
- No migration requirement for existing UI5 consumers

## Proposed Shape

## Package layout

- Keep existing package: `ui5-lib-kiosk-keyboard` (UI5 control)
- Add new package: `@ui5-kiosk/webcomponent` (name TBD)

## Runtime element

- Custom element: `<ui5-kiosk-keyboard>`
- Keyboard logic extracted into framework-agnostic core module shared by both
  implementations

## Shared core candidates

- layout registry and runtime layout switching
- key processing and shift/caps behavior
- auto-type heuristics (where framework-independent)
- target input operations (insert, delete, caret handling)
- open/close and docked state machine

## Surface API draft (web component)

Attributes/properties:

- `docked`
- `open`
- `keyboard-type` (`full|numpad|numeric`)
- `layout`
- `stable-height`
- `disabled`
- `auto-show`

Methods:

- `show()`
- `close()`
- `setKeyboardType(type)`
- `resetKeyboardType()`
- `registerLayout(name, definition)`

Events:

- `key-press`
- `after-open`
- `after-close`
- `layout-change`

Targeting:

- `for="inputId"` for direct host input association
- optional programmatic `setTargetElement(element)`

## Implementation Plan

1. Extract internal pure modules from current UI5 control where possible.
2. Build `<ui5-kiosk-keyboard>` using custom elements + shared core.
3. Add adapter layer in current UI5 control to consume shared core (reduce
   divergence).
4. Add compatibility tests that run the same behavioral scenarios for both
   implementations.
5. Publish as experimental package first, then stabilize.

## Testing Strategy

- Reuse existing behavior tests as cross-runtime test matrix:
  - UI5 control tests (existing)
  - web component tests (new)
- Add visual regression for core keyboard states (shift/caps/layout/type).
- Add integration tests against plain HTML inputs and shadow DOM hosts.

## Risks

- Feature drift between UI5 control and web component
- Focus and caret differences across browsers/shadow DOM
- Auto-show behavior differences without UI5 focus delegation helpers

Mitigation:

- shared core + shared behavioral tests
- explicit feature parity matrix in docs
- staged release (`experimental` -> `stable`)

## Open Questions

- Should the web component live in this monorepo or separate repo?
- Which naming should be used (`ui5-kiosk-keyboard` vs `kiosk-keyboard`)?
- Do we target only modern evergreen browsers from day one?
- Should we provide a minimal React/Vue wrapper package for ergonomics?
