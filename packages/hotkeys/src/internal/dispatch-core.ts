import Log from "sap/base/Log";
import { UnhandledReason } from "../library";
import { matchesKeyboardEvent } from "./match";
import { resolveIgnoreInputs } from "./dom";
import type { HotkeyRegistration, HotkeyRegistrationInfo } from "../types";
import { recordSkip, type DebugSkipEntry, type SkipInfo } from "./skip-reason";

interface FindMatchOptions {
  event: KeyboardEvent;
  isInput: boolean;
  popupOpen: boolean;
  registrations: ReadonlyArray<HotkeyRegistration>;
  skipInfo?: SkipInfo | null;
  debugSkips?: DebugSkipEntry[] | null;
  toRegistrationInfo: (reg: HotkeyRegistration) => HotkeyRegistrationInfo;
  logComponent: string;
}

/**
 * Find first matching registration for a specific scope.
 */
export function findMatchInScope(options: FindMatchOptions): HotkeyRegistration | null {
  const { event, isInput, popupOpen, registrations, skipInfo, debugSkips, toRegistrationInfo, logComponent } = options;

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
      if (debugSkips) debugSkips.push({ registration, reason: UnhandledReason.Disabled });
      continue;
    }

    if (opts.ignoreRepeat && event.repeat) {
      recordSkip(skipInfo, UnhandledReason.RepeatIgnored, registration, toRegistrationInfo);
      if (debugSkips) debugSkips.push({ registration, reason: UnhandledReason.RepeatIgnored });
      continue;
    }

    const shouldIgnoreInputs = resolveIgnoreInputs(
      opts.ignoreInputs,
      registration.parsedHotkey.ctrl,
      registration.parsedHotkey.meta,
      registration.parsedHotkey.key,
    );
    if (shouldIgnoreInputs && isInput) {
      recordSkip(skipInfo, UnhandledReason.InputSuppressed, registration, toRegistrationInfo);
      if (debugSkips) debugSkips.push({ registration, reason: UnhandledReason.InputSuppressed });
      continue;
    }

    if (opts.suppressInPopups && popupOpen) {
      recordSkip(skipInfo, UnhandledReason.PopupSuppressed, registration, toRegistrationInfo);
      if (debugSkips) debugSkips.push({ registration, reason: UnhandledReason.PopupSuppressed });
      continue;
    }

    return registration;
  }

  return null;
}
