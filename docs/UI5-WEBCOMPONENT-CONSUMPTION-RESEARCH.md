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

To cover both modern paths clearly, demo should include:

- **Inside UI5 app:** custom/external web component integration example (already present as bridge pattern).
- **Inside UI5 app (native custom elements):** add an example using a package namespace + custom element tag in XML, aligned with the 2025 post.
- **Standalone page:** direct `@ui5/webcomponents` usage without UI5 wrappers (currently missing).

This split avoids deprecated `sap.ui.webc.main` while still demonstrating web component interoperability.

## Suggested Demo Extensions from the Blogs

1. **Standalone "UI5 Everywhere" sample**
   - Custom element that bootstraps and renders an embedded SAPUI5 component in a non-UI5 page.
   - Keep it as an advanced sample with explicit caveat: no shadow DOM styling isolation for embedded UI5 content.

2. **Native custom-element consumption in UI5 XML**
   - Add a minimal local custom web component package fixture.
   - Generate and include `custom-elements.json`.
   - Consume it in an XML view via namespace mapping.
   - Keep bridge sample for keyboard target/focus-heavy scenarios where native mapping alone is insufficient.

3. **Keep deprecated wrappers out of primary path**
   - Do not reintroduce `sap.ui.webc.main` in demo runtime artifacts.
   - If needed, mention legacy wrapper path in docs only, with deprecation warning.

## Recommendation

Add a small standalone demo artifact (separate from XML-view wrappers), for example:

- `packages/demo-app/webapp/standalone-webc/index.html` (or test-resources page)
- imports from `@ui5/webcomponents` ES modules
- minimal input + button + event handling sample
- a short README section linking this page and clarifying it is standalone, not UI5 wrapper consumption

This gives clear coverage of both worlds without reintroducing deprecated wrapper APIs.

## Implementation Plan: Add Missing Standalone Scenario

1. Create `packages/demo-app/webapp/standalone-webc/` with:
   - `index.html`
   - `main.js` (imports `@ui5/webcomponents` modules)
   - small style sheet and readme note in-page
2. Demonstrate at least:
   - `ui5-input`, `ui5-button`, one message/feedback interaction
   - basic theming switch or theme declaration
3. Add a second tab/section in that page:
   - optional "UI5 Everywhere" variant showing embedded UI5 app bootstrap approach (documented as advanced)
4. Add docs links:
   - `packages/demo-app/README.md`
   - this research file and a short "when to use what" matrix
5. Verify:
   - page loads under demo app static hosting
   - no new UI5 linter errors in app/library projects
   - formatting/type checks remain green

## Practical Rule-of-Thumb

- Building a UI5 app screen: use `sap.m`/`sap.f` controls first.
- Need custom web component in a UI5 app: use bridge pattern.
- Building a web-component-first app: use standalone `@ui5/webcomponents` directly.
