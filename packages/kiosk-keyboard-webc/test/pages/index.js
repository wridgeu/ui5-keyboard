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
const THEME_BACKGROUNDS = {
  sap_horizon: "#f5f6f7",
  sap_horizon_dark: "#12171c",
  sap_horizon_hcb: "#000",
  sap_horizon_hcw: "#fff",
};

const CARD_BACKGROUNDS = {
  sap_horizon: "#fff",
  sap_horizon_dark: "#1a1d21",
  sap_horizon_hcb: "#000",
  sap_horizon_hcw: "#fff",
};

document.querySelectorAll(".theme-controls button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const theme = btn.dataset.theme;
    await setTheme(theme);

    const isDark = theme === "sap_horizon_dark" || theme === "sap_horizon_hcb";

    document.body.style.background = THEME_BACKGROUNDS[theme];
    document.body.style.color = isDark ? "#ccc" : "#32363a";

    document.querySelectorAll(".card").forEach((c) => {
      c.style.background = CARD_BACKGROUNDS[theme];
      c.style.boxShadow = isDark ? "0 1px 4px rgba(0,0,0,0.4)" : "0 1px 4px rgba(0,0,0,0.1)";
    });
    document.querySelectorAll(".card h2").forEach((h) => {
      h.style.borderBottomColor = isDark ? "#444" : "#e5e5e5";
    });
    document.querySelectorAll("label, .input-group label").forEach((l) => {
      l.style.color = isDark ? "#aaa" : "#666";
    });
    document.querySelectorAll("header p").forEach((p) => {
      p.style.color = isDark ? "#888" : "#666";
    });
    document.querySelectorAll("input, textarea").forEach((el) => {
      el.style.background = isDark ? "#2a2e33" : "#fff";
      el.style.color = isDark ? "#ccc" : "#32363a";
      el.style.borderColor = isDark ? "#555" : "#bfbfbf";
    });
    document.querySelector("header").style.borderBottomColor = isDark ? "#444" : "#e5e5e5";

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
