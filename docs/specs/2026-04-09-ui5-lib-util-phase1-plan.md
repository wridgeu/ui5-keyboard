# ui5-lib-util Phase 1: Scaffolding + Dialog Module

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `ui5-lib-util` monorepo with working library scaffolding and the dialog module as the first fully tested module.

**Architecture:** npm workspaces monorepo with `packages/lib` (UI5 library, namespace `ui5.util`) and `packages/demo-app` (consumer app). Dialog module provides DialogManager, DialogProvider, DialogControllerExtension, and AbstractDialogController for fragment-based overlay lifecycle management.

**Tech Stack:** OpenUI5 1.120+, TypeScript 6.x, UI5 Tooling 4.0 (specVersion 4.0), ui5-tooling-transpile, QUnit + WDIO, oxlint + oxfmt, husky + commitlint + lint-staged.

**Spec:** `docs/specs/2026-04-09-ui5-lib-util-design.md` in the `ui5-lib-keyboard-clean` repo.

---

## File Map

### Root (monorepo scaffolding)

| File                    | Responsibility                                                |
| ----------------------- | ------------------------------------------------------------- |
| `package.json`          | Monorepo root, workspaces, devDependencies (tooling), scripts |
| `tsconfig.base.json`    | Shared TypeScript config (ES2023, Bundler moduleResolution)   |
| `commitlint.config.mjs` | Conventional commits                                          |
| `.husky/pre-commit`     | lint-staged + typecheck                                       |
| `.husky/commit-msg`     | commitlint                                                    |
| `.gitignore`            | Node, UI5, TypeScript build artifacts                         |
| `.editorconfig`         | Consistent editor settings                                    |
| `README.md`             | Root README (placeholder, fleshed out in Phase 8)             |
| `LICENSE`               | MIT                                                           |

### packages/lib (the UI5 library)

| File                                                   | Responsibility                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `package.json`                                         | Library package config, dependencies                                   |
| `ui5.yaml`                                             | UI5 library config (specVersion 4.0, OpenUI5 1.120.0)                  |
| `tsconfig.json`                                        | Extends root, paths for `ui5/util/*`                                   |
| `tsconfig.test.json`                                   | Test-specific TypeScript config                                        |
| `src/library.ts`                                       | `Lib.init()` for `ui5.util`                                            |
| `src/manifest.json`                                    | Library manifest                                                       |
| `src/dialog/types.ts`                                  | `TDialogConfiguration`, `DialogOpenProperties`, `DialogManagerOptions` |
| `src/dialog/DialogControllerExtension.ts`              | ControllerExtension with fire\*Event helpers and fragmentById          |
| `src/dialog/AbstractDialogController.ts`               | Base class with lifecycle hooks, fire\*Event, fragmentById, onData     |
| `src/dialog/DialogProvider.ts`                         | Fragment/controller loading, deferred events, open/close lifecycle     |
| `src/dialog/DialogManager.ts`                          | Component-scoped orchestrator, dialog map, namespace resolution        |
| `test/qunit/testsuite.qunit.ts`                        | QUnit test suite registry                                              |
| `test/qunit/Test.qunit.html`                           | QUnit test runner HTML                                                 |
| `test/qunit/dialog/DialogControllerExtension.qunit.ts` | Tests for extension fire\*Event methods                                |
| `test/qunit/dialog/AbstractDialogController.qunit.ts`  | Tests for abstract controller                                          |
| `test/qunit/dialog/DialogProvider.qunit.ts`            | Tests for deferred events, lifecycle, overlay detection                |
| `test/qunit/dialog/DialogManager.qunit.ts`             | Tests for namespace resolution, caching, open/close                    |
| `test/wdio-qunit.conf.ts`                              | WDIO config for QUnit test execution                                   |

### packages/demo-app (consumer application)

| File                                                  | Responsibility                                              |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `package.json`                                        | Demo app package, depends on `ui5-lib-util`                 |
| `ui5.yaml`                                            | App config with transpile middleware                        |
| `tsconfig.json`                                       | App TypeScript config                                       |
| `webapp/manifest.json`                                | UI5 app manifest                                            |
| `webapp/index.html`                                   | Entry point                                                 |
| `webapp/Component.ts`                                 | Initializes DialogManager                                   |
| `webapp/controller/BaseController.ts`                 | Base controller with component access                       |
| `webapp/controller/App.controller.ts`                 | App controller                                              |
| `webapp/controller/Main.controller.ts`                | Main view, opens dialogs                                    |
| `webapp/controller/dialogs/SampleDialogController.ts` | Sample dialog controller extending AbstractDialogController |
| `webapp/view/App.view.xml`                            | App view shell                                              |
| `webapp/view/Main.view.xml`                           | Main view with buttons                                      |
| `webapp/view/dialogs/SampleDialog.fragment.xml`       | Sample dialog fragment                                      |
| `webapp/i18n/i18n.properties`                         | i18n texts                                                  |

---

## Task 1: Initialize Git repository and monorepo root

**Files:**

- Create: `C:/Users/m.beier/Documents/dev/ui5-lib-util/.gitignore`
- Create: `C:/Users/m.beier/Documents/dev/ui5-lib-util/.editorconfig`
- Create: `C:/Users/m.beier/Documents/dev/ui5-lib-util/package.json`
- Create: `C:/Users/m.beier/Documents/dev/ui5-lib-util/tsconfig.base.json`
- Create: `C:/Users/m.beier/Documents/dev/ui5-lib-util/commitlint.config.mjs`
- Create: `C:/Users/m.beier/Documents/dev/ui5-lib-util/LICENSE`
- Create: `C:/Users/m.beier/Documents/dev/ui5-lib-util/README.md`

- [ ] **Step 1: Create directory and init git**

```bash
mkdir -p "C:/Users/m.beier/Documents/dev/ui5-lib-util"
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
git init
```

- [ ] **Step 2: Create .gitignore**

Create `C:/Users/m.beier/Documents/dev/ui5-lib-util/.gitignore`:

```
node_modules/
dist/
.ui5/
*.tsbuildinfo
```

- [ ] **Step 3: Create .editorconfig**

Create `C:/Users/m.beier/Documents/dev/ui5-lib-util/.editorconfig`:

```ini
root = true

[*]
end_of_line = lf
insert_final_newline = true
charset = utf-8
indent_style = tab
indent_size = 4
trim_trailing_whitespace = true

[*.{yml,yaml}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Create root package.json**

Create `C:/Users/m.beier/Documents/dev/ui5-lib-util/package.json`:

```json
{
  "name": "ui5-lib-util-monorepo",
  "private": true,
  "author": "Marco Beier",
  "engines": {
    "node": ">=22"
  },
  "workspaces": ["packages/*"],
  "scripts": {
    "clean": "npm run clean --workspaces",
    "fmt": "oxfmt .",
    "fmt:check": "oxfmt --check .",
    "lint": "oxlint packages/ --tsconfig tsconfig.base.json --import-plugin --deny-warnings",
    "lint:fix": "oxlint packages/ --tsconfig tsconfig.base.json --import-plugin --fix",
    "check": "npm run fmt:check && npm run lint && npm run typecheck",
    "typecheck": "tsc --noEmit -p packages/lib/tsconfig.json && tsc --noEmit -p packages/lib/tsconfig.test.json && tsc --noEmit -p packages/demo-app/tsconfig.json",
    "build": "npm run build --workspace=packages/lib",
    "start": "npm start --workspace=packages/demo-app",
    "start:lib": "npm start --workspace=packages/lib",
    "wdio:qunit": "wdio run packages/lib/test/wdio-qunit.conf.ts",
    "test": "npm run test:qunit",
    "test:qunit": "node ./scripts/run-with-server.mjs --ready-url http://localhost:8080 --server-script start:lib --test-script wdio:qunit",
    "commitlint": "commitlint --last",
    "prepare": "husky"
  },
  "lint-staged": {
    "{packages,scripts}/**/*.{ts,js,mjs}": [
      "oxlint --fix --tsconfig tsconfig.base.json --import-plugin --deny-warnings",
      "oxfmt"
    ],
    "*.{json,md,yaml,yml}": "oxfmt"
  },
  "devDependencies": {
    "@commitlint/cli": "^20.1.0",
    "@commitlint/config-conventional": "^20.0.0",
    "@wdio/cli": "^9.0.0",
    "@wdio/local-runner": "^9.0.0",
    "@wdio/mocha-framework": "^9.0.0",
    "@wdio/spec-reporter": "^9.0.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "oxfmt": "^0.41.0",
    "oxlint": "^1.56.0",
    "rimraf": "^6.0.0",
    "typescript": "~6.0.0",
    "wdio-qunit-service": "^2.0.0"
  }
}
```

- [ ] **Step 5: Create tsconfig.base.json**

Create `C:/Users/m.beier/Documents/dev/ui5-lib-util/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "rootDir": ".",
    "composite": true
  }
}
```

- [ ] **Step 6: Create commitlint.config.mjs**

Create `C:/Users/m.beier/Documents/dev/ui5-lib-util/commitlint.config.mjs`:

```javascript
export default {
  extends: ["@commitlint/config-conventional"],
};
```

- [ ] **Step 7: Create LICENSE (MIT)**

Create `C:/Users/m.beier/Documents/dev/ui5-lib-util/LICENSE`:

```
MIT License

Copyright (c) 2026 Marco Beier

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 8: Create placeholder README.md**

Create `C:/Users/m.beier/Documents/dev/ui5-lib-util/README.md`:

```markdown
# ui5-lib-util

A collection of reusable UI5 utility patterns for OpenUI5 1.120+ applications.

> Work in progress. See `docs/specs/` for the design specification.
```

- [ ] **Step 9: Install dependencies and init husky**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
npm install
npx husky init
```

- [ ] **Step 10: Create husky hooks**

Write `.husky/pre-commit`:

```sh
npx lint-staged
npm run typecheck
```

Write `.husky/commit-msg`:

```sh
npx commitlint --edit $1
```

- [ ] **Step 11: Initial commit**

```bash
git add -A
git commit -m "chore: initialize monorepo scaffolding"
```

---

## Task 2: Create library package scaffolding

**Files:**

- Create: `packages/lib/package.json`
- Create: `packages/lib/ui5.yaml`
- Create: `packages/lib/tsconfig.json`
- Create: `packages/lib/tsconfig.test.json`
- Create: `packages/lib/src/library.ts`
- Create: `packages/lib/src/manifest.json`

- [ ] **Step 1: Create packages/lib directory structure**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
mkdir -p packages/lib/src packages/lib/test/qunit
```

- [ ] **Step 2: Create packages/lib/package.json**

```json
{
  "name": "ui5-lib-util",
  "version": "0.1.0",
  "license": "MIT",
  "main": "dist/resources/ui5/util/library.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/resources/ui5/util/library.js"
    }
  },
  "author": "Marco Beier",
  "description": "Reusable UI5 utility patterns for OpenUI5 1.120+ applications",
  "keywords": ["ui5", "openui5", "sapui5", "dialog", "messaging", "utilities"],
  "publishConfig": {
    "access": "public"
  },
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "files": ["dist/**/*", "src/**/*", "ui5.yaml", "tsconfig.json", "README.md", "LICENSE"],
  "scripts": {
    "clean": "rimraf dist .ui5",
    "build": "ui5 build --create-build-manifest",
    "prepublishOnly": "npm run build",
    "start": "ui5 serve",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@openui5/types": "1.120.25",
    "@types/qunit": "^2.19.13",
    "@types/sinon": "^21.0.0",
    "@ui5/cli": "^4.0.0",
    "ui5-tooling-transpile": "^3.11.0"
  }
}
```

- [ ] **Step 3: Create packages/lib/ui5.yaml**

```yaml
specVersion: "4.0"
metadata:
  name: ui5.util
type: library
framework:
  name: OpenUI5
  version: "1.120.0"
  libraries:
    - name: sap.ui.core
    - name: sap.m
builder:
  resources:
    excludes:
      - "/test-resources/**"
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        omitTSFromBuildResult: true
        transformTypeScript:
          allowDeclareFields: true
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        transformTypeScript:
          allowDeclareFields: true
```

- [ ] **Step 4: Create packages/lib/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "paths": {
      "ui5/util/*": ["./src/*"]
    },
    "types": ["@openui5/types"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 5: Create packages/lib/tsconfig.test.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "paths": {
      "ui5/util/*": ["./src/*"]
    },
    "types": ["@openui5/types", "@types/qunit", "@types/sinon"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

- [ ] **Step 6: Create packages/lib/src/manifest.json**

```json
{
  "sap.app": {
    "id": "ui5.util",
    "type": "library",
    "title": "UI5 Utility Library",
    "description": "Reusable UI5 utility patterns for OpenUI5 1.120+ applications",
    "applicationVersion": {
      "version": "${version}"
    }
  },
  "sap.ui": {
    "technology": "UI5"
  },
  "sap.ui5": {
    "dependencies": {
      "libs": {
        "sap.ui.core": {},
        "sap.m": {}
      }
    }
  }
}
```

- [ ] **Step 7: Create packages/lib/src/library.ts**

```typescript
import Lib from "sap/ui/core/Lib";

const library = Lib.init({
  apiVersion: 2,
  name: "ui5.util",
  version: "${version}",
  dependencies: ["sap.ui.core", "sap.m"],
  types: [],
  interfaces: [],
  controls: [],
  elements: [],
  noLibraryCSS: true,
});

export default library;
```

- [ ] **Step 8: Install lib dependencies and verify build**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
npm install
cd packages/lib
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
git add packages/lib/
git commit -m "chore: add library package scaffolding"
```

---

## Task 3: Create QUnit test infrastructure

**Files:**

- Create: `packages/lib/test/qunit/Test.qunit.html`
- Create: `packages/lib/test/qunit/testsuite.qunit.ts`
- Create: `packages/lib/test/wdio-qunit.conf.ts`
- Create: `scripts/run-with-server.mjs`

- [ ] **Step 1: Create Test.qunit.html**

Create `packages/lib/test/qunit/Test.qunit.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QUnit tests for ui5.util</title>
    <script
      src="../../node_modules/@openui5/sap.ui.core/test-resources/sap/ui/qunit/testrunner.js"
      data-sap-ui-testsuite="test-resources/ui5/util/qunit/testsuite.qunit"
    ></script>
  </head>
  <body></body>
</html>
```

Wait -- this HTML is for running via the UI5 test runner. For library development the standard pattern is:

Create `packages/lib/test/qunit/Test.qunit.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QUnit tests for ui5.util</title>
    <script
      id="sap-ui-bootstrap"
      src="../../resources/sap-ui-core.js"
      data-sap-ui-theme="sap_horizon"
      data-sap-ui-libs="sap.ui.core,sap.m"
      data-sap-ui-resourceroots='{ "ui5.util": "../../resources/ui5/util/" }'
      data-sap-ui-async="true"
    ></script>
    <link rel="stylesheet" href="../../resources/sap/ui/thirdparty/qunit-2.css" />
    <script src="../../resources/sap/ui/thirdparty/qunit-2.js"></script>
    <script src="../../resources/sap/ui/qunit/qunit-junit.js"></script>
    <script src="../../resources/sap/ui/thirdparty/sinon-4.js"></script>
    <script>
      sap.ui.require(
        [
          sap.ui.require.toUrl(
            "test-resources/ui5/util/qunit/" + new URLSearchParams(window.location.search).get("test"),
          ) + ".qunit",
        ],
        function () {
          QUnit.start();
        },
      );
    </script>
  </head>
  <body>
    <div id="qunit"></div>
    <div id="qunit-fixture"></div>
  </body>
</html>
```

- [ ] **Step 2: Create testsuite.qunit.ts**

Create `packages/lib/test/qunit/testsuite.qunit.ts`:

```typescript
sap.ui.define([], () => {
  "use strict";

  return {
    name: "QUnit test suite for ui5.util",
    defaults: {
      page: "ui5://test-resources/ui5/util/qunit/Test.qunit.html?testsuite={suite}&test={name}",
      qunit: {
        version: 2,
      },
      sinon: {
        version: 4,
      },
      ui5: {
        theme: "sap_horizon",
      },
    },
    tests: {},
  };
});
```

- [ ] **Step 3: Create testsuite.qunit.html (the entry for testrunner)**

Create `packages/lib/test/qunit/testsuite.qunit.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>QUnit Test Suite for ui5.util</title>
    <script
      src="../../resources/sap/ui/qunit/testrunner.js"
      data-sap-ui-testsuite="test-resources/ui5/util/qunit/testsuite.qunit"
    ></script>
  </head>
  <body></body>
</html>
```

- [ ] **Step 4: Create wdio-qunit.conf.ts**

Create `packages/lib/test/wdio-qunit.conf.ts`:

```typescript
export const config: WebdriverIO.Config = {
  runner: "local",
  specs: ["./**/*.qunit.html"],
  exclude: [],
  maxInstances: 1,
  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      },
    },
  ],
  logLevel: "warn",
  bail: 0,
  baseUrl: "http://localhost:8080",
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ["qunit"],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
};
```

- [ ] **Step 5: Create scripts/run-with-server.mjs**

Copy the run-with-server.mjs script from `ui5-lib-signal-model`. This script starts a UI5 serve process, waits for it to be ready, runs the WDIO tests, then shuts down the server.

```bash
cp "C:/Users/m.beier/Documents/dev/ui5-lib-signal-model/scripts/run-with-server.mjs" "C:/Users/m.beier/Documents/dev/ui5-lib-util/scripts/run-with-server.mjs"
```

If that file does not exist, create a minimal version:

```javascript
#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "ready-url": { type: "string" },
    "server-script": { type: "string" },
    "test-script": { type: "string" },
  },
});

const serverProc = spawn("npm", ["run", values["server-script"]], {
  stdio: ["ignore", "pipe", "inherit"],
  shell: true,
});

async function waitForServer(url, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server at ${url} did not become ready`);
}

try {
  await waitForServer(values["ready-url"]);
  const testProc = spawn("npm", ["run", values["test-script"]], {
    stdio: "inherit",
    shell: true,
  });
  const code = await new Promise((resolve) => testProc.on("close", resolve));
  process.exitCode = code;
} finally {
  serverProc.kill();
}
```

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
git add packages/lib/test/ scripts/
git commit -m "chore: add QUnit test infrastructure"
```

---

## Task 4: Dialog module types

**Files:**

- Create: `packages/lib/src/dialog/types.ts`

- [ ] **Step 1: Create dialog types**

Create `packages/lib/src/dialog/types.ts`:

```typescript
import type BaseObject from "sap/ui/base/Object";
import type Element from "sap/ui/core/Element";
import type View from "sap/ui/core/mvc/View";
import type Context from "sap/ui/model/Context";

/**
 * Configuration for a dialog managed by the library.
 * Consumer defines these as plain objects.
 */
export interface TDialogConfiguration {
  /** Fragment name relative to component namespace + fragmentBasePath */
  fragmentName: string;
  /** Controller name relative to component namespace + controllerBasePath (omit to use parent controller) */
  controllerName?: string;
  /** Events that trigger dialog close (default: ["afterClose"]) */
  closeEvents?: string[];
  /** Cache mode: "destroy" recreates on each open, "reuse" caches and re-calls onData() */
  cacheMode?: "destroy" | "reuse";
  /** Where to call addDependent(): "rootView" (default), "control", or "none" */
  dependentTarget?: "rootView" | "control" | "none";
}

/**
 * Options for DialogManager initialization.
 */
export interface DialogManagerOptions {
  /** Path prefix for fragment resolution relative to component namespace (default: "view/dialogs") */
  fragmentBasePath?: string;
  /** Path prefix for controller resolution relative to component namespace (default: "controller/dialogs") */
  controllerBasePath?: string;
}

/**
 * Properties passed to DialogManager.open().
 */
export interface DialogOpenProperties {
  /** Unique ID for this dialog instance */
  id: string;
  /** Root view for dependent management and ID scoping */
  rootView: View;
  /** Data to pass to the dialog controller's onData() */
  data?: object | Context | BaseObject | null;
  /** Dialog configuration */
  configuration: TDialogConfiguration;
  /** Control to dock a Popover/ResponsivePopover to */
  dockingControl?: Element;
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
npx tsc --noEmit -p packages/lib/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/lib/src/dialog/
git commit -m "feat(dialog): add type definitions"
```

---

## Task 5: DialogControllerExtension

**Files:**

- Create: `packages/lib/src/dialog/DialogControllerExtension.ts`
- Create: `packages/lib/test/qunit/dialog/DialogControllerExtension.qunit.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/test/qunit/dialog/DialogControllerExtension.qunit.ts`:

```typescript
sap.ui.define(
  ["ui5/util/dialog/DialogControllerExtension", "sap/ui/base/EventProvider"],
  (
    DialogControllerExtension: typeof import("ui5/util/dialog/DialogControllerExtension").default,
    EventProvider: typeof import("sap/ui/base/EventProvider").default,
  ) => {
    "use strict";

    const { test, module } = QUnit;

    module("DialogControllerExtension", () => {
      test("should be a ControllerExtension subclass", (assert) => {
        assert.ok(DialogControllerExtension, "Module is loaded");
        assert.ok(DialogControllerExtension.prototype, "Has prototype");
      });

      test("fireDialogEvent fires event on control", (assert) => {
        const ext = new DialogControllerExtension();
        const mockControl = new EventProvider();
        const spy = sinon.spy(mockControl, "fireEvent");

        ext.fireDialogEvent(mockControl, {
          eventId: "TEST_EVENT",
          parameters: { value: 42 },
        });

        assert.ok(spy.calledOnce, "fireEvent called once");
        assert.strictEqual(spy.firstCall.args[0], "TEST_EVENT", "Correct event ID");
        assert.deepEqual(spy.firstCall.args[1], { value: 42 }, "Correct parameters");

        mockControl.destroy();
      });

      test("fireCreateEvent fires CREATE with data", (assert) => {
        const ext = new DialogControllerExtension();
        const mockControl = new EventProvider();
        const spy = sinon.spy(mockControl, "fireEvent");
        const data = { name: "test" };

        ext.fireCreateEvent(mockControl, data);

        assert.ok(spy.calledOnce, "fireEvent called once");
        assert.strictEqual(spy.firstCall.args[0], "CREATE", "Event is CREATE");
        assert.deepEqual(spy.firstCall.args[1], { data }, "Data wrapped in parameters");

        mockControl.destroy();
      });

      test("fireSaveEvent fires SAVE with source and updateFields", (assert) => {
        const ext = new DialogControllerExtension();
        const mockControl = new EventProvider();
        const spy = sinon.spy(mockControl, "fireEvent");

        ext.fireSaveEvent(mockControl, null, { field: "value" });

        assert.strictEqual(spy.firstCall.args[0], "SAVE", "Event is SAVE");
        assert.deepEqual(
          spy.firstCall.args[1],
          { source: null, updateFields: { field: "value" } },
          "Parameters correct",
        );

        mockControl.destroy();
      });

      test("fireCancelEvent fires CANCEL", (assert) => {
        const ext = new DialogControllerExtension();
        const mockControl = new EventProvider();
        const spy = sinon.spy(mockControl, "fireEvent");

        ext.fireCancelEvent(mockControl);

        assert.strictEqual(spy.firstCall.args[0], "CANCEL", "Event is CANCEL");

        mockControl.destroy();
      });

      test("fireDeleteEvent fires DELETE with data", (assert) => {
        const ext = new DialogControllerExtension();
        const mockControl = new EventProvider();
        const spy = sinon.spy(mockControl, "fireEvent");

        ext.fireDeleteEvent(mockControl, null);

        assert.strictEqual(spy.firstCall.args[0], "DELETE", "Event is DELETE");
        assert.deepEqual(spy.firstCall.args[1], { data: null }, "Data parameter");

        mockControl.destroy();
      });

      test("fireEditEvent fires EDIT with data", (assert) => {
        const ext = new DialogControllerExtension();
        const mockControl = new EventProvider();
        const spy = sinon.spy(mockControl, "fireEvent");

        ext.fireEditEvent(mockControl, null);

        assert.strictEqual(spy.firstCall.args[0], "EDIT", "Event is EDIT");
        assert.deepEqual(spy.firstCall.args[1], { data: null }, "Data parameter");

        mockControl.destroy();
      });
    });
  },
);
```

- [ ] **Step 2: Register test in testsuite**

Update `packages/lib/test/qunit/testsuite.qunit.ts` -- add to the `tests` object:

```typescript
tests: {
	"dialog/DialogControllerExtension": {
		title: "QUnit tests for ui5.util - DialogControllerExtension",
	},
},
```

- [ ] **Step 3: Write implementation**

Create `packages/lib/src/dialog/DialogControllerExtension.ts`:

```typescript
import type Control from "sap/ui/core/Control";
import type Element from "sap/ui/core/Element";
import Fragment from "sap/ui/core/Fragment";
import ControllerExtension from "sap/ui/core/mvc/ControllerExtension";
import OverrideExecution from "sap/ui/core/mvc/OverrideExecution";
import type Context from "sap/ui/model/Context";

/**
 * Controller extension providing dialog event firing and fragment ID lookup.
 * Use via ControllerExtension.use() in any controller.
 *
 * @namespace ui5.util.dialog
 */
export default class DialogControllerExtension extends ControllerExtension {
  static readonly metadata = {
    methods: {
      onDialogOpened: {
        public: true,
        final: false,
        overrideExecution: OverrideExecution.After,
      },
      onDialogClosed: {
        public: true,
        final: false,
        overrideExecution: OverrideExecution.After,
      },
    },
  };

  static readonly overrides = {
    onExit: function (this: DialogControllerExtension) {
      // Cleanup hook -- subclasses can override
    },
  };

  public fireDialogEvent(
    control: Control,
    settings: {
      eventId: string;
      parameters?: object;
      allowPreventDefault?: boolean;
      enableEventBubbling?: boolean;
    },
  ): void {
    control.fireEvent(
      settings.eventId,
      settings.parameters,
      settings.allowPreventDefault,
      settings.enableEventBubbling,
    );
  }

  public fireCreateEvent(control: Control, data: object): void {
    this.fireDialogEvent(control, { eventId: "CREATE", parameters: { data } });
  }

  public fireSaveEvent(control: Control, source: Context | null | undefined, updateFields: object): void {
    this.fireDialogEvent(control, {
      eventId: "SAVE",
      parameters: { source, updateFields },
    });
  }

  public fireCancelEvent(control: Control): void {
    this.fireDialogEvent(control, { eventId: "CANCEL" });
  }

  public fireDeleteEvent(control: Control, data: Context | null | undefined): void {
    this.fireDialogEvent(control, { eventId: "DELETE", parameters: { data } });
  }

  public fireEditEvent(control: Control, data: Context | null | undefined): void {
    this.fireDialogEvent(control, { eventId: "EDIT", parameters: { data } });
  }

  public fragmentById<T extends Element>(fragmentId: string, controlId: string): T {
    return Fragment.byId(fragmentId, controlId) as T;
  }

  public onDialogOpened(): void {
    // Default no-op -- consumers override via OverrideExecution.After
  }

  public onDialogClosed(): void {
    // Default no-op -- consumers override via OverrideExecution.After
  }
}
```

- [ ] **Step 4: Verify types compile**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
npx tsc --noEmit -p packages/lib/tsconfig.json
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/lib/src/dialog/DialogControllerExtension.ts packages/lib/test/qunit/dialog/
git commit -m "feat(dialog): add DialogControllerExtension with event helpers"
```

---

## Task 6: AbstractDialogController

**Files:**

- Create: `packages/lib/src/dialog/AbstractDialogController.ts`
- Create: `packages/lib/test/qunit/dialog/AbstractDialogController.qunit.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/test/qunit/dialog/AbstractDialogController.qunit.ts`:

```typescript
sap.ui.define(
  ["ui5/util/dialog/AbstractDialogController"],
  (AbstractDialogController: typeof import("ui5/util/dialog/AbstractDialogController").default) => {
    "use strict";

    const { test, module } = QUnit;

    module("AbstractDialogController", () => {
      test("should be a Controller subclass", (assert) => {
        assert.ok(AbstractDialogController, "Module is loaded");
      });

      test("setOwnerComponent and getOwnerComponent", (assert) => {
        // Create a concrete subclass for testing
        const ConcreteController = AbstractDialogController.extend("test.ConcreteDialogController", {
          onData() {},
        }) as unknown as new () => InstanceType<typeof AbstractDialogController>;

        const ctrl = new ConcreteController();
        const mockComponent = { getId: () => "testComponent" } as any;

        ctrl.setOwnerComponent(mockComponent);
        assert.strictEqual(ctrl.getOwnerComponent(), mockComponent, "Component stored and retrieved");
      });

      test("setFragmentId stores fragment ID", (assert) => {
        const ConcreteController = AbstractDialogController.extend("test.ConcreteDialogController2", {
          onData() {},
        }) as unknown as new () => InstanceType<typeof AbstractDialogController>;

        const ctrl = new ConcreteController();
        ctrl.setFragmentId("myFragment");
        assert.strictEqual((ctrl as any).fragmentId, "myFragment", "Fragment ID stored");
      });

      test("fireDialogEvent delegates to control.fireEvent", (assert) => {
        const ConcreteController = AbstractDialogController.extend("test.ConcreteDialogController3", {
          onData() {},
        }) as unknown as new () => InstanceType<typeof AbstractDialogController>;

        const ctrl = new ConcreteController();
        const mockControl = { fireEvent: sinon.spy() } as any;

        (ctrl as any).fireDialogEvent(mockControl, {
          eventId: "TEST",
          parameters: { key: "val" },
        });

        assert.ok(mockControl.fireEvent.calledOnce, "fireEvent called");
        assert.strictEqual(mockControl.fireEvent.firstCall.args[0], "TEST", "Correct event");
      });
    });
  },
);
```

- [ ] **Step 2: Register test in testsuite**

Add to `tests` object in `packages/lib/test/qunit/testsuite.qunit.ts`:

```typescript
"dialog/AbstractDialogController": {
	title: "QUnit tests for ui5.util - AbstractDialogController",
},
```

- [ ] **Step 3: Write implementation**

Create `packages/lib/src/dialog/AbstractDialogController.ts`:

```typescript
import type ResourceBundle from "sap/base/i18n/ResourceBundle";
import type Component from "sap/ui/core/Component";
import type Control from "sap/ui/core/Control";
import type Element from "sap/ui/core/Element";
import Fragment from "sap/ui/core/Fragment";
import Controller from "sap/ui/core/mvc/Controller";
import type Context from "sap/ui/model/Context";
import type ResourceModel from "sap/ui/model/resource/ResourceModel";

/**
 * Abstract base class for dialog controllers.
 * Provides lifecycle hooks, event firing helpers, and fragment ID-scoped control lookup.
 *
 * This is an alternative to DialogControllerExtension for consumers who prefer
 * inheritance over composition. The two approaches are independent.
 *
 * @namespace ui5.util.dialog
 */
export default abstract class AbstractDialogController extends Controller {
  protected ownerComponent!: Component;
  protected fragmentId!: string;

  // Lifecycle hooks with default empty implementations
  public onInit(): void {}
  public onBeforeRendering(): void {}
  public onAfterRendering(): void {}
  public onExit(): void {}

  /**
   * Called by DialogProvider after the dialog is loaded, passing the data
   * from DialogOpenProperties.data. Must be implemented by subclasses.
   */
  public abstract onData(data: object | Context): void | Promise<void>;

  public setOwnerComponent(component: Component): void {
    this.ownerComponent = component;
  }

  public getOwnerComponent(): Component {
    return this.ownerComponent;
  }

  public setFragmentId(id: string): void {
    this.fragmentId = id;
  }

  /**
   * Look up a control within the fragment by its local ID.
   */
  public fragmentById<T extends Element>(id: string): T {
    return Fragment.byId(this.fragmentId, id) as T;
  }

  /**
   * Gets the ResourceBundle from the i18n model asynchronously.
   */
  protected async getResourceBundle(): Promise<ResourceBundle> {
    const i18nModel = this.ownerComponent.getModel("i18n") as ResourceModel;
    const bundleOrPromise = i18nModel.getResourceBundle();
    if (bundleOrPromise instanceof Promise) {
      return bundleOrPromise;
    }
    return bundleOrPromise as ResourceBundle;
  }

  protected fireDialogEvent(
    control: Control,
    settings: {
      eventId: string;
      parameters?: object;
      allowPreventDefault?: boolean;
      enableEventBubbling?: boolean;
    },
  ): void {
    control.fireEvent(
      settings.eventId,
      settings.parameters,
      settings.allowPreventDefault,
      settings.enableEventBubbling,
    );
  }

  protected fireCreateEvent(control: Control, data: object): void {
    this.fireDialogEvent(control, { eventId: "CREATE", parameters: { data } });
  }

  protected fireSaveEvent(control: Control, source: Context | null | undefined, updateFields: object): void {
    this.fireDialogEvent(control, {
      eventId: "SAVE",
      parameters: { source, updateFields },
    });
  }

  protected fireCancelEvent(control: Control): void {
    this.fireDialogEvent(control, { eventId: "CANCEL" });
  }

  protected fireDeleteEvent(control: Control, data: Context | null | undefined): void {
    this.fireDialogEvent(control, { eventId: "DELETE", parameters: { data } });
  }

  protected fireEditEvent(control: Control, data: Context | null | undefined): void {
    this.fireDialogEvent(control, { eventId: "EDIT", parameters: { data } });
  }
}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit -p packages/lib/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add packages/lib/src/dialog/AbstractDialogController.ts packages/lib/test/qunit/dialog/AbstractDialogController.qunit.ts
git commit -m "feat(dialog): add AbstractDialogController with lifecycle hooks"
```

---

## Task 7: DialogProvider

**Files:**

- Create: `packages/lib/src/dialog/DialogProvider.ts`
- Create: `packages/lib/test/qunit/dialog/DialogProvider.qunit.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/test/qunit/dialog/DialogProvider.qunit.ts`:

```typescript
sap.ui.define(
  ["ui5/util/dialog/DialogProvider", "sap/ui/base/EventProvider"],
  (
    DialogProvider: typeof import("ui5/util/dialog/DialogProvider").default,
    EventProvider: typeof import("sap/ui/base/EventProvider").default,
  ) => {
    "use strict";

    const { test, module } = QUnit;

    module("DialogProvider", () => {
      test("should be an EventProvider subclass", (assert) => {
        assert.ok(DialogProvider, "Module is loaded");
      });

      test("on() defers handlers when dialog not yet opened", (assert) => {
        const provider = new DialogProvider({} as any, {
          id: "test",
          rootView: { getId: () => "view", createId: (id: string) => `view--${id}` } as any,
          configuration: {
            fragmentName: "TestDialog",
            controllerName: "TestController",
          },
        });

        const handler = sinon.spy();
        const result = provider.on("SAVE", handler);

        assert.strictEqual(result, provider, "Returns this for chaining");
        assert.ok(handler.notCalled, "Handler not called immediately");

        provider.destroy();
      });

      test("onPersistent() defers persistent handlers", (assert) => {
        const provider = new DialogProvider({} as any, {
          id: "test",
          rootView: { getId: () => "view", createId: (id: string) => `view--${id}` } as any,
          configuration: {
            fragmentName: "TestDialog",
          },
        });

        const handler = sinon.spy();
        const result = provider.onPersistent("CREATE", handler);

        assert.strictEqual(result, provider, "Returns this for chaining");

        provider.destroy();
      });

      test("createDialogId generates scoped ID", (assert) => {
        const result = DialogProvider.createDialogId({
          id: "myDialog",
          rootView: { createId: (id: string) => `view--${id}` } as any,
        });

        assert.strictEqual(result, "view--myDialog", "ID is scoped to view");
      });

      test("createDialogId falls back to view ID when no id given", (assert) => {
        const result = DialogProvider.createDialogId({
          id: "",
          rootView: { getId: () => "viewId", createId: (id: string) => `view--${id}` } as any,
        });

        assert.strictEqual(result, "viewId", "Falls back to view ID");
      });
    });
  },
);
```

- [ ] **Step 2: Register test in testsuite**

Add to `tests` object:

```typescript
"dialog/DialogProvider": {
	title: "QUnit tests for ui5.util - DialogProvider",
},
```

- [ ] **Step 3: Write implementation**

Create `packages/lib/src/dialog/DialogProvider.ts`:

```typescript
import type Dialog from "sap/m/Dialog";
import type Popover from "sap/m/Popover";
import type ResponsivePopover from "sap/m/ResponsivePopover";
import Log from "sap/base/Log";
import type Event from "sap/ui/base/Event";
import EventProvider from "sap/ui/base/EventProvider";
import type Component from "sap/ui/core/Component";
import type Control from "sap/ui/core/Control";
import Fragment from "sap/ui/core/Fragment";
import Controller from "sap/ui/core/mvc/Controller";
import type View from "sap/ui/core/mvc/View";
import type AbstractDialogController from "./AbstractDialogController";
import type { DialogOpenProperties } from "./types";

const logger = Log.getLogger("ui5.util.dialog.DialogProvider");

type DeferredEventHandler = {
  eventType: string;
  callback: (event?: Event) => void;
  persistent?: boolean;
};

type OverlayControl = Dialog | Popover | ResponsivePopover;

/**
 * Manages the lifecycle of a single dialog/popover instance.
 * Handles fragment loading, controller creation, deferred event attachment,
 * and open/close mechanics.
 *
 * @namespace ui5.util.dialog
 */
export default class DialogProvider extends EventProvider {
  private isOpened = false;
  private readonly dialogModuleId: string;
  private readonly controllerModuleId?: string;
  private controller?: AbstractDialogController;
  private readonly ownerComponent: Component;
  private dialog!: OverlayControl;
  private readonly rootView: View;
  private readonly dockingControl: Control | undefined;
  private readonly closeEvents: string[];
  private readonly _dialogId: string;
  private readonly data: object;
  private readonly dependentTarget: "rootView" | "control" | "none";
  private readonly cacheMode: "destroy" | "reuse";
  private deferredEventHandlers: DeferredEventHandler[] = [];

  public static createDialogId({ id, rootView }: Pick<DialogOpenProperties, "id" | "rootView">): string {
    return id ? rootView.createId(id) : rootView.getId();
  }

  constructor(ownerComponent: Component, props: DialogOpenProperties) {
    super();
    this._dialogId = DialogProvider.createDialogId({
      id: props.id,
      rootView: props.rootView,
    });
    this.dialogModuleId = props.configuration.fragmentName;
    this.controllerModuleId = props.configuration.controllerName;
    this.rootView = props.rootView;
    this.dockingControl = props.dockingControl as Control | undefined;
    this.data = props.data ?? {};
    this.closeEvents = props.configuration.closeEvents ?? ["afterClose"];
    this.ownerComponent = ownerComponent;
    this.dependentTarget = props.configuration.dependentTarget ?? "rootView";
    this.cacheMode = props.configuration.cacheMode ?? "destroy";
  }

  public async open(): Promise<void> {
    // If reusing a cached dialog, just re-call onData and re-open
    if (this.cacheMode === "reuse" && this.dialog && this.controller) {
      await this.controller.onData(this.data);
      this.openOverlay();
      this.isOpened = true;
      return;
    }

    if (this.controllerModuleId) {
      this.controller = (await Controller.create({
        name: this.controllerModuleId,
      })) as AbstractDialogController;
    }

    this.dialog = (await Fragment.load({
      id: this._dialogId,
      name: this.dialogModuleId,
      controller: this.controller,
    })) as OverlayControl;

    // Manage dependency ownership
    if (this.dependentTarget === "rootView") {
      this.rootView.addDependent(this.dialog);
    } else if (this.dependentTarget === "control" && this.dockingControl) {
      (this.dockingControl as Control).addDependent(this.dialog);
    }

    // Initialize controller lifecycle
    if (this.controller) {
      this.controller.setOwnerComponent(this.ownerComponent);
      this.controller.setFragmentId(this._dialogId);
      this.controller.onInit();
      await this.controller.onData(this.data);
      this.controller.onBeforeRendering();
    }

    // Ensure afterClose is always handled
    if (this.hasCloseMethod() && !this.closeEvents.includes("afterClose")) {
      this.closeEvents.push("afterClose");
    }

    // Attach close event listeners
    for (const eventType of this.closeEvents) {
      this.dialog.attachEvent(eventType, () => {
        this.onClose();
        this.fireEvent("CLOSE");
      });
    }

    // Attach all deferred event handlers
    for (const handler of this.deferredEventHandlers) {
      if (handler.persistent) {
        this.dialog.attachEvent(handler.eventType, handler.callback);
      } else {
        this.dialog.attachEventOnce(handler.eventType, handler.callback);
      }
    }
    this.deferredEventHandlers = [];

    this.openOverlay();

    if (this.controller) {
      this.controller.onAfterRendering();
    }
    this.isOpened = true;
  }

  private openOverlay(): void {
    // ResponsivePopover and Popover use openBy(), Dialog uses open()
    if ("openBy" in this.dialog && this.dockingControl) {
      (this.dialog as Popover).openBy(this.dockingControl);
    } else if ("open" in this.dialog) {
      (this.dialog as Dialog).open();
    }
  }

  private hasCloseMethod(): boolean {
    return "close" in this.dialog;
  }

  public close(): void {
    if (this.hasCloseMethod()) {
      (this.dialog as Dialog).close();
    } else {
      this.fireEvent("INTERNAL_CLOSE");
    }
  }

  protected onClose(): void {
    if (this.controller) {
      this.controller.onExit();
    }

    if (this.cacheMode === "destroy") {
      if (this.dependentTarget === "rootView") {
        this.rootView.removeDependent(this.dialog);
      } else if (this.dependentTarget === "control" && this.dockingControl) {
        (this.dockingControl as Control).removeDependent(this.dialog);
      }
      this.dialog.destroy();
    }

    this.isOpened = false;
  }

  /**
   * Attach a one-time event handler. If the dialog is not yet opened,
   * the handler is deferred until open().
   */
  public on(eventType: string, callback: (event?: Event) => void): this {
    if (this.isOpened) {
      this.dialog.attachEventOnce(eventType, callback);
    } else {
      this.deferredEventHandlers.push({ eventType, callback });
    }
    return this;
  }

  /**
   * Attach a persistent event handler that fires every time.
   * If the dialog is not yet opened, the handler is deferred until open().
   */
  public onPersistent(eventType: string, callback: (event?: Event) => void): this {
    if (this.isOpened) {
      this.dialog.attachEvent(eventType, callback);
    } else {
      this.deferredEventHandlers.push({ eventType, callback, persistent: true });
    }
    return this;
  }

  public getController(): AbstractDialogController | undefined {
    return this.controller;
  }
}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit -p packages/lib/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add packages/lib/src/dialog/DialogProvider.ts packages/lib/test/qunit/dialog/DialogProvider.qunit.ts
git commit -m "feat(dialog): add DialogProvider with deferred events and overlay lifecycle"
```

---

## Task 8: DialogManager

**Files:**

- Create: `packages/lib/src/dialog/DialogManager.ts`
- Create: `packages/lib/test/qunit/dialog/DialogManager.qunit.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/lib/test/qunit/dialog/DialogManager.qunit.ts`:

```typescript
sap.ui.define(
  ["ui5/util/dialog/DialogManager"],
  (DialogManager: typeof import("ui5/util/dialog/DialogManager").default) => {
    "use strict";

    const { test, module } = QUnit;

    module("DialogManager", () => {
      test("should be loadable", (assert) => {
        assert.ok(DialogManager, "Module is loaded");
      });

      test("resolves fragment module ID from component namespace", (assert) => {
        const mockComponent = {
          getManifestEntry: (path: string) => {
            if (path === "/sap.app/id") return "com.example.myapp";
            return undefined;
          },
        } as any;

        const manager = new DialogManager(mockComponent);

        // Access the private resolve method via casting for testing
        const resolved = (manager as any).resolveModuleId("CreateMember", "view/dialogs");
        assert.strictEqual(
          resolved,
          "com.example.myapp.view.dialogs.CreateMember",
          "Fragment module ID resolved correctly",
        );

        manager.destroy();
      });

      test("resolves controller module ID from component namespace", (assert) => {
        const mockComponent = {
          getManifestEntry: (path: string) => {
            if (path === "/sap.app/id") return "com.example.myapp";
            return undefined;
          },
        } as any;

        const manager = new DialogManager(mockComponent);

        const resolved = (manager as any).resolveModuleId("CreateMemberController", "controller/dialogs");
        assert.strictEqual(
          resolved,
          "com.example.myapp.controller.dialogs.CreateMemberController",
          "Controller module ID resolved correctly",
        );

        manager.destroy();
      });

      test("uses custom base paths when provided", (assert) => {
        const mockComponent = {
          getManifestEntry: (path: string) => {
            if (path === "/sap.app/id") return "com.example.myapp";
            return undefined;
          },
        } as any;

        const manager = new DialogManager(mockComponent, {
          fragmentBasePath: "fragments",
          controllerBasePath: "controllers",
        });

        const resolved = (manager as any).resolveModuleId("MyDialog", "fragments");
        assert.strictEqual(resolved, "com.example.myapp.fragments.MyDialog", "Custom base path used");

        manager.destroy();
      });

      test("destroy cleans up", (assert) => {
        const mockComponent = {
          getManifestEntry: () => "com.example.myapp",
        } as any;

        const manager = new DialogManager(mockComponent);
        manager.destroy();

        assert.ok(true, "Destroy completes without error");
      });
    });
  },
);
```

- [ ] **Step 2: Register test in testsuite**

Add to `tests` object:

```typescript
"dialog/DialogManager": {
	title: "QUnit tests for ui5.util - DialogManager",
},
```

- [ ] **Step 3: Write implementation**

Create `packages/lib/src/dialog/DialogManager.ts`:

```typescript
import Log from "sap/base/Log";
import BaseObject from "sap/ui/base/Object";
import type Component from "sap/ui/core/Component";
import DialogProvider from "./DialogProvider";
import type { DialogManagerOptions, DialogOpenProperties } from "./types";

const logger = Log.getLogger("ui5.util.dialog.DialogManager");

/**
 * Component-scoped dialog orchestrator.
 * Manages the creation, caching, and cleanup of DialogProvider instances.
 *
 * @namespace ui5.util.dialog
 */
export default class DialogManager extends BaseObject {
  private readonly dialogs: Map<string, DialogProvider> = new Map();
  private readonly ownerComponent: Component;
  private readonly fragmentBasePath: string;
  private readonly controllerBasePath: string;
  private readonly componentNamespace: string;

  constructor(ownerComponent: Component, options?: DialogManagerOptions) {
    super();
    this.ownerComponent = ownerComponent;
    this.fragmentBasePath = options?.fragmentBasePath ?? "view/dialogs";
    this.controllerBasePath = options?.controllerBasePath ?? "controller/dialogs";
    this.componentNamespace = ownerComponent.getManifestEntry("/sap.app/id") as string;
  }

  public open(props: DialogOpenProperties): DialogProvider {
    const dialogId = DialogProvider.createDialogId(props);

    // Check for cached (reuse mode) dialog
    let dialogProvider = this.dialogs.get(dialogId);
    if (dialogProvider && props.configuration.cacheMode === "reuse") {
      // Re-open cached dialog with new data
      void dialogProvider.open();
      return dialogProvider;
    }

    // Resolve module IDs from component namespace
    const resolvedConfig = {
      ...props.configuration,
      fragmentName: this.resolveModuleId(props.configuration.fragmentName, this.fragmentBasePath),
      controllerName: props.configuration.controllerName
        ? this.resolveModuleId(props.configuration.controllerName, this.controllerBasePath)
        : undefined,
    };

    dialogProvider = new DialogProvider(this.ownerComponent, {
      ...props,
      configuration: resolvedConfig,
    });

    this.dialogs.set(dialogId, dialogProvider);

    void dialogProvider.open();

    dialogProvider.attachEventOnce("INTERNAL_CLOSE", () => this.onDialogClose(dialogId));
    dialogProvider.attachEventOnce("CLOSE", () => this.onDialogClose(dialogId));

    return dialogProvider;
  }

  private onDialogClose(dialogId: string): void {
    const provider = this.dialogs.get(dialogId);
    if (provider) {
      const config = provider as any;
      if (config.cacheMode !== "reuse") {
        this.dialogs.delete(dialogId);
      }
    }
  }

  private resolveModuleId(name: string, basePath: string): string {
    return `${this.componentNamespace}.${basePath.replace(/\//g, ".")}.${name}`;
  }

  public destroy(): void {
    for (const [dialogId, dialogProvider] of this.dialogs) {
      dialogProvider.close();
      this.dialogs.delete(dialogId);
    }
    super.destroy();
  }
}
```

- [ ] **Step 4: Verify types compile**

```bash
npx tsc --noEmit -p packages/lib/tsconfig.json
```

- [ ] **Step 5: Commit**

```bash
git add packages/lib/src/dialog/DialogManager.ts packages/lib/test/qunit/dialog/DialogManager.qunit.ts
git commit -m "feat(dialog): add DialogManager with namespace resolution and caching"
```

---

## Task 9: Create demo app scaffolding

**Files:**

- Create: `packages/demo-app/package.json`
- Create: `packages/demo-app/ui5.yaml`
- Create: `packages/demo-app/tsconfig.json`
- Create: `packages/demo-app/webapp/manifest.json`
- Create: `packages/demo-app/webapp/index.html`
- Create: `packages/demo-app/webapp/Component.ts`
- Create: `packages/demo-app/webapp/controller/BaseController.ts`
- Create: `packages/demo-app/webapp/controller/App.controller.ts`
- Create: `packages/demo-app/webapp/controller/Main.controller.ts`
- Create: `packages/demo-app/webapp/view/App.view.xml`
- Create: `packages/demo-app/webapp/view/Main.view.xml`
- Create: `packages/demo-app/webapp/i18n/i18n.properties`

- [ ] **Step 1: Create directory structure**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
mkdir -p packages/demo-app/webapp/{controller,view,i18n}
mkdir -p packages/demo-app/webapp/controller/dialogs
mkdir -p packages/demo-app/webapp/view/dialogs
```

- [ ] **Step 2: Create packages/demo-app/package.json**

```json
{
  "name": "demo-util-app",
  "version": "1.0.0",
  "private": true,
  "author": "Marco Beier",
  "description": "Demo app for ui5-lib-util library",
  "engines": {
    "node": ">=22"
  },
  "type": "module",
  "scripts": {
    "clean": "rimraf dist .ui5",
    "start": "ui5 serve --open /index.html",
    "build": "ui5 build",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@openui5/types": "1.120.25",
    "@ui5/cli": "^4.0.0",
    "ui5-middleware-livereload": "^3.0.0",
    "ui5-tooling-transpile": "^3.11.0"
  },
  "dependencies": {
    "ui5-lib-util": "*"
  }
}
```

- [ ] **Step 3: Create packages/demo-app/ui5.yaml**

```yaml
specVersion: "4.0"
metadata:
  name: demo.util.app
type: application
framework:
  name: OpenUI5
  version: "1.120.0"
  libraries:
    - name: sap.m
    - name: sap.ui.core
    - name: sap.ui.layout
    - name: themelib_sap_horizon
server:
  customMiddleware:
    - name: ui5-tooling-transpile-middleware
      afterMiddleware: compression
      configuration:
        transpileDependencies: true
        transformTypeScript:
          allowDeclareFields: true
    - name: ui5-middleware-livereload
      afterMiddleware: compression
resources:
  configuration:
    paths:
      webapp: webapp
builder:
  customTasks:
    - name: ui5-tooling-transpile-task
      afterTask: replaceVersion
      configuration:
        omitTSFromBuildResult: true
        transformTypeScript:
          allowDeclareFields: true
```

- [ ] **Step 4: Create packages/demo-app/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": ".",
    "paths": {
      "demo/util/app/*": ["./webapp/*"],
      "ui5/util/*": ["../lib/src/*"]
    },
    "types": ["@openui5/types"]
  },
  "include": ["webapp/**/*.ts"]
}
```

- [ ] **Step 5: Create webapp/index.html**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ui5-lib-util Demo</title>
    <script
      id="sap-ui-bootstrap"
      src="resources/sap-ui-core.js"
      data-sap-ui-theme="sap_horizon"
      data-sap-ui-resourceroots='{ "demo.util.app": "./resources/demo/util/app/" }'
      data-sap-ui-compatVersion="edge"
      data-sap-ui-async="true"
      data-sap-ui-onInit="module:demo/util/app/Component"
    ></script>
  </head>
  <body class="sapUiBody" id="content"></body>
</html>
```

- [ ] **Step 6: Create webapp/manifest.json**

```json
{
  "sap.app": {
    "id": "demo.util.app",
    "type": "application",
    "title": "ui5-lib-util Demo",
    "applicationVersion": {
      "version": "1.0.0"
    }
  },
  "sap.ui": {
    "technology": "UI5"
  },
  "sap.ui5": {
    "dependencies": {
      "minUI5Version": "1.120.0",
      "libs": {
        "sap.m": {},
        "sap.ui.core": {},
        "sap.ui.layout": {},
        "ui5.util": {}
      }
    },
    "rootView": {
      "viewName": "demo.util.app.view.App",
      "type": "XML",
      "id": "app"
    },
    "models": {
      "i18n": {
        "type": "sap.ui.model.resource.ResourceModel",
        "settings": {
          "bundleName": "demo.util.app.i18n.i18n",
          "async": true
        }
      }
    }
  }
}
```

- [ ] **Step 7: Create webapp/Component.ts**

```typescript
import UIComponent from "sap/ui/core/UIComponent";
import DialogManager from "ui5/util/dialog/DialogManager";

/**
 * @namespace demo.util.app
 */
export default class Component extends UIComponent {
  private dialogManager!: DialogManager;

  public static metadata = {
    manifest: "json",
  };

  public init(): void {
    super.init();
    this.dialogManager = new DialogManager(this, {
      fragmentBasePath: "view/dialogs",
      controllerBasePath: "controller/dialogs",
    });
  }

  public getDialogManager(): DialogManager {
    return this.dialogManager;
  }

  public exit(): void {
    this.dialogManager.destroy();
  }
}
```

- [ ] **Step 8: Create BaseController, App controller, Main controller, and views**

Create `packages/demo-app/webapp/controller/BaseController.ts`:

```typescript
import Controller from "sap/ui/core/mvc/Controller";
import type View from "sap/ui/core/mvc/View";
import type Model from "sap/ui/model/Model";
import type Component from "../Component";

/**
 * @namespace demo.util.app.controller
 */
export default abstract class BaseController extends Controller {
  public getOwnerComponent(): Component {
    return super.getOwnerComponent() as unknown as Component;
  }

  public getModel(name?: string): Model {
    return (this.getView() as View).getModel(name);
  }

  public setModel(model: Model, name?: string): this {
    (this.getView() as View).setModel(model, name);
    return this;
  }
}
```

Create `packages/demo-app/webapp/controller/App.controller.ts`:

```typescript
import BaseController from "./BaseController";

/**
 * @namespace demo.util.app.controller
 */
export default class App extends BaseController {
  public onInit(): void {}
}
```

Create `packages/demo-app/webapp/controller/Main.controller.ts`:

```typescript
import type View from "sap/ui/core/mvc/View";
import BaseController from "./BaseController";

const DIALOGS = {
  SAMPLE: {
    fragmentName: "SampleDialog",
    controllerName: "SampleDialogController",
    closeEvents: ["CANCEL", "SAVE"],
  },
} as const;

/**
 * @namespace demo.util.app.controller
 */
export default class Main extends BaseController {
  public onOpenDialog(): void {
    this.getOwnerComponent()
      .getDialogManager()
      .open({
        id: "sampleDlg",
        rootView: this.getView() as View,
        data: { message: "Hello from Main controller" },
        configuration: DIALOGS.SAMPLE,
      })
      .on("SAVE", () => {
        // Handle save
      })
      .on("CANCEL", () => {
        // Handle cancel
      });
  }
}
```

Create `packages/demo-app/webapp/view/App.view.xml`:

```xml
<mvc:View
	controllerName="demo.util.app.controller.App"
	xmlns:mvc="sap.ui.core.mvc"
	xmlns="sap.m">
	<App id="app">
		<Page id="page" title="ui5-lib-util Demo">
			<mvc:XMLView viewName="demo.util.app.view.Main" />
		</Page>
	</App>
</mvc:View>
```

Create `packages/demo-app/webapp/view/Main.view.xml`:

```xml
<mvc:View
	controllerName="demo.util.app.controller.Main"
	xmlns:mvc="sap.ui.core.mvc"
	xmlns="sap.m">
	<VBox class="sapUiSmallMargin">
		<Title text="Dialog Module Demo" level="H2" />
		<Button text="Open Sample Dialog" press=".onOpenDialog" type="Emphasized" />
	</VBox>
</mvc:View>
```

Create `packages/demo-app/webapp/view/dialogs/SampleDialog.fragment.xml`:

```xml
<core:FragmentDefinition
	xmlns="sap.m"
	xmlns:core="sap.ui.core">
	<Dialog id="sampleDialog" title="Sample Dialog">
		<content>
			<VBox class="sapUiSmallMargin">
				<Label text="This is a sample dialog loaded via DialogManager." />
				<Input id="sampleInput" placeholder="Enter something..." />
			</VBox>
		</content>
		<beginButton>
			<Button text="Save" type="Emphasized" press=".onSave" />
		</beginButton>
		<endButton>
			<Button text="Cancel" press=".onCancel" />
		</endButton>
	</Dialog>
</core:FragmentDefinition>
```

Create `packages/demo-app/webapp/controller/dialogs/SampleDialogController.ts`:

```typescript
import type Control from "sap/ui/core/Control";
import type Context from "sap/ui/model/Context";
import AbstractDialogController from "ui5/util/dialog/AbstractDialogController";

/**
 * @namespace demo.util.app.controller.dialogs
 */
export default class SampleDialogController extends AbstractDialogController {
  public onData(data: object | Context): void {
    // Receive data from the caller
  }

  public onSave(): void {
    this.fireSaveEvent(this.fragmentById<Control>("sampleDialog"), null, {});
  }

  public onCancel(): void {
    this.fireCancelEvent(this.fragmentById<Control>("sampleDialog"));
  }
}
```

Create `packages/demo-app/webapp/i18n/i18n.properties`:

```properties
appTitle=ui5-lib-util Demo
appDescription=Demo application for the ui5-lib-util library
```

- [ ] **Step 9: Install and verify typecheck**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
npm install
npx tsc --noEmit -p packages/demo-app/tsconfig.json
```

- [ ] **Step 10: Commit**

```bash
git add packages/demo-app/
git commit -m "feat: add demo app with dialog module consumption example"
```

---

## Task 10: Verify end-to-end

- [ ] **Step 1: Run full typecheck from root**

```bash
cd "C:/Users/m.beier/Documents/dev/ui5-lib-util"
npm run typecheck
```

Expected: all three tsconfig passes (lib, lib test, demo-app) succeed.

- [ ] **Step 2: Start demo app and verify it loads**

```bash
npm start
```

Expected: browser opens, shows the demo page with "Open Sample Dialog" button. Clicking it opens the sample dialog.

- [ ] **Step 3: Run library build**

```bash
npm run build
```

Expected: build completes without errors, `packages/lib/dist/` contains the library output.

- [ ] **Step 4: Commit any fixes needed**

If any fixes were needed during verification, commit them:

```bash
git add -A
git commit -m "fix: resolve integration issues from end-to-end verification"
```

---

## Subsequent Phases

Each phase follows the same pattern (types -> tests -> implementation -> integration):

| Phase   | Module                | Key files                                                                |
| ------- | --------------------- | ------------------------------------------------------------------------ |
| Phase 2 | `messaging`           | MessageHandler.ts, types.ts                                              |
| Phase 3 | `messageBoxSequencer` | MessageBoxSequencer.ts                                                   |
| Phase 4 | `websocket`           | WebSocketService.ts, WebSocketEventFacade.ts, RetryStrategy.ts, types.ts |
| Phase 5 | `odata`               | ODataV2ModelPromisifier.ts, types.ts                                     |
| Phase 6 | `focus`               | FocusHandler.ts                                                          |
| Phase 7 | Demo app expansion    | Wire all modules into demo-app Component + views                         |
| Phase 8 | Root README           | Full documentation with extraction guide, API compat table, cross-links  |

Each subsequent phase plan will be written when the previous phase is complete.
