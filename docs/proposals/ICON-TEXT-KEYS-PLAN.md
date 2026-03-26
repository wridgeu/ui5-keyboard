# Icon + Text Keys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow modifier and action keys to display both an icon and a text label simultaneously, and render the Space bar label visibly.

**Architecture:** Rendering-only change across both packages. The `KeyDefinition` type already has `icon` and `label` properties; the renderer currently treats them as mutually exclusive. This plan changes the renderer to emit both elements when both resolve, adds icon type detection (SAP icon vs Unicode/emoji), invalid icon handling, CSS for stacked layout, and updates all documentation.

**Tech Stack:** TypeScript, UI5 RenderManager, Lit/JSX (WebC), LESS (UI5), CSS (WebC), Vitest (WebC unit tests), @open-wc/testing (WebC component tests), QUnit + WDIO (UI5 tests), Playwright (e2e visual regression)

**Spec:** `docs/proposals/ICON-TEXT-KEYS.md`

---

## File Map

### WebC Package (`packages/kiosk-keyboard-webc/`)

| File                                               | Action | Responsibility                                                |
| -------------------------------------------------- | ------ | ------------------------------------------------------------- |
| `src/core/dom-contract.ts`                         | Modify | Add `keyDual` class name                                      |
| `src/KioskKeyboard.ts`                             | Modify | Update `_getKeyLabel`, `_getKeyIcon`; add icon type detection |
| `src/KioskKeyboardTemplate.tsx`                    | Modify | Dual icon+label rendering, `__key--dual` class                |
| `src/types.ts`                                     | Modify | JSDoc updates on `icon` and `label`                           |
| `src/themes/KioskKeyboard.css`                     | Modify | Add `__key--dual` styling                                     |
| `test/component/kiosk-keyboard-icon-label.test.ts` | Create | Icon/label permutation tests                                  |

### UI5 Package (`packages/kiosk-keyboard/`)

| File                                                  | Action | Responsibility                                                                                                 |
| ----------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `src/internal/dom-contract.ts`                        | Modify | Add `keyDual` class name                                                                                       |
| `src/KioskKeyboard.ts`                                | Modify | Update `_getKeyLabel` for explicit label handling                                                              |
| `src/KioskKeyboardRenderer.ts`                        | Modify | Decompose into `renderKeyIcon`/`renderKeyLabel`/`renderKeyContent`; icon type detection; invalid icon handling |
| `src/types.ts`                                        | Modify | JSDoc updates on `icon` and `label`                                                                            |
| `src/themes/base/KioskKeyboard.less`                  | Modify | Add `__key--dual` styling                                                                                      |
| `test/qunit/KioskKeyboard-renderer-blackbox.qunit.ts` | Modify | Icon/label permutation tests                                                                                   |

### Documentation

| File                              | Action | Responsibility                   |
| --------------------------------- | ------ | -------------------------------- |
| `docs/kiosk/ARCHITECTURE.md`      | Modify | Update KeyDefinition description |
| `docs/kiosk-webc/ARCHITECTURE.md` | Modify | Update KeyDefinition description |

---

## Task 1: DOM Contract -- Add `keyDual` Class (Both Packages)

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/core/dom-contract.ts:38`
- Modify: `packages/kiosk-keyboard/src/internal/dom-contract.ts:33`

- [ ] **Step 1: Add `keyDual` to WebC DOM contract**

In `packages/kiosk-keyboard-webc/src/core/dom-contract.ts`, add after `keyIcon` (line 38):

```typescript
    keyIcon: "kiosk-key__icon",
    keyDual: "kiosk-key--dual",
    liveRegion: "kiosk-keyboard__live-region",
```

- [ ] **Step 2: Add `keyDual` to UI5 DOM contract**

In `packages/kiosk-keyboard/src/internal/dom-contract.ts`, add after `keyIcon` (line 33):

```typescript
    keyIcon: "ui5KioskKey__icon",
    keyDual: "ui5KioskKey--dual",
```

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/core/dom-contract.ts packages/kiosk-keyboard/src/internal/dom-contract.ts
git commit -m "feat(dom): add keyDual class to DOM contracts for icon+label keys"
```

---

## Task 2: WebC -- Write Failing Tests for Icon/Label Permutations

**Files:**

- Create: `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard-icon-label.test.ts`

- [ ] **Step 1: Create the test file**

Create `packages/kiosk-keyboard-webc/test/component/kiosk-keyboard-icon-label.test.ts`:

```typescript
import { fixture, html, expect } from "@open-wc/testing";
import { renderFinished } from "@ui5/webcomponents-base/dist/Render.js";
import KioskKeyboard from "../../src/KioskKeyboard.js";
import type { LayoutDefinition } from "../../src/types.js";

const nextRender = renderFinished;
const DOM = KioskKeyboard.DOM;

function queryKey(el: KioskKeyboard, dataKey: string): HTMLElement {
  const key = el.shadowRoot!.querySelector<HTMLElement>(DOM.selectors.keyByValue(dataKey));
  if (!key) throw new Error(`Key "${dataKey}" not found`);
  return key;
}

function queryKeyIcon(keyEl: HTMLElement): Element | null {
  return keyEl.querySelector(`.${DOM.classes.keyIcon}`);
}

function queryKeyLabel(keyEl: HTMLElement): HTMLElement | null {
  return keyEl.querySelector<HTMLElement>(`.${DOM.classes.keyLabel}`);
}

async function createKeyboard(layout: LayoutDefinition): Promise<KioskKeyboard> {
  KioskKeyboard.registerLayout("test-layout", layout);
  const el = await fixture<KioskKeyboard>(html`<kiosk-keyboard layout="test-layout"></kiosk-keyboard>`);
  await nextRender();
  return el;
}

describe("icon + label rendering", () => {
  afterEach(() => {
    KioskKeyboard.unregisterLayout("test-layout");
  });

  // ── Permutation matrix ──

  it("icon omitted, label omitted: renders label from value fallback", async () => {
    const el = await createKeyboard([[{ value: "a" }]]);
    const keyEl = queryKey(el, "a");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("a");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  it("icon omitted, label set: renders custom label only", async () => {
    const el = await createKeyboard([[{ value: "x", label: "Custom" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("Custom");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  it("icon omitted, label empty: renders blank key", async () => {
    const el = await createKeyboard([[{ value: "x", label: "" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)).to.be.null;
  });

  it("SAP icon set, label omitted: renders both icon and value label (dual)", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "sap-icon://home" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyIcon(keyEl)!.getAttribute("aria-hidden")).to.equal("true");
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("x");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("SAP icon set, label set: renders both icon and custom label (dual)", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "sap-icon://home", label: "Go" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("Go");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("SAP icon set, label empty: renders icon only", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "sap-icon://home", label: "" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.be.null;
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  it("icon empty string, label omitted: renders label only (icon suppressed)", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("x");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  it("icon empty string, label empty: renders blank key", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "", label: "" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)).to.be.null;
  });

  // ── Unicode / emoji icons ──

  it("Unicode icon renders as text span with icon class", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "⇧", label: "Shift" }]]);
    const keyEl = queryKey(el, "x");
    const iconEl = queryKeyIcon(keyEl);
    expect(iconEl).to.exist;
    expect(iconEl!.tagName.toLowerCase()).to.not.equal("ui5-icon");
    expect(iconEl!.textContent).to.equal("⇧");
    expect(iconEl!.getAttribute("aria-hidden")).to.equal("true");
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("Shift");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("emoji icon renders as text span with icon class", async () => {
    const el = await createKeyboard([[{ value: "x", icon: "🔍" }]]);
    const keyEl = queryKey(el, "x");
    const iconEl = queryKeyIcon(keyEl);
    expect(iconEl).to.exist;
    expect(iconEl!.textContent).to.equal("🔍");
  });

  // ── Built-in special keys ──

  it("Shift key renders built-in icon + i18n label (dual)", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25" }]]);
    const keyEl = queryKey(el, "{shift}");
    const iconEl = queryKeyIcon(keyEl);
    const labelEl = queryKeyLabel(keyEl);
    expect(iconEl).to.exist;
    expect(labelEl).to.exist;
    expect(labelEl!.textContent).to.match(/shift/i);
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("Enter key renders built-in icon + i18n label (dual)", async () => {
    const el = await createKeyboard([[{ value: "{enter}", type: "action", width: "2.25" }]]);
    const keyEl = queryKey(el, "{enter}");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.match(/enter/i);
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("Backspace key renders built-in icon + i18n label (dual)", async () => {
    const el = await createKeyboard([[{ value: "{backspace}", type: "action", width: "2" }]]);
    const keyEl = queryKey(el, "{backspace}");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.match(/backspace/i);
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.true;
  });

  it("Space bar renders visible label from i18n, no icon", async () => {
    const el = await createKeyboard([[{ value: " ", type: "space", width: "space" }]]);
    const keyEl = queryKey(el, " ");
    expect(queryKeyIcon(keyEl)).to.be.null;
    expect(queryKeyLabel(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)!.textContent).to.match(/space/i);
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  // ── Special key label suppression ──

  it("Shift with label='' renders icon only (opt-out)", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", label: "" }]]);
    const keyEl = queryKey(el, "{shift}");
    expect(queryKeyIcon(keyEl)).to.exist;
    expect(queryKeyLabel(keyEl)).to.be.null;
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
  });

  // ── Accessibility ──

  it("icon-only key retains aria-label", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25", label: "" }]]);
    const keyEl = queryKey(el, "{shift}");
    expect(keyEl.getAttribute("aria-label")).to.be.a("string").and.not.be.empty;
  });

  it("dual icon+label key has no redundant aria-label", async () => {
    const el = await createKeyboard([[{ value: "{shift}", type: "modifier", width: "2.25" }]]);
    const keyEl = queryKey(el, "{shift}");
    // When visible text is present, aria-label should be removed
    // to satisfy WCAG 2.5.3 (Label in Name)
    expect(keyEl.getAttribute("aria-label")).to.be.null;
  });

  // ── Invalid icon handling ──

  it("invalid SAP icon logs warning and renders label only", async () => {
    const warnSpy = sinon.spy(console, "warn");
    const el = await createKeyboard([[{ value: "x", icon: "sap-icon://nonexistent-icon-xyz", label: "Fallback" }]]);
    const keyEl = queryKey(el, "x");
    expect(queryKeyLabel(keyEl)!.textContent).to.equal("Fallback");
    expect(keyEl.classList.contains(DOM.classes.keyDual)).to.be.false;
    warnSpy.restore();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd packages/kiosk-keyboard-webc && npm run test:component`

Expected: Multiple failures -- `keyDual` class doesn't exist on DOM contract yet (will exist after Task 1 is merged), and rendering logic doesn't support dual icon+label yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/kiosk-keyboard-webc/test/component/kiosk-keyboard-icon-label.test.ts
git commit -m "test(webc): add failing tests for icon+label permutation matrix"
```

---

## Task 3: WebC -- Update `_getKeyLabel` for Special Key i18n and Explicit Label Handling

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts:109-114` (SPECIAL_KEY_LABELS)
- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts:940-950` (\_getKeyLabel)

Currently the WebC `_getKeyLabel` returns `key.label ?? key.value` for all keys. For special keys (Shift, Enter, Backspace, Space), the i18n text is only used in `_getKeyAriaLabel`, never for display. This task updates `_getKeyLabel` to:

1. Return `""` early when `label` is explicitly `""`
2. Use i18n text for special keys when no explicit label is set

- [ ] **Step 1: Update `_getKeyLabel` in WebC KioskKeyboard.ts**

Replace the `_getKeyLabel` method at line ~940:

```typescript
_getKeyLabel(key: KeyDefinition): string {
  // Explicit empty label suppresses display text (icon-only opt-out)
  if (key.label === "") return "";

  const shift = this._shifted;
  if (shift && key.shiftLabel) return key.shiftLabel;

  // Explicit non-empty label always wins
  if (key.label !== undefined) {
    const base = key.label;
    return shift && key.value.length === 1 && key.value.trim() ? base.toUpperCase() : base;
  }

  // No explicit label: use i18n for special keys, value for regular keys
  const i18nKey = SPECIAL_KEY_LABELS[key.value];
  if (i18nKey) return getText(i18nKey, key.value);

  const base = key.value;
  if (shift) {
    if (key.shiftValue) return key.shiftValue;
    if (key.value.length === 1 && key.value.trim()) return key.value.toUpperCase();
  }
  return base;
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd packages/kiosk-keyboard-webc && npm run test`

Expected: All existing unit and component tests pass. The Space bar now returns "Space" instead of " ", but no existing test checks the visible Space label text.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/KioskKeyboard.ts
git commit -m "fix(webc): use i18n labels for special keys in _getKeyLabel"
```

---

## Task 4: WebC -- Update Template for Dual Icon+Label Rendering

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts:952-962` (\_getKeyIcon)
- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboardTemplate.tsx:41-91`

- [ ] **Step 1: Add icon type detection helper to KioskKeyboard.ts**

Add this helper function near the top of the file (after the existing constants, around line 65):

```typescript
/** Check if an icon value is a SAP icon URI (vs a Unicode character/emoji). */
function isSapIcon(icon: string): boolean {
  return icon.startsWith("sap-icon://");
}
```

- [ ] **Step 2: Update `_getKeyIcon` to return structured info**

The current `_getKeyIcon` returns a string or null. We need the template to know whether the icon is a SAP icon (render as `<ui5-icon>`) or Unicode (render as text `<span>`). Add a new method alongside `_getKeyIcon`:

```typescript
/**
 * Resolve the icon for a key, categorized by type.
 * Returns null if no icon should render.
 */
_resolveKeyIcon(key: KeyDefinition): { value: string; sap: boolean } | null {
  if (key.icon === "") return null; // explicit suppression

  const customIcon = key.icon;
  if (customIcon) {
    return { value: customIcon, sap: isSapIcon(customIcon) };
  }

  // Built-in icons for special keys
  if (key.value === "{shift}" && this._capsLock) {
    return { value: ICON_SHIFT_LOCKED, sap: true };
  }
  const builtIn = ICON_MAP[key.value];
  if (builtIn) {
    return { value: builtIn, sap: true };
  }

  return null;
}
```

- [ ] **Step 3: Rewrite the key rendering in KioskKeyboardTemplate.tsx**

Replace the key content rendering (the `{isBuiltInIcon ? ... : ...}` block inside the key `<div>`, lines ~72-91) with:

```tsx
{
  (() => {
    const resolved = this._resolveKeyIcon(key);
    const label = this._getKeyLabel(key);
    const hasIcon = resolved !== null;
    const hasLabel = label !== "";
    const isDual = hasIcon && hasLabel;

    return (
      <>
        {hasIcon && resolved!.sap ? (
          <ui5-icon
            class={KIOSK_KEYBOARD_DOM.classes.keyIcon}
            part="key-icon"
            name={resolved!.value}
            mode="Decorative"
          />
        ) : hasIcon ? (
          <span class={KIOSK_KEYBOARD_DOM.classes.keyIcon} part="key-icon" aria-hidden="true">
            {resolved!.value}
          </span>
        ) : null}
        {hasLabel ? (
          <span
            class={{
              [KIOSK_KEYBOARD_DOM.classes.keyLabel]: true,
              [KIOSK_KEYBOARD_DOM.classes.keyLabelGlyph]: !hasIcon && isSingleGlyph(label),
              [KIOSK_KEYBOARD_DOM.classes.keyLabelMulti]:
                !hasIcon && !isSingleGlyph(label) && key.type !== "modifier" && key.type !== "action",
            }}
            part="key-label"
          >
            {label}
          </span>
        ) : null}
      </>
    );
  })();
}
```

Also update the key `<div>` class map to include the dual class:

```tsx
class={{
  [KIOSK_KEYBOARD_DOM.classes.key]: true,
  [KIOSK_KEYBOARD_DOM.classes.keyModifier]: key.type === "modifier",
  [KIOSK_KEYBOARD_DOM.classes.keyAction]: key.type === "action",
  [KIOSK_KEYBOARD_DOM.keyWidthClass(key.width ?? "")]: !!key.width,
  [KIOSK_KEYBOARD_DOM.classes.keyShiftActive]: isShift && this._shifted,
  [KIOSK_KEYBOARD_DOM.classes.keyCapsLock]: isShift && this._capsLock,
  [KIOSK_KEYBOARD_DOM.classes.keyHighlight]: this._highlightedKey === key.value.toLowerCase(),
  [KIOSK_KEYBOARD_DOM.classes.keyDual]: (() => {
    const resolved = this._resolveKeyIcon(key);
    const label = this._getKeyLabel(key);
    return resolved !== null && label !== "";
  })(),
}}
```

Note: the dual check duplicates the resolution. For cleanliness, hoist the resolution above the `<div>` return, alongside the existing variables at lines 44-48:

```tsx
const resolved = this._resolveKeyIcon(key);
const label = resolved !== null ? this._getKeyLabel(key) : (iconName ?? this._getKeyLabel(key));
```

Refactor so that `resolved`, `label`, `hasIcon`, `hasLabel`, `isDual` are computed once at the top of the `.map()` callback, then used in both the class map and the content rendering. Remove the old `iconName`, `isBuiltInIcon`, `label` variables.

- [ ] **Step 4: Update `aria-label` logic**

In the same template, the key `<div>` currently always sets `aria-label={this._getKeyAriaLabel(key)}`. Update to omit `aria-label` when visible text is present:

```tsx
aria-label={(() => {
  const resolved = this._resolveKeyIcon(key);
  const label = this._getKeyLabel(key);
  // Only set aria-label when there is no visible text (icon-only or blank)
  return label === "" ? this._getKeyAriaLabel(key) : undefined;
})()}
```

(With the hoisted variables, this simplifies to: `aria-label={hasLabel ? undefined : this._getKeyAriaLabel(key)}`)

- [ ] **Step 5: Run component tests**

Run: `cd packages/kiosk-keyboard-webc && npm run test:component`

Expected: Icon/label permutation tests now pass (except possibly the invalid icon test).

- [ ] **Step 6: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/KioskKeyboard.ts packages/kiosk-keyboard-webc/src/KioskKeyboardTemplate.tsx
git commit -m "feat(webc): render icon and label together when both resolve"
```

---

## Task 5: WebC -- Invalid Icon Handling

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/KioskKeyboard.ts`

SAP icon validation in the WebC context: `<ui5-icon>` renders nothing for invalid icon names but does not throw. We can detect the failure and log a warning.

- [ ] **Step 1: Add validation to `_resolveKeyIcon`**

For SAP icon URIs set via `key.icon` (not built-in), validate the icon name. Add a warning log when the icon cannot be resolved:

```typescript
_resolveKeyIcon(key: KeyDefinition): { value: string; sap: boolean } | null {
  if (key.icon === "") return null;

  const customIcon = key.icon;
  if (customIcon) {
    if (isSapIcon(customIcon)) {
      // SAP icon: extract name after "sap-icon://" prefix
      const name = customIcon.slice("sap-icon://".length);
      if (!name) {
        console.warn(`KioskKeyboard: empty SAP icon URI for key "${key.value}", skipping icon`);
        return null;
      }
      return { value: name, sap: true };
    }
    // Unicode / emoji
    return { value: customIcon, sap: false };
  }

  if (key.value === "{shift}" && this._capsLock) {
    return { value: ICON_SHIFT_LOCKED, sap: true };
  }
  return ICON_MAP[key.value] ? { value: ICON_MAP[key.value], sap: true } : null;
}
```

Note: Full SAP icon existence validation (checking against the icon registry) is not possible at render time in the WebC context without importing the full icon pool. The `<ui5-icon>` component handles invalid names gracefully by rendering nothing. The warning for empty URIs catches the most common developer error.

- [ ] **Step 2: Run all tests**

Run: `cd packages/kiosk-keyboard-webc && npm run test`

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/KioskKeyboard.ts
git commit -m "feat(webc): add invalid icon handling with console warning"
```

---

## Task 6: WebC -- CSS for Dual-Content Keys

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/themes/KioskKeyboard.css:557`

- [ ] **Step 1: Add dual-content key styles**

After the `.kiosk-key__icon` block (line ~557), add:

```css
/* ============================= */
/* Dual icon + label             */
/* ============================= */

.kiosk-key--dual {
  flex-direction: column;
  gap: 0.1em;
}

.kiosk-key--dual .kiosk-key__icon {
  width: auto;
  height: auto;
  font-size: 0.85em;
}

.kiosk-key--dual .kiosk-key__label {
  font-size: clamp(0.4rem, calc(100cqi * 0.28), 0.75em);
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 2: Run all tests and visually verify**

Run: `cd packages/kiosk-keyboard-webc && npm run test`

Then start the dev server to visually inspect:

Run: `cd packages/kiosk-keyboard-webc && npm run start`

Expected: Shift, Enter, Backspace keys show icon above text. Space shows "Space" text. All existing keys render correctly.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/themes/KioskKeyboard.css
git commit -m "style(webc): add CSS for dual icon+label key layout"
```

---

## Task 7: UI5 -- Write Failing Tests for Icon/Label Permutations

**Files:**

- Modify: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-renderer-blackbox.qunit.ts`

- [ ] **Step 1: Add icon/label permutation tests**

Append to `packages/kiosk-keyboard/test/qunit/KioskKeyboard-renderer-blackbox.qunit.ts`:

```typescript
// ──────────────────────────────────────────────
// Icon + Label permutation matrix
// ──────────────────────────────────────────────

QUnit.test("icon omitted, label omitted: renders label from value", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "a" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "a");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.strictEqual(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent, "a", "Label text is 'a'");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("SAP icon set, label omitted: renders both (dual)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "sap-icon://home" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.strictEqual(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent, "x", "Label text is 'x'");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("icon omitted, label set: renders custom label only", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", label: "Custom" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.strictEqual(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent, "Custom", "Custom label");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("icon omitted, label empty: renders blank key", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", label: "" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No label element");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("SAP icon + custom label: renders both (dual)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "sap-icon://home", label: "Go" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.strictEqual(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent, "Go", "Custom label");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("icon empty, label omitted: renders label only (icon suppressed)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("emoji icon renders as text span with icon class", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "🔍", label: "Search" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
  assert.ok(iconEl, "Icon element present");
  assert.strictEqual(iconEl!.tagName.toLowerCase(), "span", "Icon is a span");
  assert.strictEqual(iconEl!.textContent, "🔍", "Icon text is emoji");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("SAP icon set, label empty: renders icon only", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "sap-icon://home", label: "" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No label element");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("Unicode icon renders as text span with icon class", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "x", icon: "⇧", label: "Shift" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "x");
  const iconEl = keyEl.querySelector(`.${DOM.classes.keyIcon}`);
  assert.ok(iconEl, "Icon element present");
  assert.strictEqual(iconEl!.tagName.toLowerCase(), "span", "Icon is a span (not sap icon)");
  assert.strictEqual(iconEl!.textContent, "⇧", "Icon text is ⇧");
  assert.strictEqual(iconEl!.getAttribute("aria-hidden"), "true", "Icon is aria-hidden");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("Shift key renders built-in icon + i18n label (dual)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "{shift}", type: "modifier", width: "2.25" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(
    /shift/i.test(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent || ""),
    "Label contains 'Shift'",
  );
  assert.ok(keyEl.classList.contains(DOM.classes.keyDual), "Has dual class");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("Space bar renders visible i18n label, no icon", async (assert) => {
  const layout: LayoutDefinition = [[{ value: " ", type: "space", width: "space" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, " ");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "No icon element");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "Label element present");
  assert.ok(
    /space/i.test(keyEl.querySelector(`.${DOM.classes.keyLabel}`)!.textContent || ""),
    "Label contains 'Space'",
  );

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});

QUnit.test("Shift with label='' renders icon only (opt-out)", async (assert) => {
  const layout: LayoutDefinition = [[{ value: "{shift}", type: "modifier", width: "2.25", label: "" }]];
  const kb = new KioskKeyboard();
  KioskKeyboard.registerLayout("test-icon-label", layout);
  kb.setLayout("test-icon-label");
  await placeAndWait(kb);

  const keyEl = getRequiredKeyElement(kb, "{shift}");
  assert.ok(keyEl.querySelector(`.${DOM.classes.keyIcon}`), "Icon element present");
  assert.notOk(keyEl.querySelector(`.${DOM.classes.keyLabel}`), "No label element");
  assert.notOk(keyEl.classList.contains(DOM.classes.keyDual), "No dual class");
  assert.ok(keyEl.getAttribute("aria-label"), "aria-label present for icon-only key");

  kb.destroy();
  KioskKeyboard.unregisterLayout("test-icon-label");
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd packages/kiosk-keyboard && npm run test:qunit`

Expected: Multiple failures -- dual rendering not implemented yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/kiosk-keyboard/test/qunit/KioskKeyboard-renderer-blackbox.qunit.ts
git commit -m "test(ui5): add failing tests for icon+label permutation matrix"
```

---

## Task 8: UI5 -- Update `_getKeyLabel` for Explicit Label Handling

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboard.ts:1767-1775`

- [ ] **Step 1: Update `_getKeyLabel`**

Replace the method at line ~1767:

```typescript
/** The display label for a key (may be empty for icon-only keys). */
private _getKeyLabel(key: KeyDefinition): string {
  // Explicit empty label suppresses display text (icon-only opt-out)
  if (key.label === "") return "";

  const shift = this._isShiftActive();
  if (shift && key.shiftLabel) return key.shiftLabel;

  // Explicit non-empty label always wins over i18n
  if (key.label !== undefined) {
    return shift && key.value.length === 1 && key.value.trim() ? key.label.toUpperCase() : key.label;
  }

  // No explicit label: i18n for special keys, value for regular keys
  const entry = KioskKeyboard._SPECIAL_KEY_I18N[key.value];
  if (entry) return getText(entry[0], entry[1]);

  const base = key.value;
  if (!base) return "";
  return shift && key.value.length === 1 && key.value.trim() ? base.toUpperCase() : base;
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `cd packages/kiosk-keyboard && npm run test:qunit`

Expected: Existing tests pass. New icon/label tests still fail (renderer not updated yet).

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/src/KioskKeyboard.ts
git commit -m "fix(ui5): respect explicit label on special keys in _getKeyLabel"
```

---

## Task 9: UI5 -- Decompose Renderer with Dual Icon+Label Support

**Files:**

- Modify: `packages/kiosk-keyboard/src/KioskKeyboardRenderer.ts:243-268`

This is the core change: decompose `renderKeyContent` into three methods and support dual rendering, icon type detection, and invalid icon handling.

- [ ] **Step 1: Add `isSapIcon` helper**

At the top of `KioskKeyboardRenderer.ts`, near the existing imports, add:

```typescript
import Log from "sap/base/Log";

/** Check if an icon value is a SAP icon URI (vs Unicode/emoji). */
function isSapIcon(icon: string): boolean {
  return icon.startsWith("sap-icon://");
}
```

- [ ] **Step 2: Replace `renderKeyContent` with three methods**

Replace the `renderKeyContent` method (lines 243-268) with:

```typescript
/** Resolve the effective icon for a key. Returns the icon string or empty string if none. */
private resolveKeyIcon(oControl: KioskKeyboard, key: KeyDefinition): string {
  if (key.icon === "") return "";
  const Ctor = oControl.constructor as typeof KioskKeyboard;
  return key.icon || Ctor.getKeyIcon(key.value) || "";
}

/** Render the icon element inside a key. Overridable by subclasses. */
renderKeyIcon(rm: RenderManager, _oControl: KioskKeyboard, icon: string): void {
  if (isSapIcon(icon)) {
    try {
      rm.icon(icon, ["sapUiIcon", KIOSK_KEYBOARD_DOM.classes.keyIcon], { "aria-hidden": "true" });
    } catch (e) {
      Log.warning(`KioskKeyboard: icon "${icon}" could not be rendered, skipping`, undefined, "KioskKeyboard");
    }
  } else {
    // Unicode / emoji -- render as text span with icon class
    rm.openStart("span")
      .class(KIOSK_KEYBOARD_DOM.classes.keyIcon)
      .attr("aria-hidden", "true")
      .openEnd();
    rm.text(icon);
    rm.close("span");
  }
}

/** Render the label element inside a key. Overridable by subclasses. */
renderKeyLabel(rm: RenderManager, _oControl: KioskKeyboard, key: KeyDefinition, label: string): void {
  rm.openStart("span").class(KIOSK_KEYBOARD_DOM.classes.keyLabel);
  if (isSingleGlyph(label)) {
    rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelGlyph);
  } else if (key.type !== "modifier" && key.type !== "action") {
    rm.class(KIOSK_KEYBOARD_DOM.classes.keyLabelMulti);
  }
  rm.openEnd();
  rm.text(label);
  rm.close("span");
}

/** Icon and/or text inside the key. Overridable by subclasses. */
renderKeyContent(rm: RenderManager, oControl: KioskKeyboard, key: KeyDefinition): void {
  const { _isCapsLock, _getKeyLabel } = oControl._getRendererApi();
  const bIsShiftKey = key.value === "{shift}";

  // Resolve icon
  let icon: string;
  if (bIsShiftKey && _isCapsLock()) {
    icon = "sap-icon://locked";
  } else {
    icon = this.resolveKeyIcon(oControl, key);
  }

  // Resolve label
  const label = _getKeyLabel(key);
  const hasIcon = icon !== "";
  const hasLabel = label !== "";

  // Render icon (if present)
  if (hasIcon) {
    this.renderKeyIcon(rm, oControl, icon);
  }

  // Render label (if present)
  if (hasLabel) {
    this.renderKeyLabel(rm, oControl, key, label);
  }
}
```

- [ ] **Step 3: Update `renderKey` to apply `keyDual` class**

Find the `renderKey` method (which wraps `renderKeyContent`) and add the `keyDual` class when both icon and label are present. Locate where the key `<div>` classes are written and add:

```typescript
// Inside renderKey, after opening the key div and applying existing classes:
const icon = (() => {
  if (key.value === "{shift}" && _isCapsLock()) return "sap-icon://locked";
  return this.resolveKeyIcon(oControl, key);
})();
const label = _getKeyLabel(key);
if (icon && label) {
  rm.class(KIOSK_KEYBOARD_DOM.classes.keyDual);
}
```

Note: The exact location depends on how `renderKey` is structured. The dual class must be applied to the key container `<div>`, before `renderKeyContent` is called.

- [ ] **Step 4: Update `aria-label` logic in `renderKey`**

In the same `renderKey` method, find where `aria-label` is set on the key element. Update to omit it when visible text is present:

```typescript
// Only set aria-label when there is no visible text label
const label = _getKeyLabel(key);
if (!label) {
  rm.attr("aria-label", _getKeyAriaLabel(key));
}
```

- [ ] **Step 5: Run tests**

Run: `cd packages/kiosk-keyboard && npm run test:qunit`

Expected: All new icon/label permutation tests pass. All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/kiosk-keyboard/src/KioskKeyboardRenderer.ts
git commit -m "feat(ui5): decompose renderKeyContent for dual icon+label rendering"
```

---

## Task 10: UI5 -- CSS for Dual-Content Keys

**Files:**

- Modify: `packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less:310`

- [ ] **Step 1: Add dual-content key styles**

After the `&__icon` block (line ~310), add:

```less
/* ---- Dual icon + label ---- */
&--dual {
  flex-direction: column;
  gap: 0.1em;
}

&--dual &__icon {
  font-size: 0.85em;
}

&--dual &__label {
  font-size: ~"clamp(0.4rem, calc(100cqi * 0.28), 0.75em)";
  line-height: 1;
}
```

- [ ] **Step 2: Run all tests and visually verify**

Run: `cd packages/kiosk-keyboard && npm run test`

Then start the dev server:

Run: `cd packages/kiosk-keyboard && npm run start:qunit`

Navigate to the keyboard demo page and verify Shift/Enter/Backspace show icon above text, Space shows "Space".

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/src/themes/base/KioskKeyboard.less
git commit -m "style(ui5): add LESS for dual icon+label key layout"
```

---

## Task 11: JSDoc and Type Updates (Both Packages)

**Files:**

- Modify: `packages/kiosk-keyboard/src/types.ts:155-165` (label JSDoc)
- Modify: `packages/kiosk-keyboard/src/types.ts:167-185` (icon JSDoc)
- Modify: `packages/kiosk-keyboard-webc/src/types.ts:63-66` (label JSDoc)
- Modify: `packages/kiosk-keyboard-webc/src/types.ts:73-76` (icon JSDoc)

- [ ] **Step 1: Update UI5 types.ts `label` JSDoc**

Replace the `label` property JSDoc (lines ~155-160):

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

- [ ] **Step 2: Update UI5 types.ts `icon` JSDoc**

Replace the `icon` property JSDoc (lines ~167-185):

```typescript
  /**
   * Icon displayed on the key face.
   *
   * Accepts two value types:
   * - **SAP icon URI** (e.g. `"sap-icon://accept"`) -- rendered via the
   *   platform icon component
   * - **Unicode character or emoji** (e.g. `"⇧"`, `"⏎"`, `"🔍"`) --
   *   rendered as a text span styled at icon font size
   *
   * When both `icon` and a non-empty `label` are present, both render
   * together (icon above label by default). Set `label` to `""` for
   * icon-only display.
   *
   * The following special keys render built-in icons by default (no need
   * to set this property):
   * - `{shift}` -- `sap-icon://arrow-top` (Caps Lock uses `sap-icon://locked`)
   * - `{enter}` -- `sap-icon://accept`
   * - `{backspace}` -- `sap-icon://arrow-left`
   *
   * Set to `""` (empty string) to suppress a built-in icon.
   *
   * @example "sap-icon://arrow-left"
   * @example "⏎"
   */
  icon?: string;
```

- [ ] **Step 3: Update WebC types.ts `label` JSDoc**

```typescript
  /**
   * Display label shown on the key face. Defaults to `value`.
   * When an icon is also present, both render together.
   * Set to `""` to suppress the label for icon-only display.
   */
  label?: string;
```

- [ ] **Step 4: Update WebC types.ts `icon` JSDoc**

```typescript
  /**
   * Icon displayed on the key face.
   * SAP icon URI (e.g. `"sap-icon://accept"`) or Unicode character / emoji (e.g. `"⏎"`).
   * When both icon and label are present, both render together.
   * Set `label` to `""` for icon-only display; set `icon` to `""` to suppress a built-in icon.
   */
  icon?: string;
```

- [ ] **Step 5: Update the example in UI5 types.ts KeyDefinition JSDoc**

Find the `@example Action key with icon` block (around line ~118) and update:

````typescript
 * @example Action key with icon and label
 * ```ts
 * {
 *   value: "{backspace}",
 *   icon: "sap-icon://arrow-left",
 *   width: "2",
 *   type: "action",
 * }
 * ```
 *
 * @example Icon-only key (label suppressed)
 * ```ts
 * {
 *   value: "{backspace}",
 *   label: "",
 *   icon: "sap-icon://arrow-left",
 *   width: "2",
 *   type: "action",
 * }
 * ```
 *
 * @example Unicode icon with text label
 * ```ts
 * {
 *   value: "{shift}",
 *   icon: "⇧",
 *   label: "Shift",
 *   width: "2.25",
 *   type: "modifier",
 * }
 * ```
````

- [ ] **Step 6: Commit**

```bash
git add packages/kiosk-keyboard/src/types.ts packages/kiosk-keyboard-webc/src/types.ts
git commit -m "docs: update KeyDefinition JSDoc for combined icon+label rendering"
```

---

## Task 12: Architecture Docs Update

**Files:**

- Modify: `docs/kiosk/ARCHITECTURE.md:239`
- Modify: `docs/kiosk-webc/ARCHITECTURE.md:237`

- [ ] **Step 1: Update UI5 ARCHITECTURE.md**

Replace line 239:

```markdown
Each key defines its value, optional display label, optional shift variant, width class, visual type, and optional icon.
```

With:

```markdown
Each key defines its value, optional display label, optional shift variant, width class, visual type, and optional icon. When both `icon` and `label` resolve for a key, both render together (icon above label). The `icon` property accepts SAP icon URIs (e.g. `sap-icon://accept`) or Unicode characters/emojis (e.g. `⇧`). Built-in icons for Shift, Enter, and Backspace render automatically alongside their i18n labels.
```

- [ ] **Step 2: Update WebC ARCHITECTURE.md KeyDefinition snippet**

Replace the `icon` comment in the code block at line ~237:

```typescript
  icon?: string; // SAP icon URI or Unicode character; renders alongside label when both present
```

- [ ] **Step 3: Commit**

```bash
git add docs/kiosk/ARCHITECTURE.md docs/kiosk-webc/ARCHITECTURE.md
git commit -m "docs: update architecture docs for icon+label rendering"
```

---

## Task 13: Stale Reference Sweep

**Files:**

- Search across both packages and docs

- [ ] **Step 1: Search for stale icon/label references**

Run:

```bash
grep -rn "icon instead of text\|icon-only keys\|renders the icon instead\|fall back to.*aria-label" packages/kiosk-keyboard/src/ packages/kiosk-keyboard-webc/src/ docs/ --include="*.ts" --include="*.tsx" --include="*.md" --include="*.less" --include="*.css"
```

- [ ] **Step 2: Update any stale references found**

For each result, update the text to reflect the new combined rendering behavior. Common replacements:

- "renders the icon instead of text" -> "renders the icon; when a label is also present, both render together"
- "icon-only keys" -> "keys where `label` is set to `\"\"`"
- "fall back to a built-in aria-label" -> remove (visible text now provides the accessible name)

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "docs: remove stale icon/label mutually-exclusive references"
```

---

## Task 14: Visual Regression Baseline Updates

**Files:**

- Visual baseline snapshots in both packages' `test/e2e/` directories

- [ ] **Step 1: Update WebC visual baselines**

Run: `cd packages/kiosk-keyboard-webc && npm run test:e2e -- --update-visual-baseline`

Review the diff to ensure only expected changes: Shift/Enter/Backspace now show icon+text, Space shows "Space" label.

- [ ] **Step 2: Update UI5 visual baselines**

Run: `cd packages/kiosk-keyboard && npm run test:e2e:update`

Review the diff to ensure only expected changes.

- [ ] **Step 3: Run full e2e to verify baselines pass**

Run from repo root:

```bash
cd packages/kiosk-keyboard-webc && npm run test:e2e
cd ../kiosk-keyboard && npm run test:e2e
```

Expected: All visual regression tests pass with updated baselines.

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/e2e/ packages/kiosk-keyboard/test/e2e/
git commit -m "test: update visual baselines for icon+label rendering"
```

---

## Task 15: Final Verification

- [ ] **Step 1: Run full test suite for both packages**

```bash
cd packages/kiosk-keyboard-webc && npm test
cd ../kiosk-keyboard && npm test
```

Expected: All tests pass in both packages.

- [ ] **Step 2: Run typecheck for both packages**

```bash
cd packages/kiosk-keyboard-webc && npm run typecheck
cd ../kiosk-keyboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Verify generated types are up to date**

Check that `packages/kiosk-keyboard/src/KioskKeyboard.gen.d.ts` reflects any changes. If it needs regeneration, run the appropriate build command.
