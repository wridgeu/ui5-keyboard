# Japanese and Arabic Keyboard Layouts

Design spec for [#22](https://github.com/wridgeu/ui5-lib-keyboard/issues/22).

## Scope

Add built-in Japanese romaji and Arabic keyboard layouts to both packages (`kiosk-keyboard` and `kiosk-keyboard-webc`) with locale auto-resolution, i18n bundles, and full test coverage including RTL visuals.

### In scope

- `ja-romaji` layout: QWERTY base with Japanese punctuation and JIS shift symbols
- `arabic` layout: Standard IBM Arabic 101 mapping with 28 Arabic letters
- Locale mappings: `ja -> ja-romaji`, `ar -> arabic`
- i18n bundles: `messagebundle_ja.properties`, `messagebundle_ar.properties`
- Visual regression baselines for both layouts (desktop + device viewports)
- Explicit Arabic RTL visual coverage
- Functional tests for locale auto-selection, layout switching, and character input
- Documentation updates to READMEs and architecture docs

### Out of scope

- Japanese kana direct-input layout (tracked in [#35](https://github.com/wridgeu/ui5-lib-keyboard/issues/35))
- Full IME / candidate selection
- Composed variants (`-fk`, `-nav`); consumers compose their own via exported row modules
- Layout source deduplication between packages
- Combined icon + text on Shift/Enter/Space keys (tracked in [#34](https://github.com/wridgeu/ui5-lib-keyboard/issues/34))

## Approach

Package-by-package: implement fully in `kiosk-keyboard-webc` first (layouts, registry, i18n, tests), then mirror to `kiosk-keyboard`. One branch, one PR.

## Layout Definitions

### ja-romaji

QWERTY letter arrangement (a-z) with Japanese-specific differences:

- **Number row**: 1-0 with JIS shifted symbols: `! " # $ % & ' ( ) ~`
- **Letter rows**: Identical to QWERTY (q-p, a-l, z-m)
- **Shift behavior**: Standard uppercase for letters, JIS symbols on number row
- **Bottom row punctuation**: `、` (ideographic comma, U+3001) and `。` (ideographic period, U+3002) replace Latin comma/period
- **Shift punctuation**: `・` (middle dot, U+30FB) replaces shift comma; `」` and other Japanese brackets available on shift layer
- **Layout switchers**: `{layout:numeric}` labeled "123", `{layout:fkeys}` labeled "Fn" (same as QWERTY)
- **Text direction**: LTR

### arabic

Standard IBM Arabic 101 / Windows Arabic layout:

- **Number row**: Western Arabic numerals 1-0 (default), Arabic-Indic numerals `١٢٣٤٥٦٧٨٩٠` on shift
- **Row 2** (11 keys): ض ص ث ق ف غ ع ه خ ح ج
- **Row 3** (11 keys): ش س ي ب ل ا ت ن م ك د
- **Row 4** (10 keys): Shift + ئ ء ؤ ر ى ة و ز ظ + Enter
- **Shift layer**: Tashkeel diacritics (fatha, damma, kasra, shadda, sukun, tanwin) and hamza variants on letter keys
- **Bottom row punctuation**: `،` (Arabic comma, U+060C) and `.` (period)
- **Layout switchers**: Same structure as other layouts
- **Text direction**: RTL -- the keyboard layout content renders right-to-left

## Locale Resolution

No changes to the resolution algorithm. New entries added to `DEFAULT_LOCALE_LAYOUT_MAP`:

```
"ja" -> "ja-romaji"
"ar" -> "arabic"
```

Resolution examples:

- `navigator.language = "ja-JP"` -> tries `"ja-jp"` (no match) -> tries `"ja"` -> resolves to `ja-romaji`
- `navigator.language = "ar-SA"` -> tries `"ar-sa"` (no match) -> tries `"ar"` -> resolves to `arabic`
- Explicit `layout="qwerty"` overrides locale auto-resolution (existing behavior, unchanged)
- `{layout:base}` from secondary layouts returns to the locale-specific base layout (existing behavior, unchanged)

## i18n Bundles

New files in both packages, following the existing `messagebundle_en.properties` and `messagebundle_de.properties` key structure:

**messagebundle_ja.properties:**

- Key labels: Backspace -> バックスペース, Enter -> エンター, Shift -> シフト, Space -> スペース
- Layout switcher labels: numeric -> 数字, special -> 特殊文字
- ARIA labels: keyboard region, key announcements, shift/caps lock state

**messagebundle_ar.properties:**

- Key labels: Backspace -> مسح, Enter -> إدخال, Shift -> تحويل, Space -> مسافة
- Layout switcher labels: numeric -> أرقام, special -> رموز
- ARIA labels: same key set, in Arabic

The existing i18n resolution chain (`custom resolver -> locale bundle -> English defaults`) picks these up automatically. No code changes to the resolution logic.

## Testing

### Unit tests (WebC, vitest)

Added to `layout-registry.test.ts`:

- `ja` and `ar` locale resolution via `getLocaleLayout()`
- `ja-romaji` and `arabic` recognized as built-in layouts
- `getLocaleLayout()` returns correct layout for `ja`, `ja-JP`, `ar`, `ar-SA`, `ar-EG`

### E2E visual regression (both packages, WebdriverIO)

Added to `visual.test.ts`:

- Desktop baseline snapshots for `ja-romaji` and `arabic`
- Device-specific baselines: phone-sm, phone-md, phone-lg, tablet (WebC has per-device directories)

### RTL tests (both packages)

Added to `rtl.test.ts`:

- Arabic layout snapshot with `dir="rtl"` + `lang="ar"` -- explicit Arabic RTL coverage with real Arabic glyphs, not just Latin layouts in RTL mode

### Functional E2E tests (both packages)

New tests (in existing or new test files):

- Setting locale to `ja`/`ar` auto-selects the correct layout
- Layout switching from `ja-romaji`/`arabic` to numeric/special and back to base
- Representative character input for both layouts

### Font rendering

SAP 72 font (loaded via theme infrastructure) covers Arabic and Japanese glyphs. No extra font setup for tests.

## Documentation Updates

**READMEs (both packages):**

- Add `ja-romaji` and `arabic` to built-in layouts table
- Add `ja` and `ar` to locale mapping table
- Note that Arabic layout renders RTL

**Architecture docs (both packages):**

- Add new layouts to built-in layout inventory
- Add locale mapping entries

No new documentation files.
