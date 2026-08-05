## Architectural conventions

- **TypeScript-only control authoring.** UI5 controls in `packages/kiosk-keyboard` are written in TS with `.gen.d.ts` interfaces produced by `@ui5/ts-interface-generator`. Do not hand-edit `*.gen.d.ts`; run the generator script instead.
- **Commit the generated interface (`src/KioskKeyboard.gen.d.ts`); do not gitignore it (#150).** The control uses `$KioskKeyboardSettings` in its constructor overloads without importing it, so the IDE and a bare `tsc --noEmit` need the file on disk before any build, and kiosk ships `src/` to npm. Deciding principle: commit a generated file when something reads it before the build (IDE, `tsc`, npm consumers); gitignore it when only the build does. That is why webc's `src/generated/` (bulk output consumed via imports, rebuilt by every entry point) stays gitignored while this stays committed; do not flatten that asymmetry. Drift (the #142/#143/#149 JSDoc-strip class) is guarded by the two `verbose` pins (`generate --jsdoc verbose` and `ui5.yaml` `generateTsInterfacesJsDoc: verbose`) plus a CI `generate && git diff --exit-code` gate; review noise by `*.gen.d.ts linguist-generated`.
- **TypeScript pinned to 6.x; do not bump to 7 yet.** The `@ui5/ts-interface-generator` above is built on the TypeScript compiler API (`ts.factory`, `ts.TypeChecker`, `ts.createWatchProgram`), which TS7 (the Go rewrite) does not yet expose, so the generator caps its TS peer dependency at `<7.0.0`. Generation runs in `npm run generate` (and `prebuild`/`pretypecheck`), so the whole kiosk control-authoring pipeline breaks on TS7. The repo pins `typescript` to 6.x (`~6.0.3`); keep it there until the generator gains TS7 support (`@openui5/types` and the `moduleResolution: "Bundler"` config already work on TS6/7, the generator is the only blocker). UI5 type definitions come from `@openui5/types`, the package SAP maintains directly; the older `@types/openui5` is deprecated and now only appears transitively via `@ui5/webcomponents-localization`.
- **UI5 string enums in `library.ts`.** Declare them as `export enum X { Foo = "Foo", ... }` directly in `library.ts` (matches SAP's `ui5-typescript-conversion` skill and the shape `@ui5/ts-interface-generator` emits, which uses named imports from the library module). Register each via `DataType.registerEnum("fully.qualified.Name", X)` and list the qualified names in `Lib.init({ apiVersion: 2, types: [...] })`. With `apiVersion: 2` plus `DataType.registerEnum`, attaching enums to the library namespace via `ObjectPath`/`thisLib.X = X` is unnecessary: XML `core:require="{ alias: 'ns/lib/library' }"` binds the alias to the module's named exports, and UI5's runtime type validation resolves through the `DataType` registry rather than the global namespace (`Lib.init` skips the auto-attachment in v2; see `sap/ui/core/Lib.js`). Compare with string literals (`=== "Foo"`) since TS string enum members are string literals at runtime. Do not split enums into per-file modules and `import X from "./X"`: UI5 treats those as pseudo-modules and resolves them to `undefined`. Numeric enums are different: `DataType.createType` extending `int`, TS `enum`, type-only import.

  One exception: **an enum that is also the component type of an array property is registered with `DataType.createType` over the `string` base instead** (`ui5.kiosk.LayoutFacet`, for `suppress`; #223). UI5's array parser splits on commas without trimming and a registered enum's parser is `oEnum[sValue]`, which maps any unknown token to `undefined` (`DataType.js`), so under `registerEnum` the space in `suppress="Variants, Middleware"` is indistinguishable from a misspelling and rejects the whole XML view. `createType` supplies a `parseValue` that trims the token and an `isValid` that checks enum membership, so conforming markup parses and a real typo still fails loudly. The TS `export enum` and the `Lib.init({ types })` entry are unchanged; the cost is that `isEnumType()`/`getEnumValues()` no longer answer for that type, so the Support Assistant loses its value dropdown for the property. Scalar enum properties (`layoutRole`, `keyboardType`, ...) keep `registerEnum`.

- **No shared-core package across `kiosk-keyboard` and `kiosk-keyboard-webc` (evaluated in #105, declined 2026-06-10).** The two packages keep parallel copies of the framework-agnostic logic (`grapheme`, `auto-repeat`, `shift-state`, `composition-utils`, `key-token`, plus the diverged `layout-registry` / `input-operations` / `middleware-registry` / i18n / detector). Extraction was declined: per section 2 the cost (a new private package, a build-time vendor/sync into both pipelines, the `.js`-vs-extensionless import reconciliation, relocating the unit suites, an internal API to keep stable) outweighs the ~11 KB of near-identical leaf code, and the modules that would actually benefit have diverged enough to require risky behavior-parity reconciliation across two shipping packages. The dominant constraint if ever revisited: `kiosk-keyboard` ships UI5 AMD resolved by namespace, so it cannot carry a runtime npm dependency; any shared core must be inlined/vendored into `ui5/kiosk/*` at build time (a copy step or `ui5-tooling-modules`), never depended upon. `kiosk-keyboard-webc` is bundler-consumed, so Vite inlines a shared module trivially; that asymmetry is why the standard "publish a core, depend on it" pattern (TanStack, Floating UI) does not transfer. Drift is a known tax (it caused #98 and #108; `action-registry` was re-duplicated for #74). If it recurs, prefer a divergence guardrail (a normalized diff of the leaf files in CI) over extraction. Full analysis in issue #105.

## UI5 framework notes (project-specific)

- **Modules load once and never unload.** SAPUI5 caches factory results for the page lifetime. In a launchpad, switching apps destroys the component but leaves module-level state intact. A `let cache = null` at factory scope survives across app restarts. Keep state on component-scoped or control-scoped instances, never module closures.
- **`sap.ui.core.IAsyncContentCreation` on every Component owning views.** Flips `rootView`, router, and nested views to async, and rejects `Component.create` on broken view definitions instead of degrading silently. Caveat: nested components loaded via `ComponentContainer` are still not async by default.
- **Lifecycle hooks must not return a value.** Since 1.120, returning anything (including a Promise from `async onInit`) logs an error and is scheduled to fail. Keep hooks synchronous; fire-and-forget async work from inside.
- **Clean up globals in exit.** `EventBus`, `Theming.attachApplied`, `Localization.attachChange` (since 1.118) are page-level. Every `subscribe`/`attach*` needs a matching `unsubscribe`/`detach*` in `exit`/`destroy`, or the callback fires against a torn-down context.
- **Declarative XML before workarounds.** When a control exposes a property/aggregation/event for the intent, use it rather than controller logic, renderer subclassing, or override CSS. DOM manipulation and override CSS are footguns: lost on re-render, accessibility regressions, theme drift.
- **Bind, don't manipulate.** Prefer property/expression bindings and formatters over `setVisible`/`setEnabled`/`setText`. With one-way bindings, imperative writes are reverted on the next refresh; with two-way, they silently propagate into the model. Hoist repeated compound expressions into a `viewState` JSON-model flag. Formatters run with undefined inputs (every parameter must tolerate `undefined`/`null`) and are one-way.
- **Close dialogs via the dialog's close event.** `sap.m.Dialog` also closes via ESC and via the router (`closeOnNavigation`, since 1.72), not only buttons. Hang result propagation and cleanup off the close event.
- **`sap.ui.define` exports; `sap.ui.require` does not.** Use `define` for any file another module imports; `require` for one-shot deferred imports inside event handlers.
- **Give a control's own persistent sub-controls a stable id derived from `getId()`.** When a custom control creates and owns an internal sub-control (a popup, list, etc.) once and reuses it, id it as `new SubControl(\`${this.getId()}-suffix\`, { ... })` the way core controls id their internals (`sap.m.Select`'s list is `getId() + "-list"`, `sap.m.ComboBox`'s picker `getId() + "-popup"`, `sap.m.DatePicker`'s calendar `getId() + "-cal"`), rather than letting UI5 auto-generate a volatile `__controlN`. The derived id is deterministic, collision-free, namespaced, stable across opens for ARIA references and tests, and reads clearly in the DOM. Applies to persistent owned controls; genuinely transient per-render children rebuilt every cycle may keep auto-ids. This repo: `KioskKeyboard._getVariantPopover()` creates `${this.getId()}-variantPopover`.
- **A control that owns exactly one internal popup owns it through a named, typed, hidden 0..1 aggregation, not a per-open `new` + `dependents`/`addDependent` bridge.** Declare `_name: { type: "sap.m.Popover", multiple: false, visibility: "hidden" }` in `metadata.aggregations`: `visibility: "hidden"` keeps it out of the settings interface / `applySettings` / XML / cloning, and the generator emits NO public accessors (so touch it only via generic `getAggregation`/`setAggregation(name, popover, true)`, mirroring the hidden `_activeTarget` association; do not hand-edit `*.gen.d.ts`, run generate). Create the shell ONCE lazily, reuse it across opens, and rebuild its CONTENT each open (`destroyContent()` / `removeAllAriaLabelledBy()` then re-add); dismiss with `close()`, never `destroy()`. No manual teardown in `exit`: `ManagedObject.destroy` runs `exit` first, then the aggregation-destroy loop, so the framework auto-destroys the hidden popup with its owner. The public 0..n `dependents` bag also works but a hidden 0..1 aggregation is the precise home for a single owned popup. Neither aggregation carries DOM content-density into the static area, so mirror it per open with `sap/ui/core/syncStyleClass` (since 1.58) from the control onto the popover. Canon: `sap.m.Menu._popover`, `sap.m.DatePicker._popup`, `sap.m.ComboBoxBase.picker`; this repo: `KioskKeyboard._variantPopover` (accent-variant popup, #162).

## 1. Before coding

- State assumptions explicitly. If multiple interpretations exist, surface them; don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- Every changed line must trace to the user's request. Don't "improve" adjacent code, comments, or formatting; match existing style even if you'd do it differently.
- Comments and doc-blocks describe the current contract, not the edit that produced it. No refactor narration ("now a discriminated union", "collapsed from two fields", "renamed from X", "moved here for clarity"), no before/after history, no justifying the diff in prose. That belongs in the commit message or PR. A reader a year out wants what the code does, not how it got there.
- When your changes orphan imports/vars/functions, remove them. Don't delete pre-existing dead code unless asked.

## 2. Sharing has a cost

Before extracting a helper, weigh the shared code against: a new file, a new import edge, a new line in the extraction guide, a new internal API to keep stable.

Hoist when the shared code is non-trivial (several lines, not a regex/ternary), the duplicates risk diverging incorrectly (different test coverage or bug fixes), or a third call site appears. Otherwise duplicate. Never add "keep byte-identical" comments: if the duplication is small enough you considered hoisting and chose not to, no comment is needed.

## 3. Bug fixes ship with regression tests

Write the failing test first. If you can't reproduce the bug in a test, you don't understand it well enough to fix it.

- Helper / pure-logic bugs: unit test in the corresponding `.qunit.ts` (kiosk) or `.test.ts` (webc, vitest).
- Integration bugs: control-level QUnit test using the internals cast pattern.
- Untestable bugs (e.g. framework rendering timing): state that explicitly and include manual repro steps.

## 4. No test-only code in production modules

Production modules must not export functions whose only callers are tests (`_resetCache`, `hasResolver`, `_getInternalState`, etc.). It's a code smell: the production code never needs them, and they leak internals into the public surface. Instead:

- Observe behavior through the public API (e.g. assert that `getText()` returns base text after a clear, rather than peeking at a `hasResolver()` flag).
- Use sinon to stub/spy collaborators at module boundaries.
- Put genuine test scaffolding in `test/helpers/` and import it only from tests.

If a test seems to require a production-side helper, the test is probably asserting on internal state instead of behavior; rewrite the assertion.

## 5. Code review methodology

- No scoring or confidence ranking. A finding is real or it isn't.
- Verify each finding against the actual code and CLAUDE.md / UI5 API docs / existing patterns. Discard anything that doesn't survive that check.
- Report surviving findings in the current conversation. Do not post to GitHub unless explicitly asked.

## 6. UI5 framework lookups

Verify UI5 APIs against the pinned version (see each package's `ui5.yaml` / `package.json`). Many `sap.ui.getCore()` accessors deprecated across 1.118 to 1.120 in favor of `Theming`, `Localization`, `Messaging`, `Element`, `Lib`, etc. Source order:

1. **Local cache** `~/.ui5/framework/packages/@openui5/...`: authoritative for the installed version. Grep here first.
2. **`SAP/openui5` GitHub**: when the local cache lacks the version. Cite commit-pinned URLs.
3. **OpenUI5 SDK API reference** and the `ui5-mcp` tool (`get_api_reference`): for high-level contracts and `since` markers.

The numbers are out of sync so you must put some effort into making it correct but you'll get the gist.

## 7. Adversarial test validation

A green suite can lie: a test asserts nothing, the runner reports success while executing zero tests, or a tolerance / skip hides the regression. Before trusting a suite, especially after a test-infrastructure change, prove it fails on real breakage instead of only watching it pass.

- Write the false-positive hypotheses down first (how could a green run be lying?) in a dated `docs/specs/*-adversarial-hypotheses.md`.
- Clear each hypothesis only after you have SEEN the suite go red for it, then revert: flip one assertion (is it live?), corrupt one committed baseline (does the visual test compare?), inject one failing assertion (does the exit code propagate?), point the runner at a bogus path (does it pass empty?).
- Code review and agent audits are corroboration, not proof. Confirm empirically.
- Watch for: vacuous assertions, skips that fire on all targets, snapshot tolerances large enough to mask a one-element change, and runners that pass while running zero tests.
