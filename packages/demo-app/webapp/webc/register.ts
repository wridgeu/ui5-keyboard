import CustomAlertButtonElement from "demo/hotkeys/webc/CustomAlertButton";
import DemoKioskInputElement from "demo/hotkeys/webc/DemoKioskInput";

// Ensures modules that call `customElements.define(...)` are loaded once
// before any UI5 WebComponent wrapper tries to render their tags.
void CustomAlertButtonElement;
void DemoKioskInputElement;

export const DEMO_WEBC_TAGS_REGISTERED = true;
