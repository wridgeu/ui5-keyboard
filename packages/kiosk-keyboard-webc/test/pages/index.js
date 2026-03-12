// Import the unbundled ESM entry (not the self-contained bundle) so Vite
// deduplicates the UI5 WC framework. This allows setTheme() to affect the
// component. Requires `npm run build` first.
import "../../dist/bundle.esm.js";
import { setTheme } from "@ui5/webcomponents-base/dist/config/Theme.js";

// UI5 Web Components used on the demo page
import "@ui5/webcomponents/dist/Input.js";
import "@ui5/webcomponents/dist/StepInput.js";
import "@ui5/webcomponents/dist/Label.js";
import "@ui5/webcomponents/dist/Button.js";
import "@ui5/webcomponents/dist/Switch.js";
import "@ui5/webcomponents/dist/TextArea.js";

// ── Theme switcher ──
// Theme tokens are defined as CSS custom properties in index.html.
// Switching themes only requires updating the data-theme attribute on <body>
// and calling setTheme() for the UI5 Web Components.
document.querySelectorAll(".theme-controls button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const theme = btn.dataset.theme;
    document.body.dataset.theme = theme;
    await setTheme(theme);
    document.querySelectorAll(".theme-controls button").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// ── Global event log ──
const log = document.getElementById("event-log");
function appendLog(source, msg) {
  const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
  log.textContent += `[${ts}] ${source}: ${msg}\n`;
  log.scrollTop = log.scrollHeight;
}

document.getElementById("clear-log").addEventListener("click", () => {
  log.textContent = "";
});

// Wire all keyboards for event logging
document.querySelectorAll("kiosk-keyboard").forEach((kb) => {
  const name = kb.id || kb.getAttribute("keyboard-type") || "keyboard";
  kb.addEventListener("key-press", (e) => {
    const d = e.detail;
    appendLog(name, `key-press key="${d.key}" shift=${d.shiftKey}`);
  });
  kb.addEventListener("layout-change", (e) => {
    appendLog(name, `layout-change layout="${e.detail.layout}"`);
  });
  kb.addEventListener("keyboard-type-change", (e) => {
    appendLog(name, `keyboard-type-change type="${e.detail.keyboardType}"`);
  });
  kb.addEventListener("after-open", () => appendLog(name, "after-open"));
  kb.addEventListener("after-close", () => appendLog(name, "after-close"));
});

// Toggle docked keyboard
document.getElementById("toggle-docked").addEventListener("click", () => {
  const docked = document.getElementById("kb-docked");
  if (docked.open) docked.close();
  else docked.show();
});

// Custom layout via instance method (no class import needed)
const kbCustom = document.getElementById("kb-custom");
kbCustom.registerLayout("demo-pin", [
  [{ value: "1" }, { value: "2" }, { value: "3" }],
  [{ value: "4" }, { value: "5" }, { value: "6" }],
  [{ value: "7" }, { value: "8" }, { value: "9" }],
  [{ value: "{backspace}", type: "action" }, { value: "0" }, { value: "{enter}", type: "action" }],
]);

// Auto-type toggle
document.getElementById("auto-type-switch").addEventListener("change", (e) => {
  const enabled = e.target.checked;
  const kb = document.getElementById("kb-docked");
  kb.autoType = enabled;
  if (!enabled) kb.resetKeyboardType();
  appendLog("kb-docked", `autoType ${enabled ? "enabled" : "disabled"}`);
});
