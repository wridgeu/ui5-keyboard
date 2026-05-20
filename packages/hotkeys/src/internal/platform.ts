import { Platform } from "../library";
import type { CanonicalModifier } from "../types";

interface NavigatorUAData {
  platform: string;
}

let cachedPlatform: Platform | null = null;

/**
 * Detect the current platform.
 *
 * Detection order:
 * 1. `navigator.userAgentData.platform` (modern Chromium API)
 * 2. `navigator.platform` (legacy, widely supported)
 * 3. `navigator.userAgent` (fallback)
 *
 * Result is cached after first call.
 */
export function detectPlatform(): Platform {
  if (cachedPlatform !== null) {
    return cachedPlatform;
  }

  // Modern API (Chromium-based browsers)
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (uaData?.platform) {
    const uaPlatform = uaData.platform.toLowerCase();
    cachedPlatform = resolvePlatformString(uaPlatform);
    return cachedPlatform;
  }

  // Legacy API
  const platform = navigator.platform?.toLowerCase() ?? "";
  if (platform) {
    cachedPlatform = resolvePlatformString(platform);
    return cachedPlatform;
  }

  // User-Agent fallback
  const ua = navigator.userAgent?.toLowerCase() ?? "";
  cachedPlatform = resolvePlatformString(ua);
  return cachedPlatform;
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
 */
export function resolveModifier(modifier: CanonicalModifier | "Mod", platform?: Platform): CanonicalModifier {
  if (modifier === "Mod") {
    const p = platform ?? detectPlatform();
    return p === Platform.Mac ? "Meta" : "Control";
  }
  return modifier;
}
