class DemoKioskInput extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["value", "placeholder"];
  }

  private _input: HTMLInputElement | null = null;

  connectedCallback(): void {
    this._ensureInput();
    this._syncFromAttributes();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
    const input = this._ensureInput();

    if (name === "value") {
      const nextValue = newValue ?? "";
      if (input.value !== nextValue) {
        input.value = nextValue;
      }
      return;
    }

    if (name === "placeholder") {
      input.placeholder = newValue ?? "Custom element input";
    }
  }

  get value(): string {
    return this._input?.value ?? this.getAttribute("value") ?? "";
  }

  set value(next: string) {
    const normalized = String(next ?? "");
    if (this.getAttribute("value") !== normalized) {
      this.setAttribute("value", normalized);
      return;
    }

    if (this._input && this._input.value !== normalized) {
      this._input.value = normalized;
    }
  }

  get placeholder(): string {
    if (this._input) {
      return this._input.placeholder;
    }

    if (this.hasAttribute("placeholder")) {
      return this.getAttribute("placeholder") ?? "";
    }

    return "Custom element input";
  }

  set placeholder(next: string) {
    const normalized = String(next ?? "");
    if (this.getAttribute("placeholder") !== normalized) {
      this.setAttribute("placeholder", normalized);
      return;
    }

    if (this._input && this._input.placeholder !== normalized) {
      this._input.placeholder = normalized;
    }
  }

  focusInner(): void {
    this._ensureInput().focus();
  }

  private _syncFromAttributes(): void {
    const input = this._ensureInput();
    input.value = this.getAttribute("value") ?? "";
    input.placeholder = this.getAttribute("placeholder") ?? "Custom element input";
  }

  private _ensureInput(): HTMLInputElement {
    if (this._input) {
      this._input.id = this.id ? `${this.id}-inner` : "";
      if (!this.contains(this._input)) {
        this.append(this._input);
      }
      return this._input;
    }

    const input = document.createElement("input");
    input.type = "text";
    input.id = this.id ? `${this.id}-inner` : "";

    input.addEventListener("input", () => {
      const nextValue = input.value;
      if (this.getAttribute("value") !== nextValue) {
        this.setAttribute("value", nextValue);
      }
    });

    this.append(input);
    this._input = input;
    return input;
  }
}

if (!customElements.get("demo-kiosk-input")) {
  customElements.define("demo-kiosk-input", DemoKioskInput);
}

export default DemoKioskInput;
