# UI5 Web Components Consumption Research

## Purpose

Capture practical guidance for consuming UI5 / custom web components, both
standalone and inside SAPUI5/OpenUI5 apps, and record what this repo's demos cover.

## Rule of Thumb

- Building a UI5 app screen: use `sap.m` / `sap.f` controls first.
- Need a custom/third-party web component in a UI5 app: bridge it (native
  custom-element consumption via `ui5-tooling-modules`, or a targeted adapter for
  focus/value/event sync). The bridge is a situational tool, not a default.
- Building a web-component-first app: consume `@ui5/webcomponents` directly, no
  UI5 bridge needed.

The legacy wrapper library `sap.ui.webc.main` is deprecated since 1.120 and
flagged by the UI5 linter; do not use it for new development.

## Repo Web-Component Setup

- The repo uses standard UI5 controls (`sap.m.Input`, `sap.m.StepInput`,
  `sap.m.TextArea`) for inputIds targeting and carries no `sap.ui.webc.main`
  dependency.
- Interop examples use a native UI5 Web Component input in XML
  (`xmlns:webc="@ui5/webcomponents/dist"`) alongside custom-element bridge
  controls in `packages/demo-app/webapp/control/`.
- The `ui5-tooling-modules` middleware/task resolves npm web-component modules in
  the UI5 app.
- Auto-generated wrappers from the Custom Elements Manifest (CEM-driven) and
  manual `WebComponent.extend()` bridges coexist without conflict.
  The demo app uses auto-wrapping via CEM for `@ui5/webcomponents/dist/Input`; the
  `kiosk-keyboard-webc` bridge pattern is documented as a reference in the
  demo-app README.
- The interop e2e harness avoids deprecated/global-core access patterns.
- Standalone web component pages live under
  `packages/kiosk-keyboard-webc/test/pages/`: `index.html` (direct ESM imports,
  native + UI5 Web Component inputs) plus `visual.html` / `visual-themes.html` for
  visual regression and manual inspection. The main UI5 interop examples stay in
  `packages/demo-app`.

## Middleware Configuration for CEM-Driven Web Components

Framework version in `ui5.yaml` must be >= 1.120.0. The
[SAP-samples/uxc-integration](https://github.com/SAP-samples/uxc-integration)
project is the official SAP reference for the build-time setup.

```yaml
builder:
  customTasks:
    - name: ui5-tooling-modules-task
      afterTask: replaceVersion
      configuration:
        addToNamespace: true

server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
    - name: ui5-tooling-modules-middleware
      afterMiddleware: ui5-tooling-transpile-middleware
      configuration:
        addToNamespace: true
        useRelativeModulePaths: true
```

The SAP reference project configures only the task with `addToNamespace: true`
and leaves the middleware at defaults (no `useRelativeModulePaths`). That works
for production builds but not for dev serve; the reference project has the same
dev-serve gap.

### How `addToNamespace` and `useRelativeModulePaths` affect module paths

When `addToNamespace: true` is set, the middleware wraps each npm module in a
small redirect ("Stellvertreter") that points the browser to a namespace-prefixed
path under `thirdparty/`. At build time the task physically places modules at that
namespace-prefixed path, so the redirect resolves to a real file. During dev
serve the middleware bundles modules in memory but stores them under their
original npm name; the namespace rewriting of entry-point modules is a build-only
step ([ui5-community/ui5-ecosystem-showcase#1049](https://github.com/ui5-community/ui5-ecosystem-showcase/issues/1049)).
Full dev-serve rewriting is deferred until UI5 tooling supports iterative builds.

`useRelativeModulePaths: true` skips the redirect entirely: the middleware serves
the bundled module at its original npm path, matching how it is stored in memory.

The tables use an app with namespace `demo/hotkeys` loading
`@ui5/webcomponents/dist/Input` as an example.

**Dev serve (middleware):**

| `addToNamespace` | `useRelativeModulePaths` | Browser requests                                                                     | Module stored at                                    | Result             |
| ---------------- | ------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------ |
| `true` (default) | `false` (default)        | `/resources/demo/hotkeys/thirdparty/@ui5/.../Input.js` (via Stellvertreter redirect) | `@ui5/webcomponents/dist/Input` (original npm name) | 404, path mismatch |
| `true`           | `true`                   | `/resources/@ui5/webcomponents/dist/Input.js` (no redirect)                          | `@ui5/webcomponents/dist/Input`                     | Resolves correctly |
| `false`          | (ignored)                | `/resources/@ui5/webcomponents/dist/Input.js` (no redirect)                          | `@ui5/webcomponents/dist/Input`                     | Resolves correctly |

**Production build (task):**

| `addToNamespace` | Output file on disk                                                                   | Result             |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------ |
| `true`           | `resources/demo/hotkeys/thirdparty/@ui5/.../Input.js` (namespace-prefixed, rewritten) | Resolves correctly |
| `false`          | `resources/@ui5/webcomponents/dist/Input.js` (original npm path)                      | Resolves correctly |

The first dev-serve row is the default and what the SAP reference project uses:
the Stellvertreter redirect sends the browser to the namespace-prefixed path, but
at dev time no module exists there because the in-memory bundle stores it under
its npm name. The task rewrites module names during build, so the same redirect
resolves correctly in production. `addToNamespace: true` +
`useRelativeModulePaths: true` is the correct combination for dev serve; the task
does not need `useRelativeModulePaths` since it rewrites paths regardless.

## Operational Notes (Current Demo Scope)

1. Install dependencies at repo root (`npm install`).
2. For standalone web component pages, run `npm run start:kiosk-webc` and open
   `http://localhost:8084/test/pages/index.html`.
3. For this repo's current demo-app integration path, build the workspace
   libraries first on a fresh clone or after library changes (`npm run build`).
4. Then run `npm start` and open
   `http://localhost:8080/index.html#/kiosk/input-ids`.

Source-based or package-specific consumption flows can differ; follow the
package-local docs for those scenarios.

## Sources

- UI5 Web Components docs (NPM + ES module consumption, selective imports):
  [first steps](https://ui5.github.io/webcomponents/docs/getting-started/first-steps/),
  [components packages](https://ui5.github.io/webcomponents/docs/getting-started/components-packages/)
- `sap/ui/webc/main/Input` UI5 API reference (wrapper model deprecated since 1.120)
- SAP Community: ["UI5 everywhere"](https://community.sap.com/t5/technology-blog-posts-by-members/ui5-everywhere-use-ui5-web-components-to-integrate-sapui5-on-any-web-page/ba-p/13555468) (Daniel Kawkab, 2023), SAPUI5 embedded as a custom web component
- SAP Community: ["Consuming your own (or external) Web Components in UI5 Applications"](https://community.sap.com/t5/frontend-ui5-sap-fiori-blog-posts/consuming-your-own-or-external-web-components-in-ui5-applications/ba-p/14281839) (Nico Schoenteich, 2025), custom elements consumed natively in UI5 without the deprecated wrapper
