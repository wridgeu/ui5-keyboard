# Contributing

Contributions are welcome. Whether you file a bug report, suggest a feature, or open a pull request, all input is appreciated.

## Getting Started

```bash
git clone https://github.com/wridgeu/ui5-keyboard.git
cd ui5-keyboard
npm install        # Installs all workspaces + applies dependency patches
npm run build      # Builds library dist/ artifacts
```

Requires **Node >= 24** and **npm >= 11.10.0** for development (Node 24 ships a satisfying npm). CI runs on Node 24. Published packages support Node >= 20.19, so library consumers are not required to be on Node 24.

## Reporting Issues

Use [GitHub Issues](https://github.com/wridgeu/ui5-keyboard/issues) to report bugs or request features. When filing a bug, include:

- Steps to reproduce
- Expected vs actual behavior
- UI5 version and browser (if relevant)

## Pull Requests

1. Fork the repo and create a branch from `main`.
2. Make your changes.
3. Run the full quality gate before submitting:

   ```bash
   npm run check
   ```

   This runs formatting, linting, UI5 linting, typechecking, all tests, smoke checks, and the e2e device matrix.

4. Open a PR against `main`.

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint. Commit messages must follow the format:

```
<type>(scope): description
```

Common types:

| Type       | Purpose                   | Appears in changelog |
| ---------- | ------------------------- | -------------------- |
| `feat`     | New feature               | Yes                  |
| `fix`      | Bug fix                   | Yes                  |
| `refactor` | Code refactoring          | Yes                  |
| `perf`     | Performance improvement   | Yes                  |
| `docs`     | Documentation only        | No                   |
| `test`     | Adding or updating tests  | No                   |
| `chore`    | Maintenance / tooling     | No                   |
| `ci`       | CI/CD changes             | No                   |
| `style`    | Formatting, no code logic | No                   |

Scope is optional but encouraged. Use the package name (`hotkeys`, `kiosk`, `kiosk-webc`, `demo`) or a shared area (`deps`, `ci`, `tools`).

Versioning and changelogs are automated via [release-please](https://github.com/googleapis/release-please).

## Code Quality

Git hooks run lint-staged and commitlint on staged files. They are wired natively through git's `core.hooksPath` (pointing at `.githooks/`), which the `prepare` script sets on `npm install`, so a fresh clone has no hooks until you run `npm install`. Bypass a hook with `git commit --no-verify`. CI runs the same checks plus the full test suite, so a skipped or missing local hook is still caught.

```bash
npm run fmt           # Format all files (oxfmt)
npm run lint          # Lint all packages (oxlint)
npm run lint:ui5      # UI5-specific linting
npm run typecheck     # TypeScript across all workspaces
npm test              # Core test suite (QUnit + kiosk desktop e2e + Vitest + Web Test Runner)
```

## End-to-end & visual tests

The UI5 QUnit suites run via `ui5-test-runner` (puppeteer backend; its chromium is fetched by `npm install`). The e2e and visual-regression suites run on `@playwright/test`. Those browsers are not installed by `npm install`, so run `npx playwright install chromium` once first. See [docs/shared/TESTING.md](./docs/shared/TESTING.md) for the full reference.

```bash
# Run the e2e/visual suite for a package (desktop project)
npm run test:kiosk:e2e
npm run test:kiosk-webc:e2e

# Run the full device matrix (desktop + phone-sm/md/lg + tablet)
npm run test:e2e:all-devices               # both packages, one after the other
npm run test:e2e:all-devices:sequential    # same, with one Playwright worker per package

# Debug interactively in the Playwright UI
npm run test:kiosk:e2e:open
npm run test:kiosk-webc:e2e:open

# Run a single spec or a single test by title (invoke the workspace script
# directly so the args forward to playwright)
npm run test:e2e -w packages/kiosk-keyboard -- focus.spec.ts
npm run test:e2e -w packages/kiosk-keyboard -- -g "stays open"

# Inspect the last run (baseline / actual / diff for failed snapshots)
npm run report:visual:kiosk
npm run report:visual:webc
```

Visual baselines live under each package's `test/e2e/__baselines__/<project>/` and are committed. When a visual change is intentional, regenerate the affected baselines with the `*:update` scripts (e.g. `npm run test:kiosk:e2e:update`, or `npm run test:e2e:update:all` for every package + device), then review the diff before committing. Baselines carry no platform suffix and are compared against the Chromium bundled with `@playwright/test` (pinned at the repo root): a baseline is only valid for the OS it was generated on, so regenerate on whatever platform runs the comparison.

## Project Structure

See [Project Structure](./README.md#project-structure) in the root README for the workspace layout, and the [Docs Index](./docs/README.md) for architecture deep-dives and design rationale.

### Dependency Layout

Shared test/build tooling (`typescript`, `rimraf`, `@playwright/test`, `ui5-test-runner` + `puppeteer` + `start-server-and-test` for the UI5 QUnit suites, and the patched `@ui5/webcomponents-tools` / `less-openui5` toolchain) is declared **once at the repository root** and resolved by every workspace via npm hoisting, which keeps a single source of truth for versions. Each package declares only the tooling unique to it (e.g. `vite` / `vitest` and `@web/test-runner` for the web component). The e2e/visual suites use `@playwright/test` directly; the UI5 QUnit suites are harvested by `ui5-test-runner` using its puppeteer backend (chromium only: its bundled chromium is fetched on `npm install`, and unlike the playwright backend it does not try to install firefox/webkit, which hangs on CI). Because of this, always run `npm install` at the root after switching to a branch that changes dependencies; a workspace's own `node_modules` is not self-contained.

## Build Pipelines

The library packages build differently because they target different runtimes:

- **UI5 libraries** (`hotkeys`, `kiosk-keyboard`) are built by the UI5 CLI: `ui5-tooling-transpile` turns `src/*.ts` into `dist/resources/ui5/{namespace}/`. Theming is LESS, i18n is `.properties`, both handled natively, so there is no code-generation step.
- **The web component** (`kiosk-keyboard-webc`) uses a multi-step UI5 Web Components build (`npm run build`): `ui5nps generate` converts source assets into TypeScript modules, `tsc` compiles, `vite build` produces the standalone bundle, and `generateAPI` emits the Custom Elements Manifest.

The full reference, including the asset code-generation data flow, the `ui5nps` script runner, the two distribution formats, tree-shaking/`sideEffects`, and the CEM, is in [docs/kiosk-webc/BUILD-PIPELINE.md](./docs/kiosk-webc/BUILD-PIPELINE.md).

### Generated files in version control

Both library packages generate code and make opposite calls on committing it, by one rule.

- **`kiosk-keyboard` commits its interface** (`src/KioskKeyboard.gen.d.ts`, from `@ui5/ts-interface-generator`). The control references `$KioskKeyboardSettings` without importing it, so the IDE and a bare `tsc --noEmit` need the file before any build runs, and the package publishes `src/` to npm. Never hand-edit it; regenerate with `npm run generate -w packages/kiosk-keyboard` (wired to `prebuild` / `pretypecheck`).
- **`kiosk-keyboard-webc` gitignores its output** (`src/generated/`, from `ui5nps generate`). It is bulk machine output consumed via `import`s and rebuilt by every entry point, so committing it would only add noise and a drift surface.

The rule: commit a generated file when something reads it before the build runs (IDE, `tsc`, an npm consumer of `src/`); gitignore it when only the build consumes it. The wider JS/TS ecosystem splits the same way, committing types the typechecker needs up front (e.g. TanStack Router's `routeTree.gen.ts`) and regenerating build-only codegen. Decided in #150.

Committing costs two things, both guarded: drift (the #142/#143/#149 JSDoc-strip class) is caught by CI regenerating and running `git diff --exit-code`, with the generator pinned to verbose on both paths that rewrite the file (`generate --jsdoc verbose` and `ui5.yaml`'s `generateTsInterfacesJsDoc: verbose`); review noise is hidden by `.gitattributes` marking `*.gen.d.ts linguist-generated`.

## Questions

Open a [discussion or issue](https://github.com/wridgeu/ui5-keyboard/issues) if something is unclear.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
