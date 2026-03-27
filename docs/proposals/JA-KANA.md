# Japanese Kana Direct-Input Keyboard Layout

Design spec for [#35](https://github.com/wridgeu/ui5-lib-keyboard/issues/35).

## Scope

Add a `ja-kana` built-in layout where each key press produces a hiragana character directly, following the JIS X 6002 kana key mapping. Both packages (`kiosk-keyboard` and `kiosk-keyboard-webc`) receive identical layout data.

### In scope

- Hiragana characters mapped to keys per JIS X 6002
- Shift layer: small kana, digits on number row, additional kana
- Dakuten (゛) and handakuten (゜) as dedicated base-layer keys (touch-friendly)
- Layout registered as built-in `ja-kana` in both packages
- Layout toggle keys between `ja-kana` and `ja-romaji`
- UI5 `KeyboardLayout` enum addition
- README and ARCHITECTURE.md updates
- Unit, component, and visual regression tests

### Out of scope

- IME / candidate selection (fundamentally different feature)
- Composed variants (`ja-kana-fk`, `ja-kana-nav`) -- consumers compose their own via exported row modules
- Changing the default locale mapping (`"ja"` stays mapped to `ja-romaji`)
- Katakana layout (separate feature if needed)

## Approach

Data-only addition. The layout is a `LayoutDefinition` (array of `KeyRow`) following the same patterns as `ja-romaji`, `qwerty`, and `arabic`. No renderer, CSS, or type changes are required.

## Locale Mapping

The `"ja"` locale continues to resolve to `ja-romaji` (romaji is the more common virtual keyboard input method). Consumers who want kana as the default use:

```ts
KioskKeyboard.registerLocaleLayout("ja", "ja-kana");
```

Or set `layout="ja-kana"` explicitly on the component.

## Layout Toggle

Both layouts get a toggle key to switch between them at runtime:

- `ja-kana` row 5: `{ value: "{layout:ja-romaji}", label: "ローマ字", type: "modifier" }`
- `ja-romaji` row 5: `{ value: "{layout:ja-kana}", label: "かな", type: "modifier" }` (replaces the `{layout:fkeys}` Fn key position)

## Layout Definition

5 rows following JIS X 6002 kana mapping. The number row produces kana on the base layer and digits on the shift layer.

### Row 1 (Number Row)

| Position | Base (kana) | Shift (digit/symbol) |
| -------- | ----------- | -------------------- |
| 1        | ぬ          | 1                    |
| 2        | ふ          | 2                    |
| 3        | あ          | 3                    |
| 4        | う          | 4                    |
| 5        | え          | 5                    |
| 6        | お          | 6                    |
| 7        | や          | 7                    |
| 8        | ゆ          | 8                    |
| 9        | よ          | 9                    |
| 10       | わ          | 0                    |
| 11       | {backspace} | (action key)         |

### Row 2 (Upper Letter Row)

| Position | Base | Shift |
| -------- | ---- | ----- |
| 1        | た   | --    |
| 2        | て   | --    |
| 3        | い   | ぃ    |
| 4        | す   | --    |
| 5        | か   | --    |
| 6        | ん   | --    |
| 7        | な   | --    |
| 8        | に   | --    |
| 9        | ら   | --    |
| 10       | せ   | を    |

### Row 3 (Home Row)

| Position | Base | Shift |
| -------- | ---- | ----- |
| 1        | ち   | --    |
| 2        | と   | --    |
| 3        | し   | --    |
| 4        | は   | --    |
| 5        | き   | --    |
| 6        | く   | --    |
| 7        | ま   | --    |
| 8        | の   | --    |
| 9        | り   | --    |
| 10       | れ   | --    |

### Row 4 (Lower Row)

| Position | Base    | Shift |
| -------- | ------- | ----- |
| 1        | {shift} | --    |
| 2        | つ      | っ    |
| 3        | さ      | ゃ    |
| 4        | そ      | ゅ    |
| 5        | ひ      | ょ    |
| 6        | こ      | ぁ    |
| 7        | み      | ぃ    |
| 8        | も      | ぅ    |
| 9        | ね      | ぇ    |
| 10       | {enter} | --    |

Small kana (っ, ゃ, ゅ, ょ, ぁ, ぃ, ぅ, ぇ) are placed on the shift layer of row 4. This keeps the number row's shift layer free for digits.

### Row 5 (Bottom Row)

| Position | Key                           | Type     |
| -------- | ----------------------------- | -------- |
| 1        | {layout:numeric} "123"        | modifier |
| 2        | {layout:ja-romaji} "ローマ字" | modifier |
| 3        | ゛ (dakuten)                  | modifier |
| 4        | ゜ (handakuten)               | modifier |
| 5        | (space)                       | space    |
| 6        | 。 (period)                   | default  |
| 7        | {layout:fkeys} "Fn"           | modifier |

### Touch-Friendly Addition

Dakuten (゛) and handakuten (゜) are placed on the base layer as dedicated keys instead of requiring shift. This is a deliberate deviation from physical JIS keyboards, where these marks share keys with other characters. On a touchscreen, having them always visible eliminates the shift-tap-shift cycle that makes voicing mark input tedious.

The keyboard does not perform composition (combining か + ゛ into が). It produces the standalone combining marks (U+309B, U+309C) as character output. The consuming application or input method handles composition if needed.

### Shift Layer: Small Kana

The shift layer provides small kana variants on row 4, and digits on row 1:

**Row 4 shift (small kana):**

| Base | Shift |
| ---- | ----- |
| つ   | っ    |
| さ   | ゃ    |
| そ   | ゅ    |
| ひ   | ょ    |
| こ   | ぁ    |
| み   | ぃ    |
| も   | ぅ    |
| ね   | ぇ    |

**Row 1 shift (digits):**

| Base | Shift |
| ---- | ----- |
| ぬ   | 1     |
| ふ   | 2     |
| あ   | 3     |
| う   | 4     |
| え   | 5     |
| お   | 6     |
| や   | 7     |
| ゆ   | 8     |
| よ   | 9     |
| わ   | 0     |

**Row 2 shift:** を on せ position (`{ value: "せ", shiftValue: "を" }`).

Keys on rows 2-3 without shift variants produce no shift output.

## Changes to ja-romaji

Add a layout toggle key on row 5 to switch to `ja-kana`. Replace the `Fn` key position:

```ts
// Before:
{ value: "{layout:fkeys}", label: "Fn", type: "modifier" }

// After:
{ value: "{layout:ja-kana}", label: "かな", type: "modifier" }
```

This applies to both packages.

## File Map

### New Files

| File                     | Package | Description                |
| ------------------------ | ------- | -------------------------- |
| `src/layouts/ja-kana.ts` | Both    | JIS kana layout definition |

### Modified Files

| File                              | Package      | Change                             |
| --------------------------------- | ------------ | ---------------------------------- |
| `src/layouts/ja-romaji.ts`        | Both         | Add `{layout:ja-kana}` toggle key  |
| `src/layouts/index.ts`            | WebC         | Register `ja-kana` in built-in map |
| `src/internal/layout-registry.ts` | UI5          | Register `ja-kana` in built-in map |
| `src/library.ts`                  | UI5          | Add `JaKana: "ja-kana"` to enum    |
| `README.md`                       | Both         | Document ja-kana layout            |
| `ARCHITECTURE.md`                 | Both (docs/) | Add ja-kana to layout lists        |

### Test Files

| File                                                        | Package | Description                  |
| ----------------------------------------------------------- | ------- | ---------------------------- |
| `test/unit/ja-kana.test.ts` or `test/qunit/JaKana.qunit.ts` | Both    | Layout structure validation  |
| `test/component/` or `test/qunit/`                          | Both    | Layout switching integration |
| `test/e2e/`                                                 | Both    | Visual regression baselines  |

## Testing Strategy

### Unit Tests

- Layout has exactly 5 rows
- Each row has the expected number of keys
- All base-layer values are valid hiragana, special keys, or punctuation
- Shift variants are correct small kana
- Dakuten and handakuten keys exist on base layer
- Layout toggle key points to `ja-romaji`
- Backspace, enter, shift, space keys present with correct types

### Component Tests

- Switching from `ja-romaji` to `ja-kana` via toggle key renders kana layout
- Switching back from `ja-kana` to `ja-romaji` restores romaji layout
- Pressing a kana key fires `key-press` event with the hiragana character
- Shift layer shows small kana variants
- Dakuten/handakuten keys fire events with combining marks

### Visual Regression

- Baseline screenshot for `ja-kana` layout (desktop + device profiles)
- Shifted state screenshot showing small kana
