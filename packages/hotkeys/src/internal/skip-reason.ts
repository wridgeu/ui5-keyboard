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
 *
 * Only reasons that flow through {@link recordSkip} are listed here.
 * `Suspended` is emitted directly via `_emitUnhandled` and bypasses this table.
 */
const SKIP_PRIORITY: Partial<Record<UnhandledReason, number>> = {
  [UnhandledReason.NoMatch]: 0,
  [UnhandledReason.TargetMismatch]: 1,
  [UnhandledReason.RepeatIgnored]: 2,
  [UnhandledReason.InputSuppressed]: 3,
  [UnhandledReason.PopupSuppressed]: 4,
  [UnhandledReason.Disabled]: 5,
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
  if (skipInfo && (SKIP_PRIORITY[reason] ?? -1) > (SKIP_PRIORITY[skipInfo.reason] ?? -1)) {
    skipInfo.reason = reason;
    skipInfo.registration = toRegistrationInfo(registration);
  }
}
