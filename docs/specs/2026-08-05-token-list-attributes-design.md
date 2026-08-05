# Token-list attributes: whitespace after a comma (#223, #224)

**Date:** 2026-08-05
**Issues:** [#224](https://github.com/wridgeu/ui5-keyboard/issues/224) (`controls`, silent), [#223](https://github.com/wridgeu/ui5-keyboard/issues/223) (`suppress`, fatal)
**Status:** Implemented
**Package:** `packages/kiosk-keyboard` only. `kiosk-keyboard-webc` has no defect and takes no production change.

## 1. The defect

Both issues are one root cause with opposite failure modes. UI5 parses an array-typed property written as an XML attribute by splitting on commas and trimming nothing:

```js
// sap/ui/base/DataType.js:390-396 (OpenUI5 1.136.18, the pinned version)
oType.parseValue = function (sValue) {
  var aValues = sValue.split(",");
  for (var i = 0; i < aValues.length; i++) {
    aValues[i] = componentType.parseValue(aValues[i]);
  }
  return aValues;
};
```

What happens next depends entirely on the component type, because `validateProperty` special-cases one type name:

```js
// sap/ui/base/ManagedObject.js:1621-1638
} else if (oType.getName() == "string[]") {
    // ... coerce every entry to a string, validate nothing ...
} else if (!oType.isValid(oValue)) {
    throw new Error(...);
}
```

- `controls` is `string[]`, so `" emailInput"` survives coercion, misses both branches of `_findControlById`, and is dropped by a bare `continue` (`src/internal/controls-delegation-controller.ts:90-92`). **Silent.**
- `suppress` is `ui5.kiosk.LayoutFacet[]`, whose enum parser is `oEnum[sValue]` (`DataType.js:446-448`), so `" Middleware"` becomes `undefined`, the array `isValid` rejects it, and `XMLView.create` rejects. **Fatal to the whole view.**

`suppress` is the library's only enum-array property, which is why it is the only attribute where padding is fatal rather than merely wrong.

## 2. Why this is a defect and not a framework constraint to document

Whitespace around a comma-separated token is not part of the token. That is specified, not a matter of taste:

- WHATWG Infra, [split a string on commas](https://infra.spec.whatwg.org/#split-on-commas), carries the normative per-token step _"Strip leading and trailing ASCII whitespace from token"_.
- HTML's [set of comma-separated tokens](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#comma-separated-tokens) microsyntax defines tokens as _"neither beginning nor ending with ASCII whitespace ... and optionally surrounded by ASCII whitespace"_.

UI5's array parser implements Infra's _other_ algorithm, "strictly split a string". So `suppress="Variants, Middleware"` is conforming author markup and rejecting it is the bug. Two further facts make "document the limitation" untenable: this library's own design spec writes the spaced form (`docs/specs/2026-04-08-unified-controls-attribute.md:32-36`), and the web-component twin publishes the tolerance as a documented guarantee (`packages/kiosk-keyboard-webc/README.md:530`). Identical markup cannot be valid in one package and view-fatal in the other.

## 3. The mechanism

`createArrayType`'s parser delegates each comma token to the **component type's** `parseValue`. That is the framework's own per-token seam, and it is the only one: a component `parseValue` receives exactly one token and returns exactly one value.

So each list property gets a component `DataType` whose `parseValue` trims one token. The library declares a token contract; the framework does every split. There is no delimiter, no index arithmetic and no string parser in library code.

Three things make it the idiomatic choice:

1. **It is the framework's documented extension point.** `DataType.createType(name, { parseValue, isValid }, base)` is public, and `getType("Foo[]")` resolves the component name through the ordinary type registry and caches the manufactured array type (`DataType.js:544-552`), so a library-registered scalar works as an array component with no framework change.
2. **It is what SAP itself uses `parseValue` for.** Across every OpenUI5 library at 1.136.18 there are exactly two `parseValue` overrides, and both are whitespace normalizers built on `createType(..., "string")`: `sap.ui.core.CSSGapShortHand` (`sap/ui/core/library.js:939-957`) and `sap.ui.layout.cssgrid.CSSGridTrack` (`sap/ui/layout/library.js:803-825`).
3. **It is the family every comparable framework belongs to.** Lit's `ComplexAttributeConverter.fromAttribute`, FAST's `@attr({ converter })`, Angular's input `transform` (`booleanAttribute`, `numberAttribute`). All of them put attribute coercion in a declared per-property converter, never in business logic. `DataType.parseValue` is UI5's member of that family.

### 3.1 Where the framework has no hook

**The JS path never parses.** `applySettings` sends a property straight to its mutator (`ManagedObject.js:1332-1337`), so `new KioskKeyboard({ controls: [" emailInput"] })` — the repro issue #224 itself specifies — never reaches `parseValue`. The same is true of a model-bound `controls="{/ids}"`.

The only public on-write hook is `DataType.prototype.setNormalizer`, which `validateProperty` applies at `ManagedObject.js:1645-1648`, **after** the `isValid` throw at `:1635`. That ordering decides the asymmetry between the two properties:

|                  | `ui5.kiosk.ControlID`    | `ui5.kiosk.LayoutFacet`         |
| ---------------- | ------------------------ | ------------------------------- |
| vocabulary       | open (any id)            | closed (two members)            |
| `isValid`        | none — inherits `string` | member check                    |
| `parseValue`     | trim                     | trim                            |
| array normalizer | yes                      | no — unreachable past `isValid` |

The principle: **normalize on write where the type is open; validate where the type is closed.** A closed type cannot have a write-time normalizer without first calling `" Middleware"` valid, and the loud rejection of a genuine typo is a pinned contract (`test/qunit/customLayouts-xml.qunit.ts:195`).

`setNormalizer` has zero callers in all of OpenUI5 1.136.18. Its JSDoc sanctions it for "applications or application frameworks" and warns it "is not intended to break-out of the value range defined by a type" — trimming an id stays inside the string value range, and the normalizer is set on `ui5.kiosk.ControlID[]`, a type only this library declares, so no page-global type object is mutated. It earns its place through the test in §6 that stays red without it.

## 4. The change

In `src/library.ts`, beside the two `createType` calls already there:

```ts
DataType.createType("ui5.kiosk.ControlID", { parseValue: trimToken }, "string");
DataType.getType("ui5.kiosk.ControlID[]")!.setNormalizer(normalizeTokens);
DataType.createType(
  "ui5.kiosk.LayoutFacet",
  { defaultValue: LayoutFacet.Variants, isValid: isLayoutFacetName, parseValue: trimToken },
  "string",
);
```

`LayoutFacet` passes `defaultValue` because `createType` defines a default only when the settings object carries one (`DataType.js:217-222`), and `validateProperty` returns a type's default without validating it (`ManagedObject.js:1612-1613`). Without it the type inherits the `string` base's `""`, a value its own `isValid` rejects. `suppress` declares `defaultValue: []` and so never reads it; a future scalar property of this type would.

`normalizeTokens` drops empty tokens as well as trimming. A component `parseValue` receives one token and can neither split nor drop, so `controls=""` and a trailing comma reach the property as `[""]` and `["a", ""]`; an empty token names nothing, and leaving it in would make the §5 diagnostic report an id the author never wrote. This is also what closes the last gap to the twin, whose splitter already filters (`kiosk-keyboard-webc/src/KioskKeyboard.ts:881-888`).

`controls` becomes `type: "ui5.kiosk.ControlID[]"`; `suppress` keeps `type: "ui5.kiosk.LayoutFacet[]"`. Both `.gen.d.ts` files are regenerated, never hand-edited.

### 4.1 `LayoutFacet`: `createType` instead of `registerEnum`

`LayoutFacet` is the one enum in this library that also serves as an array component type, and a registered enum's parser cannot trim. Registering it with `createType` over the `string` base keeps a single type name, so the public surface is unchanged: `getSuppress(): LayoutFacet[]`, the exported TS enum, and both type-level pins in `custom-layout-types.tsd.ts` all stay as they are. The alternative — a second `ui5.kiosk.LayoutFacetName` type plus an exported alias — buys nothing a consumer can see and renames the generated accessor's type.

The cost is smaller than it looks and lands entirely in the future. `isEnumType()` and `getEnumValues()` stop answering for this type, and those are what the Diagnostics Control Tree plugin (`sap/ui/core/support/plugins/ControlTree.js:1524-1526`) and `sap/ui/debug/PropertyList` (`:146,158`) read to render a value dropdown. Both resolve the **property's** type, which for `suppress` is `ui5.kiosk.LayoutFacet[]` — and `createArrayType` never overrides `isEnumType` (`DataType.js:357-408`), so it inherits `DataType.prototype.isEnumType` and answers `false`. **`suppress` had no dropdown before this change either.** What is actually given up is the dropdown for a future _scalar_ property typed `ui5.kiosk.LayoutFacet`, of which there is none. Nothing in the runtime depends on either accessor. `LayoutRole` and the four keyboard enums keep `registerEnum`; CLAUDE.md records the exception and its trigger.

### 4.2 Deliberately out of scope

`locales` stays `string[]`. It is not broken end to end — the fold trims and lowercases every tag (`src/internal/custom-layout-fold.ts:233-236`) — so only the raw `getLocales()` value carries a space. Retyping it would delete `validateProperty`'s bare-string widening, which `test/qunit/custom-layouts.qunit.ts:398-419` pins by test (`locales: "pl"` through the aggregation's default class). That widening is keyed on the literal type name `"string[]"` (`ManagedObject.js:1621`) and cannot be recovered on any other type.

The price, accepted: the two sibling list properties now normalize at different layers, so `getLocales()` reads back `[" en"]` where `getControls()` reads back `["en"]`, and a bare string still widens for `locales` while it throws for `controls`. Retyping `locales` the same way would cost the pinned widening to fix a value no reader consumes.

### 4.3 What `controls` stops accepting

`controls` loses `validateProperty`'s compatibility branch entirely, and that branch did two things. The bare-string widening goes: `new KioskKeyboard({ controls: "myInput" })` changes from working to throwing. So does the per-entry coercion at `ManagedObject.js:1630-1634` (`oValue[i] = "" + oValue[i]`), so an array carrying a non-string entry throws where it used to be stringified.

Nothing is released yet, so this narrows the property before anyone depends on it rather than breaking a published contract. Neither form is TS-legal, and neither appears in a test, demo or README; the bare string survived in exactly one JSDoc example (`src/layouts/ja-kana-compact.ts:42`), which this change corrects.

Two paths are worth naming anyway, because TypeScript does not check them and both fail loudly at runtime:

- `controls="{/targetIds}"` where the model array holds a number or a `null` (an unloaded row). `ManagedObjectBindingSupport` re-raises anything that is not a `FormatException`, so this surfaces as an error out of the model-update turn rather than a log line. Under `string[]` the same value was silently wrong.
- `controls="{= 'nameInput' }"` — an all-constant expression binding hands the mutator a string (`ManagedObject.js:3546-3552`).

The remedy for both is the documented one: pass an array of strings.

## 5. The diagnostic (#224 part 2)

Trimming fixes the padded id. It does not make a _mistyped_ id visible, which is the more common fault and the one the silent `continue` has always swallowed.

**Emit site:** the resolution loop in `ControlsDelegationController.sync()`, written inline at the call site. Not a `DiagnosticCode`: that union requires a `layout` and lives in `custom-layout-fold.ts`, a byte-compared twin module (`tools/check-twin-drift.mjs`), so joining it would force an unrelated edit into the webc fold.

**Once per distinct id.** Deduplication is load-bearing, not cosmetic: `sync()` runs from `onAfterRendering`, from `setControls`, and from the document-wide `focusin` capture listener, and the `_isResolutionUnchanged` fast path returns _after_ the resolution loop. An unreported miss would re-log on every focus change in the application. The id leaves the set the moment it does resolve, so an id that breaks again afterwards is reported again.

**"Not yet rendered" is the wrong frame.** A `ManagedObject` enters the element registry inside its constructor, before `init()` and before `applySettings` (`ManagedObject.js:511-517`), independently of rendering; an XMLView builds its whole content tree before anything renders. A merely unrendered target therefore always resolves. The two real "not yet" cases are (a) the keyboard is not yet parented under its View, so the view-local `byId` cannot run, and (b) the target is constructed later — a lazily loaded Fragment, another routing target.

**Gate:** warn only once the host has a DOM ref. Structural, not a timer, matching the repo's existing precedent for this class of problem (`rowsPending` is a producer-supplied "it can still arrive" signal, never an elapsed-time guess). By the time the host renders, any enclosing View is an ancestor, so the view-local lookup has run against the tree it was meant to, which is what case (a) needed.

Three residuals, all accepted:

- **A target constructed later.** `ElementRegistry` is created with only an `onDuplicate` hook and `ManagedObjectRegistry.create` supports only `onDuplicate`/`onDeregister`, so there is no element-added signal to subscribe to. Such a target produces exactly one warning that later becomes untrue; the message's closing clause says so.
- **`visible="false"`.** An invisible control renders a placeholder under `sap-ui-invisible-<id>` (`InvisibleRenderer.js:31,41`), so `getDomRef()` is `null` (`Element.js:485-487`), and `RenderManager.js:1274` skips `onAfterRendering` for it. The report is therefore deferred until the keyboard becomes visible, not lost — which is the right trade, since an invisible keyboard is delegating focus to nothing anyone can see.
- **The detach window.** `setParent(null)` does not remove DOM, so between `removeContent(kb)` and the next rendering tick the host is rendered and unparented at once, and a correct view-local id looks unresolvable. One warning, self-correcting on the next `sync()`.

## 6. Tests

Each was run against `main` first and failed for the stated reason. Every hook the change adds is pinned by a test that goes red when that hook alone is removed, confirmed by injecting each fault in turn rather than by inspection.

| Test                                                                                                        | Fails without                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XMLView with `suppress="Variants, Middleware"` resolves and `getSuppress()` is `["Variants", "Middleware"]` | `LayoutFacet.parseValue`. On `main`: the enum parser yields `undefined`, the array `isValid` rejects, `XMLView.create` rejects — issue #223's repro        |
| XMLView with `controls="firstInput, secondInput"`, focusing the second input delegates to it                | either token hook. On `main`: `" secondInput"` resolves to nothing and is dropped by the silent `continue` — issue #224's repro                            |
| `new KioskKeyboard({ controls: [" <id>"] })` types into the input                                           | `setNormalizer`. The settings path never parses, so this is the only test that isolates it                                                                 |
| `controls` written with an empty token reports nothing and drops it                                         | `normalizeTokens`' filter. Without it the entry survives and the diagnostic reports an id the author never wrote                                           |
| An unresolvable id logs exactly one warning across repeated `focusin` events                                | the dedupe set                                                                                                                                             |
| An id reported, then resolved, then broken again is reported a second time                                  | the `delete` on successful resolution — the "it leaves the set the moment it resolves" contract in §5                                                      |
| An unrendered keyboard logs nothing                                                                         | the render gate. Vacuous on `main`, so it was checked the other way: removing the gate turns it red                                                        |
| Existing: a typo in `suppress` still rejects the view                                                       | `LayoutFacet.isValid`. Its inline comment now cites the member check rather than the old `parseValue`-to-`undefined` mechanism; the assertion is unchanged |
| webc: `suppress="Variants, Middleware"` via the fixture factory                                             | `splitTokens`' whitespace class. Green on `main` — added because the webc README publishes that tolerance as a guarantee and nothing exercised it          |

`ControlID.parseValue` is the one hook no test isolates, and it cannot have one: every path that reaches it also reaches the array normalizer, which trims the same value afterwards. It stays because the type must parse its own token correctly to be usable on its own, not because a test demands it.

## 7. Twin divergence after the change

- `controls`: **closed.** Both packages now accept `"a,b"` and `"a, b"`, and both drop an empty token, so `"a,"` and `""` agree too. Kiosk reaches that through `parseValue` plus `normalizeTokens`; webc through `split(",").map(trim).filter(Boolean)`.
- `suppress`: **narrowed, not closed.** Both accept the comma forms; only the webc accepts the space-only `"Variants Middleware"`, because its `splitTokens` splits on `/[\s,]+/`. A component `parseValue` receives one token and can neither split nor drop, so kiosk cannot accept that form without modelling the property as a 0..n association — rejected below.
- The diagnostic is kiosk-only. The webc's multi-id path never resolves ids at all (it matches focused-element ancestors), so there is no equivalent emit site.

## 8. Rejected alternatives

| Option                                                                            | Why not                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trim inside `sync()` / `setControls` (#224's own part 1)                          | The hand-rolled normalization the framework makes unnecessary. Leaves `getControls()` returning padded ids, repairs nothing for `suppress` (which throws before any control code runs), and must be repeated at every future reader.                            |
| Document "no spaces" and pin the rejection (#223's own recommendation)            | Documents a spec violation as a contract, and contradicts both this library's own design spec and the twin's published guarantee. Recommended in the issue only because `createArrayType`'s delegation to `componentType.parseValue` had not been found.        |
| Retype `suppress` as `string[]` with a hand-written `setSuppress` (#223 option 2) | Trades the typed public surface for a whitespace convenience the type system supplies for free, breaks both tsd pins, and hand-writes a mutator the generator owns.                                                                                             |
| Model `controls` as a 0..n association                                            | `XMLTemplateProcessor` would split on `/[\s,]+/` for free, but `createId` prefixes unconditionally, destroying the documented view-local-then-global fallback that three tests pin; it changes the shape of the public API; and it does nothing for `suppress`. |
| `setNormalizer` on the built-in `string[]` type                                   | `getType` caches array types in a page-global map, so this mutates the single `string[]` type shared by every control on the page. A control library must not do that.                                                                                          |
| Type `controls` as `sap.ui.core.ID[]`                                             | Its `isValid` regex rejects a padded id, and the name is not literally `"string[]"`, so `validateProperty` takes the throwing branch — it converts #224's silent drop into #223's view rejection.                                                               |
| Fix it in `custom-layout-fold.ts`                                                 | Never runs for #223 (the throw precedes the fold), and the file is a byte-compared twin.                                                                                                                                                                        |
