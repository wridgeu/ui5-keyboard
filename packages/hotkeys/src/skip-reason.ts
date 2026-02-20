import { UnhandledReason } from "./library";
import type { HotkeyRegistration, HotkeyRegistrationInfo } from "./types";

/**
 * Tracks why a matching registration was skipped during event processing.
 * Used to provide meaningful context to the unhandled callback.
 */
export interface SkipInfo {
  reason: UnhandledReason;
  registration?: HotkeyRegistrationInfo;
}

/**
 * Debug skip entry for debug mode — records ALL skipped registrations.
 */
export interface DebugSkipEntry {
  registration: HotkeyRegistration;
  reason: UnhandledReason;
}

/**
 * Higher number = more specific/useful reason. When multiple registrations
 * are skipped, the most informative reason is reported.
 */
const SKIP_PRIORITY = {
  [UnhandledReason.NoMatch]: 0,
  [UnhandledReason.RepeatIgnored]: 1,
  [UnhandledReason.InputSuppressed]: 2,
  [UnhandledReason.PopupSuppressed]: 3,
  [UnhandledReason.Disabled]: 4,
} satisfies Record<UnhandledReason, number>;

/**
 * Record a skip reason if it is more informative than the current one.
 */
export function recordSkip(
  skipInfo: SkipInfo | null | undefined,
  reason: UnhandledReason,
  registration: HotkeyRegistration,
  toRegistrationInfo: (reg: HotkeyRegistration) => HotkeyRegistrationInfo,
): void {
  if (skipInfo && SKIP_PRIORITY[reason] > SKIP_PRIORITY[skipInfo.reason]) {
    skipInfo.reason = reason;
    skipInfo.registration = toRegistrationInfo(registration);
  }
}
