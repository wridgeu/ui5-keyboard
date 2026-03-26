# Japanese & Arabic Keyboard Layouts -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add built-in `ja-romaji` and `arabic` keyboard layouts to both packages with locale auto-resolution, i18n bundles, and full test coverage including RTL visuals.

**Architecture:** Package-by-package: complete `kiosk-keyboard-webc` first (Tasks 1-7), then mirror to `kiosk-keyboard` (Tasks 8-13). Layout files are identical between packages. One branch, one PR.

**Tech Stack:** TypeScript, WebdriverIO (E2E/visual), Vitest (unit), UI5 Web Components, SAPUI5

**Spec:** `docs/proposals/JA-AR-LAYOUTS.md`

---

## File Map

### WebC package (`packages/kiosk-keyboard-webc/`)

| Action | File                                   | Responsibility                                            |
| ------ | -------------------------------------- | --------------------------------------------------------- |
| Create | `src/layouts/ja-romaji.ts`             | Japanese romaji layout definition                         |
| Create | `src/layouts/arabic.ts`                | Arabic layout definition                                  |
| Modify | `src/layouts/index.ts`                 | Add ja-romaji and arabic to built-in map                  |
| Modify | `src/core/layout-registry.ts:16`       | Add `ja` and `ar` to `DEFAULT_LOCALE_LAYOUT_MAP`          |
| Create | `src/i18n/messagebundle_ja.properties` | Japanese i18n translations                                |
| Create | `src/i18n/messagebundle_ar.properties` | Arabic i18n translations                                  |
| Modify | `test/unit/layout-registry.test.ts`    | Unit tests for new built-in layouts and locale resolution |
| Modify | `test/pages/visual.html`               | Add ja-romaji and arabic keyboard instances               |
| Modify | `test/e2e/visual.test.ts`              | Visual regression tests for new layouts                   |
| Modify | `test/e2e/rtl.test.ts`                 | Arabic RTL visual regression test                         |

### UI5 package (`packages/kiosk-keyboard/`)

| Action | File                                   | Responsibility                                      |
| ------ | -------------------------------------- | --------------------------------------------------- |
| Create | `src/layouts/ja-romaji.ts`             | Japanese romaji layout definition (same content)    |
| Create | `src/layouts/arabic.ts`                | Arabic layout definition (same content)             |
| Modify | `src/internal/layout-registry.ts`      | Import new layouts, add to map, add locale mappings |
| Create | `src/i18n/messagebundle_ja.properties` | Japanese i18n translations (same content)           |
| Create | `src/i18n/messagebundle_ar.properties` | Arabic i18n translations (same content)             |
| Modify | `test/e2e/visual/index.html`           | Add ja-romaji and arabic sections                   |
| Modify | `test/e2e/visual/init.js`              | Instantiate new keyboard controls                   |
| Modify | `test/e2e/visual.test.ts`              | Visual regression tests for new layouts             |
| Modify | `test/e2e/rtl.test.ts`                 | Arabic RTL visual regression test                   |

### Documentation

| Action | File                                     |
| ------ | ---------------------------------------- |
| Modify | `packages/kiosk-keyboard-webc/README.md` |
| Modify | `packages/kiosk-keyboard/README.md`      |
| Modify | `docs/kiosk-webc/ARCHITECTURE.md`        |
| Modify | `docs/kiosk/ARCHITECTURE.md`             |

---

## Task 1: Create ja-romaji layout (WebC)

**Files:**

- Create: `packages/kiosk-keyboard-webc/src/layouts/ja-romaji.ts`

- [ ] **Step 1: Write the layout file**

```typescript
import type { LayoutDefinition } from "../types.js";

const jaRomaji: LayoutDefinition = [
  // Row 1: number row (JIS shifted symbols)
  [
    { value: "1", shiftValue: "!" },
    { value: "2", shiftValue: '"' },
    { value: "3", shiftValue: "#" },
    { value: "4", shiftValue: "$" },
    { value: "5", shiftValue: "%" },
    { value: "6", shiftValue: "&" },
    { value: "7", shiftValue: "'" },
    { value: "8", shiftValue: "(" },
    { value: "9", shiftValue: ")" },
    { value: "0", shiftValue: "~" },
    {
      value: "{backspace}",
      label: "",
      width: "2",
      type: "action",
    },
  ],
  // Row 2: QWERTY
  [
    { value: "q" },
    { value: "w" },
    { value: "e" },
    { value: "r" },
    { value: "t" },
    { value: "y" },
    { value: "u" },
    { value: "i" },
    { value: "o" },
    { value: "p" },
  ],
  // Row 3: ASDF
  [
    { value: "a" },
    { value: "s" },
    { value: "d" },
    { value: "f" },
    { value: "g" },
    { value: "h" },
    { value: "j" },
    { value: "k" },
    { value: "l" },
  ],
  // Row 4: ZXCV + Shift/Enter
  [
    {
      value: "{shift}",
      width: "2.25",
      type: "modifier",
    },
    { value: "z" },
    { value: "x" },
    { value: "c" },
    { value: "v" },
    { value: "b" },
    { value: "n" },
    { value: "m" },
    {
      value: "{enter}",
      width: "2.25",
      type: "action",
    },
  ],
  // Row 5: bottom row (Japanese punctuation)
  [
    {
      value: "{layout:numeric}",
      label: "123",
      width: "1.5",
      type: "modifier",
    },
    { value: "\u3001", shiftValue: "\u30FB" },
    { value: " ", label: "Space", width: "space", type: "space" },
    { value: "\u3002", shiftValue: "\u300C" },
    {
      value: "{layout:fkeys}",
      label: "Fn",
      width: "1.5",
      type: "modifier",
    },
  ],
];

export default jaRomaji;
```

Key details:

- `\u3001` = 、(ideographic comma), shift produces `\u30FB` = ・(middle dot)
- `\u3002` = 。(ideographic period), shift produces `\u300C` = 「(left corner bracket)
- JIS-style shifted number row: `! " # $ % & ' ( ) ~`

- [ ] **Step 2: Verify the file compiles**

Run: `cd packages/kiosk-keyboard-webc && npx tsc --noEmit src/layouts/ja-romaji.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/layouts/ja-romaji.ts
git commit -m "feat(kiosk-webc): add ja-romaji layout definition"
```

---

## Task 2: Create arabic layout (WebC)

**Files:**

- Create: `packages/kiosk-keyboard-webc/src/layouts/arabic.ts`

- [ ] **Step 1: Write the layout file**

```typescript
import type { LayoutDefinition } from "../types.js";

const arabic: LayoutDefinition = [
  // Row 1: Western Arabic numerals (default), Arabic-Indic on shift
  [
    { value: "1", shiftValue: "\u0661" },
    { value: "2", shiftValue: "\u0662" },
    { value: "3", shiftValue: "\u0663" },
    { value: "4", shiftValue: "\u0664" },
    { value: "5", shiftValue: "\u0665" },
    { value: "6", shiftValue: "\u0666" },
    { value: "7", shiftValue: "\u0667" },
    { value: "8", shiftValue: "\u0668" },
    { value: "9", shiftValue: "\u0669" },
    { value: "0", shiftValue: "\u0660" },
    {
      value: "{backspace}",
      label: "",
      width: "2",
      type: "action",
    },
  ],
  // Row 2: Arabic letters (standard Arabic 101 top row)
  [
    { value: "\u0636", shiftValue: "\u0651" },
    { value: "\u0635", shiftValue: "\u064B" },
    { value: "\u062B", shiftValue: "\u064C" },
    { value: "\u0642", shiftValue: "\u064D" },
    { value: "\u0641", shiftValue: "\u064E" },
    { value: "\u063A", shiftValue: "\u064F" },
    { value: "\u0639", shiftValue: "\u0650" },
    { value: "\u0647", shiftValue: "\u0652" },
    { value: "\u062E", shiftValue: "\u0623" },
    { value: "\u062D", shiftValue: "\u0625" },
    { value: "\u062C", shiftValue: "\u0627\u0653" },
  ],
  // Row 3: Arabic letters (home row)
  [
    { value: "\u0634", shiftValue: "\u0624" },
    { value: "\u0633", shiftValue: "\u0626" },
    { value: "\u064A", shiftValue: "\u0649" },
    { value: "\u0628", shiftValue: "\u0644\u0627" },
    { value: "\u0644", shiftValue: "\u0644\u0623" },
    { value: "\u0627", shiftValue: "\u0644\u0625" },
    { value: "\u062A", shiftValue: "\u0640" },
    { value: "\u0646", shiftValue: "\u060C" },
    { value: "\u0645", shiftValue: "/" },
    { value: "\u0643", shiftValue: ":" },
    { value: "\u062F", shiftValue: '"' },
  ],
  // Row 4: Arabic letters (bottom row) + Shift/Enter
  [
    {
      value: "{shift}",
      width: "2.25",
      type: "modifier",
    },
    { value: "\u0626", shiftValue: "~" },
    { value: "\u0621", shiftValue: "\u0652" },
    { value: "\u0624", shiftValue: "\u007B" },
    { value: "\u0631", shiftValue: "\u007D" },
    { value: "\u0649", shiftValue: "\u0622" },
    { value: "\u0629", shiftValue: "\u2018" },
    { value: "\u0648", shiftValue: "\u2019" },
    { value: "\u0632", shiftValue: "," },
    { value: "\u0638", shiftValue: "." },
    {
      value: "{enter}",
      width: "2.25",
      type: "action",
    },
  ],
  // Row 5: bottom row (Arabic punctuation)
  [
    {
      value: "{layout:numeric}",
      label: "123",
      width: "1.5",
      type: "modifier",
    },
    { value: "\u060C", shiftValue: "\u061B" },
    { value: " ", label: "Space", width: "space", type: "space" },
    { value: ".", shiftValue: "\u061F" },
    {
      value: "{layout:fkeys}",
      label: "Fn",
      width: "1.5",
      type: "modifier",
    },
  ],
];

export default arabic;
```

Key details:

- Row 2 shift: tashkeel diacritics (shadda, tanwin fathah/dammah/kasrah, fathah, dammah, kasrah, sukun) + hamza variants
- Row 3 shift: hamza variants, lam-alef ligatures, tatweel, Arabic comma, punctuation
- Row 4 shift: brackets, alef madda, quotation marks
- Bottom row: `\u060C` = Arabic comma, `\u061B` = Arabic semicolon (shift), `\u061F` = Arabic question mark (shift)

- [ ] **Step 2: Verify the file compiles**

Run: `cd packages/kiosk-keyboard-webc && npx tsc --noEmit src/layouts/arabic.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/layouts/arabic.ts
git commit -m "feat(kiosk-webc): add arabic layout definition"
```

---

## Task 3: Register layouts and locale mappings (WebC)

**Files:**

- Modify: `packages/kiosk-keyboard-webc/src/layouts/index.ts`
- Modify: `packages/kiosk-keyboard-webc/src/core/layout-registry.ts`

- [ ] **Step 1: Write failing unit tests for new built-in layouts**

Add to `packages/kiosk-keyboard-webc/test/unit/layout-registry.test.ts`, inside the `describe("built-in layouts")` block after the existing `numpad` test (after line 36):

```typescript
it("has ja-romaji as a built-in layout", () => {
  expect(isBuiltInLayout("ja-romaji")).toBe(true);
});

it("has arabic as a built-in layout", () => {
  expect(isBuiltInLayout("arabic")).toBe(true);
});
```

And inside the `describe("getLocaleLayout")` block, replace the existing test at lines 172-179 that asserts `ja-JP` falls back to `qwerty`:

```typescript
it("resolves ja-JP to ja-romaji via built-in locale mapping", () => {
  const original = navigator.language;
  Object.defineProperty(navigator, "language", { value: "ja-JP", configurable: true });
  try {
    expect(getLocaleLayout()).toBe("ja-romaji");
  } finally {
    Object.defineProperty(navigator, "language", { value: original, configurable: true });
  }
});

it("resolves ar to arabic via built-in locale mapping", () => {
  const original = navigator.language;
  Object.defineProperty(navigator, "language", { value: "ar", configurable: true });
  try {
    expect(getLocaleLayout()).toBe("arabic");
  } finally {
    Object.defineProperty(navigator, "language", { value: original, configurable: true });
  }
});

it("resolves ar-SA to arabic via language prefix", () => {
  const original = navigator.language;
  Object.defineProperty(navigator, "language", { value: "ar-SA", configurable: true });
  try {
    expect(getLocaleLayout()).toBe("arabic");
  } finally {
    Object.defineProperty(navigator, "language", { value: original, configurable: true });
  }
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/layout-registry.test.ts`
Expected: FAIL -- `ja-romaji` and `arabic` are not yet registered as built-in, `ja-JP` still falls back to `qwerty`

- [ ] **Step 3: Add imports and map entries to index.ts**

In `packages/kiosk-keyboard-webc/src/layouts/index.ts`, add imports after line 12 (after `qwertzDeNav`):

```typescript
import jaRomaji from "./ja-romaji.js";
import arabic from "./arabic.js";
```

Add map entries before the closing `]);` (after line 26):

```typescript
  ["ja-romaji", jaRomaji],
  ["arabic", arabic],
```

- [ ] **Step 4: Add locale mappings to layout-registry.ts**

In `packages/kiosk-keyboard-webc/src/core/layout-registry.ts`, change line 16 from:

```typescript
const DEFAULT_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([["de", "qwertz-de"]]);
```

to:

```typescript
const DEFAULT_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([
  ["de", "qwertz-de"],
  ["ja", "ja-romaji"],
  ["ar", "arabic"],
]);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd packages/kiosk-keyboard-webc && npx vitest run test/unit/layout-registry.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/layouts/index.ts packages/kiosk-keyboard-webc/src/core/layout-registry.ts packages/kiosk-keyboard-webc/test/unit/layout-registry.test.ts
git commit -m "feat(kiosk-webc): register ja-romaji and arabic layouts with locale mappings"
```

---

## Task 4: Add i18n bundles (WebC)

**Files:**

- Create: `packages/kiosk-keyboard-webc/src/i18n/messagebundle_ja.properties`
- Create: `packages/kiosk-keyboard-webc/src/i18n/messagebundle_ar.properties`

- [ ] **Step 1: Create Japanese i18n bundle**

```properties
# Resource bundle for kiosk-keyboard-webc
# Japanese

#XACT: ARIA label for the keyboard root when accessibleName is not set
KIOSK_KEYBOARD_LABEL=\u4eee\u60f3\u30ad\u30fc\u30dc\u30fc\u30c9
#XACT: ARIA roledescription for the keyboard root
KIOSK_KEYBOARD_ROLEDESCRIPTION=\u30ad\u30fc\u30dc\u30fc\u30c9

#XBUT: Label for Shift key (used as ARIA label for icon-only key)
KEY_SHIFT=\u30b7\u30d5\u30c8
#XBUT: Label for Enter key (used as ARIA label for icon-only key)
KEY_ENTER=\u30a8\u30f3\u30bf\u30fc
#XBUT: Label for Backspace key (used as ARIA label for icon-only key)
KEY_BACKSPACE=\u30d0\u30c3\u30af\u30b9\u30da\u30fc\u30b9
#XBUT: Label for Space key
KEY_SPACE=\u30b9\u30da\u30fc\u30b9

#XACT: ARIA label for Shift key when Caps Lock is active
ARIA_CAPS_LOCK=Caps Lock
#XACT: ARIA live announcement when Caps Lock is enabled
ARIA_CAPS_LOCK_ON=Caps Lock \u30aa\u30f3
#XACT: ARIA live announcement when Shift is enabled
ARIA_SHIFT_ON=\u30b7\u30d5\u30c8 \u30aa\u30f3
#XACT: ARIA live announcement when keyboard opens
ARIA_KEYBOARD_OPENED=\u4eee\u60f3\u30ad\u30fc\u30dc\u30fc\u30c9\u3092\u958b\u304d\u307e\u3057\u305f
#XACT: ARIA live announcement when keyboard closes
ARIA_KEYBOARD_CLOSED=\u4eee\u60f3\u30ad\u30fc\u30dc\u30fc\u30c9\u3092\u9589\u3058\u307e\u3057\u305f
```

The unicode escapes decode to:

- `KIOSK_KEYBOARD_LABEL` = 仮想キーボード (Virtual Keyboard)
- `KIOSK_KEYBOARD_ROLEDESCRIPTION` = キーボード (keyboard)
- `KEY_SHIFT` = シフト, `KEY_ENTER` = エンター, `KEY_BACKSPACE` = バックスペース, `KEY_SPACE` = スペース
- `ARIA_CAPS_LOCK` = Caps Lock (kept in English as this is universally recognized)
- `ARIA_CAPS_LOCK_ON` = Caps Lock オン, `ARIA_SHIFT_ON` = シフト オン
- `ARIA_KEYBOARD_OPENED` = 仮想キーボードを開きました, `ARIA_KEYBOARD_CLOSED` = 仮想キーボードを閉じました

- [ ] **Step 2: Create Arabic i18n bundle**

```properties
# Resource bundle for kiosk-keyboard-webc
# Arabic

#XACT: ARIA label for the keyboard root when accessibleName is not set
KIOSK_KEYBOARD_LABEL=\u0644\u0648\u062d\u0629 \u0645\u0641\u0627\u062a\u064a\u062d \u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0629
#XACT: ARIA roledescription for the keyboard root
KIOSK_KEYBOARD_ROLEDESCRIPTION=\u0644\u0648\u062d\u0629 \u0645\u0641\u0627\u062a\u064a\u062d

#XBUT: Label for Shift key (used as ARIA label for icon-only key)
KEY_SHIFT=\u062a\u062d\u0648\u064a\u0644
#XBUT: Label for Enter key (used as ARIA label for icon-only key)
KEY_ENTER=\u0625\u062f\u062e\u0627\u0644
#XBUT: Label for Backspace key (used as ARIA label for icon-only key)
KEY_BACKSPACE=\u0645\u0633\u062d
#XBUT: Label for Space key
KEY_SPACE=\u0645\u0633\u0627\u0641\u0629

#XACT: ARIA label for Shift key when Caps Lock is active
ARIA_CAPS_LOCK=Caps Lock
#XACT: ARIA live announcement when Caps Lock is enabled
ARIA_CAPS_LOCK_ON=Caps Lock \u0645\u064f\u0641\u0639\u0651\u0644
#XACT: ARIA live announcement when Shift is enabled
ARIA_SHIFT_ON=\u062a\u062d\u0648\u064a\u0644 \u0645\u064f\u0641\u0639\u0651\u0644
#XACT: ARIA live announcement when keyboard opens
ARIA_KEYBOARD_OPENED=\u062a\u0645 \u0641\u062a\u062d \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0641\u0627\u062a\u064a\u062d \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0629
#XACT: ARIA live announcement when keyboard closes
ARIA_KEYBOARD_CLOSED=\u062a\u0645 \u0625\u063a\u0644\u0627\u0642 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0641\u0627\u062a\u064a\u062d \u0627\u0644\u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0629
```

The unicode escapes decode to:

- `KIOSK_KEYBOARD_LABEL` = لوحة مفاتيح افتراضية (Virtual Keyboard)
- `KIOSK_KEYBOARD_ROLEDESCRIPTION` = لوحة مفاتيح (keyboard)
- `KEY_SHIFT` = تحويل, `KEY_ENTER` = إدخال, `KEY_BACKSPACE` = مسح, `KEY_SPACE` = مسافة
- `ARIA_CAPS_LOCK_ON` = Caps Lock مُفعَّل, `ARIA_SHIFT_ON` = تحويل مُفعَّل
- `ARIA_KEYBOARD_OPENED` = تم فتح لوحة المفاتيح الافتراضية
- `ARIA_KEYBOARD_CLOSED` = تم إغلاق لوحة المفاتيح الافتراضية

- [ ] **Step 3: Regenerate i18n loaders**

Run: `cd packages/kiosk-keyboard-webc && npm run generate`
Expected: Generated files updated to include new locales (check `src/generated/json-imports/i18n.js` for `ja` and `ar` entries)

- [ ] **Step 4: Verify build succeeds**

Run: `cd packages/kiosk-keyboard-webc && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/i18n/messagebundle_ja.properties packages/kiosk-keyboard-webc/src/i18n/messagebundle_ar.properties packages/kiosk-keyboard-webc/src/generated/
git commit -m "feat(kiosk-webc): add Japanese and Arabic i18n bundles"
```

---

## Task 5: Add visual regression tests (WebC)

**Files:**

- Modify: `packages/kiosk-keyboard-webc/test/pages/visual.html`
- Modify: `packages/kiosk-keyboard-webc/test/e2e/visual.test.ts`

- [ ] **Step 1: Add keyboard instances to the visual test page**

In `packages/kiosk-keyboard-webc/test/pages/visual.html`, add two new sections before the closing `</body>` tag (before line 201):

```html
<div class="section">
  <h2>28. Japanese Romaji</h2>
  <kiosk-keyboard id="kb-ja-romaji" layout="ja-romaji"></kiosk-keyboard>
</div>

<div class="section">
  <h2>29. Arabic</h2>
  <kiosk-keyboard id="kb-arabic" layout="arabic"></kiosk-keyboard>
</div>
```

- [ ] **Step 2: Add visual test cases**

In `packages/kiosk-keyboard-webc/test/e2e/visual.test.ts`, add two new tests inside the `describe("KioskKeyboard Web Component - Visual Regression")` block, after the part-styled test (after line 80):

```typescript
it("should match Japanese Romaji layout", async () => {
  const kb = await getKeyboardRoot("kb-ja-romaji");
  await matchElementSnapshotInSection(kb, "webc-ja-romaji");
});

it("should match Arabic layout", async () => {
  const kb = await getKeyboardRoot("kb-arabic");
  await matchElementSnapshotInSection(kb, "webc-arabic");
});
```

- [ ] **Step 3: Run the visual tests to capture initial baselines**

Run: `cd packages/kiosk-keyboard-webc && npm run test:e2e:update`
Expected: New baseline images created in `test/e2e/__baselines__/` for `webc-ja-romaji.png` and `webc-arabic.png`

- [ ] **Step 4: Verify the baselines were created**

Run: `ls packages/kiosk-keyboard-webc/test/e2e/__baselines__/webc-ja-romaji* packages/kiosk-keyboard-webc/test/e2e/__baselines__/webc-arabic*`
Expected: Files exist

- [ ] **Step 5: Run the visual tests without update to verify they pass**

Run: `cd packages/kiosk-keyboard-webc && npm run test:e2e`
Expected: All tests PASS (baselines match)

- [ ] **Step 6: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/pages/visual.html packages/kiosk-keyboard-webc/test/e2e/visual.test.ts packages/kiosk-keyboard-webc/test/e2e/__baselines__/
git commit -m "test(kiosk-webc): add visual regression baselines for ja-romaji and arabic"
```

---

## Task 6: Add Arabic RTL visual test (WebC)

**Files:**

- Modify: `packages/kiosk-keyboard-webc/test/e2e/rtl.test.ts`

- [ ] **Step 1: Add Arabic RTL test**

In `packages/kiosk-keyboard-webc/test/e2e/rtl.test.ts`, add a new test after the Numeric RTL test (after line 32):

```typescript
it("should match Arabic layout in RTL", async () => {
  await openVisualPage();
  await setDocumentDirection("rtl");
  const kb = await getKeyboardRoot("kb-arabic");
  await matchElementSnapshotInSection(kb, "webc-arabic-rtl");
});
```

- [ ] **Step 2: Run the RTL tests to capture the baseline**

Run: `cd packages/kiosk-keyboard-webc && npm run test:e2e:update`
Expected: New baseline `webc-arabic-rtl.png` created

- [ ] **Step 3: Run the RTL tests without update to verify they pass**

Run: `cd packages/kiosk-keyboard-webc && npm run test:e2e`
Expected: All RTL tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/e2e/rtl.test.ts packages/kiosk-keyboard-webc/test/e2e/__baselines__/
git commit -m "test(kiosk-webc): add Arabic RTL visual regression baseline"
```

---

## Task 7: Run full WebC test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all unit tests**

Run: `cd packages/kiosk-keyboard-webc && npm run test`
Expected: All unit tests PASS

- [ ] **Step 2: Run all E2E tests**

Run: `cd packages/kiosk-keyboard-webc && npm run test:e2e`
Expected: All E2E tests PASS (visual + RTL + existing tests)

- [ ] **Step 3: Commit if any baselines were updated**

If any existing baselines changed (unlikely), commit them:

```bash
git add packages/kiosk-keyboard-webc/test/e2e/__baselines__/
git commit -m "test(kiosk-webc): update visual baselines after layout additions"
```

---

## Task 8: Create ja-romaji and arabic layouts (UI5)

**Files:**

- Create: `packages/kiosk-keyboard/src/layouts/ja-romaji.ts`
- Create: `packages/kiosk-keyboard/src/layouts/arabic.ts`

- [ ] **Step 1: Copy ja-romaji layout to UI5 package**

Create `packages/kiosk-keyboard/src/layouts/ja-romaji.ts` with the same content as the WebC version from Task 1, but with a different import path:

```typescript
import type { LayoutDefinition } from "../types";
```

(Note: UI5 package uses `"../types"` without `.js` extension, matching the existing UI5 layout files like `qwerty.ts`)

The rest of the file is identical to Task 1.

- [ ] **Step 2: Copy arabic layout to UI5 package**

Create `packages/kiosk-keyboard/src/layouts/arabic.ts` with the same content as the WebC version from Task 2, but with the UI5 import path:

```typescript
import type { LayoutDefinition } from "../types";
```

The rest of the file is identical to Task 2.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/src/layouts/ja-romaji.ts packages/kiosk-keyboard/src/layouts/arabic.ts
git commit -m "feat(kiosk): add ja-romaji and arabic layout definitions"
```

---

## Task 9: Register layouts and locale mappings (UI5)

**Files:**

- Modify: `packages/kiosk-keyboard/src/internal/layout-registry.ts`

- [ ] **Step 1: Add imports**

In `packages/kiosk-keyboard/src/internal/layout-registry.ts`, add imports after line 15 (after `qwertzDeNav`):

```typescript
import jaRomaji from "../layouts/ja-romaji";
import arabic from "../layouts/arabic";
```

- [ ] **Step 2: Add map entries**

Add entries to the `layouts` Map after line 28 (after `qwertz-de-nav`):

```typescript
  ["ja-romaji", jaRomaji],
  ["arabic", arabic],
```

- [ ] **Step 3: Add locale mappings**

Change line 34 from:

```typescript
const DEFAULT_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([["de", "qwertz-de"]]);
```

to:

```typescript
const DEFAULT_LOCALE_LAYOUT_MAP: ReadonlyMap<string, string> = new Map([
  ["de", "qwertz-de"],
  ["ja", "ja-romaji"],
  ["ar", "arabic"],
]);
```

- [ ] **Step 4: Verify build**

Run: `cd packages/kiosk-keyboard && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard/src/internal/layout-registry.ts
git commit -m "feat(kiosk): register ja-romaji and arabic layouts with locale mappings"
```

---

## Task 10: Add i18n bundles (UI5)

**Files:**

- Create: `packages/kiosk-keyboard/src/i18n/messagebundle_ja.properties`
- Create: `packages/kiosk-keyboard/src/i18n/messagebundle_ar.properties`

- [ ] **Step 1: Create Japanese i18n bundle**

Same content as Task 4 Step 1, but with the UI5 header comment:

```properties
# Resource bundle for kiosk-keyboard
# Japanese
```

(Rest of content identical to Task 4 Step 1)

- [ ] **Step 2: Create Arabic i18n bundle**

Same content as Task 4 Step 2, but with the UI5 header comment:

```properties
# Resource bundle for kiosk-keyboard
# Arabic
```

(Rest of content identical to Task 4 Step 2)

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/src/i18n/messagebundle_ja.properties packages/kiosk-keyboard/src/i18n/messagebundle_ar.properties
git commit -m "feat(kiosk): add Japanese and Arabic i18n bundles"
```

---

## Task 11: Add visual regression tests (UI5)

**Files:**

- Modify: `packages/kiosk-keyboard/test/e2e/visual/index.html`
- Modify: `packages/kiosk-keyboard/test/e2e/visual/init.js`
- Modify: `packages/kiosk-keyboard/test/e2e/visual.test.ts`

- [ ] **Step 1: Add sections to visual test HTML**

In `packages/kiosk-keyboard/test/e2e/visual/index.html`, add two new sections before the closing `</body>` tag (before line 268):

```html
<div class="section">
  <h2>30. Japanese Romaji</h2>
  <div class="keyboard-container" id="kb-ja-romaji"></div>
</div>

<div class="section">
  <h2>31. Arabic</h2>
  <div class="keyboard-container" id="kb-arabic"></div>
</div>
```

- [ ] **Step 2: Instantiate keyboards in init.js**

In `packages/kiosk-keyboard/test/e2e/visual/init.js`, add after line 148 (after the unconstrained keyboard):

```javascript
// 30. Japanese Romaji
new KioskKeyboard({ layout: "ja-romaji" }).placeAt("kb-ja-romaji");

// 31. Arabic
new KioskKeyboard({ layout: "arabic" }).placeAt("kb-arabic");
```

- [ ] **Step 3: Add visual test cases**

In `packages/kiosk-keyboard/test/e2e/visual.test.ts`, add two new tests inside the `describe("KioskKeyboard Responsive Visual Regression")` block, after the glyph stress test (after line 87):

```typescript
it("should match Japanese Romaji layout", async () => {
  const kb = await getKeyboard("kb-ja-romaji");
  await matchElementSnapshotInSection(kb, "kb-ja-romaji");
});

it("should match Arabic layout", async () => {
  const kb = await getKeyboard("kb-arabic");
  await matchElementSnapshotInSection(kb, "kb-arabic");
});
```

- [ ] **Step 4: Run the visual tests to capture baselines**

Run: `cd packages/kiosk-keyboard && npm run test:e2e:update`
Expected: New baselines `kb-ja-romaji.png` and `kb-arabic.png` created

- [ ] **Step 5: Run the visual tests without update to verify**

Run: `cd packages/kiosk-keyboard && npm run test:e2e`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/kiosk-keyboard/test/e2e/visual/ packages/kiosk-keyboard/test/e2e/visual.test.ts packages/kiosk-keyboard/test/e2e/__baselines__/
git commit -m "test(kiosk): add visual regression baselines for ja-romaji and arabic"
```

---

## Task 12: Add Arabic RTL visual test (UI5)

**Files:**

- Modify: `packages/kiosk-keyboard/test/e2e/rtl.test.ts`

- [ ] **Step 1: Add Arabic RTL test**

In `packages/kiosk-keyboard/test/e2e/rtl.test.ts`, add a new test after the Numeric RTL test (after line 27):

```typescript
it("should match Arabic layout in RTL", async () => {
  await openVisualPage();
  await setDocumentDirection("rtl");
  const kb = await getKeyboard("kb-arabic");
  await matchElementSnapshotInSection(kb, "kb-arabic-rtl");
});
```

- [ ] **Step 2: Run the RTL tests to capture the baseline**

Run: `cd packages/kiosk-keyboard && npm run test:e2e:update`
Expected: New baseline `kb-arabic-rtl.png` created

- [ ] **Step 3: Run the RTL tests without update to verify**

Run: `cd packages/kiosk-keyboard && npm run test:e2e`
Expected: All RTL tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard/test/e2e/rtl.test.ts packages/kiosk-keyboard/test/e2e/__baselines__/
git commit -m "test(kiosk): add Arabic RTL visual regression baseline"
```

---

## Task 13: Run full UI5 test suite

**Files:** None (verification only)

- [ ] **Step 1: Run all E2E tests**

Run: `cd packages/kiosk-keyboard && npm run test:e2e`
Expected: All E2E tests PASS

- [ ] **Step 2: Commit if any baselines were updated**

If any existing baselines changed, commit them:

```bash
git add packages/kiosk-keyboard/test/e2e/__baselines__/
git commit -m "test(kiosk): update visual baselines after layout additions"
```

---

## Task 14: Update documentation

**Files:**

- Modify: `packages/kiosk-keyboard-webc/README.md`
- Modify: `packages/kiosk-keyboard/README.md`
- Modify: `docs/kiosk-webc/ARCHITECTURE.md`
- Modify: `docs/kiosk/ARCHITECTURE.md`

- [ ] **Step 1: Update WebC README**

In `packages/kiosk-keyboard-webc/README.md`:

1. Find the built-in layouts list (around line 16) and add `Japanese Romaji, Arabic` to the feature list.
2. Find the built-in layouts table (around lines 357-367) and add rows for `ja-romaji` and `arabic`.
3. Find the locale mapping documentation and add `ja -> ja-romaji` and `ar -> arabic` entries.
4. Add a note that the Arabic layout renders RTL content.

- [ ] **Step 2: Update UI5 README**

In `packages/kiosk-keyboard/README.md`:

1. Find the built-in layouts section (around lines 442-456) and add `ja-romaji` and `arabic`.
2. Find the built-in locale mappings section (around lines 700-706) and add `ja -> ja-romaji` and `ar -> arabic`.
3. Add a note about Arabic RTL rendering.

- [ ] **Step 3: Update WebC Architecture doc**

In `docs/kiosk-webc/ARCHITECTURE.md`:

1. Find the built-in layout inventory and add `ja-romaji` and `arabic`.
2. Find the locale mapping documentation and add the new entries.

- [ ] **Step 4: Update UI5 Architecture doc**

In `docs/kiosk/ARCHITECTURE.md`:

1. Find the built-in layout inventory and add `ja-romaji` and `arabic`.
2. Find the locale mapping documentation and add the new entries.

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/README.md packages/kiosk-keyboard/README.md docs/kiosk-webc/ARCHITECTURE.md docs/kiosk/ARCHITECTURE.md
git commit -m "docs: add ja-romaji and arabic to layout tables and locale mappings"
```

---

## Task 15: Final verification

**Files:** None (full test run)

- [ ] **Step 1: Run the complete test suite from the monorepo root**

Run: `npm run test`
Expected: All tests across all packages PASS

- [ ] **Step 2: Build both packages**

Run: `npm run build`
Expected: Clean build with no errors
