// Ensures modules that call `customElements.define(...)` are loaded once
// before any UI5 WebComponent wrapper tries to render their tags.
import "demo/hotkeys/webc/CustomAlertButton";
import "demo/hotkeys/webc/DemoKioskInput";
