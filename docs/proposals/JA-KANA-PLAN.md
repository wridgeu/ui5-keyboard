# Japanese Kana Direct-Input Layout -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ja-kana` built-in layout following JIS X 6002, with touch-friendly dakuten/handakuten keys, to both packages.

**Architecture:** Data-only addition. A new `ja-kana.ts` layout file in each package, registered in the built-in layout maps. The `ja-romaji` layout gets a toggle key. No renderer, CSS, or type changes needed.

**Tech Stack:** TypeScript, Vitest (WebC unit tests), @open-wc/testing (WebC component tests), QUnit + WDIO (UI5 tests), Playwright (e2e visual regression)

**Spec:** `docs/proposals/JA-KANA.md`

---

## Task 1: Create ja-kana layout file (WebC)

**Files:**
- Create: `packages/kiosk-keyboard-webc/src/layouts/ja-kana.ts`

- [ ] **Step 1: Create the layout file**

Create `packages/kiosk-keyboard-webc/src/layouts/ja-kana.ts`:

```typescript
import type { LayoutDefinition } from "../types.js";

/**
 * Japanese kana direct-input layout following JIS X 6002.
 *
 * Each key produces a hiragana character directly. The shift layer provides
 * small kana on the same key as their full-size counterpart (JIS standard),
 * and JIS punctuation variants on row 4. Dakuten and handakuten are on the
 * base layer at their standard JIS positions (row 2, after せ).
 *
 * Digits are accessible via the `{layout:numeric}` switch on row 5.
 *
 * @see {@link https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/fe_kbds/jpn/106/kbd106.c | Microsoft kbd106.c}
 * @public
 */
const jaKana: LayoutDefinition = [
  // Row 1: number row -- kana base, small kana / を on shift
  [
    { value: "\u306C" },                                   // ぬ (1)
    { value: "\u3075" },                                   // ふ (2)
    { value: "\u3042", shiftValue: "\u3041" },             // あ → ぁ (3)
    { value: "\u3046", shiftValue: "\u3045" },             // う → ぅ (4)
    { value: "\u3048", shiftValue: "\u3047" },             // え → ぇ (5)
    { value: "\u304A", shiftValue: "\u3049" },             // お → ぉ (6)
    { value: "\u3084", shiftValue: "\u3083" },             // や → ゃ (7)
    { value: "\u3086", shiftValue: "\u3085" },             // ゆ → ゅ (8)
    { value: "\u3088", shiftValue: "\u3087" },             // よ → ょ (9)
    { value: "\u308F", shiftValue: "\u3092" },             // わ → を (0)
    { value: "\u307B" },                                   // ほ (-)
    { value: "{backspace}", width: "1.5", type: "action" },
  ],
  // Row 2: upper letter row + dakuten/handakuten at JIS positions
  [
    { value: "\u305F" },                                   // た (Q)
    { value: "\u3066" },                                   // て (W)
    { value: "\u3044", shiftValue: "\u3043" },             // い → ぃ (E)
    { value: "\u3059" },                                   // す (R)
    { value: "\u304B" },                                   // か (T)
    { value: "\u3093" },                                   // ん (Y)
    { value: "\u306A" },                                   // な (U)
    { value: "\u306B" },                                   // に (I)
    { value: "\u3089" },                                   // ら (O)
    { value: "\u305B" },                                   // せ (P)
    { value: "\u309B", type: "modifier" },                 // ゛ dakuten (@ on JIS)
    { value: "\u309C", type: "modifier" },                 // ゜ handakuten ([ on JIS)
  ],
  // Row 3: home row + JIS extra keys
  [
    { value: "\u3061" },                                   // ち (A)
    { value: "\u3068" },                                   // と (S)
    { value: "\u3057" },                                   // し (D)
    { value: "\u306F" },                                   // は (F)
    { value: "\u304D" },                                   // き (G)
    { value: "\u304F" },                                   // く (H)
    { value: "\u307E" },                                   // ま (J)
    { value: "\u306E" },                                   // の (K)
    { value: "\u308A" },                                   // り (L)
    { value: "\u308C" },                                   // れ (; on JIS)
    { value: "\u3051" },                                   // け (: on JIS)
    { value: "\u3080" },                                   // む (] on JIS)
  ],
  // Row 4: lower row + shift/enter + JIS punctuation shifts
  [
    { value: "{shift}", width: "1.5", type: "modifier" },
    { value: "\u3064", shiftValue: "\u3063" },             // つ → っ (Z)
    { value: "\u3055" },                                   // さ (X)
    { value: "\u305D" },                                   // そ (C)
    { value: "\u3072" },                                   // ひ (V)
    { value: "\u3053" },                                   // こ (B)
    { value: "\u307F" },                                   // み (N)
    { value: "\u3082" },                                   // も (M)
    { value: "\u306D", shiftValue: "\u3001" },             // ね → 、 (,)
    { value: "\u308B", shiftValue: "\u3002" },             // る → 。 (.)
    { value: "\u3081", shiftValue: "\u30FB" },             // め → ・ (/)
    { value: "{enter}", width: "1.5", type: "action" },
  ],
  // Row 5: bottom row
  [
    { value: "{layout:numeric}", label: "123", width: "1.5", type: "modifier" },
    { value: "{layout:ja-romaji}", label: "\u30ED\u30FC\u30DE\u5B57", type: "modifier" }, // ローマ字
    { value: " ", width: "space", type: "space" },
    { value: "\u30FC" },                                   // ー prolonged sound mark
    { value: "\u3002" },                                   // 。 period (convenience)
    { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" },
  ],
];

export default jaKana;
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd packages/kiosk-keyboard-webc && npx tsc --noEmit
```

Expected: Clean (file is not imported yet, so no effect, but syntax should be valid).

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/layouts/ja-kana.ts
git commit -m "feat(webc): add JIS kana direct-input layout definition"
```

---

## Task 2: Create ja-kana layout file (UI5)

**Files:**
- Create: `packages/kiosk-keyboard/src/layouts/ja-kana.ts`

- [ ] **Step 1: Create the layout file**

Create `packages/kiosk-keyboard/src/layouts/ja-kana.ts` with the same layout data as Task 1, but with UI5 import style:

```typescript
import type { LayoutDefinition } from "../types";

/**
 * Japanese kana direct-input layout following JIS X 6002.
 *
 * Each key produces a hiragana character directly. The shift layer provides
 * small kana on the same key as their full-size counterpart (JIS standard),
 * and JIS punctuation variants on row 4. Dakuten and handakuten are on the
 * base layer at their standard JIS positions (row 2, after せ).
 *
 * Digits are accessible via the `{layout:numeric}` switch on row 5.
 *
 * @see {@link https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/fe_kbds/jpn/106/kbd106.c | Microsoft kbd106.c}
 * @public
 */
const jaKana: LayoutDefinition = [
  // Row 1: number row -- kana base, small kana / を on shift
  [
    { value: "\u306C" },                                   // ぬ (1)
    { value: "\u3075" },                                   // ふ (2)
    { value: "\u3042", shiftValue: "\u3041" },             // あ → ぁ (3)
    { value: "\u3046", shiftValue: "\u3045" },             // う → ぅ (4)
    { value: "\u3048", shiftValue: "\u3047" },             // え → ぇ (5)
    { value: "\u304A", shiftValue: "\u3049" },             // お → ぉ (6)
    { value: "\u3084", shiftValue: "\u3083" },             // や → ゃ (7)
    { value: "\u3086", shiftValue: "\u3085" },             // ゆ → ゅ (8)
    { value: "\u3088", shiftValue: "\u3087" },             // よ → ょ (9)
    { value: "\u308F", shiftValue: "\u3092" },             // わ → を (0)
    { value: "\u307B" },                                   // ほ (-)
    { value: "{backspace}", width: "1.5", type: "action" },
  ],
  // Row 2: upper letter row + dakuten/handakuten at JIS positions
  [
    { value: "\u305F" },                                   // た (Q)
    { value: "\u3066" },                                   // て (W)
    { value: "\u3044", shiftValue: "\u3043" },             // い → ぃ (E)
    { value: "\u3059" },                                   // す (R)
    { value: "\u304B" },                                   // か (T)
    { value: "\u3093" },                                   // ん (Y)
    { value: "\u306A" },                                   // な (U)
    { value: "\u306B" },                                   // に (I)
    { value: "\u3089" },                                   // ら (O)
    { value: "\u305B" },                                   // せ (P)
    { value: "\u309B", type: "modifier" },                 // ゛ dakuten (@ on JIS)
    { value: "\u309C", type: "modifier" },                 // ゜ handakuten ([ on JIS)
  ],
  // Row 3: home row + JIS extra keys
  [
    { value: "\u3061" },                                   // ち (A)
    { value: "\u3068" },                                   // と (S)
    { value: "\u3057" },                                   // し (D)
    { value: "\u306F" },                                   // は (F)
    { value: "\u304D" },                                   // き (G)
    { value: "\u304F" },                                   // く (H)
    { value: "\u307E" },                                   // ま (J)
    { value: "\u306E" },                                   // の (K)
    { value: "\u308A" },                                   // り (L)
    { value: "\u308C" },                                   // れ (; on JIS)
    { value: "\u3051" },                                   // け (: on JIS)
    { value: "\u3080" },                                   // む (] on JIS)
  ],
  // Row 4: lower row + shift/enter + JIS punctuation shifts
  [
    { value: "{shift}", width: "1.5", type: "modifier" },
    { value: "\u3064", shiftValue: "\u3063" },             // つ → っ (Z)
    { value: "\u3055" },                                   // さ (X)
    { value: "\u305D" },                                   // そ (C)
    { value: "\u3072" },                                   // ひ (V)
    { value: "\u3053" },                                   // こ (B)
    { value: "\u307F" },                                   // み (N)
    { value: "\u3082" },                                   // も (M)
    { value: "\u306D", shiftValue: "\u3001" },             // ね → 、 (,)
    { value: "\u308B", shiftValue: "\u3002" },             // る → 。 (.)
    { value: "\u3081", shiftValue: "\u30FB" },             // め → ・ (/)
    { value: "{enter}", width: "1.5", type: "action" },
  ],
  // Row 5: bottom row
  [
    { value: "{layout:numeric}", label: "123", width: "1.5", type: "modifier" },
    { value: "{layout:ja-romaji}", label: "\u30ED\u30FC\u30DE\u5B57", type: "modifier" }, // ローマ字
    { value: " ", width: "space", type: "space" },
    { value: "\u30FC" },                                   // ー prolonged sound mark
    { value: "\u3002" },                                   // 。 period (convenience)
    { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" },
  ],
];

export default jaKana;
```

- [ ] **Step 2: Commit**

```bash
git add packages/kiosk-keyboard/src/layouts/ja-kana.ts
git commit -m "feat(ui5): add JIS kana direct-input layout definition"
```

---

## Task 3: Register ja-kana in both layout registries

**Files:**
- Modify: `packages/kiosk-keyboard-webc/src/layouts/index.ts`
- Modify: `packages/kiosk-keyboard/src/internal/layout-registry.ts`
- Modify: `packages/kiosk-keyboard/src/library.ts`

- [ ] **Step 1: Register in WebC layout index**

In `packages/kiosk-keyboard-webc/src/layouts/index.ts`, add the import after the `jaRomaji` import:

```typescript
import jaKana from "./ja-kana.js";
```

And add the entry to the map after `["ja-romaji", jaRomaji]`:

```typescript
  ["ja-kana", jaKana],
```

- [ ] **Step 2: Register in UI5 layout registry**

In `packages/kiosk-keyboard/src/internal/layout-registry.ts`, add the import after the `jaRomaji` import:

```typescript
import jaKana from "../layouts/ja-kana";
```

And add the entry to the `layouts` map after `["ja-romaji", jaRomaji]`:

```typescript
  ["ja-kana", jaKana],
```

- [ ] **Step 3: Add to UI5 KeyboardLayout enum**

In `packages/kiosk-keyboard/src/library.ts`, add after the `JaRomaji` entry:

```typescript
  /** Japanese Kana direct-input layout (JIS X 6002). */
  JaKana: "ja-kana",
```

- [ ] **Step 4: Verify TypeScript compilation in both packages**

```bash
cd packages/kiosk-keyboard-webc && npx tsc --noEmit
cd ../kiosk-keyboard && npx tsc --noEmit
```

Expected: Both compile clean.

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/layouts/index.ts \
  packages/kiosk-keyboard/src/internal/layout-registry.ts \
  packages/kiosk-keyboard/src/library.ts
git commit -m "feat: register ja-kana as built-in layout in both packages"
```

---

## Task 4: Add layout toggle key to ja-romaji

**Files:**
- Modify: `packages/kiosk-keyboard-webc/src/layouts/ja-romaji.ts`
- Modify: `packages/kiosk-keyboard/src/layouts/ja-romaji.ts`

- [ ] **Step 1: Update WebC ja-romaji row 5**

In `packages/kiosk-keyboard-webc/src/layouts/ja-romaji.ts`, replace the `{layout:fkeys}` entry in row 5:

```typescript
    {
      value: "{layout:fkeys}",
      label: "Fn",
      width: "1.5",
      type: "modifier",
    },
```

With:

```typescript
    {
      value: "{layout:ja-kana}",
      label: "\u304B\u306A", // かな
      width: "1.5",
      type: "modifier",
    },
```

- [ ] **Step 2: Update UI5 ja-romaji row 5**

Same change in `packages/kiosk-keyboard/src/layouts/ja-romaji.ts`:

Replace the `{layout:fkeys}` entry with:

```typescript
    {
      value: "{layout:ja-kana}",
      label: "\u304B\u306A", // かな
      width: "1.5",
      type: "modifier",
    },
```

- [ ] **Step 3: Run WebC component tests**

```bash
cd packages/kiosk-keyboard-webc && npm run test:component
```

Expected: All existing tests pass (no ja-romaji-specific tests depend on the Fn key).

- [ ] **Step 4: Commit**

```bash
git add packages/kiosk-keyboard-webc/src/layouts/ja-romaji.ts \
  packages/kiosk-keyboard/src/layouts/ja-romaji.ts
git commit -m "feat: add kana toggle key to ja-romaji layout in both packages"
```

---

## Task 5: WebC unit tests for ja-kana layout structure

**Files:**
- Create: `packages/kiosk-keyboard-webc/test/unit/ja-kana-layout.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from "vitest";
import jaKana from "../../src/layouts/ja-kana.js";

describe("ja-kana layout structure", () => {
  it("has exactly 5 rows", () => {
    expect(jaKana).toHaveLength(5);
  });

  it("row 1 has 12 keys (10 kana + ほ + backspace)", () => {
    expect(jaKana[0]).toHaveLength(12);
  });

  it("row 2 has 12 keys (10 kana + dakuten + handakuten)", () => {
    expect(jaKana[1]).toHaveLength(12);
  });

  it("row 3 has 12 keys (10 kana + け + む)", () => {
    expect(jaKana[2]).toHaveLength(12);
  });

  it("row 4 has 12 keys (shift + 9 kana + enter)", () => {
    // shift, つ, さ, そ, ひ, こ, み, も, ね, る, め, enter
    expect(jaKana[3]).toHaveLength(12);
  });

  it("row 5 has 6 keys", () => {
    expect(jaKana[4]).toHaveLength(6);
  });

  it("all base-layer values are hiragana, special keys, or punctuation", () => {
    const hiraganaRange = /^[\u3040-\u309F]$/;
    const specialKeys = new Set(["{backspace}", "{enter}", "{shift}", " "]);
    const punctuation = new Set(["\u309B", "\u309C", "\u30FC", "\u3002"]); // ゛゜ー。
    const layoutKeys = new Set(["{layout:numeric}", "{layout:ja-romaji}", "{layout:fkeys}"]);

    for (const row of jaKana) {
      for (const key of row) {
        const v = key.value;
        const isValid =
          hiraganaRange.test(v) ||
          specialKeys.has(v) ||
          punctuation.has(v) ||
          layoutKeys.has(v);
        expect(isValid, `key value "${v}" (U+${v.codePointAt(0)?.toString(16)}) should be valid`).toBe(true);
      }
    }
  });

  it("small kana shift variants are on the correct keys", () => {
    const expectedShifts: Record<string, string> = {
      "\u3042": "\u3041", // あ → ぁ
      "\u3046": "\u3045", // う → ぅ
      "\u3048": "\u3047", // え → ぇ
      "\u304A": "\u3049", // お → ぉ
      "\u3084": "\u3083", // や → ゃ
      "\u3086": "\u3085", // ゆ → ゅ
      "\u3088": "\u3087", // よ → ょ
      "\u308F": "\u3092", // わ → を
      "\u3044": "\u3043", // い → ぃ
      "\u3064": "\u3063", // つ → っ
    };

    const allKeys = jaKana.flat();
    for (const [base, expectedSmall] of Object.entries(expectedShifts)) {
      const key = allKeys.find((k) => k.value === base);
      expect(key, `key for ${base} should exist`).toBeDefined();
      expect(key!.shiftValue, `shift of ${base} should be ${expectedSmall}`).toBe(expectedSmall);
    }
  });

  it("dakuten and handakuten are on the base layer", () => {
    const allKeys = jaKana.flat();
    const dakuten = allKeys.find((k) => k.value === "\u309B");
    const handakuten = allKeys.find((k) => k.value === "\u309C");
    expect(dakuten, "dakuten key exists").toBeDefined();
    expect(handakuten, "handakuten key exists").toBeDefined();
  });

  it("has layout toggle pointing to ja-romaji", () => {
    const allKeys = jaKana.flat();
    const toggle = allKeys.find((k) => k.value === "{layout:ja-romaji}");
    expect(toggle, "ja-romaji toggle key exists").toBeDefined();
    expect(toggle!.type).toBe("modifier");
  });

  it("has backspace, enter, shift, and space with correct types", () => {
    const allKeys = jaKana.flat();
    expect(allKeys.find((k) => k.value === "{backspace}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{enter}")!.type).toBe("action");
    expect(allKeys.find((k) => k.value === "{shift}")!.type).toBe("modifier");
    expect(allKeys.find((k) => k.value === " ")!.type).toBe("space");
  });

  it("row 4 punctuation keys have JIS shift variants", () => {
    const row4 = jaKana[3];
    const ne = row4.find((k) => k.value === "\u306D"); // ね
    const ru = row4.find((k) => k.value === "\u308B"); // る
    const me = row4.find((k) => k.value === "\u3081"); // め
    expect(ne!.shiftValue).toBe("\u3001"); // 、
    expect(ru!.shiftValue).toBe("\u3002"); // 。
    expect(me!.shiftValue).toBe("\u30FB"); // ・
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd packages/kiosk-keyboard-webc && npm run test -- --run test/unit/ja-kana-layout.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/unit/ja-kana-layout.test.ts
git commit -m "test(webc): add unit tests for ja-kana layout structure"
```

---

## Task 6: UI5 QUnit tests for ja-kana layout

**Files:**
- Modify: `packages/kiosk-keyboard/test/qunit/KioskKeyboard-layout.qunit.ts`

- [ ] **Step 1: Add ja-kana layout tests**

At the end of `packages/kiosk-keyboard/test/qunit/KioskKeyboard-layout.qunit.ts`, add:

```typescript
// ──────────────────────────────────────────────
// ja-kana layout
// ──────────────────────────────────────────────

QUnit.test("ja-kana layout renders 5 rows with correct key counts", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const rows = getRowElements(kb);
  assert.strictEqual(rows.length, 5, "ja-kana has 5 rows");
  assert.strictEqual(getRowKeyValues(kb, 0).length, 12, "Row 1 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 1).length, 12, "Row 2 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 2).length, 12, "Row 3 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 3).length, 12, "Row 4 has 12 keys");
  assert.strictEqual(getRowKeyValues(kb, 4).length, 6, "Row 5 has 6 keys");
  kb.destroy();
});

QUnit.test("ja-kana first key is ぬ (hiragana nu)", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  assert.strictEqual(getRowKeyValues(kb, 0)[0], "\u306C", "First key is ぬ");
  kb.destroy();
});

QUnit.test("ja-kana has dakuten and handakuten on base layer", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const allKeys = getRowKeyValues(kb, 1);
  assert.ok(allKeys.includes("\u309B"), "Row 2 contains dakuten ゛");
  assert.ok(allKeys.includes("\u309C"), "Row 2 contains handakuten ゜");
  kb.destroy();
});

QUnit.test("ja-kana has layout toggle to ja-romaji", async (assert) => {
  const kb = new KioskKeyboard({ layout: "ja-kana" });
  await placeAndWait(kb);
  const row5Keys = getRowKeyValues(kb, 4);
  assert.ok(row5Keys.includes("{layout:ja-romaji}"), "Row 5 contains ja-romaji toggle");
  kb.destroy();
});
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd packages/kiosk-keyboard && npx tsc --noEmit
```

Expected: Clean compilation.

- [ ] **Step 3: Commit**

```bash
git add packages/kiosk-keyboard/test/qunit/KioskKeyboard-layout.qunit.ts
git commit -m "test(ui5): add QUnit tests for ja-kana layout structure"
```

---

## Task 7: Add visual test fixtures

**Files:**
- Modify: `packages/kiosk-keyboard-webc/test/pages/visual.html`
- Modify: `packages/kiosk-keyboard-webc/test/e2e/visual.test.ts`
- Modify: `packages/kiosk-keyboard/test/e2e/visual/index.html`
- Modify: `packages/kiosk-keyboard/test/e2e/visual/init.js`
- Modify: `packages/kiosk-keyboard/test/e2e/visual.test.ts`

- [ ] **Step 1: Add WebC visual test page section**

In `packages/kiosk-keyboard-webc/test/pages/visual.html`, add before the closing `</body>`:

```html
    <div class="section">
      <h2>31. Japanese Kana</h2>
      <kiosk-keyboard id="kb-ja-kana" layout="ja-kana"></kiosk-keyboard>
    </div>
```

- [ ] **Step 2: Add WebC visual test**

In `packages/kiosk-keyboard-webc/test/e2e/visual.test.ts`, add after the Japanese Romaji test:

```typescript
  it("should match Japanese Kana layout", async () => {
    const kb = await getKeyboardRoot("kb-ja-kana");
    await matchElementSnapshotInSection(kb, "webc-ja-kana");
  });
```

- [ ] **Step 3: Add UI5 visual test page section**

In `packages/kiosk-keyboard/test/e2e/visual/index.html`, add after the ja-romaji section:

```html
      <h2>Japanese Kana</h2>
      <div class="keyboard-container" id="kb-ja-kana"></div>
```

- [ ] **Step 4: Add UI5 visual test init**

In `packages/kiosk-keyboard/test/e2e/visual/init.js`, add after the ja-romaji instantiation:

```javascript
  new KioskKeyboard({ layout: "ja-kana" }).placeAt("kb-ja-kana");
```

- [ ] **Step 5: Add UI5 visual test**

In `packages/kiosk-keyboard/test/e2e/visual.test.ts`, add after the Japanese Romaji test:

```typescript
  it("should match Japanese Kana layout", async () => {
    const kb = await getKeyboard("kb-ja-kana");
    await matchElementSnapshotInSection(kb, "kb-ja-kana");
  });
```

- [ ] **Step 6: Commit**

```bash
git add packages/kiosk-keyboard-webc/test/pages/visual.html \
  packages/kiosk-keyboard-webc/test/e2e/visual.test.ts \
  packages/kiosk-keyboard/test/e2e/visual/index.html \
  packages/kiosk-keyboard/test/e2e/visual/init.js \
  packages/kiosk-keyboard/test/e2e/visual.test.ts
git commit -m "test: add visual regression fixtures for ja-kana layout"
```

---

## Task 8: Update documentation

**Files:**
- Modify: `packages/kiosk-keyboard/README.md`
- Modify: `packages/kiosk-keyboard-webc/README.md`
- Modify: `docs/kiosk/ARCHITECTURE.md`
- Modify: `docs/kiosk-webc/ARCHITECTURE.md`

- [ ] **Step 1: Update UI5 README**

Add `ja-kana` to the layout table (after `ja-romaji`):

```markdown
| `ja-kana`       | Japanese Kana direct-input (JIS X 6002)              | 5    |
```

Add to the `KeyboardLayout` enum documentation:

```markdown
KeyboardLayout.JaKana; // "ja-kana"
```

- [ ] **Step 2: Update WebC README**

Add `ja-kana` to the layout table (after `ja-romaji`):

```markdown
| `ja-kana`       | Japanese Kana direct-input (JIS X 6002)              |
```

Update the locale-aware description to mention kana:

```markdown
- **Locale-aware**: auto-selects layout based on browser locale (e.g. `de` → `qwertz-de`, `ja` → `ja-romaji`, `ar` → `arabic`). Use `registerLocaleLayout("ja", "ja-kana")` to switch the Japanese default to kana input.
```

Add `ja-kana.ts` to the file tree.

- [ ] **Step 3: Update kiosk ARCHITECTURE.md**

Add `ja-kana.ts` to both file tree listings (lines ~44 and ~596):

```
  ja-kana.ts              Japanese Kana direct-input layout (JIS X 6002)
```

- [ ] **Step 4: Update kiosk-webc ARCHITECTURE.md**

Add `ja-kana.ts` to the file tree listing (line ~40):

```
  ja-kana.ts              Japanese Kana direct-input layout (JIS X 6002)
```

- [ ] **Step 5: Commit**

```bash
git add packages/kiosk-keyboard/README.md \
  packages/kiosk-keyboard-webc/README.md \
  docs/kiosk/ARCHITECTURE.md \
  docs/kiosk-webc/ARCHITECTURE.md
git commit -m "docs: document ja-kana layout in READMEs and architecture docs"
```

---

## Task 9: Run full test suite and verify

- [ ] **Step 1: Run WebC unit tests**

```bash
cd packages/kiosk-keyboard-webc && npm run test
```

Expected: All tests pass including new ja-kana tests.

- [ ] **Step 2: Run WebC component tests**

```bash
cd packages/kiosk-keyboard-webc && npm run test:component
```

Expected: All tests pass.

- [ ] **Step 3: Verify UI5 TypeScript compilation**

```bash
cd packages/kiosk-keyboard && npx tsc --noEmit
```

Expected: Clean compilation.
