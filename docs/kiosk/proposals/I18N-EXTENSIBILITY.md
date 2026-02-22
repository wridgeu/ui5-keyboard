# Feature Proposal: Configurable i18n Extensibility for `ui5.kiosk`

## Why

`KioskKeyboard` currently resolves texts from the library bundle only (`ui5.kiosk`).
This works for built-in locales, but consumers cannot easily:

- add new locales without changing the library package
- override selected built-in texts in a supported way

For enterprise apps, tenant-specific wording and additional languages are common.
This proposal adds both in a controlled API surface.

## Goals

1. Allow consumers to enable additional locales via configuration.
2. Provide an explicit, documented override hook for selected texts.
3. Keep backward compatibility with current behavior when not configured.
4. Keep control rendering deterministic and safe when translations are missing.

## Non-Goals

- No breaking changes to existing control properties/events.
- No mandatory migration for current consumers.
- No replacement of the standard UI5 language resolution logic.

## Current Limitation

- Internal text lookup uses the library bundle directly.
- Consumers can set `ariaLabel`, but cannot override all internal labels/messages.
- Additional locale bundles are not configurable from consumer apps today.

## Proposed API

### 1) Additional locales via config

Add a static API on `KioskKeyboard`:

```ts
KioskKeyboard.configureI18n({
  supportedLocales?: string[];
  fallbackLocale?: string;
  enhanceWith?: Array<{
    bundleName?: string;
    bundleUrl?: string;
    supportedLocales?: string[];
    fallbackLocale?: string;
  }>;
});
```

Behavior:

- `supportedLocales` extends allowed locales for keyboard texts.
- `fallbackLocale` controls language fallback after locale-specific lookup.
- `enhanceWith` allows consumer bundles (same concept as UI5 ResourceBundle enhancement chain).
- When not called, existing default behavior remains unchanged.

Companion reset API for tests/FLP lifecycle cleanup:

```ts
KioskKeyboard.resetI18nConfiguration();
```

### 2) Explicit override hook for consumers

Add a static override hook:

```ts
type KioskI18nOverrideContext = {
  key: string;
  locale: string;
  defaultText: string;
  resolvedText: string;
};

KioskKeyboard.setI18nOverrideHook((ctx: KioskI18nOverrideContext) => {
  // return string to override; return undefined to keep resolvedText
  return undefined;
});
```

Companion clear API:

```ts
KioskKeyboard.clearI18nOverrideHook();
```

## Resolution Order

For each text key, resolve in this order:

1. Base library bundle (`ui5.kiosk`).
2. Configured enhancement bundles (`enhanceWith`), last one wins.
3. Override hook return value, if defined.
4. Hardcoded safety fallback currently passed by call sites.

This keeps UI5-compatible bundle behavior while giving a final explicit hook.

## Consumer Examples

### A) Add French and Spanish locale bundles

```ts
KioskKeyboard.configureI18n({
  supportedLocales: ["", "de", "fr", "es"],
  fallbackLocale: "en",
  enhanceWith: [{ bundleName: "my.app.i18n.kiosk" }],
});
```

### B) Tenant-specific wording override

```ts
KioskKeyboard.setI18nOverrideHook(({ key, resolvedText }) => {
  if (key === "KIOSK_KEYBOARD_LABEL") {
    return "Terminal Keyboard";
  }
  return resolvedText;
});
```

## Implementation Notes

- Introduce an internal i18n service module that centralizes bundle lookup and hook execution.
- Keep public control API unchanged; only internal `getText(...)` implementation changes.
- Invalidate i18n cache on UI5 language change and on `configureI18n(...)` calls.
- Ensure fallback strings remain in place so rendering never fails due to missing translations.

## Testing Strategy

- Unit tests for:
  - locale config application (`supportedLocales`, `fallbackLocale`)
  - enhancement bundle precedence
  - override hook precedence and removal
  - fallback behavior for unknown keys/locales
- Integration tests to verify language switches update keyboard labels/ARIA text.
- FLP lifecycle tests to confirm reset APIs prevent cross-app leakage.

## Risks

- Misconfigured consumer bundles could lead to partial translations.
- Global static configuration can leak across app sessions in FLP if not reset.

Mitigation:

- Keep safe hardcoded fallbacks.
- Provide reset APIs and document recommended cleanup in `Component.destroy()`.

## Rollout Plan

1. Add APIs as optional, fully backward-compatible features.
2. Document examples in README i18n section.
3. Add tests for all precedence and lifecycle scenarios.
4. Mark feature as stable after one release cycle of usage feedback.
