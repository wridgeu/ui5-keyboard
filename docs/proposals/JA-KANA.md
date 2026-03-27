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

5 rows following JIS X 6002 kana mapping. Rows 2-4 have 11-12 keys each (wider than QWERTY) to accommodate the extra kana positions present on the JIS 106-key keyboard. The renderer handles this naturally via flexbox.

Reference: [Microsoft kbd106.c driver source](https://github.com/microsoft/Windows-driver-samples/blob/main/input/layout/fe_kbds/jpn/106/kbd106.c) (authoritative JIS X 6002 implementation).

### Row 1 (Number Row) -- 12 keys

Kana on base layer, digits on shift. Small kana on shift where the base is the full-size counterpart (per JIS: Shift on the same key gives the small version).

| Pos | Base        | Shift | JIS key  |
| --- | ----------- | ----- | -------- |
| 1   | ぬ          | 1     | 1        |
| 2   | ふ          | 2     | 2        |
| 3   | あ          | ぁ    | 3        |
| 4   | う          | ぅ    | 4        |
| 5   | え          | ぇ    | 5        |
| 6   | お          | ぉ    | 6        |
| 7   | や          | ゃ    | 7        |
| 8   | ゆ          | ゅ    | 8        |
| 9   | よ          | ょ    | 9        |
| 10  | わ          | を    | 0        |
| 11  | ほ          | --    | -        |
| 12  | {backspace} | --    | (action) |

Note: the number row shift layer produces small kana (ぁ, ぅ, ぇ, ぉ, ゃ, ゅ, ょ, を) per JIS, **not** digits. Digits are accessible via the `{layout:numeric}` switch on row 5. This is faithful to JIS where the number row in kana mode is fully dedicated to kana input.

### Row 2 (Upper Letter Row) -- 12 keys

| Pos | Base | Shift | JIS key |
| --- | ---- | ----- | ------- |
| 1   | た   | --    | Q       |
| 2   | て   | --    | W       |
| 3   | い   | ぃ    | E       |
| 4   | す   | --    | R       |
| 5   | か   | --    | T       |
| 6   | ん   | --    | Y       |
| 7   | な   | --    | U       |
| 8   | に   | --    | I       |
| 9   | ら   | --    | O       |
| 10  | せ   | --    | P       |
| 11  | ゛   | --    | @ (JIS) |
| 12  | ゜   | --    | [ (JIS) |

Dakuten (゛) and handakuten (゜) are on their standard JIS positions (after P). This is also the touch-friendly placement -- they are always visible on the base layer without needing shift.

### Row 3 (Home Row) -- 12 keys

| Pos | Base | Shift | JIS key |
| --- | ---- | ----- | ------- |
| 1   | ち   | --    | A       |
| 2   | と   | --    | S       |
| 3   | し   | --    | D       |
| 4   | は   | --    | F       |
| 5   | き   | --    | G       |
| 6   | く   | --    | H       |
| 7   | ま   | --    | J       |
| 8   | の   | --    | K       |
| 9   | り   | --    | L       |
| 10  | れ   | --    | ; (JIS) |
| 11  | け   | --    | : (JIS) |
| 12  | む   | --    | ] (JIS) |

### Row 4 (Lower Row) -- 12 keys

| Pos | Base    | Shift | JIS key |
| --- | ------- | ----- | ------- |
| 1   | {shift} | --    | Shift   |
| 2   | つ      | っ    | Z       |
| 3   | さ      | --    | X       |
| 4   | そ      | --    | C       |
| 5   | ひ      | --    | V       |
| 6   | こ      | --    | B       |
| 7   | み      | --    | N       |
| 8   | も      | --    | M       |
| 9   | ね      | 、    | , (JIS) |
| 10  | る      | 。    | . (JIS) |
| 11  | め      | ・    | / (JIS) |
| 12  | {enter} | --    | Enter   |

Shift+comma (ね) produces 、 (ideographic comma), Shift+period (る) produces 。 (ideographic period), Shift+slash (め) produces ・ (middle dot) -- matching JIS.

### Row 5 (Bottom Row) -- 6 keys

| Pos | Key                           | Type     |
| --- | ----------------------------- | -------- |
| 1   | {layout:numeric} "123"        | modifier |
| 2   | {layout:ja-romaji} "ローマ字" | modifier |
| 3   | (space)                       | space    |
| 4   | ー (prolonged sound mark)     | default  |
| 5   | 。 (period, convenience)      | default  |
| 6   | {layout:fkeys} "Fn"           | modifier |

The prolonged sound mark (ー, U+30FC) is included as a convenience key since it is frequently needed in Japanese input. The 。 key provides quick access to the ideographic period without shift.

### Shift Layer Summary

Small kana are on the **same key as their full-size counterpart** (standard JIS behavior):

| Key position  | Base | Shift |
| ------------- | ---- | ----- |
| Row 1, pos 3  | あ   | ぁ    |
| Row 1, pos 4  | う   | ぅ    |
| Row 1, pos 5  | え   | ぇ    |
| Row 1, pos 6  | お   | ぉ    |
| Row 1, pos 7  | や   | ゃ    |
| Row 1, pos 8  | ゆ   | ゅ    |
| Row 1, pos 9  | よ   | ょ    |
| Row 1, pos 10 | わ   | を    |
| Row 2, pos 3  | い   | ぃ    |
| Row 4, pos 2  | つ   | っ    |

Row 4 punctuation keys produce their JIS shift variants (、, 。, ・). All other keys have no shift variant.

### Touch-Friendly Design

Dakuten (゛) and handakuten (゜) appear on the base layer at their JIS positions (row 2, after せ). On a physical keyboard these require knowing the JIS-specific key positions; on the virtual keyboard they are always visible and tappable.

The keyboard produces standalone combining marks (U+309B, U+309C) as character output. The consuming application handles composition (e.g., combining か + ゛ into が) if needed.

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
