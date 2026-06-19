import { UnhandledReason } from "../library";
import { matchesKeyboardEvent } from "./match";
import { resolveIgnoreInputs } from "./dom";
import { resolveEnabled } from "./resolve-enabled";
import type { HotkeyRegistrationInfo } from "../types";
import type { HotkeyRegistration } from "./types";
import { recordSkip, type SkipInfo } from "./skip-reason";

interface FindMatchOptions {
  event: KeyboardEvent;
  isInput: boolean;
  popupOpen: boolean;
  registrations: ReadonlyArray<HotkeyRegistration>;
  skipInfo?: SkipInfo | null;
  toRegistrationInfo: (reg: HotkeyRegistration) => HotkeyRegistrationInfo;
  logComponent: string;
}

/**
 * Find first matching registration for a specific scope.
 */
export function findMatchInScope(options: FindMatchOptions): HotkeyRegistration | null {
  const { event, isInput, popupOpen, registrations, skipInfo, toRegistrationInfo, logComponent } = options;

  for (const registration of registrations) {
    const opts = registration.options;

    if (!matchesKeyboardEvent(event, registration.parsedHotkey)) continue;

    const enabled = resolveEnabled(opts.enabled, `"${registration.normalizedHotkey}"`, logComponent);
    if (!enabled) {
      recordSkip(skipInfo, UnhandledReason.Disabled, registration, toRegistrationInfo);
      continue;
    }

    if (opts.ignoreRepeat && event.repeat) {
      recordSkip(skipInfo, UnhandledReason.RepeatIgnored, registration, toRegistrationInfo);
      continue;
    }

    const shouldIgnoreInputs = resolveIgnoreInputs(opts.ignoreInputs, registration.parsedHotkey);
    if (shouldIgnoreInputs && isInput) {
      recordSkip(skipInfo, UnhandledReason.InputSuppressed, registration, toRegistrationInfo);
      continue;
    }

    if (opts.suppressInPopups && popupOpen) {
      recordSkip(skipInfo, UnhandledReason.PopupSuppressed, registration, toRegistrationInfo);
      continue;
    }

    return registration;
  }

  return null;
}
