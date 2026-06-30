# UI5 TypeScript: Event Typing and Disguised Type Assertions

## The Rule

Do not fake-type UI5 events with a return-only generic. Writing
`event: UI5Event<{ key: string }>` and then reading `event.getParameter("key")`
compiles and gives you autocomplete, but provides **zero** runtime safety: you
never construct the Event (UI5 does, inside `fireEvent`), so the generic only
ever annotates the value flowing back out. A type parameter that appears solely
in the return position is the textbook
[disguised type assertion](https://github.com/DefinitelyTyped/DefinitelyTyped#common-mistakes):
`getMeAT<T>(): T` is just `getMeAT() as T` with the cast hidden. Be honest about
the cast instead.

## Recommended Approach for UI5 Event Handlers

Use structural typing with explicit `as`:

```ts
onKeyPress(event: { getParameter(name: string): unknown }): void {
  const key = event.getParameter("key") as string;
  const shift = event.getParameter("shiftKey") as boolean;
}
```

The `as string` is visible at the usage site, the structural type works with any
object exposing `getParameter()`, and you avoid importing `sap/ui/base/Event`
just for typing. This matches SAP's own TypeScript samples.

## When the Generated Types ARE Useful

The carve-out is framework-generated `$Event` aliases. UI5's type generator
emits canonical, metadata-derived aliases like `Route$MatchedEvent` or
`Button$PressEvent`. These are guaranteed by the framework to match the actual
event shape, so prefer them when they exist:

```ts
import type { Button$PressEvent } from "sap/m/Button";

onPress(event: Button$PressEvent): void {
  // getParameter() is properly typed via the generated alias
}
```

The difference from the anti-pattern: you are using a type the framework
guarantees, not one you made up.

## Background

The same return-only-generic shape was proposed for `this.byId<T>()` and rejected
in [SAP-samples/ui5-cap-event-app#5](https://github.com/SAP-samples/ui5-cap-event-app/pull/5)
(see [akudev's comment](https://github.com/SAP-samples/ui5-cap-event-app/pull/5#issuecomment-855343402)),
on the same DefinitelyTyped grounds. dtslint encodes this as the
[`no-unnecessary-generics`](https://github.com/Microsoft/dtslint/blob/master/docs/no-unnecessary-generics.md)
rule: a generic must _relate_ one type to another (input to output); used once,
it relates nothing and should be a concrete type or an explicit cast.

## References

- [DefinitelyTyped: Common Mistakes](https://github.com/DefinitelyTyped/DefinitelyTyped#common-mistakes)
- [dtslint: no-unnecessary-generics](https://github.com/Microsoft/dtslint/blob/master/docs/no-unnecessary-generics.md)
- [SAP-samples/ui5-cap-event-app#5](https://github.com/SAP-samples/ui5-cap-event-app/pull/5), `byId<T>()` proposal and rejection
- [akudev's comment on disguised type assertions](https://github.com/SAP-samples/ui5-cap-event-app/pull/5#issuecomment-855343402)
