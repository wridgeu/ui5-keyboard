# Icon + Text Keys Review Fixes -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 issues found during end-to-end review of PR #38 (icon+text keys feature) on the `feature/icon-text-keys` branch.

**Architecture:** All changes are on the existing `feature/icon-text-keys` branch as follow-up commits. Fixes span both packages (`kiosk-keyboard` and `kiosk-keyboard-webc`), their test suites, and the demo app. One commit per fix.

**Tech Stack:** TypeScript, LESS (UI5), CSS (WebC), QUnit + WDIO (UI5 tests), @open-wc/testing (WebC component tests), UI5 RenderManager, Lit/JSX (WebC)

**Spec:** `docs/proposals/ICON-TEXT-KEYS-FIXES.md`

---

## Prerequisites

Before starting, switch to the feature branch:

```bash
git checkout feature/icon-text-keys
git pull origin feature/icon-text-keys
```

---

## Task 1: UI5 sr-only pattern for responsive dual label hiding

**Files:**

- Modify: `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less:345-349`

- [ ] **Step 1: Replace `display: none` with sr-only clip pattern**

In `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less`, replace the container query block at lines 345-349:

```less
/* At narrow key widths, hide the dual label and show icon-only */
@container (max-inline-size: 5rem) {
  &--dual &__label {
    display: none;
  }
}
```

With the sr-only clip pattern (matching WebC's `KioskKeyboard.css`):

```less
/* At narrow key widths, visually hide the dual label and show icon-only.
       Uses the sr-only pattern (not display: none) so the label text stays
       in the accessibility tree as the key's accessible name. */
@container (max-inline-size: 5rem) {
  &--dual &__label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run:

```bash
cd packages/kiosk-keyboard && npm run build
```

Expected: Clean build (LESS compiles without errors).

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less
git commit -m "fix(a11y): use sr-only pattern for dual label responsive hiding in UI5

The previous display:none removed the label from the accessibility tree.
When the renderer omits aria-label for WCAG 2.5.3 compliance, this left
dual keys with no accessible name at narrow widths. The sr-only clip
pattern keeps the label in the a11y tree while hiding it visually,
matching the WebC package's approach."
```

---

## Task 2: CapsLock state evaluated before `icon: ""` suppression

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboardRenderer.ts:263-278`
- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts:984-1016`

- [ ] **Step 1: Reorder UI5 `resolveKeyIcon`**

In `packages/kiosk-keyboard/src/KioskKeyboardRenderer.ts`, replace the `resolveKeyIcon` method (lines 263-278):

```typescript
  /** Resolve the effective icon for a key. Returns the icon string or empty string if none. */
  resolveKeyIcon(oControl: KioskKeyboard, key: KeyDefinition): string {
    if (key.icon === "") return "";
    const { _isCapsLock } = oControl._getRendererApi();
    if (key.value === "{shift}" && _isCapsLock()) {
      const Ctor = oControl.constructor as typeof KioskKeyboard;
      return key.capsLockIcon ?? Ctor.SPECIAL_KEY_ICONS["{shift:capsLock}"] ?? "";
    }
    const Ctor = oControl.constructor as typeof KioskKeyboard;
    const icon = key.icon || Ctor.getKeyIcon(key.value) || "";
    // Validate SAP icon URIs exist in the registry; skip invalid ones
    if (icon && IconPool.isIconURI(icon) && !IconPool.getIconInfo(icon)) {
      Log.warning(`KioskKeyboard: icon "${icon}" not found, skipping`, undefined, "KioskKeyboard");
      return "";
    }
    return icon;
  },
```

With (CapsLock first, then `icon: ""`):

```typescript
  /** Resolve the effective icon for a key. Returns the icon string or empty string if none. */
  resolveKeyIcon(oControl: KioskKeyboard, key: KeyDefinition): string {
    const { _isCapsLock } = oControl._getRendererApi();

    // CapsLock state is evaluated first -- capsLockIcon is independent of icon: ""
    if (key.value === "{shift}" && _isCapsLock()) {
      const Ctor = oControl.constructor as typeof KioskKeyboard;
      const clIcon = key.capsLockIcon;
      if (clIcon !== undefined) {
        if (!clIcon) return ""; // capsLockIcon: "" suppresses icon
        // Validate SAP icon URIs
        if (IconPool.isIconURI(clIcon) && !IconPool.getIconInfo(clIcon)) {
          Log.warning(`KioskKeyboard: capsLockIcon "${clIcon}" not found, skipping`, undefined, "KioskKeyboard");
          return "";
        }
        return clIcon;
      }
      return Ctor.SPECIAL_KEY_ICONS["{shift:capsLock}"] ?? "";
    }

    if (key.icon === "") return ""; // suppress default-state icon

    const Ctor = oControl.constructor as typeof KioskKeyboard;
    const icon = key.icon || Ctor.getKeyIcon(key.value) || "";
    // Validate SAP icon URIs exist in the registry; skip invalid ones
    if (icon && IconPool.isIconURI(icon) && !IconPool.getIconInfo(icon)) {
      Log.warning(`KioskKeyboard: icon "${icon}" not found, skipping`, undefined, "KioskKeyboard");
      return "";
    }
    return icon;
  },
```

- [ ] **Step 2: Reorder WebC `_resolveKeyIcon`**

In `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`, replace the `_resolveKeyIcon` method (lines 980-1016):

```typescript
  /**
   * Resolve the icon for a key, categorized by type.
   * Returns null if no icon should render.
   */
  _resolveKeyIcon(key: KeyDefinition): { value: string; sap: boolean } | null {
    if (key.icon === "") return null; // explicit suppression

    // CapsLock always overrides the shift icon (matches UI5 renderer priority).
    // Must be checked before key.icon so capsLockIcon is not dead code.
    if (key.value === "{shift}" && this._capsLock) {
      const clIcon = key.capsLockIcon;
      if (clIcon !== undefined) {
        if (!clIcon) return null; // capsLockIcon: "" suppresses icon
        return clIcon.startsWith(SAP_ICON_PREFIX)
          ? { value: clIcon.slice(SAP_ICON_PREFIX.length), sap: true }
          : { value: clIcon, sap: false };
      }
      const builtIn = ICON_MAP["{shift:capsLock}"];
      return builtIn ? { value: builtIn, sap: true } : null;
    }

    const customIcon = key.icon;
    if (customIcon) {
      if (customIcon.startsWith(SAP_ICON_PREFIX)) {
        const name = customIcon.slice(SAP_ICON_PREFIX.length);
        if (!name) {
          console.warn(`KioskKeyboard: empty SAP icon URI for key "${key.value}", skipping icon`);
          return null;
        }
        return { value: name, sap: true };
      }
      // Unicode / emoji
      return { value: customIcon, sap: false };
    }

    const builtIn = ICON_MAP[key.value];
    return builtIn ? { value: builtIn, sap: true } : null;
  }
```

With (CapsLock first, then `icon: ""`, plus capsLockIcon validation):

```typescript
  /**
   * Resolve the icon for a key, categorized by type.
   * Returns null if no icon should render.
   */
  _resolveKeyIcon(key: KeyDefinition): { value: string; sap: boolean } | null {
    // CapsLock state is evaluated first -- capsLockIcon is independent of icon: ""
    if (key.value === "{shift}" && this._capsLock) {
      const clIcon = key.capsLockIcon;
      if (clIcon !== undefined) {
        if (!clIcon) return null; // capsLockIcon: "" suppresses icon
        if (clIcon.startsWith(SAP_ICON_PREFIX)) {
          const name = clIcon.slice(SAP_ICON_PREFIX.length);
          if (!name) {
            console.warn(`KioskKeyboard: empty SAP icon URI for capsLockIcon on key "${key.value}", skipping icon`);
            return null;
          }
          return { value: name, sap: true };
        }
        return { value: clIcon, sap: false };
      }
      const builtIn = ICON_MAP["{shift:capsLock}"];
      return builtIn ? { value: builtIn, sap: true } : null;
    }

    if (key.icon === "") return null; // suppress default-state icon

    const customIcon = key.icon;
    if (customIcon) {
      if (customIcon.startsWith(SAP_ICON_PREFIX)) {
        const name = customIcon.slice(SAP_ICON_PREFIX.length);
        if (!name) {
          console.warn(`KioskKeyboard: empty SAP icon URI for key "${key.value}", skipping icon`);
          return null;
        }
        return { value: name, sap: true };
      }
      // Unicode / emoji
      return { value: customIcon, sap: false };
    }

    const builtIn = ICON_MAP[key.value];
    return builtIn ? { value: builtIn, sap: true } : null;
  }
```

Note: This step also includes Fix 3 (capsLockIcon validation) inline in both methods.

- [ ] **Step 3: Run WebC component tests**

```bash
cd packages/kiosk-keyboard-webc && npm run test:component
```

Expected: All 131 existing tests pass (no regressions from reorder).

- [ ] **Step 4: Verify UI5 TypeScript compilation**

```bash
cd packages/kiosk-keyboard && npx tsc --noEmit
```

Expected: Clean compilation.

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard/src/KioskKeyboardRenderer.ts packages/kiosk-keyboard-webc/src/KioskKeyboard.ts
git commit -m "fix: evaluate capsLock state before icon suppression, validate capsLockIcon

Reorder resolveKeyIcon in both packages so the CapsLock branch runs
before the icon: \"\" early exit. This makes capsLockIcon independent
of icon: \"\", matching how capsLockLabel already works relative to
label: \"\".

Also adds SAP icon URI validation to the capsLockIcon code path in
both packages, consistent with the existing key.icon validation."
```

---

## Task 3: Test coverage for `capsLockLabel` and `capsLockIcon`

**Files:**

- Modify: `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard-icon-label.test.ts`
- Modify: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-renderer-blackbox.qunit.ts`

- [ ] **Step 1: Add WebC capsLock tests**

In `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard-icon-label.test.ts`, add the following tests before the closing `});` of the `describe` block:

```typescript
// ── CapsLock property overrides ──

it("capsLockLabel overrides visible label during caps lock", async () => {
  const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", capsLockLabel: "CL" }]]);
  const keyEl = queryKey(el, "{shift}");
  // Activate caps lock (double-tap)
  keyEl.click();
  await nextRender();
  keyEl.click();
  await nextRender();
  expect(queryKeyLabel(keyEl)!.textContent).to.equal("CL");
});

it("capsLockIcon overrides icon during caps lock", async () => {
  const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", capsLockIcon: "\u{1F512}" }]]);
  const keyEl = queryKey(el, "{shift}");
  // Activate caps lock
  keyEl.click();
  await nextRender();
  keyEl.click();
  await nextRender();
  const iconEl = queryKeyIcon(keyEl);
  expect(iconEl).to.exist;
  expect(iconEl!.textContent).to.equal("\u{1F512}");
});

it("capsLockIcon: '' suppresses icon during caps lock", async () => {
  const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", capsLockIcon: "" }]]);
  const keyEl = queryKey(el, "{shift}");
  // Activate caps lock
  keyEl.click();
  await nextRender();
  keyEl.click();
  await nextRender();
  expect(queryKeyIcon(keyEl)).to.be.null;
});

it("capsLockLabel: '' suppresses label, aria-label says Caps Lock", async () => {
  const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", capsLockLabel: "" }]]);
  const keyEl = queryKey(el, "{shift}");
  // Activate caps lock
  keyEl.click();
  await nextRender();
  keyEl.click();
  await nextRender();
  expect(queryKeyLabel(keyEl)).to.be.null;
  expect(keyEl.getAttribute("aria-label")).to.match(/caps lock/i);
});

it("icon: '' + capsLockIcon shows icon only during caps lock", async () => {
  const el = await createKeyboard([
    [{ value: "{shift}", type: "modifier", width: "2.25", icon: "", capsLockIcon: "\u{1F512}" }],
  ]);
  const keyEl = queryKey(el, "{shift}");
  // Normal state: no icon (icon: "" suppresses)
  expect(queryKeyIcon(keyEl)).to.be.null;
  // Activate caps lock
  keyEl.click();
  await nextRender();
  keyEl.click();
  await nextRender();
  // CapsLock state: capsLockIcon renders independently
  const iconEl = queryKeyIcon(keyEl);
  expect(iconEl).to.exist;
  expect(iconEl!.textContent).to.equal("\u{1F512}");
});
```

- [ ] **Step 2: Run WebC component tests**

```bash
cd packages/kiosk-keyboard-webc && npm run test:component
```

Expected: All tests pass including the 5 new ones. If any fail, the fixes from Task 2 need adjustment.

- [ ] **Step 3: Add UI5 capsLock tests**

In `packages/kiosk-keyboard/test/qunit/KioskKeyboard-renderer-blackbox.qunit.ts`, add the following tests at the end of the file (before any final closing brace):

```typescript
// ──────────────────────────────────────────────
// CapsLock property overrides
// ──────────────────────────────────────────────

QUnit.test("capsLockLabel overrides visible label during caps lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", capsLockLabel: "CL" }],
  ];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-capslock", layout);
  kb.setLayout("test-capslock");
  await placeAndWait(kb);

  // Activate caps lock (double-tap shift)
  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.strictEqual(
    keyEl.querySelector(`.${DOM.classes.keyLabel}`)?.textContent,
    "CL",
    "CapsLock label shows custom value",
  );

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-capslock");
});

QUnit.test("capsLockIcon overrides icon during caps lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", capsLockIcon: "\u21E7" }],
  ];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-capslock", layout);
  kb.setLayout("test-capslock");
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
  assert.ok(iconEl, "Icon element present");
  assert.strictEqual(iconEl!.textContent, "\u21E7", "CapsLock icon shows custom Unicode value");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-capslock");
});

QUnit.test("capsLockIcon: '' suppresses icon during caps lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", capsLockIcon: "" }],
  ];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-capslock", layout);
  kb.setLayout("test-capslock");
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon during caps lock");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-capslock");
});

QUnit.test("capsLockLabel: '' suppresses label, aria-label says Caps Lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", capsLockLabel: "" }],
  ];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-capslock", layout);
  kb.setLayout("test-capslock");
  await placeAndWait(kb);

  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No visible label during caps lock");
  assert.ok(/caps lock/i.test(keyEl.getAttribute("aria-label") ?? ""), "aria-label contains 'Caps Lock'");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-capslock");
});

QUnit.test("icon: '' + capsLockIcon shows icon only during caps lock", async (assert) => {
  const layout: LayoutDefinition = [
    [{ value: "a" }, { value: "{shift}", type: "modifier", width: "2.25", icon: "", capsLockIcon: "\u{1F512}" }],
  ];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-capslock", layout);
  kb.setLayout("test-capslock");
  await placeAndWait(kb);

  // Normal state: no icon (icon: "" suppresses)
  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon in normal state");

  // Activate caps lock
  tapKey(kb, "{shift}");
  await waitForRender();
  tapKey(kb, "{shift}");
  await waitForRender();

  // CapsLock state: capsLockIcon renders independently
  assert.ok(
    getRequiredKeyElement(kb, "{shift}").querySelector(`.${DOM.classes.keyIcon}`),
    "Icon present during caps lock",
  );

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-capslock");
});
```

- [ ] **Step 4: Verify UI5 TypeScript compilation**

```bash
cd packages/kiosk-keyboard && npx tsc --noEmit
```

Expected: Clean compilation.

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/component/kiosk-keyboard-icon-label.test.ts packages/kiosk-keyboard/test/qunit/KioskKeyboard-renderer-blackbox.qunit.ts
git commit -m "test: add capsLockLabel and capsLockIcon tests to both packages

Covers custom label, custom icon, suppression via empty string,
aria-label fallback, and icon: '' + capsLockIcon independence."
```

---

## Task 4: JSDoc for CapsLock label override behavior

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/types.ts:59-63,69-74,77-81,93-98`
- Modify: `packages/kiosk-keyboard/src/types.ts:134-143,155-165,168-180,211-236`

- [ ] **Step 1: Update WebC `types.ts` JSDoc**

In `packages/kiosk-keyboard-webc/src/types.ts`:

Replace the `label` JSDoc (lines 59-63):

```typescript
  /**
   * Display label shown on the key face. Defaults to `value`.
   * When an icon is also present, both render together.
   * Set to `""` to suppress the label for icon-only display.
   */
  label?: string;
```

With:

```typescript
  /**
   * Display label shown on the key face. Defaults to `value`.
   * When an icon is also present, both render together.
   * Set to `""` to suppress the label for icon-only display.
   *
   * On `{shift}` keys, this label is replaced during Caps Lock state
   * by {@link capsLockLabel} (or the i18n fallback "Caps Lock").
   */
  label?: string;
```

Replace the `capsLockLabel` JSDoc (lines 69-74):

```typescript
  /**
   * Label to show on the `{shift}` key when Caps Lock is active.
   * Defaults to the i18n text for `ARIA_CAPS_LOCK` ("Caps Lock").
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockLabel?: string;
```

With:

```typescript
  /**
   * Label to show on the `{shift}` key when Caps Lock is active.
   * Overrides {@link label} when Caps Lock is active.
   * Defaults to the i18n text for `ARIA_CAPS_LOCK` ("Caps Lock").
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockLabel?: string;
```

Replace the `capsLockIcon` JSDoc (lines 77-81):

```typescript
  /**
   * Icon to show on the `{shift}` key when Caps Lock is active.
   * Accepts SAP icon URIs or Unicode/emoji. Defaults to `sap-icon://locked`.
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockIcon?: string;
```

With:

```typescript
  /**
   * Icon to show on the `{shift}` key when Caps Lock is active.
   * Evaluated independently of {@link icon} -- setting `icon` to `""`
   * does not suppress `capsLockIcon`.
   * Accepts SAP icon URIs or Unicode/emoji. Defaults to `sap-icon://locked`.
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockIcon?: string;
```

- [ ] **Step 2: Update UI5 `types.ts` JSDoc**

In `packages/kiosk-keyboard/src/types.ts`:

Replace the `label` JSDoc (lines 134-143):

```typescript
  /**
   * Display label shown on the key face. Defaults to `value`.
   *
   * When an icon is also present (via `icon` property or built-in),
   * both icon and label render together (icon above label by default).
   * Set to `""` (empty string) to suppress the label for icon-only display.
   */
  label?: string;
```

With:

```typescript
  /**
   * Display label shown on the key face. Defaults to `value`.
   *
   * When an icon is also present (via `icon` property or built-in),
   * both icon and label render together (icon above label by default).
   * Set to `""` (empty string) to suppress the label for icon-only display.
   *
   * On `{shift}` keys, this label is replaced during Caps Lock state
   * by {@link capsLockLabel} (or the i18n fallback "Caps Lock").
   */
  label?: string;
```

Replace the `capsLockLabel` JSDoc (lines 155-165):

```typescript
  /**
   * Label to show on the `{shift}` key when Caps Lock is active.
   *
   * When omitted, the renderer uses the i18n text for `ARIA_CAPS_LOCK`
   * (default: "Caps Lock"). Set this to customize the Caps Lock label
   * per layout (e.g. localized or abbreviated text).
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockLabel?: string;
```

With:

```typescript
  /**
   * Label to show on the `{shift}` key when Caps Lock is active.
   * Overrides {@link label} when Caps Lock is active.
   *
   * When omitted, the renderer uses the i18n text for `ARIA_CAPS_LOCK`
   * (default: "Caps Lock"). Set this to customize the Caps Lock label
   * per layout (e.g. localized or abbreviated text).
   * Only meaningful on keys with `value: "{shift}"`.
   */
  capsLockLabel?: string;
```

Replace the `capsLockIcon` JSDoc (lines 168-180):

```typescript
  /**
   * Icon to show on the `{shift}` key when Caps Lock is active.
   *
   * Accepts the same values as `icon` (SAP icon URI or Unicode/emoji).
   * When omitted, defaults to `sap-icon://locked`.
   * Only meaningful on keys with `value: "{shift}"`.
   *
   * @example "sap-icon://locked"
   * @example "\uD83D\uDD12"
   */
  capsLockIcon?: string;
```

With:

```typescript
  /**
   * Icon to show on the `{shift}` key when Caps Lock is active.
   * Evaluated independently of {@link icon} -- setting `icon` to `""`
   * does not suppress `capsLockIcon`.
   *
   * Accepts the same values as `icon` (SAP icon URI or Unicode/emoji).
   * When omitted, defaults to `sap-icon://locked`.
   * Only meaningful on keys with `value: "{shift}"`.
   *
   * @example "sap-icon://locked"
   * @example "\uD83D\uDD12"
   */
  capsLockIcon?: string;
```

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/types.ts packages/kiosk-keyboard/src/types.ts
git commit -m "docs: document capsLock label override in KeyDefinition JSDoc

Add cross-references between label/capsLockLabel/capsLockIcon so the
override relationship is discoverable from any property. Note that
capsLockIcon is independent of icon: '' suppression."
```

---

## Task 5: Demo app icon+label showcase in custom layouts gallery

**Files:**

- Modify: `packages/demo-app/webapp/controller/KioskCustomLayouts.controller.ts`
- Modify: `packages/demo-app/webapp/view/KioskCustomLayouts.view.xml`

- [ ] **Step 1: Add icon+label layout and clean up existing layouts**

In `packages/demo-app/webapp/controller/KioskCustomLayouts.controller.ts`, replace the entire file content with:

```typescript
import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { KioskKeyboard$KeyPressEvent } from "ui5/kiosk/KioskKeyboard";
import type { LayoutDefinition } from "ui5/kiosk/types";
import { Scope } from "../constants";
import BaseController from "./BaseController";

const EMOJI_LAYOUT: LayoutDefinition = [
  [
    { value: "\u{1F600}" },
    { value: "\u{1F60D}" },
    { value: "\u{1F923}" },
    { value: "\u{1F44D}" },
    { value: "\u{1F389}" },
    { value: "\u{2764}\u{FE0F}", label: "\u{2764}\u{FE0F}" },
    { value: "\u{1F525}" },
    { value: "\u{2B50}" },
  ],
  [
    { value: "\u{1F60E}" },
    { value: "\u{1F622}" },
    { value: "\u{1F914}" },
    { value: "\u{1F4AA}" },
    { value: "\u{1F3C6}" },
    { value: "\u{1F308}" },
    { value: "\u{1F680}" },
    { value: "\u{1F436}" },
  ],
  [
    { value: "\u{1F60A}" },
    { value: "\u{1F609}" },
    { value: "\u{1F44B}" },
    { value: "\u{1F64F}" },
    { value: "\u{1F381}" },
    { value: "\u{2705}" },
    { value: "\u{1F3B5}" },
    { value: "\u{1F431}" },
  ],
  [
    { value: " ", width: "2", type: "space" },
    { value: "{backspace}", width: "2", type: "action" },
    { value: "{enter}", label: "Done", width: "2", type: "action" },
  ],
];

const IP_ADDRESS_LAYOUT: LayoutDefinition = [
  [{ value: "1" }, { value: "2" }, { value: "3" }],
  [{ value: "4" }, { value: "5" }, { value: "6" }],
  [{ value: "7" }, { value: "8" }, { value: "9" }],
  [{ value: ".", label: ".", type: "modifier" }, { value: "0" }, { value: "{backspace}", type: "action" }],
  [{ value: "{enter}", label: "Enter", width: "2", type: "action" }],
];

const CURRENCY_LAYOUT: LayoutDefinition = [
  [{ value: "1" }, { value: "2" }, { value: "3" }, { value: "$", type: "modifier" }],
  [{ value: "4" }, { value: "5" }, { value: "6" }, { value: "\u20AC", label: "EUR", type: "modifier" }],
  [{ value: "7" }, { value: "8" }, { value: "9" }, { value: "\u00A3", label: "GBP", type: "modifier" }],
  [{ value: "." }, { value: "0" }, { value: "," }, { value: "\u00A5", label: "JPY", type: "modifier" }],
  [
    { value: " ", width: "space", type: "space" },
    { value: "{backspace}", width: "1.5", type: "action" },
    { value: "{enter}", label: "Enter", width: "1.5", type: "action" },
  ],
];

const ICON_LABEL_LAYOUT: LayoutDefinition = [
  [
    { value: "home", icon: "sap-icon://home", label: "Home" },
    { value: "settings", icon: "sap-icon://settings", label: "Settings" },
    { value: "delete", icon: "sap-icon://delete", label: "" },
    { value: "search", icon: "\u{1F50D}", label: "Search" },
    { value: "globe", icon: "\u{1F310}", label: "Lang" },
  ],
  [
    { value: "{shift}", type: "modifier", width: "2.25" },
    { value: "{enter}", type: "action", width: "2.25" },
    { value: "{backspace}", type: "action", width: "2" },
    { value: " ", type: "space", width: "space" },
  ],
  [
    {
      value: "{shift}",
      type: "modifier",
      width: "2.25",
      label: "Custom Shift",
      capsLockLabel: "LOCKED",
      capsLockIcon: "\u{1F512}",
    },
    { value: "a" },
    { value: "b" },
    { value: "c" },
  ],
];

const LAYOUT_DESCRIPTIONS: Record<string, string> = {
  emoji:
    "3 rows of emojis (Unicode) + bottom row with Space, Backspace, and Done. Demonstrates Unicode character values.",
  "ip-address": "3x3 digit grid + dot/0/backspace row + full-width Enter. Minimal pad for IP address entry.",
  currency:
    "4x4 grid with digits and currency symbols ($, EUR, GBP, JPY). Shows label overrides and modifier key type.",
  "icon-label":
    "Icon + label rendering modes: SAP icons, Unicode/emoji icons, icon-only, built-in special keys with dual rendering, and capsLock overrides. Double-tap Shift on row 3 to see capsLockLabel/capsLockIcon.",
};

/**
 * Custom layouts gallery - four LayoutDefinitions registered via
 * registerLayout(), switchable via buttons.
 *
 * @namespace demo.hotkeys.controller
 */
export default class KioskCustomLayouts extends BaseController {
  onInit(): void {
    KioskKeyboard.registerLayout("emoji", EMOJI_LAYOUT);
    KioskKeyboard.registerLayout("ip-address", IP_ADDRESS_LAYOUT);
    KioskKeyboard.registerLayout("currency", CURRENCY_LAYOUT);
    KioskKeyboard.registerLayout("icon-label", ICON_LABEL_LAYOUT);

    this._switchLayout("emoji");
  }

  onKeyPress(event: KioskKeyboard$KeyPressEvent): void {
    this.getStateModel().setProperty("/customLastKey", this.formatKeyPress(event));
  }

  onUseEmoji(): void {
    this._switchLayout("emoji");
  }

  onUseIpAddress(): void {
    this._switchLayout("ip-address");
  }

  onUseCurrency(): void {
    this._switchLayout("currency");
  }

  onUseIconLabel(): void {
    this._switchLayout("icon-label");
  }

  onNavBack(): void {
    this.getTypedComponent().getRouter().navTo(Scope.KioskHub);
  }

  private _switchLayout(name: string): void {
    const kb = this.byId("customKeyboard") as KioskKeyboard;
    kb.resetKeyboardType();
    kb.setLayout(name);

    const stateModel = this.getStateModel();
    stateModel.setProperty("/customActiveLayout", name);
    stateModel.setProperty("/customLastKey", "None");
    stateModel.setProperty("/customDescription", LAYOUT_DESCRIPTIONS[name] ?? "");
  }
}
```

- [ ] **Step 2: Add Icon + Label button to the view**

In `packages/demo-app/webapp/view/KioskCustomLayouts.view.xml`, replace:

```xml
                        <Text text="Three custom LayoutDefinitions are registered via registerLayout(). They demonstrate KeyDefinition options such as width, type, icon, unicode values, and label overrides." />
```

With:

```xml
                        <Text text="Four custom LayoutDefinitions are registered via registerLayout(). They demonstrate KeyDefinition options such as width, type, icon, unicode values, label overrides, and dual icon+label rendering." />
```

And after the Currency Pad button, add:

```xml
                            <Button
                                text="Icon + Label"
                                press=".onUseIconLabel"
                                type="{= ${state>/customActiveLayout} === 'icon-label' ? 'Emphasized' : 'Default'}" />
```

- [ ] **Step 3: Verify UI5 TypeScript compilation**

```bash
cd packages/demo-app && npx tsc --noEmit
```

Expected: Clean compilation.

- [ ] **Step 4: Commit**

```bash
git add packages/demo-app/webapp/controller/KioskCustomLayouts.controller.ts packages/demo-app/webapp/view/KioskCustomLayouts.view.xml
git commit -m "feat(demo): add icon+label showcase to custom layouts gallery

Add 4th 'Icon + Label' layout demonstrating SAP icons, Unicode/emoji
icons, icon-only, built-in dual keys, and capsLock overrides.

Clean up existing layouts: remove stale label: '' from backspace and
hardcoded label: 'Space' from space keys, letting them use the new
dual/i18n behavior."
```

---

## Task 6: Remove proposal doc (post-implementation cleanup)

**Files:**

- Delete: `docs/proposals/ICON-TEXT-KEYS-FIXES.md`
- Delete: `docs/proposals/ICON-TEXT-KEYS-FIXES-PLAN.md`

- [ ] **Step 1: Remove both fix documents**

```bash
git rm docs/proposals/ICON-TEXT-KEYS-FIXES.md docs/proposals/ICON-TEXT-KEYS-FIXES-PLAN.md
git commit -m "chore: remove review fix proposal docs

These were working documents for the PR #38 review fixes, not feature
proposals. The fixes are now implemented as commits on the feature branch."
```
