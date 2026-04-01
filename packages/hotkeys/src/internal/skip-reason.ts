import { UnhandledReason } from "../library";
import type { HotkeyRegistration, HotkeyRegistrationInfo } from "../types";

/**
 * Tracks why a matching registration was skipped during event processing.
 * Used to provide meaningful context to the unhandled callback.
 */
export interface SkipInfo {
  reason: UnhandledReason;
  registration?: HotkeyRegistrationInfo;
}

/**
 * Higher number = more specific/useful reason. When multiple registrations
 * are skipped, the most informative reason is reported.
 */
const SKIP_PRIORITY: Record<UnhandledReason, number> = {
  [UnhandledReason.NoMatch]: 0,
  [UnhandledReason.TargetMismatch]: 1,
  [UnhandledReason.RepeatIgnored]: 2,
  [UnhandledReason.InputSuppressed]: 3,
  [UnhandledReason.PopupSuppressed]: 4,
  [UnhandledReason.Disabled]: 5,
  [UnhandledReason.Suspended]: 6,
};

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
