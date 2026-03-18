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
- SAP Community blog: "UI5 everywhere - Use UI5 Web Components to integrate SAPUI5 on any web page" (Daniel Kawkab, 2023)
  - https://community.sap.com/t5/technology-blog-posts-by-members/ui5-everywhere-use-ui5-web-components-to-integrate-sapui5-on-any-web-page/ba-p/13555468
- SAP Community blog: "Consuming your own (or external) Web Components in UI5 Applications" (Nico Schoenteich, 2025)
  - https://community.sap.com/t5/frontend-ui5-sap-fiori-blog-posts/consuming-your-own-or-external-web-components-in-ui5-applications/ba-p/14281839

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
  - native UI5 Web Component input usage in XML (`xmlns:webc="@ui5/webcomponents/dist"`)
  - custom-element bridge controls in `packages/demo-app/webapp/control/`
- Kept `ui5-tooling-modules` middleware/task so npm web-component modules resolve correctly in the UI5 app.
- Seamless Web Components (auto-generated wrappers from the Custom Elements Manifest) and manual `WebComponent.extend()` bridges coexist without conflict. The demo app uses both: `@ui5/webcomponents/dist/Input` is auto-wrapped via CEM, while `kiosk-keyboard-webc` uses a manual bridge at `packages/demo-app/webapp/control/KioskKeyboardWebc.ts`. Set `addToNamespace: false` in the middleware config to enable seamless WC transformation (the default `addToNamespace: true` has a routing issue for application-type projects). Framework version in `ui5.yaml` must be >= 1.120.0. See the [SAP-samples/uxc-integration](https://github.com/SAP-samples/uxc-integration) project for the official reference setup.
- Updated interop e2e harness to avoid deprecated/global-core access patterns.

## Standalone Scenario Status

Short answer: **yes, for manual testing and visual coverage**. This repo now includes standalone web component pages under `packages/kiosk-keyboard-webc/test/pages/`.

- `index.html` is a standalone demo page with direct ESM imports, native inputs, and UI5 Web Components inputs.
- `visual.html` and `visual-themes.html` support visual regression coverage and manual inspection outside the UI5 demo app.
- The main UI5 interoperability examples still live in `packages/demo-app`.

## Key Learnings from Community Posts

### 1) UI5 Everywhere (SAPUI5 embedded via custom web component)

The first post demonstrates a "UI5 app as embeddable widget" approach:

- Build a custom web component package.
- In the component, bootstrap SAPUI5 dynamically (`sap-ui-core.js`) and create a UI5 Component programmatically.
- Place the UI5 `ComponentContainer` near the custom element in light DOM (not shadow DOM), to avoid styling/rendering issues with encapsulation.
- Use an approuter/static host setup and CORS headers so the embedded host page can consume the app.

Important insight: this is a valid integration pattern for external websites/CMS-style hosts where "drop-in" embedding matters more than deep UI5 lifecycle coupling.

### 2) Consuming external/custom web components natively in UI5

The second post demonstrates the opposite direction: custom elements consumed inside a UI5 app.

- Create standards-based custom element (`HTMLElement` + `customElements.define`).
- Add `observedAttributes` and API JSDoc.
- Generate `custom-elements.json` manifest (`custom-elements-manifest analyze`) for UI5 metadata/property integration.
- Consume package in UI5 app via npm + `ui5-tooling-modules`.
- Use custom XML namespace and tags directly in UI5 views (for example `xmlns:webc="custom-webc-package"` and `<webc:custom-alert-button .../>`).

Important insight: UI5 can consume arbitrary web component packages directly without the deprecated `sap.ui.webc.main` wrapper model.

## Clarification on "Do we always need custom bridges?"

No. The guidance is situational:

- For standard business UI in UI5 apps: use `sap.m`/`sap.f` controls, no custom bridge needed.
- For external/custom web components in UI5 apps: either native custom-element consumption (with proper metadata manifest/tooling) or a targeted adapter/bridge for advanced focus/value/event synchronization.
- For web-component-first apps: consume `@ui5/webcomponents` directly, no UI5 bridge needed.

So the bridge is a targeted integration tool, not a universal recommendation.

## What This Means for Our Demo App

The demo currently focuses on UI5-app integration paths:

- **Inside UI5 app:** native UI5 Web Component usage in XML (`@ui5/webcomponents/dist`) plus custom/external web component bridge examples.
- **Inside UI5 app (native custom elements):** example using package namespace + custom element tag in XML.
- **Outside UI5 app:** standalone Vite-served pages exist under `packages/kiosk-keyboard-webc/test/pages/`.

This avoids deprecated `sap.ui.webc.main` while still demonstrating practical web component interoperability for UI5 applications.

## Operational Notes (Current Demo Scope)

1. Install dependencies at repo root (`npm install`).
2. For standalone web component pages, run `npm run start:kiosk-webc` and open `http://localhost:8084/test/pages/index.html`.
3. For this repo's current demo-app integration path, build the workspace libraries first on a fresh clone or after library changes (`npm run build`).
4. Then run `npm start` and open `http://localhost:8080/index.html#/kiosk/input-ids`.

This keeps both the standalone and the current demo-app integration examples reproducible. Source-based or package-specific consumption flows can differ; follow the package-local docs for those scenarios.

## Practical Rule-of-Thumb

- Building a UI5 app screen: use `sap.m`/`sap.f` controls first.
- Need custom web component in a UI5 app: use bridge pattern.
- Building a web-component-first app: use standalone `@ui5/webcomponents` directly.
