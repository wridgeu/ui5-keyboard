# UI5 TypeScript: Event Typing and Disguised Type Assertions

## The Problem

When writing UI5 event handlers in TypeScript, it's tempting to use the generic
type parameter on `sap/ui/base/Event` to get "type-safe" parameter access:

```ts
// Looks type-safe, but isn't
onKeyPress(event: UI5Event<{ key: string; shiftKey: boolean }>): void {
  const key = event.getParameter("key"); // TypeScript infers: string
  const shift = event.getParameter("shiftKey"); // TypeScript infers: boolean
}
```

This compiles, IDE autocomplete works, and it _feels_ safe. But the generic
parameter provides **zero runtime safety** — it's a **disguised type assertion**.

## Why It's a Disguised Type Assertion

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

The `ParamsType` generic **does** appear in the constructor's `oParameters`
argument, so technically it's not a "return-only" generic. But here's the catch:
**you never construct the Event yourself — UI5 does.** When the framework calls
`element.fireEvent("keyPress", { key, shiftKey })`, it constructs the Event
internally. Your handler just _receives_ it.

When you annotate your handler parameter as `event: UI5Event<{ key: string }>`,
you're telling TypeScript: "trust me, this event will have a `key` parameter of
type `string`." TypeScript believes you unconditionally. Nothing at compile time
or runtime actually validates this claim.

Compare these two approaches:

```ts
// Approach A: Disguised assertion via generic
onKeyPress(event: UI5Event<{ key: string; shiftKey: boolean }>): void {
  const key = event.getParameter("key"); // string — looks safe
}

// Approach B: Explicit assertion
onKeyPress(event: { getParameter(name: string): unknown }): void {
  const key = event.getParameter("key") as string; // string — honest about the cast
}
```

Both produce identical JavaScript. Both are equally "safe" (i.e., not safe at
all). The difference is that Approach B is **honest**: the `as string` makes it
immediately clear that you're asserting a type, not proving one. Approach A hides
the assertion behind the generic, creating a false sense of security.

## The `byId<T>()` Variant

The same pattern was proposed for `this.byId()` in UI5 TypeScript:

```ts
// Proposed: disguised assertion
this.byId<Button>("submitButton").setText("OK");

// What it really means — same as:
(this.byId("submitButton") as Button).setText("OK");
```

This was discussed in
[SAP-samples/ui5-cap-event-app#5](https://github.com/SAP-samples/ui5-cap-event-app/pull/5)
and ultimately rejected. The generic `T` only appears in the return type, not in
the input parameters — the textbook definition of an unnecessary generic.

## What the TypeScript Community Says

### DefinitelyTyped Common Mistakes

From the [DefinitelyTyped README](https://github.com/DefinitelyTyped/DefinitelyTyped#common-mistakes):

> `getMeAT<T>(): T`: If a type parameter does not appear in the types of any
> parameters, you don't really have a generic function, you just have a disguised
> type assertion. Prefer to use a real type assertion, e.g. `getMeAT() as number`.

### dtslint `no-unnecessary-generics` Rule

From
[Microsoft/dtslint](https://github.com/Microsoft/dtslint/blob/master/docs/no-unnecessary-generics.md):

> Type parameters that are used only once serve no purpose — they relate nothing.
> A generic parameter is meant to _relate_ the type of one thing to another (e.g.
> input to output, or one parameter to another). When it appears only once, it
> could be replaced with its constraint or a concrete type.

The rule identifies two patterns:

```ts
// BAD: T only constrains the return type
function parse<T>(): T;
// Callers write: parse<number>() — this is just parse() as number in disguise

// GOOD: T relates input to output
function identity<T>(x: T): T;
// T appears in both parameter and return — it actually constrains something
```

### akudev (Andreas Kunz, SAP UI5 Team)

In a [March 2022 comment](https://github.com/SAP-samples/ui5-cap-event-app/pull/5#issuecomment-855343402)
on the `byId<T>()` proposal, akudev referenced the DefinitelyTyped guidance
directly, confirming that this pattern should be avoided in UI5 TypeScript type
definitions.

## Recommended Approach for UI5 Event Handlers

Use structural typing with explicit `as` casts:

```ts
onKeyPress(event: { getParameter(name: string): unknown }): void {
  const key = event.getParameter("key") as string;
  const shift = event.getParameter("shiftKey") as boolean;
  // ...
}
```

This approach:

- Is **honest** about the type assertion — `as string` is visible at the usage site
- Uses **structural typing** — works with any object that has `getParameter()`,
  not just `sap/ui/base/Event`
- Avoids importing `sap/ui/base/Event` just for typing (one less module dependency)
- Matches the pattern used in SAP's own TypeScript samples

### When the Generated Types ARE Useful

UI5's type generator produces named event type aliases like:

```ts
type Route$MatchedEvent = Event<Route$MatchedEventParameters, Route>;
```

These are useful when **the framework defines them** — they're generated from the
control's metadata and represent the canonical parameter shape. If an event type
alias exists for your event, use it:

```ts
import type { Button$PressEvent } from "sap/m/Button";

onPress(event: Button$PressEvent): void {
  // getParameter() is properly typed via the generated alias
}
```

The difference: here you're using a type that the **framework guarantees** matches
the actual event shape, not a type you made up yourself.

## References

- [DefinitelyTyped: Common Mistakes](https://github.com/DefinitelyTyped/DefinitelyTyped#common-mistakes)
- [dtslint: no-unnecessary-generics](https://github.com/Microsoft/dtslint/blob/master/docs/no-unnecessary-generics.md)
- [SAP-samples/ui5-cap-event-app#5](https://github.com/SAP-samples/ui5-cap-event-app/pull/5) — `byId<T>()` proposal and rejection
- [akudev's comment on disguised type assertions](https://github.com/SAP-samples/ui5-cap-event-app/pull/5#issuecomment-855343402)
