# Diagnostics dedupe: warn-once state on read paths

**Date:** 2026-11-15
**Status:** Study. One spike was run and reverted. No production change.
**Package:** both. `kiosk-keyboard` at OpenUI5 1.136.18; `kiosk-keyboard-webc` read but not run.

Line numbers point at `origin/main` at `dc5bbcad`.

## 1. The question

Most developer diagnostics (an invalid custom layout, an unknown icon, an icon-only key with no accessible name, a disarmed variant table, an unsupported native F-key, a two-way write-back) are emitted from read paths. Those are the renderer, the JSX template and resolvers that run once per render or per event. So each diagnostic carries its own warn-once set or flag, and some of those are cleared by hand. This study answers three questions: which of these sets can be deleted by validating once at write time, which cannot, and whether the module-level ones are correct under "modules never unload" (CLAUDE.md).

## 2. Inventory

"LoC" counts the compensating lines only: the declaration and its doc line, the has/add check, the clear and its call site. It does not count the warning call itself, which stays under any design.

### 2.1 kiosk-keyboard

| #   | State                                                 | Where                                                                        | Scope                | Warning trigger (path)                                                                                | Cleared by / when                                                                              | LoC |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --- |
| K1  | `LayoutFoldCache._reported` + content key             | `internal/layout-fold-cache.ts:47-48, 79-87`                                 | cache (per instance) | fold rebuild in `get()`, which runs lazily from the first read after a structure or content change    | itself, when a rebuild yields zero diagnostics (`:79-83`)                                      | 9   |
| K2  | `_resolvedDefaultVariants` (borrows K1's set)         | `KioskKeyboard.ts:1223-1229`, called from `_resolveLayoutDefinition` `:1937` | instance, through K1 | every layout resolution, so every render; `isValidVariantTable` re-runs on each one                   | K1's clear-on-zero, so an unrelated custom-layout edit re-arms it (§5.2)                       | 1   |
| K3  | `_warnedDisarmedVariants`                             | `KioskKeyboard.ts:191-192, 970, 1951-1952`                                   | instance             | every layout resolution while `accentVariants` is false and a table is declared                       | never: once per control lifetime                                                               | 5   |
| K4  | `_warnedWriteBack`                                    | `KioskKeyboard.ts:193-194, 971, 1981, 1988`                                  | instance             | the `autoCompact` tier writing `layout` through a two-way binding (resize event)                      | never                                                                                          | 5   |
| K5  | `ControlsDelegationController._reportedUnresolvedIds` | `internal/controls-delegation-controller.ts:55-56, 127-128, 163, 176-177`    | instance             | `sync()` on render and on the focusin firehose, gated on `isRendered()`                               | per id when it resolves (`:128`), all on `teardown()` (`:163`, from `exit`)                    | 7   |
| K6  | `warnedInvalidIcons`                                  | `internal/key-icons.ts:35-36, 48-49, 57-64`                                  | **module**           | renderer, per key per render (`KioskKeyboardRenderer.ts:298, 307`)                                    | `clearIconWarnings()` from `KioskKeyboard.exit` on the last instance (`KioskKeyboard.ts:1064`) | 13  |
| K7  | `warnedMissingLabels`                                 | `internal/key-labels.ts:79-80, 91-101`                                       | **module**           | renderer `aria-label`, per key per render (`KioskKeyboard.ts:1866` -> `KioskKeyboardRenderer.ts:283`) | `clearLabelWarnings()` from `exit` on the last instance (`:1065`)                              | 13  |
| K8  | `FKeyController._WARNED_UNSUPPORTED_NATIVE_FKEYS`     | `internal/fkey-controller.ts:53-54, 59-62, 83-84`                            | **module** (static)  | an F-key press in `fKeyMode=Native` naming a key outside the dispatch allowlist                       | `FKeyController.clearWarnings()` from `exit` on the last instance (`:1063`)                    | 8   |
| -   | last-instance clear site                              | `KioskKeyboard.ts:48, 63, 1063-1065`                                         | -                    | -                                                                                                     | -                                                                                              | 5   |

### 2.2 kiosk-keyboard-webc

| #   | State                                     | Where                                             | Scope      | Warning trigger (path)                                                          | Cleared by / when                                         | LoC |
| --- | ----------------------------------------- | ------------------------------------------------- | ---------- | ------------------------------------------------------------------------------- | --------------------------------------------------------- | --- |
| W1  | `LayoutFoldCache._reported` + content key | `core/layout-fold-cache.ts:55-56, 89-97`          | cache      | fold rebuild in `get()`, keyed on slotted identity plus each child's `revision` | itself, when a rebuild yields zero diagnostics (`:89-93`) | 9   |
| W2  | `_defaultVariants` (borrows W1's set)     | `KioskKeyboard.ts:1411-1417`, called from `:1398` | through W1 | every layout resolution, so every render                                        | W1's clear-on-zero (same coupling as K2)                  | 1   |
| W3  | `LayoutState._warnedUnregistered`         | `core/layout-state.ts:71-72, 209-210`             | instance   | `resolvedName()`, which runs every render                                       | never                                                     | 4   |
| W4  | `_warnedDisarmedVariants`                 | `KioskKeyboard.ts:746-747, 1424-1425`             | instance   | every layout resolution                                                         | never                                                     | 4   |
| W5  | `warnedMissingLabels`                     | `KioskKeyboard.ts:154-164, 1499-1500`             | **module** | template `aria-label`, per key per render (`KioskKeyboardTemplate.tsx:159`)     | never, by design ("per-page" comment `:155-163`)          | 13  |
| W6  | `warnedUnsupportedFKeys`                  | `core/fkey-controller.ts:50-59, 98-99`            | **module** | F-key press in `Native` mode                                                    | never, by design (`:51-58`)                               | 12  |

**Totals:** 14 diagnostics with dedupe machinery. That is 12 warn-once sets or flags (7 kiosk, 5 webc), plus 2 piggy-backed diagnostics (K2, W2) that borrow the fold's set. Five of the sets live at module scope (K6-K8, W5, W6). About **117 compensating lines** in all: 66 in kiosk, 51 in webc.

One read-path diagnostic has **no** dedupe at all. webc's `_resolveKeyIcon` warns `empty SAP icon URI for …` (`KioskKeyboard.ts:1518`) each time the template resolves the key (`KioskKeyboardTemplate.tsx:124`), so it repeats on every render, for example on every Shift press. This comes from reading the code; it was not run. Kiosk has no twin for it, because a bare `sap-icon://` fails `IconPool.getIconInfo` and goes through K6.

## 3. Classification: write time or read/event time

| #                         | Invalid input knowable at write time?                                                                         | Where validation would run once                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1/W1                     | **Yes**: it is a function of the fold input                                                                   | It already runs once per fold build. `_reported` adds a second dedupe across rebuilds, so a fault that survives an edit to an unrelated layout stays quiet. Without the set, that fault would repeat once per edit, not once per render.                                                                                                                                                                            |
| K2/W2                     | **Yes**: one property                                                                                         | Once per distinct `defaultVariants` value. The property is documented as "read by object identity" (`KioskKeyboard.ts:468`), so an identity memo next to the read is exact and needs no setter override. This is the spike (§6).                                                                                                                                                                                    |
| K3/W4                     | **Yes**: `accentVariants` × (`defaultVariants` ≠ null ∨ fold has `variants`)                                  | Once per distinct value of that boolean. Today it fires once per lifetime, so a fix followed by a re-break is never re-reported. Its inputs are a property and the fold, so it can sit where K2 sits.                                                                                                                                                                                                               |
| K4                        | No: event time                                                                                                | It fires only when the tier actually writes back. The binding mode is knowable at bind time, but warning then would also fire for an app that never resizes into the tier. Keep it.                                                                                                                                                                                                                                 |
| K5                        | No: render/event time by design                                                                               | The element registry raises no event when a control is added (`controls-delegation-controller.ts:168-172`). Resolution is retried on every sync, so the per-id set with forget-on-resolve is the minimum.                                                                                                                                                                                                           |
| W3                        | No: render time by design                                                                                     | `layout-state.ts:58-62`: a `{layout:*}` name set in the same task as its slotted custom layout is not in the fold yet. The render pass is the first point where the answer is authoritative.                                                                                                                                                                                                                        |
| K6                        | **Partly**                                                                                                    | Custom-layout `icon`/`capsLockIcon` values are fold input. But `IconPool.getIconInfo` depends on which fonts are registered, and an app can call `IconPool.registerFont` after the fold is built. So a write-time verdict can go stale in either direction. Built-in special-key icons are static and always valid. The best case is once per fold build × icon URI, and that still needs a dedupe across rebuilds. |
| K7/W5                     | **Yes**: a pure function of the `KeyDefinition` (`label === ""`, no `ariaLabel`, no `SPECIAL_KEY_I18N` entry) | At fold build, over every custom-layout key. Built-in layouts carry i18n entries for their icon-only keys. Composed and overlaid rows are all in the fold, so the set of faulty values is known before any render.                                                                                                                                                                                                  |
| K8/W6                     | Partly                                                                                                        | The unsupported name is knowable at fold build (a `{fkey:*}` key token × `fKeyMode=Native`). But the contract is "warn when a press is ignored", and `fKeyMode` can change later. A fold-time check would warn about keys nobody presses. Keep it event-time.                                                                                                                                                       |
| webc `empty SAP icon URI` | **Yes**                                                                                                       | A fold-time key check, the same as K7.                                                                                                                                                                                                                                                                                                                                                                              |

## 4. The framework constraint

**kiosk.** The fold is lazy, and that is forced. `Control.prototype.invalidate` returns early in the `onBeforeRendering` phase (`sap/ui/core/Control.js:348-355`, 1.136.18). `removeAggregation`, `removeAllAggregation` and `destroyAggregation` invalidate the parent without naming the child. So structural staleness has to be read off the element list in `get()` (`layout-fold-cache.ts:34-39`), and content staleness arrives as `invalidate(customLayout)`, which only drops the cache (`KioskKeyboard.ts:1211-1217`). A rebuild inside `invalidate` would run during rendering. That is why `drop()` reports nothing.

**webc.** The host is `languageAware: true` (`KioskKeyboard.ts:184`), so its `_invalidate` is suppressed while a language change is pending. A child edit is therefore carried by `CustomLayout.revision`, which the child bumps in its own `onInvalidation` (`CustomLayout.ts:127-140`), and is read on demand in `get()`.

**What this forbids:** validating in a setter or in an invalidation handler, and validating eagerly on aggregation or slot mutation. The removal paths would be missed, and kiosk would end up validating during a render.

**What it still allows:** validating **once per distinct fold input**, inside the fold build, which is already the single place where custom-layout content becomes known. The same holds for host properties: once per distinct property value, through an identity memo at the read site. That stays lazy, so it is safe during rendering, and it runs once per change, not once per read. K7, K6 (custom-layout part), K3 and the webc empty-icon check can all move into the fold build or next to it. K1/W1's cross-rebuild `_reported` is the only part that "once per fold input" does not replace.

## 5. Correctness of module-level state (kiosk)

Proven with a throwaway QUnit module (`test/qunit/diag-probe.qunit.ts`, Appendix B). It ran against a private `ui5 serve --port 8092` through `ui5-test-runner`, a single test page at a time. All four probes used `Log.warning` spies and counted the warnings for one icon-only key without a name (K7) and one unknown `sap-icon://` (K6).

| Probe | Scenario                                                                                            | Observed [label, icon] warnings                                                |
| ----- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P1    | Two live keyboards, same faulty layout                                                              | `[1,1]` after A, still `[1,1]` after B                                         |
| P2    | Shell-level keyboard stays alive; app keyboard created, destroyed, re-created ("launchpad restart") | `[1,1]` then `[1,1]`: **restart silent**                                       |
| P3    | Same restart with no other keyboard alive                                                           | `[1,1]` then `[2,2]`: **restart warns again**                                  |
| P4    | Invalid `defaultVariants` (K2), then an edit to an unrelated custom layout                          | `1` after first render, `1` after plain `invalidate()`, **`2` after the edit** |

P1-P3 passed as written. P4 failed on `main` with "an unrelated custom-layout edit re-warned: total 2". It passed with the spike in place.

### 5.1 Verdict on K6-K8

**This is a bug, of the inconsistent kind.** P2 and P3 run the same app through the same restart and get opposite results. The only difference is whether an unrelated `KioskKeyboard` is alive somewhere else on the page. The doc comment on `clearIconWarnings` says the clear exists so that "module-level state does not survive across app restarts" (`key-icons.ts:57-61`). P2 shows that it still survives whenever a shell-level or other app's keyboard is alive, which is the ordinary launchpad case. The reverse direction ("one instance's exit re-enables warnings another already showed") cannot happen: the clear runs only when no instance is left, so no live instance has its warning re-armed. P1 (a second instance is silent) is the intended per-page behaviour. The real defect is that the lifetime is "until the last keyboard on the page dies", which no caller can predict. K8 shares the same clear site (`KioskKeyboard.ts:1063`) and the same lifetime. It was not probed separately.

webc's W5/W6 are documented as per-page and never cleared (`fkey-controller.ts:51-58`), so they are consistent with their own contract.

### 5.2 Verdict on K2/W2

**This is a bug.** K2 pushes its warning through K1's content-keyed set. K1 clears that set whenever a rebuild yields zero fold diagnostics. So an unchanged invalid `defaultVariants` is reported again after any clean fold rebuild (P4). W2 has the same coupling in webc (`KioskKeyboard.ts:1411-1417` → `layout-fold-cache.ts:89-93`). That was read from the code and not run.

## 6. Spike: K2, validate once per distinct value

The spike replaced the per-render `isValidVariantTable` call with an identity memo on `getDefaultVariants()`. The warning still goes through `_foldCache.report`, so the text and the vocabulary are unchanged. Diff in Appendix A.

- **Lines:** +11 / −4 in `KioskKeyboard.ts`. Two fields with one doc line, two `init` assignments (the house no-initialiser form, `KioskKeyboard.ts:179-186`), and a five-line memo body replacing a four-line body.
- **Deleted, not moved:** the per-render `isValidVariantTable` walk (O(table) on every render) and the re-arm-by-coupling repeat in P4. The dependence on K1's set is **not** deleted. A second, different invalid table is still deduped by K1's content key unless a clean rebuild happened in between, which is also today's behaviour.
- **Tests:** `tsc --noEmit` clean. `diag-probe` 4/4 (P4 red before, green after). `custom-layouts` 47/47, which includes "An invalid defaultVariants table is reported against the host". `KioskKeyboard-variants` 63/63, `latin-variants` 34/34.
- **Reverted:** yes. The branch carries this document only.

The spike shows that "once per distinct input" is cheap. It also shows that it does not, alone, delete a warn-once set: K2 never owned one, and the spike adds two fields. A real deletion needs the larger move in §7.

## 7. Recommendation

**Move every write-time-knowable key/variant diagnostic into the fold build, and give each package one fold-scoped reporter.** Keep the three event/render-time sets as they are.

1. **Deleted (not moved):**
   - kiosk: `warnedMissingLabels` + `clearLabelWarnings` (`key-labels.ts:79-80, 91-101`); the custom-layout half of `warnedInvalidIcons` (§3 K6); the three-line last-instance clear for labels and icons and their imports (`KioskKeyboard.ts:48, 63, 1064-1065`). If K6 moves entirely (see the weakening below), `clearIconWarnings` and the module set go too.
   - webc: `warnedMissingLabels` and its 10-line comment (`KioskKeyboard.ts:154-164, 1499-1500`).
   - both: the per-render `isValidVariantTable` re-walk (K2/W2), and the per-lifetime `_warnedDisarmedVariants` flag (K3/W4), replaced by the same once-per-input check.
   - Roughly **45 lines of compensating state go away**. The fold build gains a key walk, which `foldCustomLayouts` already performs for its other diagnostics, and returns these as `LayoutDiagnostic`s that K1/W1 already report.
2. **Becomes impossible:** module-level warn-once state for labels and icons, and with it the P2/P3 inconsistency. A label/variant warning repeating on a re-render, since the fold does not rebuild on render. A `defaultVariants` warning re-armed by an unrelated edit.
3. **Weakened:**
   - The label and icon warnings repeat **per instance**, where today they appear once per page. Two keyboards sharing a faulty layout warn twice.
   - A fault that survives an edit to an unrelated custom layout is still deduped, but only by K1/W1's content-keyed set. That set stays.
   - Icon validity is judged against the fonts registered at fold-build time, so an icon whose font is registered after the fold looks invalid until the next rebuild. To avoid that, keep K6's module set for the `IconPool` check and move only the label check.
4. **Smallest proving step:** turn P4 into a committed regression test and land the K2 memo, or, better, fold K2 and K3 into one fold-adjacent check. Then move K7 (labels, kiosk) into the fold and prove it with P1/P2 rewritten to assert per-instance counts.
5. **Must not change:** every warning text verbatim, including the `[kiosk-keyboard]` prefix and `ui5.kiosk.KioskKeyboard` component. Which inputs warn: icon-only with no `ariaLabel` and no i18n entry; an unknown `sap-icon://`; an invalid table; a disarmed table. K4, K5, K8, W3 and W6 keep their event/render-time sets, because §3 shows that their input is not knowable at write time.

## Appendix A: spike diff (reverted)

```diff
@@ -186,6 +186,9 @@ export default class KioskKeyboard extends Control {
   private _foldCache!: LayoutFoldCache;
+  /** The `defaultVariants` value last validated, compared by identity per the property's contract. */
+  private _checkedDefaultVariants!: VariantTable | null | undefined;
+  private _validDefaultVariants!: boolean;
@@ -967,6 +970,8 @@
       warnTierWriteBack: () => this._warnTierWriteBack(),
     });
+    this._checkedDefaultVariants = undefined;
+    this._validDefaultVariants = true;
     this._warnedDisarmedVariants = false;
@@ -1222,10 +1227,12 @@
   private _resolvedDefaultVariants(): VariantTable | null {
     const table = this.getDefaultVariants();
-    if (table === null) return null;
-    if (isValidVariantTable(table)) return table;
-    this._foldCache.report([{ code: "invalid-variants", layout: "" }]);
-    return null;
+    if (table !== this._checkedDefaultVariants) {
+      this._checkedDefaultVariants = table;
+      this._validDefaultVariants = table === null || isValidVariantTable(table);
+      if (!this._validDefaultVariants) this._foldCache.report([{ code: "invalid-variants", layout: "" }]);
+    }
+    return this._validDefaultVariants ? table : null;
   }
```

## Appendix B: probe module (not committed)

Registered as `"diag-probe"` in `testsuite.qunit.ts` for the run, then removed.

```ts
const FAULTY: LayoutDefinition = [
  [
    { value: "{probe}", label: "", icon: "sap-icon://paste" },
    { value: "x", icon: "sap-icon://probe-does-not-exist" },
  ],
];
const LABEL = /Icon-only key "\{probe\}" has no accessible name/;
const ICON = /"sap-icon:\/\/probe-does-not-exist" not found/;

async function faulty(): Promise<KioskKeyboard> {
  const kb = new KioskKeyboard({
    customLayouts: [new CustomLayout({ name: "probe", rows: FAULTY })],
    layout: "probe",
  });
  await placeAndWait(kb);
  return kb;
}
// module hooks: destroyKeyboards() before and after each test, so no instance leaks in.

QUnit.test("P2: app restart while a shell-level keyboard stays alive", async (assert) => {
  const warn = sandbox.spy(Log, "warning");
  await placeAndWait(new KioskKeyboard({ layout: "qwerty" }));
  const app1 = await faulty();
  const first = [count(warn, LABEL), count(warn, ICON)];
  app1.destroy();
  await faulty();
  assert.deepEqual(first, [1, 1]);
  assert.deepEqual([count(warn, LABEL), count(warn, ICON)], [1, 1]); // P3 (no shell keyboard): [2, 2]
});

QUnit.test("P4: an invalid defaultVariants repeats after a clean fold rebuild", async (assert) => {
  const warn = sandbox.spy(Log, "warning");
  const extra = new CustomLayout({ name: "extra", rows: [[{ value: "a" }]] });
  const kb = new KioskKeyboard({
    accentVariants: true,
    layout: "qwerty",
    defaultVariants: { A: ["ä"] },
    customLayouts: [extra],
  });
  await placeAndWait(kb);
  kb.invalidate();
  await waitForRender(); // still 1
  extra.setRows([[{ value: "b" }]]);
  await waitForRender();
  assert.strictEqual(count(warn, /^"defaultVariants"/), 1); // main: 2
});
```
