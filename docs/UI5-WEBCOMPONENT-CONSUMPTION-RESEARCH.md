# UI5 Web Components Consumption Research

## Purpose

Capture practical guidance for:

1. UI5 Web Components standalone consumption
2. UI5 Web Components consumption within SAPUI5/OpenUI5 applications

And evaluate what is currently covered by this repository's demos.

## Executive Summary

- Standalone UI5 Web Components (`@ui5/webcomponents*`) are the current, supported model for web-component-first apps.
- In SAPUI5/OpenUI5 apps, the legacy wrapper library `sap.ui.webc.main` is deprecated (since 1.120), and UI5 linter flags it.
- For UI5 app scenarios, prefer `sap.m` / `sap.f` controls for native UI5 usage.
- For custom/third-party web components in a UI5 app, use a bridge pattern (UI5 control as target + host event wiring).

## Source Notes

- UI5 Web Components docs describe NPM + ES module consumption (no CDN-first model) and selective imports.
  - https://ui5.github.io/webcomponents/docs/getting-started/first-steps/
  - https://ui5.github.io/webcomponents/docs/getting-started/components-packages/
- UI5 API metadata for `sap/ui/webc/main/Input` marks wrapper consumption model as deprecated since 1.120 with recommendation to use `sap.m`/`sap.f` until an alternative model is provided.
  - `sap/ui/webc/main/Input` via UI5 API reference

## Model A: Standalone UI5 Web Components (Recommended for web-component-first apps)

### How it works

- Install packages from NPM (for example `@ui5/webcomponents`, optionally `@ui5/webcomponents-fiori`).
- Import only the components used by the page (for example `@ui5/webcomponents/dist/Input.js`).
- Use native custom element tags (`<ui5-input>`, `<ui5-button>`, etc.).
- Bundle with an ES-module-capable toolchain.

### Strengths

- First-class and current model from UI5 Web Components project.
- Small payload when importing only used components.
- Works naturally in non-UI5 (plain web, React, Vue, Angular) projects.

### Trade-offs

- Different programming model from SAPUI5/OpenUI5 controls and metadata.
- In a UI5 app, requires bridge/integration code for control lifecycle and value sync.

## Model B: Consumption inside SAPUI5/OpenUI5

### B1. Legacy wrapper controls (`sap.ui.webc.main`) in XML views

- Historically convenient (UI5 control wrappers around web components).
- **Deprecated** in current UI5 guidance and flagged by linter.
- Not recommended for new development.

### B2. Native UI5 controls (`sap.m`, `sap.f`) + optional bridge for custom elements

- Preferred for UI5 applications that want best compatibility with UI5 lifecycle, binding, accessibility, and tooling.
- For custom web components, use a bridge pattern:
  - host custom element in `sap.ui.core.HTML`
  - synchronize value/focus/events with a UI5 control used as integration target

## What We Changed in This Repo

- Removed deprecated `sap.ui.webc.main` dependencies/usages from app/library config and demo XML.
- Replaced wrapper-based interop examples with:
  - standard UI5 controls (`sap.m.Input`, `sap.m.StepInput`, `sap.m.TextArea`) for inputIds targeting
  - custom-element bridge example in demo app
- Updated interop e2e harness to avoid deprecated/global-core access patterns.
- Re-ran UI5 linter: clean for both projects.

## Is the Standalone Scenario Missing?

Short answer: **yes, partially**.

- We now demonstrate custom-element integration _inside_ a UI5 app via bridge.
- We do **not** yet have a pure standalone UI5 Web Components demo page (NPM imports + `<ui5-*>` usage outside UI5 control wrappers).

This is a reasonable gap if the goal is to demonstrate both:

1. standalone consumption model
2. UI5 app integration model

## Recommendation

Add a small standalone demo artifact (separate from XML-view wrappers), for example:

- `packages/demo-app/webapp/standalone-webc/index.html` (or test-resources page)
- imports from `@ui5/webcomponents` ES modules
- minimal input + button + event handling sample
- a short README section linking this page and clarifying it is standalone, not UI5 wrapper consumption

This gives clear coverage of both worlds without reintroducing deprecated wrapper APIs.

## Practical Rule-of-Thumb

- Building a UI5 app screen: use `sap.m`/`sap.f` controls first.
- Need custom web component in a UI5 app: use bridge pattern.
- Building a web-component-first app: use standalone `@ui5/webcomponents` directly.
