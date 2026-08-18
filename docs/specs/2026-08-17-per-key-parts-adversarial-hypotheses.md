# Per-key `::part()` names: adversarial validation (#231)

Written before the suites were trusted, per CLAUDE.md §7. Each hypothesis names a
way the green run could have been lying; each is cleared only against a run that
was **seen** to go red, then reverted.

## What is under test

`keyPart()` (`packages/kiosk-keyboard-webc/src/core/dom-utils.ts`) builds a key's
whole `part` attribute, and `_keyParts` (`core/dom-contract.ts`) declares the
closed set of names it may emit. Guards:

- `test/unit/dom-utils.test.ts` — `keyPart` per action kind, the declared-set
  containment check, the registry cross-check, the ident check.
- `test/component/kiosk-keyboard.test.ts` (`CSS parts`) — the rendered `part`
  attribute, the no-undeclared-part sweep, and one real `::part()` selector
  applied from the outer document.

## H1 — the `::part()` reachability test passes without reaching anything

`getComputedStyle(enter).outlineStyle === "dotted"` could hold because the
keyboard's own stylesheet sets a dotted outline, or because the assertion reads
an element the rule never targeted. Then the test would prove nothing about
`::part()` crossing the shadow boundary — the entire point of the issue.

**Falsified.** With `key-enter` removed from `keyPart`'s output:

```
❌ CSS parts > is reachable through ::part() from outside the shadow root
     AssertionError: expected 'none' to equal 'dotted'
```

The computed style tracks the part name, and the negative half of the assertion
(the `{shift}` key does _not_ pick up the rule) already rules out a blanket match.

## H2 — the registry cross-check compares two empty sets

`DOM.parts.filter(p => p.startsWith("key-layout-"))` against
`getRegisteredLayoutNames()` passes trivially if the filter yields nothing, which
is exactly what a renamed prefix would produce. It would then keep passing while
the declared list silently fell behind a newly added built-in layout.

**Falsified.** With `"key-layout-arabic"` deleted from `_keyParts`:

```
❌ declared CSS parts > carries one key-layout part per built-in layout, plus the base sentinel
     test/unit/dom-utils.test.ts:301
```

## H3 — the no-undeclared-part sweep passes on an empty render

`renderedPartsOf()` collects `[part]` tokens from a fixture; if the fixture
rendered nothing, or the selector missed, the "every rendered part is declared"
loop would iterate zero times and pass. A leaked internal part name would then
ship unnoticed.

**Falsified.** With an undeclared `zzz-undeclared` token pushed onto every
character key:

```
❌ CSS parts > renders no part the contract does not declare
     AssertionError: rendered part "zzz-undeclared" is declared in the DOM contract: expected false to be true
```

The sibling test `all structural parts appear in rendered shadow DOM` covers the
other direction, so an empty render cannot pass both.

## H4 — the character-key boundary is asserted nowhere

The rule "a character key gets no per-key part" is the one that keeps glyphs out
of the public API. A test that only checked special keys would let a later change
name every glyph without any suite objecting.

**Falsified.** The same injection turned both the explicit boundary test and the
older `exposes 'key' part on regular keys` red:

```
❌ CSS parts > leaves character keys anonymous, so no glyph becomes public API
     AssertionError: part of "a": expected 'key zzz-undeclared' to equal 'key'
```

## H5 — a declared part that nothing renders ships unnoticed

Added 2026-08-18 (#237). `DOM.exportParts` forwards every name in `_parts`
whether or not the template writes it, so a name declared and then forgotten
reaches consumers as a selector that matches nothing. Only the structural render
check points that way, and it read a hardcoded list, which left it blind to any
name added after it was written.

**Confirmed against the suite as shipped**: `key-badge` declared in `_parts` and
acknowledged in that list rendered nowhere and no test objected. Closed by
grouping the declared names by what makes each one render — a layout, an open
accent popup, or one key — and pinning `DOM.parts` against the three joined, so
a new name has to pick a group and the structural group stays render-checked.
Both directions were then seen red:

```
❌ CSS parts > exposes a frozen parts list and exportParts string on DOM contract
     (key-badge in _parts alone)

❌ CSS parts > all structural parts appear in rendered shadow DOM
     AssertionError: part "key-badge" found in rendered DOM: expected false to be true
     (key-badge in _parts and in the structural group)
```

A per-key name stays exempt: it renders only alongside its key, so the group it
joins is what decides whether the render check applies to it.

## Not covered, and why

- **`exportparts` forwarding through a real wrapper element.** The suite asserts
  `DOM.exportParts` equals the declared list joined, not that a nested wrapper
  forwards them. Forwarding is browser behaviour over an attribute value this
  package only produces; the value is what the package owns.
- **Visual regression.** No baseline changes: the parts add no styles of their
  own, and the injected-fault runs above confirm nothing else keys off them.
