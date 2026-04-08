import Log from "sap/base/Log";
import { UnhandledReason } from "../library";
import { matchesKeyboardEvent } from "./match";
import { resolveIgnoreInputs } from "./dom";
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

    let enabled: boolean;
    try {
      enabled = typeof opts.enabled === "function" ? opts.enabled() : opts.enabled;
    } catch (error) {
      Log.warning(
        `Error evaluating enabled() for "${registration.normalizedHotkey}": ${error}`,
        undefined,
        logComponent,
      );
      enabled = false;
    }
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
