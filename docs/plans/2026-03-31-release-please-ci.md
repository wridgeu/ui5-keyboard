# Release Please + CI Pipeline Implementation Plan

**Goal:** Set up Release Please for independent versioning/publishing of 3 library packages, with a CI pipeline that runs fast checks on PRs and comprehensive validation before releases on main.

**Architecture:** Two GitHub Actions workflows -- `ci.yml` (PR validation + reusable) and `release.yml` (full suite + release-please + per-package OIDC npm publish). Release Please runs in monorepo mode with independent versioning per package. CI is split so PRs only run validation + core tests, while main runs the full matrix (all-device e2e, package smoke) before any release is created.

**Tech Stack:** Release Please v4 action, GitHub Actions, OIDC npm provenance, Node 24

---

### CI minutes optimization strategy

| Trigger      | What runs                                                                                | Approx. wall-clock |
| ------------ | ---------------------------------------------------------------------------------------- | ------------------ |
| PR to main   | validate + test (QUnit, vitest, component tests, kiosk desktop e2e)                      | ~15 min            |
| Push to main | All of the above + all-device e2e + package smoke + release-please + conditional publish | ~45 min            |

The expensive jobs (all-device e2e, smoke) only run on main, not on every PR push.

---

### Task 1: Create Release Please configuration

**Files:**

- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

- [ ] **Step 1: Create release-please-config.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "refactor", "section": "Code Refactoring" },
    { "type": "perf", "section": "Performance Improvements" },
    { "type": "docs", "section": "Documentation", "hidden": true },
    { "type": "chore", "section": "Miscellaneous", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "ci", "section": "CI", "hidden": true },
    { "type": "style", "section": "Style", "hidden": true }
  ],
  "packages": {
    "packages/hotkeys": {
      "release-type": "node",
      "package-name": "ui5-lib-hotkeys",
      "include-component-in-tag": true
    },
    "packages/kiosk-keyboard": {
      "release-type": "node",
      "package-name": "ui5-lib-kiosk-keyboard",
      "include-component-in-tag": true
    },
    "packages/kiosk-keyboard-webc": {
      "release-type": "node",
      "package-name": "kiosk-keyboard-webc",
      "include-component-in-tag": true
    }
  }
}
```

Notes:

- `include-component-in-tag: true` ensures tags don't collide (e.g. `ui5-lib-hotkeys-v0.2.0`)
- No `extra-files` needed -- UI5 manifest.json uses `${version}` placeholder substituted at build time from package.json
- Changelog sections match guard-router's config exactly
- Default behavior: one combined release PR for all packages with pending changes

- [ ] **Step 2: Create .release-please-manifest.json**

```json
{
  "packages/hotkeys": "0.1.0",
  "packages/kiosk-keyboard": "0.1.0",
  "packages/kiosk-keyboard-webc": "0.1.0"
}
```

Note: These versions must match the current `version` field in each package.json.

- [ ] **Step 3: Verify JSON syntax**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('release-please-config.json','utf8')); console.log('config OK')"
node -e "JSON.parse(require('fs').readFileSync('.release-please-manifest.json','utf8')); console.log('manifest OK')"
```

Expected: Both print OK with no errors.

- [ ] **Step 4: Commit**

```bash
git add release-please-config.json .release-please-manifest.json
git commit -m "chore: add release-please monorepo configuration

Configure Release Please for independent versioning of 3 library
packages (hotkeys, kiosk-keyboard, kiosk-keyboard-webc) with
component-scoped tags."
```

---

### Task 2: Create CI workflow

**Files:**

- Create: `.github/workflows/ci.yml`

This workflow runs on PRs and is reusable (called by release.yml on main). It has two jobs:

1. **validate** -- fast static checks (~5 min)
2. **test** -- unit/integration/component tests + kiosk desktop e2e (~15 min)

- [ ] **Step 1: Create .github/workflows directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  workflow_call:
  workflow_dispatch:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Cache UI5 framework resources
        uses: actions/cache@v4
        with:
          path: ~/.ui5
          key: ui5-${{ hashFiles('packages/*/ui5*.yaml') }}
          restore-keys: ui5-

      - run: npm ci

      - name: Commitlint
        if: github.event_name == 'pull_request'
        run: npx commitlint --from "${{ github.event.pull_request.base.sha }}" --to "${{ github.event.pull_request.head.sha }}" --verbose

      - name: Check formatting
        run: npm run fmt:check

      - name: Lint
        run: npm run lint

      - name: UI5 lint
        run: npm run lint:ui5

      - name: Check visual baselines
        run: npm run check:baselines

      - name: Typecheck
        run: npm run typecheck

      - name: Tools tests
        run: npm run test:tools

  test:
    needs: validate
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Cache UI5 framework resources
        uses: actions/cache@v4
        with:
          path: ~/.ui5
          key: ui5-${{ hashFiles('packages/*/ui5*.yaml') }}
          restore-keys: ui5-

      - run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run tests
        run: npm test
```

Notes:

- `npm test` runs: hotkeys QUnit + kiosk QUnit + kiosk desktop e2e + webc vitest + webc component tests
- Playwright install is needed for webc component tests (`@web/test-runner-playwright`)
- `fetch-depth: 0` only in validate (needed for commitlint range check)
- UI5 cache shared across jobs via same cache key
- Concurrency cancels in-progress runs on same branch (saves CI minutes on rapid PR pushes)

- [ ] **Step 3: Validate YAML syntax**

Run:

```bash
node -e "
  const yaml = require('yaml');
  const fs = require('fs');
  yaml.parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
  console.log('ci.yml OK');
"
```

If `yaml` is not installed, use: `npx -y yaml-cli lint .github/workflows/ci.yml` or just visually verify the indentation.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add CI workflow for PR validation and testing

Two-job pipeline: validate (format, lint, typecheck, baselines) then
test (QUnit, vitest, component tests, desktop e2e). Runs on PRs and
is reusable via workflow_call for the release pipeline."
```

---

### Task 3: Create Release workflow

**Files:**

- Create: `.github/workflows/release.yml`

This workflow runs on push to main. It calls CI, runs the full test matrix, then uses Release Please to manage releases and publishes packages with OIDC provenance.

- [ ] **Step 1: Create .github/workflows/release.yml**

```yaml
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      force-publish:
        description: "Force npm publish for all packages (bypass release_created check)"
        type: boolean
        default: false

concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  e2e-all-devices:
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Cache UI5 framework resources
        uses: actions/cache@v4
        with:
          path: ~/.ui5
          key: ui5-${{ hashFiles('packages/*/ui5*.yaml') }}
          restore-keys: ui5-

      - run: npm ci

      - name: Run all-device e2e tests
        run: npm run test:e2e:all-devices:sequential

  smoke:
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Cache UI5 framework resources
        uses: actions/cache@v4
        with:
          path: ~/.ui5
          key: ui5-${{ hashFiles('packages/*/ui5*.yaml') }}
          restore-keys: ui5-

      - run: npm ci

      - name: Build all packages
        run: npm run build

      - name: Package smoke tests
        run: npm run test:packages:smoke

      - name: Demo web component bundle check
        run: npm run test:demo:webc-bundle

  release-please:
    needs: [ci, e2e-all-devices, smoke]
    runs-on: ubuntu-latest
    outputs:
      hotkeys_release_created: ${{ steps.release.outputs['packages/hotkeys--release_created'] }}
      kiosk_release_created: ${{ steps.release.outputs['packages/kiosk-keyboard--release_created'] }}
      webc_release_created: ${{ steps.release.outputs['packages/kiosk-keyboard-webc--release_created'] }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  publish-hotkeys:
    needs: [release-please, ci]
    if: needs.release-please.outputs.hotkeys_release_created == 'true' || inputs.force-publish == true
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          registry-url: https://registry.npmjs.org

      - run: npm ci

      # prepublishOnly copies LICENSE and builds; OIDC auth via id-token: write
      - run: NODE_AUTH_TOKEN="" npm publish -w packages/hotkeys --provenance --access public

  publish-kiosk:
    needs: [release-please, ci]
    if: needs.release-please.outputs.kiosk_release_created == 'true' || inputs.force-publish == true
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          registry-url: https://registry.npmjs.org

      - run: npm ci

      - run: NODE_AUTH_TOKEN="" npm publish -w packages/kiosk-keyboard --provenance --access public

  publish-webc:
    needs: [release-please, ci]
    if: needs.release-please.outputs.webc_release_created == 'true' || inputs.force-publish == true
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          registry-url: https://registry.npmjs.org

      - run: npm ci

      - run: NODE_AUTH_TOKEN="" npm publish -w packages/kiosk-keyboard-webc --provenance --access public
```

Notes:

- `cancel-in-progress: false` ensures sequential release processing (never cancel a release mid-flight)
- release-please only runs after ALL test jobs pass (ci + e2e + smoke)
- Each publish job has scoped permissions (`contents: read`, `id-token: write`)
- `NODE_AUTH_TOKEN=""` prevents PAT override, forces OIDC authentication
- `prepublishOnly` in each package handles LICENSE copy + build automatically
- webc publish gets 15 min timeout (Vite build + API generation is heavier)
- `force-publish` input publishes ALL packages (useful for re-publish after npm outage)
- e2e-all-devices and smoke run in parallel after ci completes

- [ ] **Step 2: Validate YAML syntax**

Run:

```bash
node -e "
  const yaml = require('yaml');
  const fs = require('fs');
  yaml.parse(fs.readFileSync('.github/workflows/release.yml', 'utf8'));
  console.log('release.yml OK');
"
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow with Release Please and npm publish

Runs full test matrix on main (CI + all-device e2e + package smoke),
then Release Please for versioning, then per-package npm publish with
OIDC provenance. Supports force-publish via dispatch."
```

---

### Task 4: Enable npm publishing for library packages

**Files:**

- Modify: `packages/hotkeys/package.json:4` (remove `"private": true`)
- Modify: `packages/kiosk-keyboard/package.json:4` (remove `"private": true`)
- Modify: `packages/kiosk-keyboard-webc/package.json:4` (remove `"private": true`)

The demo-app stays `"private": true` (never published).

- [ ] **Step 1: Remove `"private": true` from hotkeys package.json**

In `packages/hotkeys/package.json`, remove line 4:

```diff
  "name": "ui5-lib-hotkeys",
  "version": "0.1.0",
- "private": true,
  "description": "Declarative keyboard shortcut management for SAPUI5/OpenUI5 applications",
```

- [ ] **Step 2: Remove `"private": true` from kiosk-keyboard package.json**

In `packages/kiosk-keyboard/package.json`, remove line 4:

```diff
  "name": "ui5-lib-kiosk-keyboard",
  "version": "0.1.0",
- "private": true,
  "description": "On-screen virtual keyboard control for SAPUI5/OpenUI5 kiosk and touch applications",
```

- [ ] **Step 3: Remove `"private": true` from kiosk-keyboard-webc package.json**

In `packages/kiosk-keyboard-webc/package.json`, remove line 4:

```diff
  "name": "kiosk-keyboard-webc",
  "version": "0.1.0",
- "private": true,
  "description": "Native web component variant of the kiosk keyboard, built on UI5 Web Components framework",
```

- [ ] **Step 4: Verify the demo-app is still private**

Run:

```bash
node -e "
  const pkg = JSON.parse(require('fs').readFileSync('packages/demo-app/package.json','utf8'));
  console.log('demo-app private:', pkg.private);
"
```

Expected: `demo-app private: true`

- [ ] **Step 5: Format check**

Run:

```bash
npx oxfmt --check packages/hotkeys/package.json packages/kiosk-keyboard/package.json packages/kiosk-keyboard-webc/package.json
```

Expected: No formatting errors. If there are errors, run `npx oxfmt` on the files to fix.

- [ ] **Step 6: Commit**

```bash
git add packages/hotkeys/package.json packages/kiosk-keyboard/package.json packages/kiosk-keyboard-webc/package.json
git commit -m "chore: enable npm publishing for library packages

Remove private flag from hotkeys, kiosk-keyboard, and
kiosk-keyboard-webc packages. Demo-app remains private."
```

---

### Task 5: Final validation and push

- [ ] **Step 1: Run format check on all new/modified files**

```bash
npm run fmt:check
```

Expected: All clean. If workflow YAML files fail formatting, exclude them from oxfmt (they're not covered by the existing config).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: Clean (YAML/JSON files aren't linted by oxlint).

- [ ] **Step 3: Verify all files are committed**

```bash
git status
```

Expected: Clean working tree on the feature branch.

- [ ] **Step 4: Review the complete diff**

```bash
git log --oneline main..HEAD
git diff main..HEAD --stat
```

Expected files:

- `release-please-config.json` (new)
- `.release-please-manifest.json` (new)
- `.github/workflows/ci.yml` (new)
- `.github/workflows/release.yml` (new)
- `packages/hotkeys/package.json` (modified)
- `packages/kiosk-keyboard/package.json` (modified)
- `packages/kiosk-keyboard-webc/package.json` (modified)

- [ ] **Step 5: Push branch**

```bash
git push -u origin <branch-name>
```

- [ ] **Step 6: Create PR**

```bash
gh pr create --title "ci: add Release Please and CI/CD pipeline" --body "$(cat <<'EOF'
## Summary

- Add Release Please monorepo configuration for independent versioning of 3 library packages
- Add CI workflow (PRs): validation (format, lint, typecheck, baselines) + core tests (QUnit, vitest, component, desktop e2e)
- Add Release workflow (main): full CI + all-device e2e + package smoke + Release Please + per-package npm publish with OIDC provenance
- Enable npm publishing for hotkeys, kiosk-keyboard, and kiosk-keyboard-webc (remove private flag)

## CI minutes optimization

| Trigger | Jobs | Approx. time |
|---------|------|-------------|
| PR | validate + test | ~15 min |
| Main push | validate + test + e2e-all-devices + smoke + release-please + publish | ~45 min |

## Prerequisites for first publish

- [ ] npm packages `ui5-lib-hotkeys`, `ui5-lib-kiosk-keyboard`, `kiosk-keyboard-webc` must exist on npmjs.com
- [ ] GitHub repository must have npm OIDC publishing configured (no PAT needed)
- [ ] Repository Actions permissions must allow `id-token: write`

## Test plan

- [ ] Push a commit to this PR and verify the CI workflow runs validate + test jobs
- [ ] Merge to main and verify the release workflow runs the full matrix
- [ ] Verify Release Please creates a release PR after a feat: or fix: commit reaches main
- [ ] Merge the release PR and verify GitHub releases + tags are created per package
- [ ] Verify npm publish runs with OIDC provenance (first publish may need manual npm package creation)

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
