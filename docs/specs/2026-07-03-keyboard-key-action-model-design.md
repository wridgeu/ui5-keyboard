# Keyboard key-action model: a parse-once typed action for buttons, layouts, and special functions

Date: 2026-07-03
Status: Accepted (scope B, folded into PR #156, behavior-preserving; divergence fixes deferred)
Related: PR #156 (numeric/numpad ABC-key), issue #105 (no shared-core, declined), the twin-drift god-class exclusion (`tools/check-twin-drift.mjs`)

## 1. Problem

Every button on the keyboard encodes what it does in a single overloaded string, its
`KeyDefinition.value`: a literal character (`"a"`, `","`), or a brace token
(`"{shift}"`, `"{backspace}"`, `"{enter}"`, `"{layout:NAME}"`, `"{fkey:NAME}"`). That
string authoring format is a good, JSON-serializable, public API (`SpecialKeyValue` in
`types.ts`, since 0.1.0) and should stay. The problem is not the format; it is that the
one place meant to interpret it, `classifyKeyToken` / `parseLayoutToken` in the
twin-shared `key-token.ts`, is a chokepoint that leaks. The same grammar is
re-implemented, uncoordinated, across the codebase:

- **Dispatch is duplicated and bypassed.** Kiosk dispatches through a `switch` in
  `_handleKeyAction`; webc through an if-ladder in `_onKeyClick`. Separately,
  `_keyAffectsComposition` (kiosk) re-tests `{backspace}` / `{enter}` / `{layout:` /
  `{fkey:` inline: a second, divergent classifier for the same tokens.
- **`{fkey:NAME}` has no parser.** It is sliced inline (`value.slice("{fkey:".length, -1)`)
  in both god-classes, re-tested with `startsWith("{fkey:")` in the renderer for styling,
  and _reconstructed_ with `` `{fkey:${key}}` `` in both physical-key-highlight
  controllers, then round-tripped into a `[data-key="..."]` CSS selector. One token, four+
  independent handlers, no `parseFkeyToken` twin to `parseLayoutToken`.
- **Row styling re-parses a third way.** `classifyRow` (`internal/dom.ts` and webc
  `core/dom-utils.ts`) uses `/^\{fkey:F\d+\}$/` plus a hardcoded `NAV_KEYS` set,
  duplicated verbatim in both packages, independent of the classifier.
- **The special-key metadata maps have already silently diverged.** Kiosk
  `SPECIAL_KEY_ICONS` stores full `sap-icon://` URIs; webc `ICON_MAP` stores bare icon
  names plus a `SAP_ICON_PREFIX` slice. Kiosk `SPECIAL_KEY_I18N` stores `[i18nKey, fallback]`
  tuples; webc `SPECIAL_KEY_LABELS` stores a bare i18n key with fallbacks inline at call
  sites. The caps-lock label even resolves through _different i18n keys_: kiosk
  `ARIA_CAPS_LOCK`, webc `KEY_CAPS_LOCK`. The native-F-key allowlist is a typed `KeyName`
  enum on the kiosk side, a raw `Set<string>` on the webc side.
- **None of this is guarded.** Both `KioskKeyboard.ts` god-classes are excluded from the
  twin-drift checker by design (framework-specific), so these divergences (and the
  behavioral ones below) are invisible to CI and must be reconciled by hand.

The only compile-time safety is the `SpecialKeyValue` template-literal type (erased at
runtime, not enforced at the DOM boundary) and the `never` exhaustiveness check guarding
the one dispatch switch. Everything else is convention.

### Behavioral divergences this exposes (same root cause)

Because the grammar is interpreted independently on each twin, behavior has drifted:

1. **Composition ordering.** Kiosk runs composition middleware _before_ firing `keyPress`;
   webc fires `keyPress` _first_, then middleware. A `keyPress` listener sees different
   behavior for CJK/dead-key composition across the two packages.
2. **Multi-char shift.** Webc uppercases any char token under shift
   (`shiftValue ?? value.toUpperCase()`); kiosk only uppercases single-character tokens.
   Same input, different inserted text.
3. **`keyPress` payload (a documented public-contract fork).** Kiosk fires
   `key: "Backspace"` / `"Enter"` (a `KeyName` constant), and its event JSDoc
   (`KioskKeyboard.ts:398`) documents exactly that. Webc fires `key: "{backspace}"` /
   `"{enter}"` (the raw token), and its JSDoc (`KioskKeyboard.ts:179`) documents exactly
   that. Each twin is self-consistent with its own public docs, but the two public
   contracts have forked. Unifying the payload is therefore a breaking change for one
   side's consumers regardless of which is chosen, and needs a migration/changelog note.

## 2. Goals and non-goals

**Goals**

- One typed representation of what a key does, parsed **once** at the layout boundary, so
  the hot path (dispatch, composition, styling, highlight, labels, icons) never re-parses
  a string.
- One parser (`parseKeyAction`) that subsumes `classifyKeyToken`, `parseLayoutToken`, the
  missing `parseFkeyToken`, the inline `{fkey:}` slices, and the `classifyRow` regex.
- One action-keyed metadata source replacing the four diverged label/icon maps; each twin
  adapts canonical data to its render path (URI vs bare name) instead of storing a
  diverged copy.
- Move this logic **into the twin-shared core** so `tools/check-twin-drift.mjs` covers it,
  reversing the drift instead of adding to it.
- **Behavior-preserving:** produce no observable change in inserted text, fired events,
  labels, icons, or accessible names. The refactor makes the three divergences visible in
  one place; it does not change them.

**Non-goals**

- **No behavior change in this pass.** The three behavioral divergences (composition
  ordering, multi-char shift, `keyPress` payload) are surfaced but deliberately left as-is,
  because at least the payload one is a documented public-contract fork whose fix is a
  breaking change needing its own migration note. They move to a dedicated follow-up PR
  (see section 8). The caps-lock i18n-key unification (`ARIA_CAPS_LOCK` vs `KEY_CAPS_LOCK`)
  rides in that same follow-up, since it is a semi-public surface via `setI18nResolver`.
- **No change to the public authoring format.** `KeyDefinition.value` stays a string;
  `SpecialKeyValue` stays. Custom layouts (`instanceLayouts`) authored today keep working
  byte-for-byte. This is an internal normalization, not an API break.
- **No command-id + args registry** (the VSCode/Squeekboard maximal model). Evaluated in
  section 7 and declined for a shipping control: larger surface, and it pressures the
  authoring format toward `{ cmd, args }` objects, which is the one thing we are protecting.
- **No shared-core npm package.** Per issue #105 the model must be inlinable/vendorable
  into both twins with zero runtime dependency. The design below is pure type-level +
  object literals + a switch, which satisfies that.
- Not touching layout _data_ files beyond what the parser change requires; the `{token}`
  strings in `layouts/*.ts` stay as authored.

## 3. Design

### 3.1 The `KeyAction` union (twin-shared core)

`key-token.ts` grows into the owner of a discriminated union. `value` is authored as a
string; `parseKeyAction` turns it into typed data exactly once.

```ts
// packages/*/src/{internal,core}/key-token.ts  (byte-identical, drift-checked)

/** The sentinel layout name that returns to the tracked base layout. */
export const LAYOUT_BASE = "base";

/** What a key does, parsed once from its authored `value` string. */
export type KeyAction =
  | { kind: "char"; text: string } // literal character(s) to insert
  | { kind: "shift" }
  | { kind: "backspace" }
  | { kind: "enter" }
  | { kind: "layout"; target: string } // target === LAYOUT_BASE is the base sentinel
  | { kind: "fkey"; name: string } // e.g. "F5", "ArrowLeft"
  | { kind: "unknown"; raw: string }; // brace-wrapped, unrecognized: fires keyPress, inserts nothing

export type KeyActionKind = KeyAction["kind"];

/**
 * Sole parser of the brace-token grammar. Returns a fully typed action;
 * `target`/`name` are already extracted and normalized (layout names are
 * trimmed + lowercased to match the case-insensitive registry).
 */
export function parseKeyAction(value: string): KeyAction {
  if (value === "{shift}") return { kind: "shift" };
  if (value === "{backspace}") return { kind: "backspace" };
  if (value === "{enter}") return { kind: "enter" };
  if (value.startsWith("{layout:")) {
    return { kind: "layout", target: value.slice("{layout:".length, -1).trim().toLowerCase() };
  }
  if (value.startsWith("{fkey:")) {
    return { kind: "fkey", name: value.slice("{fkey:".length, -1).trim() };
  }
  if (value.startsWith("{") && value.endsWith("}")) return { kind: "unknown", raw: value };
  return { kind: "char", text: value };
}
```

`classifyKeyToken` and `parseLayoutToken` are removed; their call sites move to
`parseKeyAction(...).kind` / `.target`. (Note: fkey `name` is intentionally not
lowercased. `{fkey:F5}` and the `KeyName` enum are case-significant, unlike layout names.
This asymmetry is called out at the definition and covered by a test.)

### 3.2 Action-derived metadata (twin-shared core, canonical identity)

The four diverged maps collapse into one table keyed by `KeyActionKind` (plus the space
character, which is a `char` action with special presentation), storing **canonical
identity**, not per-twin render strings:

```ts
// one shared table, canonical values
const ACTION_META: Record<"shift" | "backspace" | "enter", { i18nKey: string; icon: string }> = {
  shift: { i18nKey: "KEY_SHIFT", icon: "arrow-top" },
  backspace: { i18nKey: "KEY_BACKSPACE", icon: "arrow-left" },
  enter: { i18nKey: "KEY_ENTER", icon: "accept" },
};
// caps-lock icon: "locked"; layout-return icon: "nav-back"; space i18nKey: "KEY_SPACE"
```

Each twin adapts canonical data at its render boundary, and this adaptation is the
_legitimate_ divergence (it stays in the framework-specific renderer, not in the shared
table):

- **kiosk**: prefixes `sap-icon://` and validates via `IconPool` (existing `key-icons.ts`
  logic stays, but reads the icon name from the shared table).
- **webc**: uses the bare name and keeps its `@ui5/webcomponents-icons/dist/*.js` imports.

This resolves the URI-vs-name and tuple-vs-bare-key divergences structurally: there is one
source of the mapping, and the `SAP_ICON_PREFIX` slice in webc becomes the only
adaptation, at one site. These are pure identity collapses with no output change (the
icon names and i18n keys for shift/enter/backspace already agree across twins). The one
value that does _not_ agree, the caps-lock i18n key (`ARIA_CAPS_LOCK` vs `KEY_CAPS_LOCK`),
is **left per-twin for now** to keep this pass behavior-preserving; unifying it is deferred
to the follow-up (Open Question A/B). Concretely, the shared table carries the agreeing
entries; caps-lock label resolution stays a per-twin detail with a `// FOLLOW-UP` marker.

### 3.3 Dispatch: one exhaustive switch per twin, over `KeyAction`

Both god-classes keep their own dispatch method (they must: different framework event
plumbing, target sessions, composition wiring), but both switch over the _same_
`parseKeyAction(value)` result with an `assertNever` default:

```ts
const action = parseKeyAction(value);
switch (action.kind) {
  case "char":
    /* insert action.text (shift/caps applied by shared shift-state) */ break;
  case "shift":
    /* toggle */ break;
  case "backspace":
    /* delete */ break;
  case "enter":
    /* newline or change */ break;
  case "layout":
    /* applyLayout(action.target); source = target === LAYOUT_BASE ? "external" : "user" */ break;
  case "fkey":
    /* fKeyController.handle(action.name) */ break;
  case "unknown":
    /* fire cancelable keyPress, no insert */ break;
  default:
    assertNever(action);
}
```

`_keyAffectsComposition`'s inline re-parse is deleted and replaced by a check on
`action.kind` (composition applies to `char` / `backspace` / `enter` / `unknown`, never
`layout` / `fkey` / `shift`), so there is no longer a second classifier.

`assertNever` is a shared one-liner (`function assertNever(x: never): never { throw ... }`).
It is genuine production logic (it runs on an unreachable-by-types path), not a test-only
export, so it satisfies CLAUDE.md section 4.

### 3.4 Physical-key highlight and row styling

- **Highlight — declined (evaluated 2026-07-11).** The proposed
  `physicalKeyToAction(e: KeyboardEvent)` / `dataKeyForAction(action)` extraction was
  assessed against the actual twins and declined. The two highlight files
  (`internal/physical-key-highlight.ts`, `core/physical-key-highlight-controller.ts`) are
  framework adapters of ~100 lines each, of which only ~8-11 are the token-mapping slice;
  the rest stays framework-specific on `UNCHECKED_CORE_TWINS` (kiosk uses
  `Element.addEventDelegate` keyed by control id and unwraps `.originalEvent` for
  `getModifierState`; webc uses `AbortController`/`addEventListener` and reads
  `getModifierState` directly). The `KeyboardEvent` premise does not hold — kiosk consumes a
  UI5-wrapped event, not a raw DOM event. The `dataKeyForAction` "one canonical string"
  premise does not hold either — kiosk feeds a three-way selector (`data-key`,
  lowercased-char, `data-shift-value`) for a one-way class toggle, whereas webc needs a
  lowercased data-key that is also written to host state for a template equality test; one
  return value cannot serve both. And the case-sensitivity "resolution" is not
  behavior-preserving (kiosk's `data-shift-value` fallback and webc's blur-clear +
  template-state have no counterpart on the other side). Per CLAUDE.md section 2, ~8-11 lines
  of already-behaviorally-diverged mapping is below the hoist threshold; duplicate it. If
  drift recurs here, prefer a normalized-diff guardrail over extraction.
- **Row styling — done.** `classifyRow` (in both `internal/dom.ts` and `core/dom-utils.ts`)
  reads `parseKeyAction(k.value)`: an `"fkey"` row is `every` fkey with an F-number test on
  `action.name`; `"nav"` is `every` fkey with `name` in `NAV_KEY_NAMES`, now a single
  drift-checked source in `key-action-meta.ts` (was a duplicated per-twin `Set`). The
  trivial `/^F\d+$/` F-number regex stays duplicated per twin (a regex below the hoist
  threshold, CLAUDE.md section 2).

### 3.5 Layout-resolution cleanup (folded in)

Two in-theme sharp edges in the constraint system are cleaned up in the same pass, both
behavior-preserving, both moving string logic into the drift-checked core:

1. **Constraint mapping.** The `KeyboardType -> constrained layout name` decision is today
   two parallel ternaries per twin (`_resolvedLayoutName` and `_getResolvedLayout`'s
   `constrainedName`, four ladders total) hardcoding `"numpad"` / `"numeric"`. Replace with
   one shared `constrainedLayoutName(keyboardType): string | null` in the core, called from
   both sites on both twins. A third constrained type becomes a one-line edit in one place
   instead of four ladders kept in lockstep.
2. **Base-switch reconciliation.** `_reconcileBaseSwitch` (kiosk static) and
   `reconcileBaseSwitch` (webc module function) are today parallel per-twin copies excluded
   from the drift checker. Move the reshape (the `useless` predicate plus the
   strip-vs-relabel `flatMap`) into one shared core function consuming `KeyAction`: the
   `{layout:base}` identification and the "a sibling key routes back to `constrainedName`"
   check both become `parseKeyAction(k.value)` reads. Parameterize it by the per-twin bits it
   genuinely cannot share (the return-icon constant and the resolved aria-label string),
   passed in. Both twins call the shared function, so the drift checker now covers the
   predicate.

The `useless` predicate is preserved exactly (`layoutName === constrainedName` OR a sibling
key routes back to `constrainedName`); this is a structural move, not a logic change. The
`_resolvedLayoutName` precedence (user-source override wins over the constraint) is
unchanged. Left untouched and noted for a later pass: the scattered `_layoutSource` reset
sites, and the relabel path discarding a custom `label` on a `{layout:base}` key (fixing
that changes behavior, so it belongs with the deferred divergence work).

## 4. Twin strategy and drift coverage

The union, `parseKeyAction`, `assertNever`, `ACTION_META`, `physicalKeyToAction`,
`dataKeyForAction`, the nav-key allowlist, `constrainedLayoutName`, and the base-switch
reconciliation all live in the twin-shared core leaf modules
(`key-token.ts` and siblings), which `tools/check-twin-drift.mjs` already diffs
byte-for-byte. This is the core architectural payoff: the grammar and its metadata move
_out_ of the two unchecked god-classes and _into_ the checked core. The god-classes keep
only framework-specific plumbing that calls into the shared parser and table.

Per issue #105 the shared modules stay parallel copies (not a published package); the drift
checker enforces byte-identity, so adding a new `KeyAction` variant or metadata entry is a
one-place edit that CI verifies landed on both sides. The two twins' `import` specifiers
still differ (webc `.js` extensions), as they do for the existing core modules.

## 5. Migration plan (phased, TDD, both twins each phase)

Each phase writes its test first (CLAUDE.md section 3), lands on both twins, and keeps the
suite green before the next. Order chosen so each phase is independently revertible. Every
phase is behavior-preserving: characterization tests (section 6) guard against output drift.

1. **Introduce `KeyAction` + `parseKeyAction`** in the shared core; re-express
   `classifyKeyToken`/`parseLayoutToken` as thin adapters over it (no call-site changes
   yet). Unit tests for every variant incl. the fkey case-sensitivity asymmetry and the
   `{`-only / `}`-only fall-through to `char`.
2. **Add `parseFkeyToken`'s replacement**: route both god-classes' inline `{fkey:}` slices
   and the renderer styling test through `parseKeyAction`. Delete the inline slices.
3. **Unify dispatch**: both god-classes switch on `parseKeyAction(value).kind` with
   `assertNever`; delete `_keyAffectsComposition`'s inline re-parse. Each twin keeps its
   _current_ case-body behavior (the three divergences are preserved, not reconciled);
   characterization tests pin the existing output on each twin so the refactor cannot
   change it.
4. **Collapse metadata maps** into `ACTION_META` for the agreeing entries; kiosk/webc read
   canonical data and adapt at render. Caps-lock i18n key stays per-twin (marked
   `// FOLLOW-UP`). Assert each twin's accessible name / icon output is unchanged vs
   baseline.
5. **Layout-resolution cleanup**: add shared `constrainedLayoutName(keyboardType)` and
   replace the four ternary ladders; move base-switch reconciliation into one shared core
   function consuming `KeyAction`, called from both twins. Characterization tests pin the
   current strip-vs-relabel output for numeric/numpad and for a custom instance layout.
6. **Unify physical-highlight + `classifyRow`** over the union; delete the regex,
   `NAV_KEYS` duplicate, `KEY_TO_DATA_KEY` / if-ladder, and the `` `{fkey:${key}}` ``
   reconstruction.
7. **Remove `classifyKeyToken` / `parseLayoutToken`** adapters once no caller remains.

At the end, `parseKeyAction` is the single owner of the grammar, the metadata has one
source, and the god-classes carry no token-string parsing.

## 6. Testing and adversarial validation

- **Unit** (`key-token.qunit.ts` / vitest): every `KeyAction` variant; layout-name
  normalization (trim/lowercase) vs fkey name preservation; unknown-token fall-through;
  `dataKeyForAction(parseKeyAction(v)) === v` round-trip for canonical tokens.
- **Control-level** (internals-cast pattern): dispatch reaches the right behavior per kind;
  composition applies to the right kinds. **Characterization tests** pin each twin's
  _current_ output (inserted text, fired `keyPress` payload, labels, icons) so the
  behavior-preserving claim is enforced, not asserted. These same tests become the baseline
  the follow-up PR edits when it reconciles the divergences.
- **Adversarial** (CLAUDE.md section 7): before trusting the suite, write dated
  false-positive hypotheses in `docs/specs/2026-07-03-key-action-adversarial-hypotheses.md`
  and prove each red: flip one dispatch case and see a test fail; corrupt one `ACTION_META`
  icon and see the icon assertion fail; point `classifyRow` at a bogus kind and see the
  row-kind test fail. The failure mode to rule out here: a characterization suite that
  stays green after a real behavior change (a vacuous or too-loose assertion), which would
  let the "behavior-preserving" claim pass while output actually shifted. Prove it can go
  red by perturbing one inserted-text/payload expectation before trusting it.

## 7. Alternatives considered

- **A. Minimal: finish centralizing, keep the string-first model.** Add the missing
  `parseFkeyToken`, route every bypass site through the existing `classifyKeyToken`, and
  de-duplicate the maps, without introducing a typed union. Lower risk and smaller diff,
  but the hot path still classifies strings on every press, metadata stays keyed by raw
  token strings (the `{shift:capsLock}` pseudo-token magic stays), and there is no typed
  payload, so `{fkey:}` name / `{layout:}` target are still `.slice` results passed as bare
  strings. Rejected as leaving half the clutter and none of the type-level payoff.
- **B. Typed `KeyAction` union (this design).** Parse once into a discriminated union,
  consume typed everywhere, one metadata table, in the drift-checked core. Keeps the public
  format. Bounded, phased, testable. **Recommended.**
- **C. Full command-id + args registry** (VSCode/Squeekboard maximal). Keys carry a stable
  command id + typed args; an in-module `Map<CommandId, Handler>` dispatches; handlers are
  composable data. Most extensible, but the largest surface and it pressures the authoring
  format toward `{ cmd, args }` objects, breaking the public string API or forcing a second
  parallel format. Overkill for a fixed on-screen keyboard with ~6 action kinds. Rejected
  for now; `KeyAction` is a compatible stepping stone if a real extensibility need appears.

The OSS survey (simple-keyboard, Squeekboard, CodeMirror/VSCode, plus the "parse, don't
validate" + discriminated-union literature) converges on B's core moves: separate output /
behavior / presentation, normalize heterogeneous keys into one typed action at load, and
keep the hot path a discriminant lookup. Squeekboard is the closest prior art (a typed
`action` enum distinct from output, normalized at load); we adopt its shape while keeping
our string authoring format rather than its YAML.

## 8. Decisions and the deferred follow-up

**Decided:**

- **Scope: B** (typed `KeyAction` union), not the minimal centralize-only (A) or the full
  command registry (C).
- **Delivery: fold into PR #156** (the current `fix/numeric-keyboard-abc-key` branch). #156
  already carries the `key-token` centralization and `reconcileBaseSwitch` work, so this is
  a continuation of the same architectural line, kept behavior-preserving so it does not
  destabilize the bug fix it ships alongside.
- **Behavior-preserving pass:** the three divergences and the caps-lock i18n key are
  surfaced but not changed here.

**Deferred to a dedicated follow-up PR (separate, off `main` after #156):**

- **The three behavioral divergences.** Composition ordering, multi-char shift, and the
  `keyPress` payload fork. The payload one is a **breaking public-contract change** (both
  twins document their current, conflicting behavior), so it needs a changelog + migration
  note and its own review, not a quiet ride in #156. Preliminary recommendation for that
  PR: composition-before-`keyPress` (kiosk's order) and single-char-only uppercase (kiosk's
  rule); for the payload, pick one documented contract and deprecate the other, with a note
  that webc's raw-token form is the more self-describing of the two.
- **Caps-lock i18n key unification.** `ARIA_CAPS_LOCK` vs `KEY_CAPS_LOCK`; leaning
  `ARIA_CAPS_LOCK` (used as both visible caps label and aria fallback in kiosk
  `key-labels.ts`), pending a check that no bundle/consumer resolver depends on
  `KEY_CAPS_LOCK`.

- **Layout-resolution cleanup: folded in** (section 3.5). The `KeyboardType` constraint
  ternaries collapse to one shared `constrainedLayoutName`, and base-switch reconciliation
  moves into one shared core function. Behavior-preserving; the `useless` predicate is
  unchanged.
