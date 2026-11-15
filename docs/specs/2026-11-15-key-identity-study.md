# Key identity: position, value, or something else

**Date:** 2026-11-15
**Status:** Study. No production change; follow-ups are proposed in §6.
**Packages:** `packages/kiosk-keyboard` and `packages/kiosk-keyboard-webc`. Both identify a key the same way and both are affected.

Line numbers are against `origin/main` at `dc5bbcad`.

## 1. The question

In both packages a key's identity is its grid position `{row, col}`. The renderer ids each keycap `{controlId}-key-{row}-{col}` (`keyElementId`, kiosk `src/internal/dom.ts:33`, webc `src/core/dom-utils.ts:28`) and publishes the same coordinate as `data-row-index` / `data-key-index`. Because the UI5 patcher (kiosk) and the JSX reconciler (webc) match nodes by that id, a layout change does not replace a keycap: it **hands the same DOM element to whatever key the new layout seats at that position**.

So every reference to "a key" that outlives a render has to be repaired when the layout changes, or it silently points at a different key. This study measures what a different identity would cost and buy.

## 2. Identity candidates and measured duplicates

| candidate                            | unique per layout?                                    | needs consumer change? |
| ------------------------------------ | ----------------------------------------------------- | ---------------------- |
| (i) key `value`                      | only if no layout repeats a value (see measurement)   | no                     |
| (ii) `value` + occurrence index      | always (the n-th key carrying `value`, in row order)  | no                     |
| (iii) layout-supplied `id`           | only if authors supply one; `KeyDefinition` has no id | yes: new public field  |
| (iv) position `{row, col}` (current) | always, but not stable across layouts                 | no                     |

### 2.1 Measurement

Script (scratch, not committed; run with `node_modules/.bin/jiti` from the repo root) in Appendix A. It imports every `src/layouts/*.ts` default export in both packages and counts repeated `value`s, repeated `shiftValue`s, and `shiftValue`s that equal another key's `value`. The two packages' layouts are identical up to import specifiers, and the output is identical for both:

| layout             | keys | rows | duplicate `value` | duplicate `shiftValue` | `shiftValue` equal to another key's `value` |
| ------------------ | ---: | ---: | ----------------- | ---------------------- | ------------------------------------------- |
| `arabic`           |   49 |    5 | 0                 | `ْ` ×2                 | `ش→ؤ` `س→ئ` `ي→ى` `ن→،` `ظ→.`               |
| `fkey-row-compact` |   12 |    2 | 0                 | 0                      | 0                                           |
| `fkey-row`         |   12 |    1 | 0                 | 0                      | 0                                           |
| `fkeys`            |   16 |    3 | 0                 | 0                      | 0                                           |
| `ja-kana-compact`  |   54 |    5 | 0                 | 0                      | 0                                           |
| `ja-kana`          |   55 |    5 | 0                 | 0                      | `る→。`                                     |
| `ja-romaji`        |   44 |    5 | 0                 | 0                      | 0                                           |
| `ko-hangul`        |   46 |    5 | 0                 | 0                      | 0                                           |
| `nav-row-compact`  |    8 |    2 | 0                 | 0                      | 0                                           |
| `nav-row`          |    8 |    1 | 0                 | 0                      | 0                                           |
| `nav`              |   13 |    4 | 0                 | 0                      | 0                                           |
| `numeric`          |   30 |    4 | 0                 | 0                      | 0                                           |
| `numpad`           |   13 |    5 | 0                 | 0                      | 0                                           |
| `qwerty-es`        |   46 |    5 | 0                 | 0                      | 0                                           |
| `qwerty`           |   44 |    5 | 0                 | 0                      | 0                                           |
| `qwertz-de`        |   48 |    5 | 0                 | 0                      | 0                                           |
| `special`          |   30 |    4 | 0                 | 0                      | 0                                           |

(`default-layout.ts` exports a name string and `symbol-common.ts` exports row builders; neither is a layout.)

**No built-in layout repeats a key value.** `_getResolvedLayout` (kiosk `KioskKeyboard.ts:1921`) only rewrites the base switch (`reconcileBaseSwitch`) and fills `variants`, so it adds no duplicates either.

That does not make (i) sound. `LayoutDefinition` is public, `CustomLayout`/`customLayouts` accept any rows, and `custom-layout-fold.ts` validates names and locales but never key values. A custom layout with two `{shift}` keys — the shape of every physical keyboard — is legal today. Value alone would make the two indistinguishable; (ii) is (i) with that hole closed and costs nothing when values are unique.

### 2.2 Shift values

Keys are matched by shifted value in one place: the physical-key highlight, `keyByValue(…) ?? keyByValue(lower) ?? keyByShiftValue(key)` (kiosk `physical-key-highlight.ts:89-91`), and the webc twin's combined selector (`physical-key-highlight-controller.ts:73`). The `arabic` and `ja-kana` collisions above (a `shiftValue` that is another key's `value`) resolve to the key whose **value** matches, since `keyByValue` is tried first in kiosk and both match in webc. That is a highlight-lookup question, independent of identity; nothing that holds a key reference across a render matches by shifted value, so shift values do not enter the identity choice.

## 3. Inventory: every place that stores, rebuilds or re-queries a key position or element

"LoC" is executable lines, excluding doc comments. "Under (ii)" says what the recommended identity (§5) would do to it.

### 3.1 kiosk-keyboard

| site                                                                 | LoC | what it does                                                                   | under (ii)                                                           |
| -------------------------------------------------------------------- | --: | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `internal/dom.ts:8-24` `KeyPosition`, `keyPositionOf`                |  12 | reads the coordinate back off a keycap                                         | keep (geometry)                                                      |
| `internal/dom.ts:33-35` `keyElementId`                               |   3 | positional element id                                                          | keep (DOM contract, §4)                                              |
| `KioskKeyboard.ts:1772-1786` `_focusAnchorValue`                     |  13 | reads the value under the roving tab stop before a layout change               | **delete**: the anchor already is a value                            |
| `KioskKeyboard.ts:1804-1814` `_reseatFocusAnchor`                    |  10 | finds that value in the new layout, writes a new position                      | **delete**                                                           |
| `KioskKeyboard.ts:965-966`, `layout-state.ts:36-37, 224, 235`        |   6 | host hooks threading the two above through every layout change                 | **delete**                                                           |
| `KioskKeyboardRenderer.ts:105-112` `resolveFocusTarget`              |   5 | re-validates `lastFocusedKey` against the layout, else `(0,0)`                 | becomes ref→position lookup, else `(0,0)`; same size                 |
| `KioskKeyboard.ts:1739-1746` `applyFocusInfo` positional query       |   8 | re-queries the keycap at the remembered position                               | query by ref (`keyByValue` + occurrence); fallback 1748-1756 kept    |
| `internal/key-grid-navigation.ts:26, 37-56`                          |  14 | `_lastFocusedKey`, `getFocusableDomRef`, `_keyAt`                              | store a ref; `_keyAt` resolves it                                    |
| `internal/key-grid-navigation.ts:145-175` `_move`                    |  25 | arrow geometry incl. the sibling-row DOM walk                                  | keep: navigation is inherently positional                            |
| `KioskKeyboard.ts:154, 156` `_pressedKeyEl`, `_keyboardPressedKeyEl` |   2 | **element** references held for the whole press                                | keep the element, add the ref the press was made on                  |
| `KioskKeyboard.ts:1858-1861` `_getPressedKey`                        |   4 | renderer reads the pressed element's _current_ position                        | returns the press's ref; renderer compares refs                      |
| `KioskKeyboardRenderer.ts:161-164`                                   |   4 | re-emits `keyPressed` at that position                                         | compare by ref (fixes the §7 bug)                                    |
| `KioskKeyboard.ts:2218, 2232` `ontouchend`                           |   2 | re-reads `dataset.key` off the pressed element; records its position for focus | compare element's current ref with the press's ref before activating |
| `internal/physical-key-highlight.ts:30, 94-96` `HighlightedKey`      |   4 | position **paired with value** (#331)                                          | **delete** the pairing; the ref is the identity                      |
| `KioskKeyboardRenderer.ts:169-172`                                   |   4 | highlight re-emit, position + value                                            | compare by ref                                                       |
| `internal/variant-popup-behavior.ts:128, 137, 324, 336`              |   4 | `_anchorKeyEl` element, `_originKeyValue` value                                | unchanged: already value-gated                                       |

### 3.2 kiosk-keyboard-webc

| site                                                                    | LoC | what it does                                                      | under (ii)                                     |
| ----------------------------------------------------------------------- | --: | ----------------------------------------------------------------- | ---------------------------------------------- |
| `core/dom-utils.ts:7-30` `KeyPosition`, `keyPositionOf`, `keyElementId` |  15 | as kiosk                                                          | keep                                           |
| `KioskKeyboard.ts:1567-1582` `_focusAnchor`                             |  13 | value + "was focused" under the tab stop                          | **delete** the value half; keep `focused`      |
| `KioskKeyboard.ts:1601-1611` `_reseatFocusAnchor`                       |   9 | value → new position                                              | **delete** the lookup; keep the restore flag   |
| `KioskKeyboard.ts:728-729`, `core/layout-state.ts:41-42, 247, 259`      |   6 | host hooks                                                        | shrink to the `focused` flag                   |
| `KioskKeyboard.ts:745, 1093, 1107-1111` `_restoreKeyFocus`              |   7 | puts DOM focus back after the reseat                              | keep: the element under focus can still vanish |
| `KioskKeyboard.ts:1556-1560` `_getFocusPosition`                        |   4 | re-validates `lastFocusedKey`, else `(0,0)`                       | ref→position lookup                            |
| `core/key-grid-navigation.ts:59-70, 84, 99-107`                         |  20 | `_lastFocusedKey`, position read, `keyByPosition` re-query        | store a ref; geometry kept                     |
| `KioskKeyboard.ts:743`, `core/key-grid-navigation.ts:247-254`           |   9 | `_pressedKey: KeyPosition` set on Enter/Space, cleared on release | store a ref                                    |
| `KioskKeyboardTemplate.tsx:18`                                          |   1 | pressed class by position                                         | compare by ref                                 |
| `KioskKeyboardTemplate.tsx:19`                                          |   1 | highlight by `key.value.toLowerCase()` — already value identity   | unchanged (highlights every duplicate)         |
| `KioskKeyboard.ts:870-872` touchend `elementFromPoint`→`closest`        |   3 | resolves the key under the finger at lift-off                     | unchanged: hit-testing, not identity           |
| `KioskKeyboard.ts:1622`, `1828` `dataset.key` re-reads                  |   2 | value off the clicked / anchoring element                         | unchanged                                      |
| `KioskKeyboard.ts:899-903` `focusKey`                                   |   4 | variant popup returns focus by position                           | by ref                                         |
| `core/variant-popup-controller.ts:206-207, 248-252`                     |   7 | popup anchor identity and re-query by position                    | by ref                                         |

### 3.3 Totals

The compensating code that exists only because identity is positional: kiosk `_focusAnchorValue` + `_reseatFocusAnchor` + hooks (29 LoC) and the `HighlightedKey` pairing (4); webc `_focusAnchor` value half + `_reseatFocusAnchor` lookup + hooks (~24). Roughly **55 LoC deleted across both packages**, against a ref→position resolver (~10 LoC per package) and ref comparisons replacing position comparisons at the same sites. Net is small. The value of (ii) is not the line count; it is the bug class it closes (§5.2).

## 4. DOM-contract impact

What a change to the **published** identity would break:

- **Element ids.** `{controlId}-key-{row}-{col}` is documented (`docs/kiosk/ARCHITECTURE.md:493`, `docs/kiosk-webc/ARCHITECTURE.md:461`) as what the patcher / JSX reconciler match nodes by. A value-derived id would need escaping (`{layout:base}`, `" "`, non-ASCII glyphs) and would make every layout change replace nodes instead of patching them — a behavioural change in its own right (focus loss on every switch, and every element reference becomes detached rather than re-seated).
- **`data-row-index` / `data-key-index`.** In `ATTR_PARITY.core` and the `keyByPosition` selector in `SELECTOR_PARITY` core (`tools/check-dom-contract-drift.mjs:87, 154`). Arrow navigation reads them; they stay meaningful under any identity.
- **ARIA.** No `aria-activedescendant` anywhere in either `src/` (the roving tab stop moves real focus), so no id is referenced from ARIA. Keycap `id`s are therefore not an assistive-technology contract.
- **Tests.** 28 occurrences of positional ids / `keyByPosition` / `data-row-index` across 7 files: kiosk `KioskKeyboard-a11y`, `-autocompact`, `-events`, `-focus`, `-renderer-blackbox` QUnit; webc `test/component/kiosk-keyboard.test.ts`, `test/unit/key-grid-navigation.test.ts`. No e2e spec locates keys by position.

**The recommendation in §5 changes none of this.** It is an internal identity for references that cross a render; the published DOM stays positional, because the published DOM describes geometry, which is what positions are good at.

## 5. Recommendation

Keep position as the DOM identity and as the navigation coordinate. Give every **reference that outlives a render** — the roving focus anchor, the pressed key (pointer and keyboard), the physical highlight, the variant anchor — a `KeyRef = { value, occurrence }` (candidate ii), resolved to a position at render time. Reject (i) because custom layouts may repeat values, (iii) because it is new public API that every layout author must fill for no case (ii) gets wrong, and (iv) because §5.2's verdict is two live bugs it causes.

### 5.1 Which compensating lines get deleted (not moved)

- kiosk `_focusAnchorValue` (`KioskKeyboard.ts:1772-1786`), `_reseatFocusAnchor` (`1804-1814`), their two `LayoutStateHost` hooks and both call sites (`layout-state.ts:36-37, 224, 235`; `KioskKeyboard.ts:965-966`).
- kiosk `HighlightedKey`'s position+value pairing (`physical-key-highlight.ts:30, 94-96`) and the extra `value ===` clause in `KioskKeyboardRenderer.ts:170`.
- webc `_reseatFocusAnchor`'s layout scan (`KioskKeyboard.ts:1602-1608`) and the value half of `_focusAnchor`.

Not deleted, and the study should not pretend otherwise: `resolveFocusTarget`/`_getFocusPosition` still need a "key gone → first key" fallback, `applyFocusInfo`'s fallback stays, webc's `_restoreKeyFocus` stays (the focused element can still vanish), and `_move`'s DOM walk stays (it is geometry).

### 5.2 What the new shape makes impossible

A held reference resolving to a key the user did not touch. Today every positional reference is one layout change away from naming another key; the `HighlightedKey` value pairing (#331) fixed one of them by hand, and §7 shows the pressed key is still open in both its forms. Under a `KeyRef`, a reference to a key the new layout lacks resolves to nothing, which is the correct answer.

### 5.3 What requirement is dropped or weakened

- **Focus stays on the same grid spot** when the focused key is absent from the new layout: already dropped today (the reseat falls back to the first key); unchanged.
- **Duplicate keys.** If a layout change inserts an earlier key with the same value, the occurrence index follows the n-th occurrence, not the "same" physical key. Only reachable with custom layouts that repeat values across a switch; acceptable.
- **Render cost.** The renderer resolves a ref by scanning the layout (≤ 55 keys in any built-in) once per render instead of comparing integers. Negligible.

### 5.4 Smallest step that proves it, and what must not change

Smallest step: the pressed-key bug fix (§6, item 1). It touches only the pressed reference, ships with the two regression tests in Appendix B, and either confirms that a value-based reference is the right repair or shows it is not. If it lands cleanly, migrate the focus anchor next (item 2), which is where the deletions are.

Must not change, in any step: focus behaviour on a layout switch (the `KioskKeyboard-focus` / `-autocompact` QUnit and webc component suites pass untouched), the roving tabindex (exactly one `tabindex="0"`), ARIA (`role="button"`, `aria-pressed` on `{shift}`, `aria-disabled`), and the DOM contract (`check-dom-contract-drift` green with no allowlist edits; ids and data attributes byte-identical).

## 6. Follow-up proposals (ordered)

1. **Bug: a layout change during a held press moves the press onto another key, and the release types it.** `_getPressedKey` (`KioskKeyboard.ts:1858-1861`) reports the held element's _current_ position and the renderer re-emits `keyPressed` there (`KioskKeyboardRenderer.ts:161-164`); `ontouchend` then re-reads `dataset.key` off the re-seated element (`KioskKeyboard.ts:2218`) and activates it. Design: on a layout change, abandon any in-flight press the way `ontouchcancel` / window blur already do — clear `_pressedKeyEl` (pointer, incl. backspace repeat and variant hold) and `_keyboardPressedKeyEl`. Must-haves: Appendix B tests 1 and 3 committed red-first; the webc twin checked for the same defect (keyboard `_pressedKey` is positional, `KioskKeyboardTemplate.tsx:18`; pointer goes through a native `click` on the reused element — unverified); coordinate with the in-flight layout-state refactor, since the natural hook is the layout-change path in `layout-state.ts`. Removed: nothing yet.
2. **Migrate the focus anchor to a `KeyRef`** in both packages. Design: `KeyGridNavigation` stores `{ value, occurrence }`; renderer/template and `applyFocusInfo` / `getFocusableDomRef` resolve it. Must-haves: DOM contract byte-identical, existing focus suites green unedited. Removed: `_focusAnchorValue`, `_reseatFocusAnchor` (both packages), the two `LayoutStateHost` hooks.
3. **Fold the physical highlight and variant anchor onto the same `KeyRef`.** Removed: `HighlightedKey`'s position+value pairing and the renderer's value clause; webc `_isAnchoredTo`'s position compare.

## 7. Verdict on the `_getPressedKey` suspicion

**Reproduced, in two forms.** Tests in Appendix B were appended temporarily to `test/qunit/KioskKeyboard.qunit.ts`, run in Chromium against `ui5 serve` (OpenUI5 1.136.18), then reverted. None is committed.

| test                                                    | result                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1. pointer hold on `q`, `setLayout("numeric")`, release | **fails twice**: `-` (seated at `q`'s `(1,0)`) reads as pressed; the release fires `keyPress` with `"-"` |
| 2. Enter on `{layout:base}` in `numeric` → `qwerty`     | passes: focus falls back to `1`, the `focusout` clears the keyboard press                                |
| 3. Enter on a `{layout:*}` key sitting at `(0,0)`       | **fails**: the new layout's `(0,0)` key `x` reads as pressed while Enter is held                         |

Why test 2 passes and test 3 fails: the keyboard press is cleared by `onfocusout` (`KioskKeyboard.ts:2300`). Whenever the reseat moves focus to a different element, the stale press is cleared by accident. When the fallback target _is_ the pressed element — the layout key sits at `(0,0)`, the first key — focus does not move, no `focusout` fires, and the position-based re-emit paints the new key. The keyboard form is visual only and ends at `keyup`; the pointer form types a key the user never touched, and is reachable whenever the layout changes under a held pointer (`setLayout` from app code, an `autoCompact` width swap on rotation or resize).

## Appendix A: duplicate measurement script

```ts
// _dupes.ts at the repo root; run: node_modules/.bin/jiti _dupes.ts
import { readdirSync } from "node:fs";
for (const pkg of ["kiosk-keyboard", "kiosk-keyboard-webc"]) {
  const dir = `packages/${pkg}/src/layouts`;
  console.log(`\n## ${pkg}`);
  for (const f of readdirSync(dir).sort()) {
    const mod = await import(`./${dir}/${f}`);
    const def = mod.default;
    if (!Array.isArray(def)) {
      console.log(`${f}: (not a LayoutDefinition: ${typeof def})`);
      continue;
    }
    const rows = Array.isArray(def[0]) ? def : [def];
    const count = (vals: string[]) => {
      const m = new Map<string, number>();
      for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
      return [...m].filter(([, n]) => n > 1);
    };
    const keys = rows.flat();
    const vals = keys.map((k: any) => k.value);
    const shifts = keys.filter((k: any) => k.shiftValue !== undefined).map((k: any) => k.shiftValue);
    const shiftVsVal = keys
      .filter((k: any) => k.shiftValue !== undefined && vals.includes(k.shiftValue))
      .map((k: any) => `${k.value}->${k.shiftValue}`);
    const fmt = (a: [string, number][]) => (a.length ? a.map(([v, n]) => `${v}x${n}`).join(" ") : "0");
    console.log(
      `${f}: keys=${keys.length} rows=${rows.length} dupValues=${fmt(
        count(vals),
      )} dupShift=${fmt(count(shifts))} shiftCollidesWithValue=${shiftVsVal.length ? shiftVsVal.join(" ") : "0"}`,
    );
  }
}
```

## Appendix B: reproducing tests (verbatim, appended to `test/qunit/KioskKeyboard.qunit.ts`)

They use that file's existing imports and its `navigateToKey` helper.

```ts
QUnit.test(
  "SPIKE pointer: a layout change during a held press does not move the press onto another key",
  async (assert) => {
    const kb = new KioskKeyboard();
    await placeAndWait(kb);
    const typed: string[] = [];
    kb.attachKeyPress((event) => typed.push(event.getParameter("key") as string));

    const q = getRequiredKeyElement(kb, "q");
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "target", { value: q });
    kb.ontouchstart(start);
    assert.ok(hasKeyClass(kb, "q", DOM.classes.keyPressed), "Precondition: q reads as pressed");

    // The app (or an autoCompact width swap) changes the layout while the pointer is down.
    kb.setLayout("numeric");
    await waitForRender();

    assert.notOk(
      hasKeyClass(kb, "-", DOM.classes.keyPressed),
      "The key now seated at q's position is not marked pressed",
    );

    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "target", { value: q });
    kb.ontouchend(end);

    assert.deepEqual(typed, [], "Releasing types nothing: the pressed key no longer exists");

    kb.destroy();
  },
);

QUnit.test(
  "SPIKE keyboard: activating a layout key with Enter does not mark the key at its position pressed",
  async (assert) => {
    const kb = new KioskKeyboard({ layout: "numeric" });
    await placeAndWait(kb);

    const abc = navigateToKey(kb, "{layout:base}");
    abc.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitForRender();

    const pressed = Array.from(getKeyElements(kb)).filter((el) => el.classList.contains(DOM.classes.keyPressed));
    assert.deepEqual(
      pressed.map((el) => el.dataset.key),
      [],
      `No qwerty keycap reads as pressed while Enter is still down (focus on ${
        (document.activeElement as HTMLElement)?.dataset?.key
      })`,
    );

    kb.destroy();
  },
);

QUnit.test(
  "SPIKE keyboard origin: a layout key at (0,0) activated with Enter leaves its press on the new (0,0) key",
  async (assert) => {
    const kb = new KioskKeyboard({
      layout: "spike-a",
      customLayouts: [
        new CustomLayout({
          name: "spike-a",
          rows: [[{ value: "{layout:spike-b}" }, { value: "a" }]],
        }),
        new CustomLayout({
          name: "spike-b",
          rows: [[{ value: "x" }, { value: "y" }]],
        }),
      ],
    });
    await placeAndWait(kb);

    const toggle = getFirstKeyElement(kb);
    toggle.focus();
    toggle.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await waitForRender();
    assert.strictEqual(kb.getLayout(), "spike-b", "Precondition: the layout switched");

    const pressed = Array.from(getKeyElements(kb)).filter((el) => el.classList.contains(DOM.classes.keyPressed));
    assert.deepEqual(
      pressed.map((el) => el.dataset.key),
      [],
      "No key of the new layout reads as pressed while Enter is still down",
    );

    kb.destroy();
  },
);
```

Observed failures (Chromium, QUnit HTML reporter):

```
SPIKE pointer …            fail
  pass: Precondition: q reads as pressed
  fail: The key now seated at q's position is not marked pressed   Expected: false  Result: true
  fail: Releasing types nothing: the pressed key no longer exists  Expected: []     Result: ["-"]
SPIKE keyboard …           pass   (focus on 1)
SPIKE keyboard origin …    fail
  pass: Precondition: the layout switched
  fail: No key of the new layout reads as pressed while Enter is still down  Expected: []  Result: ["x"]
```

§8 check for the committed form: test 1's pressed assertion fails if `_getPressedKey` keeps returning the re-seated element's position, and its `typed` assertion fails if `ontouchend` keeps activating `pressed.dataset.key` without checking the press survived the layout change; test 3 fails if the keyboard press is not cleared or re-identified on a layout change. Test 2 passes on `main` and is not a regression test for anything: it documents why the keyboard form needs the `(0,0)` arrangement to show.
