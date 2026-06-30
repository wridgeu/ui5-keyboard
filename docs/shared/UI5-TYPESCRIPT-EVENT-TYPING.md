# UI5 TypeScript: Event Typing and Disguised Type Assertions

## TL;DR

Do not fake-type UI5 events with a return-only generic such as
`event: UI5Event<{ key: string }>`. It compiles and gives you autocomplete but
provides **zero** runtime safety: you never construct the Event (UI5 does, inside
`fireEvent`), so the generic only annotates the value flowing back out. Prefer an
honest `as` cast, or a framework-generated `$Event` alias when one exists.

## The Problem

When writing UI5 event handlers in TypeScript, it is tempting to put the
parameter shape on the `sap/ui/base/Event` generic to get "type-safe" parameter
access:

```ts
// Looks type-safe, but isn't
onKeyPress(event: UI5Event<{ key: string; shiftKey: boolean }>): void {
  const key = event.getParameter("key"); // TypeScript infers: string
  const shift = event.getParameter("shiftKey"); // TypeScript infers: boolean
}
```

This compiles, IDE autocomplete works, and it _feels_ safe. It is not: the
generic is a disguised type assertion.

## Why It Is a Disguised Type Assertion

Looking at the actual `sap/ui/base/Event` type definition (OpenUI5 1.144.0):

```ts
class Event<
  ParamsType extends Record<string, any> = object,
  SourceType extends EventProvider = EventProvider,
> extends BaseObject {
  constructor(sId: string, oSource: SourceType, oParameters: ParamsType);

  getParameter<ParamName extends keyof ParamsType>(sName: ParamName): ParamsType[ParamName];

  getParameters(): ParamsType;
}
```

`ParamsType` **does** appear in the constructor's `oParameters` argument, so it is
not literally a "return-only" generic. But here is the catch: **you never
construct the Event yourself. UI5 does.** When the framework runs
`element.fireEvent("keyPress", { key, shiftKey })`, it builds the Event
internally; your handler only _receives_ it.

So annotating your handler parameter as `UI5Event<{ key: string }>` just tells
TypeScript "trust me, this event has a `key` of type `string`". TypeScript
believes you unconditionally, and nothing at compile time or runtime validates
the claim. The generic collapses to an assertion. Make the assertion honest and
visible instead:

```ts
// Disguised assertion: the cast is hidden behind the generic
onKeyPress(event: UI5Event<{ key: string }>): void {
  const key = event.getParameter("key"); // "string", but unproven
}

// Honest assertion: the cast is visible at the use site
onKeyPress(event: { getParameter(name: string): unknown }): void {
  const key = event.getParameter("key") as string;
}
```

Both emit identical JavaScript and are equally unsafe. The second is honest about
it.

## Recommended Approach for UI5 Event Handlers

Use structural typing with an explicit `as`:

```ts
onKeyPress(event: { getParameter(name: string): unknown }): void {
  const key = event.getParameter("key") as string;
  const shift = event.getParameter("shiftKey") as boolean;
}
```

The `as` is visible at the usage site, the structural type works with any object
exposing `getParameter()`, and you avoid importing `sap/ui/base/Event` just for
typing. This matches SAP's own TypeScript samples.

## When the Generated Types ARE Useful

The carve-out is framework-generated `$Event` aliases. UI5's type generator emits
canonical, metadata-derived aliases like `Button$PressEvent` or
`Route$MatchedEvent`. The framework guarantees these match the actual event
shape, so prefer them when they exist:

```ts
import type { Button$PressEvent } from "sap/m/Button";

onPress(event: Button$PressEvent): void {
  // getParameter() is properly typed via the generated alias
}
```

The difference from the anti-pattern: you are using a type the framework
guarantees, not one you made up.

## The Same Shape Elsewhere: `byId<T>()`

`this.byId<Button>("submitButton")` is the identical disguised assertion. The
generic `T` appears only in the return type, so it is just
`(this.byId("submitButton") as Button)` with the cast hidden. It was proposed and
rejected for UI5 TypeScript in
[SAP-samples/ui5-cap-event-app#5](https://github.com/SAP-samples/ui5-cap-event-app/pull/5).

## What the TypeScript Community Says

From the
[DefinitelyTyped README](https://github.com/DefinitelyTyped/DefinitelyTyped#common-mistakes):

> `getMeAT<T>(): T`: If a type parameter does not appear in the types of any
> parameters, you don't really have a generic function, you just have a disguised
> type assertion. Prefer to use a real type assertion, e.g. `getMeAT() as number`.

dtslint encodes this as the
[`no-unnecessary-generics`](https://github.com/Microsoft/dtslint/blob/master/docs/no-unnecessary-generics.md)
rule: a generic must _relate_ one type to another (input to output); used once,
it relates nothing and should be a concrete type or an explicit cast.

```ts
// BAD: T only constrains the return type
function parse<T>(): T; // parse<number>() is just parse() as number in disguise

// GOOD: T relates input to output
function identity<T>(x: T): T; // T appears in both parameter and return
```

SAP's own UI5 team referenced the DefinitelyTyped guidance directly when
rejecting the `byId<T>()` proposal
([akudev, March 2022](https://github.com/SAP-samples/ui5-cap-event-app/pull/5#issuecomment-855343402)).

## References

- [DefinitelyTyped: Common Mistakes](https://github.com/DefinitelyTyped/DefinitelyTyped#common-mistakes)
- [dtslint: no-unnecessary-generics](https://github.com/Microsoft/dtslint/blob/master/docs/no-unnecessary-generics.md)
- [SAP-samples/ui5-cap-event-app#5](https://github.com/SAP-samples/ui5-cap-event-app/pull/5): `byId<T>()` proposal and rejection
- [akudev's comment on disguised type assertions](https://github.com/SAP-samples/ui5-cap-event-app/pull/5#issuecomment-855343402)
