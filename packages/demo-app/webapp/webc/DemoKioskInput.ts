class DemoKioskInput extends HTMLElement {
  private _input: HTMLInputElement | null = null;

  connectedCallback(): void {
    if (this._input) return;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = this.getAttribute("placeholder") || "Custom element input";
    input.style.width = "100%";
    input.style.padding = "0.625rem";
    input.style.border = "1px solid #c8d0d8";
    input.style.borderRadius = "0.5rem";
    input.style.boxSizing = "border-box";
    input.style.font = '400 1rem/1.4 "72", Arial, sans-serif';
    this.append(input);
    this._input = input;
  }

  get value(): string {
    return this._input?.value ?? "";
  }

  set value(next: string) {
    if (this._input) {
      this._input.value = next;
    }
  }

  focusInner(): void {
    this._input?.focus();
  }
}

if (!customElements.get("demo-kiosk-input")) {
  customElements.define("demo-kiosk-input", DemoKioskInput);
}

export default DemoKioskInput;
