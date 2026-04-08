# i18n Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the UI5 kiosk-keyboard's 462-line i18n enhancement-bundle system with a simple resolver callback, aligned with the web component variant's existing 97-line approach.

**Architecture:** Both libraries converge on a two-layer model: built-in ResourceBundle/JSON bundle (locale-aware, ships with the library) + optional synchronous resolver callback. The enhancement bundle system, generation counters, async coalescing, stale detection, and config API are removed entirely.

**Tech Stack:** TypeScript, UI5 ResourceBundle (base bundle only), QUnit (unit tests), WebdriverIO (e2e tests)

**Resolver signature (both libraries):**

```ts
type I18nResolver = (key: string, locale: string, resolvedText: string) => string | undefined;
```

---

## File Map

| Action  | File                                                                           | Responsibility                                                                                                  |
| ------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Rewrite | `packages/kiosk-keyboard/src/internal/i18n-registry.ts`                        | getText + resolver (from ~462 to ~70 lines)                                                                     |
| Modify  | `packages/kiosk-keyboard/src/types.ts`                                         | Remove KioskI18nConfig, KioskI18nEnhancement, KioskI18nOverrideContext, KioskI18nOverrideHook; add I18nResolver |
| Modify  | `packages/kiosk-keyboard/src/KioskKeyboard.ts`                                 | Remove 5 static methods, simplify init/exit/onLocalizationChanged                                               |
| Rewrite | `packages/kiosk-keyboard/test/qunit/i18n-registry.qunit.ts`                    | Resolver-based unit tests                                                                                       |
| Rewrite | `packages/kiosk-keyboard/test/qunit/KioskKeyboard-i18n.qunit.ts`               | Resolver-based integration tests                                                                                |
| Rewrite | `packages/kiosk-keyboard/test/e2e/i18n/init.js`                                | Resolver-based e2e demo page                                                                                    |
| Modify  | `packages/kiosk-keyboard/test/e2e/i18n.test.ts`                                | Resolver-based e2e assertions                                                                                   |
| Delete  | `packages/kiosk-keyboard/test/e2e/i18n/i18n/messagebundle.properties`          | No longer needed (resolver replaces bundles)                                                                    |
| Delete  | `packages/kiosk-keyboard/test/e2e/i18n/i18n-override/messagebundle.properties` | No longer needed                                                                                                |

---

### Task 1: Rewrite i18n-registry.ts

**Files:**

- Rewrite: `packages/kiosk-keyboard/src/internal/i18n-registry.ts`

- [ ] **Step 1: Replace the entire i18n-registry.ts with the simplified version**

```ts
import Lib from "sap/ui/core/Lib";
import Localization from "sap/base/i18n/Localization";
import Log from "sap/base/Log";
import type { I18nResolver } from "../types";

const LOG_COMPONENT = "ui5.kiosk.KioskKeyboard";

let resolver: I18nResolver | null = null;

function getCurrentLocale(): string {
  return Localization.getLanguageTag().toString();
}

/**
 * Resolve a single i18n key through the resolution chain:
 * base library bundle -> resolver callback.
 *
 * @param key       Resource bundle key (e.g. `"KIOSK_KEYBOARD_LABEL"`).
 * @param fallback  Hardcoded fallback returned when no bundle contains the key.
 * @returns The resolved text.
 */
export function getText(key: string, fallback: string): string {
  const bundle = Lib.getResourceBundleFor("ui5.kiosk");
  const baseText = bundle ? (bundle.getText(key, undefined, true) ?? fallback) : fallback;

  if (!resolver) {
    return baseText;
  }

  try {
    const override = resolver(key, getCurrentLocale(), baseText);
    if (typeof override === "string") {
      return override;
    }
  } catch (e) {
    Log.warning("i18n resolver threw", e instanceof Error ? e : String(e), LOG_COMPONENT);
  }

  return baseText;
}

/**
 * Set a custom i18n resolver callback for programmatic overrides.
 *
 * The resolver receives the i18n key, current locale, and the text resolved
 * from the base library bundle. Return a string to override, or `undefined`
 * to keep the base text.
 *
 * Only one resolver is active at a time. Calling again replaces the previous.
 * Pass `null` to clear the resolver.
 */
export function setI18nResolver(fn: I18nResolver | null): void {
  if (fn !== null && typeof fn !== "function") {
    Log.warning("setI18nResolver: argument must be a function or null.", undefined, LOG_COMPONENT);
    return;
  }
  resolver = fn;
}

/** Remove the active i18n resolver. @internal */
export function clearI18nResolver(): void {
  resolver = null;
}

/** Returns true when a resolver is currently set. @internal */
export function hasResolver(): boolean {
  return resolver !== null;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit -p packages/kiosk-keyboard/tsconfig.json 2>&1 | head -20`
Expected: Type errors in KioskKeyboard.ts and tests (they still import removed functions). That is expected at this step.

- [ ] **Step 3: Commit**

```
git add packages/kiosk-keyboard/src/internal/i18n-registry.ts
git commit -m "refactor(kiosk): rewrite i18n-registry to resolver-only model

Remove enhancement bundle system, generation counters, async coalescing,
stale detection, and config API. Replace with getText + resolver callback.
~462 lines -> ~70 lines."
```

---

### Task 2: Update types.ts

**Files:**

- Modify: `packages/kiosk-keyboard/src/types.ts`

- [ ] **Step 1: Remove i18n enhancement types, add I18nResolver**

Remove these types (lines 286-428):

- `KioskI18nEnhancement` (lines 298-332)
- `KioskI18nConfig` (lines 362-385)
- `KioskI18nOverrideContext` (lines 393-412)
- `KioskI18nOverrideHook` (lines 428)
- The section comment `// -- i18n extensibility types` (line 286)

Replace with:

````ts
// -- i18n resolver type --

/**
 * Resolver callback for programmatic i18n overrides.
 *
 * Called for every `getText()` resolution when a resolver is registered.
 * Receives the message key, current locale (BCP-47 tag), and the text
 * resolved from the base library bundle.
 *
 * Return a string to override the resolved text. Return `undefined` to
 * keep the base bundle text. The resolver must be synchronous.
 *
 * If the resolver throws, the error is logged and the base text is used.
 *
 * @example
 * ```ts
 * KioskKeyboard.setI18nResolver((key, locale, resolvedText) => {
 *   if (key === "KEY_SHIFT" && locale.startsWith("fr")) return "Maj";
 *   return undefined; // keep base bundle text
 * });
 * ```
 *
 * @public
 * @since 0.2.0
 */
export type I18nResolver = (key: string, locale: string, resolvedText: string) => string | undefined;
````

- [ ] **Step 2: Verify types.ts compiles in isolation**

Run: `npx tsc --noEmit -p packages/kiosk-keyboard/tsconfig.json 2>&1 | grep "types.ts" | head -5`
Expected: No errors from types.ts itself. Other files will still have errors.

- [ ] **Step 3: Commit**

```
git add packages/kiosk-keyboard/src/types.ts
git commit -m "refactor(kiosk): replace i18n enhancement types with I18nResolver"
```

---

### Task 3: Update KioskKeyboard.ts

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.ts`

- [ ] **Step 1: Update imports (lines 35-45)**

Replace the i18n-registry import block:

```ts
import {
  configureI18nWithStatus as registryConfigureI18nWithStatus,
  resetI18nConfiguration as registryResetI18n,
  setI18nOverrideHook as registrySetOverrideHook,
  clearI18nOverrideHook as registryClearOverrideHook,
  getI18nConfiguration as registryGetI18nConfiguration,
  hasConfiguredEnhancements as registryHasConfiguredEnhancements,
  reloadBundles as registryReloadBundles,
  reloadIfStale as registryReloadIfStale,
} from "./internal/i18n-registry";
import type { KioskI18nConfig, KioskI18nOverrideHook } from "./types";
```

With:

```ts
import {
  setI18nResolver as registrySetResolver,
  clearI18nResolver as registryClearResolver,
} from "./internal/i18n-registry";
import type { I18nResolver } from "./types";
```

- [ ] **Step 2: Remove `_lastReloadPromise` static field (line ~426)**

Delete:

```ts
  /** Tracks the current reload promise to avoid duplicate post-reload invalidation across N instances. */
  private static _lastReloadPromise: Promise<void> | null = null;
```

- [ ] **Step 3: Replace the i18n static methods section (lines 656-796)**

Remove the entire block from `// Static delegates - i18n registry` through `getI18nConfiguration()` and `_invalidateAllInstances()`. Replace with:

```ts
  // --
  // Static delegates - i18n (see internal/i18n-registry.ts)
  // --

  /**
   * Set a custom i18n resolver callback for programmatic overrides.
   *
   * The resolver runs after the base library bundle has been consulted.
   * Return a string to replace the resolved text, or `undefined` to keep it.
   *
   * Only one resolver is active at a time. Calling again replaces the
   * previous resolver. Pass `null` to clear the resolver.
   *
   * **Lifecycle note:** The resolver is stored in a module-level singleton.
   * If the resolver closes over Component, Controller, or View references,
   * those objects cannot be garbage-collected until the resolver is cleared.
   * The resolver is auto-cleared when the last KioskKeyboard instance is
   * destroyed.
   *
   * @param fn  The resolver function, or `null` to clear.
   * @public
   * @static
   * @since 0.2.0
   */
  static setI18nResolver(fn: I18nResolver | null): void {
    registrySetResolver(fn);
    KioskKeyboard._invalidateAllInstances();
  }

  /** Invalidate all living KioskKeyboard instances to pick up i18n changes. */
  private static _invalidateAllInstances(): void {
    for (const instance of KioskKeyboard._instances) {
      instance.invalidate();
    }
  }
```

- [ ] **Step 4: Simplify init() -- remove stale bundle reload (lines ~872-897)**

Remove the entire block:

```ts
    // If the locale changed while no instances existed,
    // onLocalizationChanged was never called. Reload stale bundles
    // ...
    if (registryHasConfiguredEnhancements()) {
      ...
    }
```

This block is no longer needed because there are no enhancement bundles to go stale.

- [ ] **Step 5: Simplify onLocalizationChanged() (lines ~903-928)**

Replace with:

```ts
  onLocalizationChanged(): void {
    this.invalidate();
  }
```

The base ResourceBundle handles locale switching natively. No async reload needed.

- [ ] **Step 6: Simplify exit() cleanup (lines ~1062-1065)**

Replace the i18n cleanup lines inside the `if (KioskKeyboard._instances.size === 0)` block:

```ts
registryResetI18n();
registryClearOverrideHook();
KioskKeyboard._lastReloadPromise = null;
```

With:

```ts
registryClearResolver();
```

- [ ] **Step 7: Verify the project typechecks**

Run: `npx tsc --noEmit -p packages/kiosk-keyboard/tsconfig.json 2>&1 | grep -v "test/" | head -20`
Expected: No errors in src/ files. Test files will still have errors (expected).

- [ ] **Step 8: Commit**

```
git add packages/kiosk-keyboard/src/KioskKeyboard.ts
git commit -m "refactor(kiosk): simplify KioskKeyboard i18n to resolver-only

Remove configureI18n, resetI18nConfiguration, getI18nConfiguration,
setI18nOverrideHook, clearI18nOverrideHook static methods.
Add setI18nResolver(fn | null).
Simplify onLocalizationChanged to just invalidate (no async reload).
Simplify exit() cleanup (no enhancement state to clear)."
```

---

### Task 4: Rewrite i18n-registry.qunit.ts

**Files:**

- Rewrite: `packages/kiosk-keyboard/test/qunit/i18n-registry.qunit.ts`

- [ ] **Step 1: Replace the entire file with resolver-focused tests**

```ts
import { getText, setI18nResolver, clearI18nResolver, hasResolver } from "ui5/kiosk/internal/i18n-registry";
import Lib from "sap/ui/core/Lib";
import Localization from "sap/base/i18n/Localization";
import Log from "sap/base/Log";
import type ResourceBundle from "sap/base/i18n/ResourceBundle";

const sandbox = sinon.createSandbox();

function stubBaseBundle(texts: Record<string, string>): void {
  sandbox.stub(Lib, "getResourceBundleFor").returns({
    getText(key: string) {
      return texts[key] ?? null;
    },
  } as unknown as ResourceBundle);
}

QUnit.module("i18n-registry", {
  afterEach() {
    sandbox.restore();
    clearI18nResolver();
  },
});

// -- getText --

QUnit.test("getText returns base bundle text for known key", (assert) => {
  stubBaseBundle({ KIOSK_KEYBOARD_LABEL: "Virtuelle Tastatur" });
  assert.strictEqual(getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"), "Virtuelle Tastatur");
});

QUnit.test("getText returns fallback when bundle has no key", (assert) => {
  stubBaseBundle({});
  assert.strictEqual(getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"), "Virtual Keyboard");
});

QUnit.test("getText returns fallback when no bundle available", (assert) => {
  sandbox.stub(Lib, "getResourceBundleFor").returns(null as never);
  assert.strictEqual(getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"), "Virtual Keyboard");
});

// -- resolver --

QUnit.test("resolver overrides base bundle text", (assert) => {
  stubBaseBundle({ KIOSK_KEYBOARD_LABEL: "Virtual Keyboard" });
  setI18nResolver(() => "Custom Label");
  assert.strictEqual(getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"), "Custom Label");
});

QUnit.test("resolver receives key, locale, and resolved base text", (assert) => {
  stubBaseBundle({ KIOSK_KEYBOARD_LABEL: "Virtuelle Tastatur" });
  sandbox.stub(Localization, "getLanguageTag").returns({ toString: () => "de" } as never);

  let receivedArgs: [string, string, string] | null = null;
  setI18nResolver((key, locale, resolvedText) => {
    receivedArgs = [key, locale, resolvedText];
    return undefined;
  });

  getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard");

  assert.deepEqual(receivedArgs, ["KIOSK_KEYBOARD_LABEL", "de", "Virtuelle Tastatur"]);
});

QUnit.test("resolver returning undefined keeps base text", (assert) => {
  stubBaseBundle({ KEY_SHIFT: "Umschalt" });
  setI18nResolver(() => undefined);
  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "Umschalt");
});

QUnit.test("resolver error is logged and base text returned", (assert) => {
  stubBaseBundle({ KEY_SHIFT: "Umschalt" });
  const warnSpy = sandbox.spy(Log, "warning");

  setI18nResolver(() => {
    throw new Error("resolver broke");
  });

  const result = getText("KEY_SHIFT", "Shift");
  assert.strictEqual(result, "Umschalt", "Base text used after error");
  assert.ok(warnSpy.calledOnce, "Warning logged");
});

QUnit.test("setting resolver to null clears it", (assert) => {
  setI18nResolver(() => "override");
  assert.ok(hasResolver(), "resolver is set");

  setI18nResolver(null);
  assert.notOk(hasResolver(), "resolver is cleared");

  stubBaseBundle({ KEY_SHIFT: "Shift" });
  assert.strictEqual(getText("KEY_SHIFT", "Shift"), "Shift", "Base text used after clear");
});

QUnit.test("clearI18nResolver removes active resolver", (assert) => {
  setI18nResolver(() => "override");
  assert.ok(hasResolver());

  clearI18nResolver();
  assert.notOk(hasResolver());
});

QUnit.test("non-function argument to setI18nResolver is rejected", (assert) => {
  const warnSpy = sandbox.spy(Log, "warning");
  setI18nResolver("not a function" as never);
  assert.notOk(hasResolver(), "Resolver not set");
  assert.ok(warnSpy.calledOnce, "Warning logged");
});

QUnit.test("resolver works with fallback when bundle returns null for key", (assert) => {
  stubBaseBundle({});
  setI18nResolver((_key, _locale, resolvedText) => resolvedText + " (custom)");
  assert.strictEqual(
    getText("KIOSK_KEYBOARD_LABEL", "Virtual Keyboard"),
    "Virtual Keyboard (custom)",
    "Resolver receives fallback as resolvedText when bundle has no key",
  );
});
```

- [ ] **Step 2: Verify the test file typechecks**

Run: `npx tsc --noEmit -p packages/kiosk-keyboard/tsconfig.json 2>&1 | grep "i18n-registry.qunit" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add packages/kiosk-keyboard/test/qunit/i18n-registry.qunit.ts
git commit -m "test(kiosk): rewrite i18n-registry tests for resolver-only model"
```

---

### Task 5: Rewrite KioskKeyboard-i18n.qunit.ts

**Files:**

- Rewrite: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-i18n.qunit.ts`

- [ ] **Step 1: Replace the entire file with resolver-focused integration tests**

```ts
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import Input from "sap/m/Input";
import { hasResolver } from "ui5/kiosk/internal/i18n-registry";
import { getKeyElement, placeAndWait, waitForRender } from "./test-helpers";

const DOM = KioskKeyboard.DOM;

QUnit.module("KioskKeyboard - i18n integration", {
  afterEach() {
    KioskKeyboard.setI18nResolver(null);
    KioskKeyboard.resetCustomLayouts();
    KioskKeyboard.resetLocaleLayouts();
    const fixture = document.getElementById("qunit-fixture");
    if (fixture) fixture.innerHTML = "";
  },
});

QUnit.test("Resolver can change KIOSK_KEYBOARD_LABEL on rendered control", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  KioskKeyboard.setI18nResolver((key) => {
    if (key === "KIOSK_KEYBOARD_LABEL") return "Custom Keyboard Label";
    return undefined;
  });
  await waitForRender();

  const dom = kb.getDomRef();
  assert.ok(dom, "Keyboard is rendered");
  assert.strictEqual(dom?.getAttribute("aria-label"), "Custom Keyboard Label", "aria-label reflects resolver");

  input.destroy();
  kb.destroy();
});

QUnit.test("Setting resolver to null restores base labels", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const originalLabel = kb.getDomRef()?.getAttribute("aria-label");

  KioskKeyboard.setI18nResolver((key) => {
    if (key === "KIOSK_KEYBOARD_LABEL") return "Overridden";
    return undefined;
  });
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), "Overridden", "Resolver applied");

  KioskKeyboard.setI18nResolver(null);
  await waitForRender();

  assert.strictEqual(kb.getDomRef()?.getAttribute("aria-label"), originalLabel, "Original label restored");

  input.destroy();
  kb.destroy();
});

QUnit.test("Resolver can override special key labels", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  KioskKeyboard.setI18nResolver((key) => {
    const map: Record<string, string> = {
      KEY_SHIFT: "Umschalt",
      KEY_ENTER: "Eingabe",
      KEY_BACKSPACE: "L\u00F6schen",
    };
    return map[key];
  });
  await waitForRender();

  const shiftKey = getKeyElement(kb, "{shift}");
  const enterKey = getKeyElement(kb, "{enter}");
  const backspaceKey = getKeyElement(kb, "{backspace}");

  assert.strictEqual(
    shiftKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Umschalt",
    "Shift key label overridden",
  );
  assert.strictEqual(
    enterKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Eingabe",
    "Enter key label overridden",
  );
  assert.strictEqual(
    backspaceKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "L\u00F6schen",
    "Backspace key label overridden",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("Resolver receives base-bundle resolved text", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  KioskKeyboard.setI18nResolver((key, _locale, resolvedText) => {
    if (key === "KIOSK_KEYBOARD_LABEL") return resolvedText + " (custom)";
    if (key === "KEY_SHIFT") return resolvedText.toUpperCase();
    return undefined;
  });
  await waitForRender();

  const dom = kb.getDomRef();
  // Base bundle for English returns "Virtual Keyboard"
  assert.ok(dom?.getAttribute("aria-label")?.endsWith("(custom)"), "Resolver receives and transforms base text");

  const shiftKey = getKeyElement(kb, "{shift}");
  assert.strictEqual(
    shiftKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "SHIFT",
    "Resolver uppercases base-bundle shift label",
  );

  input.destroy();
  kb.destroy();
});

QUnit.test("Destroying last instance auto-clears resolver", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  KioskKeyboard.setI18nResolver(() => "Hooked");
  assert.ok(hasResolver(), "Resolver active before destroy");

  input.destroy();
  kb.destroy();

  assert.notOk(hasResolver(), "Resolver auto-cleared after last instance destroyed");

  // Verify cleared by rendering a fresh keyboard
  const input2 = new Input({ value: "" });
  input2.placeAt("qunit-fixture");
  const kb2 = new KioskKeyboard({ targetInput: input2 });
  await placeAndWait(kb2);

  const shiftKey = getKeyElement(kb2, "{shift}");
  assert.strictEqual(
    shiftKey?.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "Shift",
    "Fresh keyboard uses default labels",
  );

  input2.destroy();
  kb2.destroy();
});

QUnit.test("Destroying one of two instances does NOT clear resolver", async (assert) => {
  const input1 = new Input({ value: "" });
  const input2 = new Input({ value: "" });
  input1.placeAt("qunit-fixture");
  input2.placeAt("qunit-fixture");
  const kb1 = new KioskKeyboard({ targetInput: input1 });
  const kb2 = new KioskKeyboard({ targetInput: input2 });
  await placeAndWait(kb1);
  await placeAndWait(kb2);

  KioskKeyboard.setI18nResolver(() => "Hooked");

  input1.destroy();
  kb1.destroy();

  assert.ok(hasResolver(), "Resolver still active after destroying one of two instances");

  input2.destroy();
  kb2.destroy();

  assert.notOk(hasResolver(), "Resolver cleared after last instance destroyed");
});

QUnit.test("Destroying last instance clears global target resolver", async (assert) => {
  const input = new Input({ value: "" });
  input.placeAt("qunit-fixture");
  const kb = new KioskKeyboard({ targetInput: input });
  await placeAndWait(kb);

  const fakeResolver = (el: HTMLElement) => el.querySelector<HTMLInputElement>("input");
  KioskKeyboard.setGlobalTargetResolver(fakeResolver);

  assert.strictEqual(KioskKeyboard.getGlobalTargetResolver(), fakeResolver, "Resolver set before destroy");

  input.destroy();
  kb.destroy();

  assert.strictEqual(
    KioskKeyboard.getGlobalTargetResolver(),
    null,
    "Resolver auto-cleared after last instance destroyed",
  );
});
```

- [ ] **Step 2: Verify the test file typechecks**

Run: `npx tsc --noEmit -p packages/kiosk-keyboard/tsconfig.json 2>&1 | grep "KioskKeyboard-i18n" | head -5`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add packages/kiosk-keyboard/test/qunit/KioskKeyboard-i18n.qunit.ts
git commit -m "test(kiosk): rewrite KioskKeyboard i18n integration tests for resolver model"
```

---

### Task 6: Update e2e test page and e2e tests

**Files:**

- Rewrite: `packages/kiosk-keyboard/test/e2e/i18n/init.js`
- Modify: `packages/kiosk-keyboard/test/e2e/i18n.test.ts`
- Delete: `packages/kiosk-keyboard/test/e2e/i18n/i18n/messagebundle.properties`
- Delete: `packages/kiosk-keyboard/test/e2e/i18n/i18n-override/messagebundle.properties`

- [ ] **Step 1: Delete the .properties files**

```bash
rm packages/kiosk-keyboard/test/e2e/i18n/i18n/messagebundle.properties
rm packages/kiosk-keyboard/test/e2e/i18n/i18n-override/messagebundle.properties
rmdir packages/kiosk-keyboard/test/e2e/i18n/i18n 2>/dev/null || true
rmdir packages/kiosk-keyboard/test/e2e/i18n/i18n-override 2>/dev/null || true
```

- [ ] **Step 2: Rewrite init.js to use resolver instead of configureI18n**

```js
sap.ui.define(["ui5/kiosk/KioskKeyboard", "sap/m/Input", "sap/m/Button"], (KioskKeyboard, Input, Button) => {
  "use strict";

  /** Reset resolver to library defaults. */
  const resetI18n = () => {
    KioskKeyboard.setI18nResolver(null);
  };

  // -- 1. Baseline --

  const inputBaseline = new Input({ value: "Hello World", width: "300px" });
  inputBaseline.placeAt("input-baseline");
  new KioskKeyboard({ targetInput: inputBaseline }).placeAt("kb-baseline");

  // -- 2. French resolver --

  const frenchTexts = {
    KIOSK_KEYBOARD_LABEL: "Clavier virtuel",
    KIOSK_KEYBOARD_ROLEDESCRIPTION: "clavier",
    KEY_SHIFT: "Maj",
    KEY_ENTER: "Entr\u00e9e",
    KEY_BACKSPACE: "Retour",
    KEY_SPACE: "Espace",
    ARIA_CAPS_LOCK: "Verrouillage majuscule",
    ARIA_CAPS_LOCK_ON: "Verrouillage majuscule activ\u00e9",
    ARIA_SHIFT_ON: "Majuscule activ\u00e9e",
    ARIA_KEYBOARD_OPENED: "Clavier virtuel ouvert",
    ARIA_KEYBOARD_CLOSED: "Clavier virtuel ferm\u00e9",
  };

  const inputFrench = new Input({ value: "Bonjour", width: "300px" });
  inputFrench.placeAt("input-french");
  const kbFrench = new KioskKeyboard({ targetInput: inputFrench });
  kbFrench.placeAt("kb-french");

  new Button({
    text: "Apply French bundle",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.setI18nResolver((key) => frenchTexts[key]);
    },
  }).placeAt("controls-french");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-french");

  // -- 3. Override existing English labels --

  const overrideTexts = {
    KIOSK_KEYBOARD_LABEL: "Touch Keyboard",
    KEY_ENTER: "Go",
    KEY_BACKSPACE: "Delete",
  };

  const inputOverride = new Input({ value: "Custom labels", width: "300px" });
  inputOverride.placeAt("input-override");
  const kbOverride = new KioskKeyboard({ targetInput: inputOverride });
  kbOverride.placeAt("kb-override");

  new Button({
    text: "Apply overrides",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.setI18nResolver((key) => overrideTexts[key]);
    },
  }).placeAt("controls-override");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-override");

  // -- 4. Programmatic resolver --

  const inputHook = new Input({ value: "Hook demo", width: "300px" });
  inputHook.placeAt("input-hook");
  const kbHook = new KioskKeyboard({ targetInput: inputHook });
  kbHook.placeAt("kb-hook");

  new Button({
    text: "Set override hook",
    type: "Emphasized",
    press: () => {
      resetI18n();
      KioskKeyboard.setI18nResolver((key, _locale, resolvedText) => {
        if (key === "KIOSK_KEYBOARD_LABEL") {
          return "\u2328\uFE0F " + resolvedText;
        }
        if (key.startsWith("KEY_")) {
          return resolvedText.toUpperCase();
        }
      });
    },
  }).placeAt("controls-hook");

  new Button({
    text: "Reset to defaults",
    press: () => resetI18n(),
  }).placeAt("controls-hook");
});
```

- [ ] **Step 3: Update e2e test assertions for resolver API**

In `packages/kiosk-keyboard/test/e2e/i18n.test.ts`, update the `afterEach` block (lines 48-60):

Replace:

```ts
afterEach(async () => {
  await browser.executeAsync((done: () => void) => {
    sap.ui.require(
      ["ui5/kiosk/KioskKeyboard"],
      (KioskKeyboard: { resetI18nConfiguration: () => void; clearI18nOverrideHook: () => void }) => {
        KioskKeyboard.resetI18nConfiguration();
        KioskKeyboard.clearI18nOverrideHook();
        done();
      },
    );
  });
});
```

With:

```ts
afterEach(async () => {
  await browser.executeAsync((done: () => void) => {
    sap.ui.require(["ui5/kiosk/KioskKeyboard"], (KioskKeyboard: { setI18nResolver: (fn: null) => void }) => {
      KioskKeyboard.setI18nResolver(null);
      done();
    });
  });
});
```

Rename the describe block "2. French enhancement bundle" to "2. French resolver". The test assertions themselves (aria-label values, key labels) remain identical since the init.js produces the same visible output.

- [ ] **Step 4: Commit**

```
git add -A packages/kiosk-keyboard/test/e2e/i18n/
git add packages/kiosk-keyboard/test/e2e/i18n.test.ts
git commit -m "test(kiosk): update e2e i18n tests for resolver-only model

Replace configureI18n + .properties files with setI18nResolver callbacks.
Delete test .properties bundle files (no longer needed).
Test assertions unchanged - same visible behavior."
```

---

### Task 7: Delete generated spec files and run full typecheck

**Files:**

- Delete: `packages/kiosk-keyboard/test/qunit/.generated-specs/i18n-registry.spec.js`
- Delete: `packages/kiosk-keyboard/test/qunit/.generated-specs/KioskKeyboard-i18n.spec.js`

- [ ] **Step 1: Delete stale generated spec files**

```bash
rm -f packages/kiosk-keyboard/test/qunit/.generated-specs/i18n-registry.spec.js
rm -f packages/kiosk-keyboard/test/qunit/.generated-specs/KioskKeyboard-i18n.spec.js
```

These are auto-generated from the `.qunit.ts` source files. Deleting them forces regeneration during the next build/test run with the updated test content.

- [ ] **Step 2: Run full typecheck across the monorepo**

Run: `npm run typecheck`
Expected: All packages pass. Zero errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 4: Commit**

```
git add -A
git commit -m "chore(kiosk): delete stale generated spec files for i18n tests"
```

---

### Task 8: Run unit tests and fix any failures

- [ ] **Step 1: Run the kiosk-keyboard QUnit tests**

Run: `npm run test:unit -w ui5-lib-kiosk-keyboard`
Expected: All tests pass. If any test outside the i18n files imports removed functions (e.g., `resetI18nConfiguration`, `clearI18nOverrideHook`), update those imports.

Common places that might reference the old API:

- Other `.qunit.ts` files that call `KioskKeyboard.resetI18nConfiguration()` or `clearI18nOverrideHook()` in `afterEach` blocks
- Any test that imports from `i18n-registry` directly

Search for remaining references:

```bash
grep -r "resetI18nConfiguration\|clearI18nOverrideHook\|configureI18n\|setI18nOverrideHook\|getI18nConfiguration\|hasConfiguredEnhancements\|reloadBundles\|reloadIfStale" packages/kiosk-keyboard/test/ --include="*.ts" -l
```

For each file found: replace `resetI18nConfiguration()` + `clearI18nOverrideHook()` with `setI18nResolver(null)`, and update imports accordingly.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: All unit, component, and e2e tests pass across all packages.

- [ ] **Step 3: Commit any remaining fixes**

```
git add -A
git commit -m "fix(kiosk): update remaining test references to old i18n API"
```

---

### Task 9: Verify web component alignment

**Files:**

- Review: `packages/kiosk-keyboard-webc/src/core/i18n.ts`
- Review: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts` (setI18nResolver method)

- [ ] **Step 1: Verify the web component resolver signature matches**

The web component already has:

```ts
static setI18nResolver(fn: ((key: string, locale: string, defaultText: string) => string | undefined) | null): void
```

The UI5 control now has:

```ts
static setI18nResolver(fn: I18nResolver | null): void
// where I18nResolver = (key: string, locale: string, resolvedText: string) => string | undefined
```

The signatures are functionally identical (positional args, same types). The third parameter is named `defaultText` in webc and `resolvedText` in UI5 -- both pass the best available text from the base bundle. This naming difference is acceptable since parameter names are not part of the public API contract.

No code changes needed for the web component.

- [ ] **Step 2: Run web component tests to verify no regressions**

Run: `npm run test:unit -w kiosk-keyboard-webc`
Expected: All tests pass unchanged.

- [ ] **Step 3: Final full-suite verification**

Run: `npm test`
Expected: All tests pass across all packages.
