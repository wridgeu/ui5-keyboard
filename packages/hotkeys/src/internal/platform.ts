import { Platform } from "../library";
import type { CanonicalModifier } from "../types";

interface NavigatorUAData {
  platform: string;
}

/**
 * Detect the current platform.
 *
 * Detection order:
 * 1. `navigator.userAgentData.platform` (modern Chromium API)
 * 2. `navigator.platform` (legacy, widely supported)
 * 3. `navigator.userAgent` (fallback)
 *
 * @since 0.1.0
 */
export function detectPlatform(): Platform {
  // Modern API (Chromium-based browsers)
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (uaData?.platform) {
    return resolvePlatformString(uaData.platform.toLowerCase());
  }

  // Legacy API
  const platform = navigator.platform.toLowerCase();
  if (platform) {
    return resolvePlatformString(platform);
  }

  // User-Agent fallback
  return resolvePlatformString(navigator.userAgent.toLowerCase());
}

function resolvePlatformString(value: string): Platform {
  if (/mac|iphone|ipad/.test(value)) return Platform.Mac;
  if (/\bwin/.test(value)) return Platform.Windows;
  return Platform.Linux;
}

/**
 * Resolve the `"Mod"` pseudo-modifier to the platform-appropriate canonical modifier.
 *
 * - macOS: `"Mod"` -> `"Meta"` (Command key)
 * - Windows/Linux: `"Mod"` -> `"Control"` (Ctrl key)
 *
 * Non-Mod modifiers are returned unchanged.
 *
 * @since 0.1.0
 */
export function resolveModifier(modifier: CanonicalModifier | "Mod", platform?: Platform): CanonicalModifier {
  if (modifier === "Mod") {
    const p = platform ?? detectPlatform();
    return p === Platform.Mac ? "Meta" : "Control";
  }
  return modifier;
}
