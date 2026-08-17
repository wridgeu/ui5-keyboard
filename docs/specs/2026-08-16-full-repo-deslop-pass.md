# Full-repo deslop pass, and the anti-slop evaluation behind it

**Date:** 2026-08-16
**Status:** Implemented
**Packages:** all four, plus `tools/`

A repo-wide pass over comment quality and type evidence, driven by running the
[anti-slop](https://github.com/dmmulroy/anti-slop) oxlint plugin as a one-off diagnostic. The
plugin found real problems and was then **removed**; §2 records why, because "we ran a linter
and did not keep it" is the part a future reader will otherwise re-litigate.

## 1. What changed

The plugin raised 933 findings, 379 after scoping its `require-safety-comment-for-type-assertion`
rule out of test files (where a cast feeds a deliberately invalid value to the code under test and
has no invariant to state). Most were mechanical; these are the ones with a durable point.

- **Module mocking dropped from the webc unit suites.** Five `vi.mock` calls stubbed
  `@ui5/webcomponents-base` internals. They are gone; the affected tests drive the framework's own
  entry points instead (`setLanguage` for locale resolution), so the suite exercises the same
  resolution path production does rather than a hand-written stand-in of it. No `vi.mock` remains
  in any package.
- **`instanceof` narrowing replacing casts.** 32 `as`-cast lines left the three `src/` trees,
  14 `instanceof` checks arrived. `(e.target as HTMLElement).closest(...)` becomes a real check,
  which matters because an event target is not always an element.
- **Named types replacing inline object literals** in positions that read as contracts:
  `AccessibilityInfo` (UI5's own) on `getAccessibilityInfo`, plus `PressEvent`,
  `KioskKeyboardFocusInfo`, `DelegatedKeyboardEvent`, `FocusAnchor` and `IdGenerator`.
- **`control.isA<Input>("sap.m.Input")`** instead of `isA()` followed by a cast — the framework's
  own typed-narrowing overload, which the repo was not using.
- **`as const satisfies Record<CanonicalModifier, string>`** on the modifier label tables, which
  keeps the literal types and still checks the key set.
- **`KEY_TO_DATA_KEY` became a `Map`.** A plain object literal resolves a key named `toString` or
  `constructor` to a prototype member; this table is looked up by `KeyboardEvent.key`. Latent
  rather than reachable from a physical keyboard, but the `Map` costs nothing.
- **Comment removals**: narrating preambles (`// Attach window listeners` above
  `addEventListener`), and one JSDoc block that had drifted off the function it documents
  (`getText` in the webc i18n module).
- **`@ts-expect-error` with a stated reason** where a test passes a value only plain JS can
  supply, instead of laundering it through `as unknown as`.

Behaviour is unchanged. Every fix that would have altered runtime semantics was reverted; the
one worth knowing about is `custom-layout-fold`, where rewriting
`typeof spec.keycapLang === "string" ? … : ""` to `?.trim() ?? ""` turned a function whose own
docblock promises it throws nothing into one that throws on a non-string arriving from plain JS,
killing an entire custom layout instead of degrading one facet. A component test caught it; reading
the diff had not.

## 2. Why the plugin was evaluated and not adopted

Three independent reasons, in ascending order of how much they matter.

**It cannot be a dependency.** The package is `private: true` and unpublished, so the only
dependency form is a git dependency — no integrity hash, and it bypasses the `min-release-age=7`
supply-chain gate in `.npmrc` entirely. It also pins `@oxlint/plugins@1.78.0` against this repo's
`oxlint@1.74.0`. And it would not load if it resolved: the package ships TypeScript source with no
build step (`"exports": "./src/index.ts"`), and Node refuses to strip types from anything under
`node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, unconditional and path-based —
neither `--experimental-strip-types` nor `--experimental-transform-types` lifts it). The npm name
`oxlint-plugin-anti-slop` is squatted by an unrelated 62-byte package, so it is not an alternative.

**Vendoring is what upstream intends, and still was not worth it here.** Its README is explicit:
"This project is meant to be vendored, not treated as a fixed npm dependency. Copy the rules into
your repository, read them, and change them to match your team's standards." That is a legitimate
model — it is MIT licensed — but it puts 2,221 lines of third-party rule source under `tools/`,
with no upstream drift tracking, to be maintained by this repo forever.

**The decisive reason: two of the fifteen rules do not fit a library that parses untrusted input.**
Of 44 findings that survived every attempt to fix them, 37 came from just two rules:

| Rule                    | Accepted findings | Every one of them was                              |
| ----------------------- | ----------------- | -------------------------------------------------- |
| `no-runtime-typeof`     | 23                | a runtime guard at a genuine I/O boundary          |
| `no-unknown-parameters` | 14                | a type predicate, or a boundary parser feeding one |

Both rules say "parse at the boundary instead". These modules **are** the boundary: values arrive
from XML attributes run through `JSON.parse`, from model bindings, from `setX()` calls in untyped
JS, and from duck-typed foreign objects the host deliberately admits. A type predicate must take
`unknown` — that is what a type predicate is. Suppressing 37 findings meant 37 inline disables,
each carrying three to six lines of prose arguing with the rule; `custom-layout-fold.ts` reached
33 lines of such prose around 33 lines of code. That is a worse artifact than the one the plugin
exists to prevent.

The remaining 13 rules found real things (§1), which is why the pass was worth running as a
diagnostic. Running a linter once and keeping its findings is a legitimate outcome; it does not
oblige the repo to carry the linter.

## 3. Standing decisions

These outlived the plugin and apply to any future pass.

- **A behaviour change is never an acceptable price for a lint finding.** Revert it and report the
  finding as unresolved. A silent behaviour delta in a shipping library is the worst of the
  available outcomes.
- **A public exported constant keeps its annotation and runtime shape.** Narrowing a
  documented-stable export is a breaking change for consumers and outranks any lint finding. This
  is why `latin-variants` keeps `: VariantTable` and the four special-key tables stay `Record`.
- **`interface X { [k: string]: V }` is not a fix for a widening finding, it is a dodge.**
  anti-slop's classifier resolved type aliases but never interface declarations, so the identical
  shape written as `type X = Record<string, V>` was flagged while the interface form went silent.
  The contract is unchanged, so the rewrite bought nothing; three such interfaces were introduced
  during the pass and reverted.
- **Twin modules land on the same choice on both sides**, drift-pinned or not.
- **For a constant lookup table, choose by how it is read**: only literal keys means drop the
  annotation and let inference keep them (`satisfies` if the constraint is wanted); an arbitrary
  runtime string means `Map` with `.get()`.

## 4. Verification

`oxlint` reports nothing, including under `--deny-warnings`, and was confirmed live against a
planted violation rather than assumed from a silent run. `typecheck` clean; UI5 linter clean; all
four drift guards in parity (32/32 twin pairs); 67/67 lint-plugin tests; webc 602 unit and 351
component tests; both QUnit suites exit 0.
