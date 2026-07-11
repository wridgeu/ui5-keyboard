# KeyAction refactor: adversarial test-validation hypotheses

Date: 2026-07-03
Companion to: `2026-07-03-keyboard-key-action-model-design.md`

Per CLAUDE.md section 7, a green suite can lie. This refactor is behavior-preserving,
so its safety rests on the existing suites (plus a few added tests) actually going red on
real breakage. Below is each "how could a green run be lying?" hypothesis and the
empirically observed red that cleared it. Every red was reverted immediately after
observation.

## H1 — The parser's own assertions are vacuous

Hypothesis: `parseKeyAction` unit tests pass regardless of what the function returns.
Refutation: perturbed the implementation to lowercase the `{fkey:NAME}` name; the
webc `key-token.test.ts` case-preservation assertion went red
(`expected { name: 'f5' } to deeply equal { name: 'F5' }`). Reverted. (Task 1)

## H2 — The fkey styling class is not actually asserted

Hypothesis: routing the `keyFkey` styling through `parseKeyAction` could silently drop the
class and no test would notice. Refutation: forced `isFkey = false` in the webc template;
a component assertion went red (`part "fkey" found in rendered DOM: expected false to be
true`). Reverted. (Task 2)

## H3 — Dispatch exhaustiveness is not enforced

Hypothesis: the `assertNever(action)` default is decorative; a missing case would be a
silent no-op. Refutation: added a phantom `{ kind: "__phantom__" }` variant to the
`KeyAction` union; the kiosk build failed precisely at `KioskKeyboard.ts` `assertNever`
(`Argument of type '{ kind: "__phantom__"; }' is not assignable to parameter of type
'never'`). Reverted. (Task 3)

## H4 — The canonical icon/label source is unguarded

Hypothesis: collapsing the four diverged maps into `key-action-meta.ts` could ship a wrong
icon name with no test catching it. Observed first that the webc _component_ suite only
warns (does not fail) on an unregistered icon name — a real coverage gap. Closed it by
adding `key-action-meta.test.ts` pinning the canonical values, then perturbed the `enter`
icon name and saw that unit test go red. Reverted. The twin-drift check guarantees the
kiosk copy is identical, so pinning one twin protects both. (Task 4)

## H5 — The keyboardType constraint / base-switch reconcile is untested

Hypothesis: sharing `constrainedLayoutName` and moving the base-switch predicate onto
`parseKeyAction` could break the numeric/numpad ABC-key behavior (PR #156) undetected.
Refutation: disabled the Numpad branch of `constrainedLayoutName`; two webc component
tests went red (a middleware-swap assertion downstream of the numpad layout switch).
Reverted. (Task 5)

## H6 — Row classification is not asserted

Hypothesis: rewriting `classifyRow` over `parseKeyAction` could misclassify rows with no
test catching it. Refutation: forced the fkey-row branch to `false`; the webc
`dom-utils.test.ts` fkey-row assertion went red. Reverted. (Task 6)

## Standing coverage note

H4 surfaced that the webc component suite does not strictly assert special-key icon
_names_ (only warns on unregistered icons). This is a pre-existing gap, now mitigated for
the canonical source by `key-action-meta.test.ts`. A fuller fix (asserting the rendered
icon identity in the component suite) is out of scope for this behavior-preserving refactor.
