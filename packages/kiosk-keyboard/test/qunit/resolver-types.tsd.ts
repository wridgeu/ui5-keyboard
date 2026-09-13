import KioskKeyboard from "ui5/kiosk/KioskKeyboard";
import type { I18nResolver, TargetResolver } from "ui5/kiosk/types";

// Compile-time contract for the resolver types `ui5/kiosk/types` exports. Nothing here
// runs: the file is not registered in testsuite.qunit.ts. The import fails the build if
// either type stops being exported, and each `@ts-expect-error` fails it if its line
// starts to compile, as it would once a resolver type loosens to `any`.

const byHost: TargetResolver = (el) => el.querySelector("input");
const kb = new KioskKeyboard();
kb.setTargetResolver(byHost);
KioskKeyboard.setGlobalTargetResolver(byHost);
const instanceResolver: TargetResolver | null = kb.getTargetResolver();
const globalResolver: TargetResolver | null = KioskKeyboard.getGlobalTargetResolver();
void instanceResolver;
void globalResolver;

// @ts-expect-error a target resolver returns a text field or null, not any element
const returnsHost: TargetResolver = (el) => el;
void returnsHost;

const upperCase: I18nResolver = (_key, _locale, resolvedText) => resolvedText.toUpperCase();
KioskKeyboard.setI18nResolver(upperCase);

// @ts-expect-error an i18n resolver returns text or undefined, not a number
const returnsLength: I18nResolver = (_key, _locale, resolvedText) => resolvedText.length;
void returnsLength;
