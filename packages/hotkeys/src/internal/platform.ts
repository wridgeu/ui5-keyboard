import Device from "sap/ui/Device";
import { Platform } from "../library";
import type { CanonicalModifier } from "../types";

/**
 * Detect the current platform.
 *
 * Reads the framework's own detection (`sap/ui/Device`), which resolves the OS from
 * `navigator.userAgentData` where the browser offers it and falls back to the
 * user-agent string otherwise. iOS counts as Mac here: what the platform decides is
 * whether `"Mod"` means Command or Ctrl, and an iPad keyboard carries Command.
 *
 * @since 0.1.0
 */
export function detectPlatform(): Platform {
  if (Device.os.macintosh || Device.os.ios) return Platform.Mac;
  if (Device.os.windows) return Platform.Windows;
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
