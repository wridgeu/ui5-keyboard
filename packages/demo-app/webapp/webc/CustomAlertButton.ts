class CustomAlertButton extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["text", "message"];
  }

  private _button: HTMLButtonElement | null = null;
  private _onClick: (() => void) | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this._render();
  }

  attributeChangedCallback(): void {
    this._render();
  }

  private _render(): void {
    if (!this.shadowRoot) return;

    if (!this._button) {
      const style = document.createElement("style");
      style.textContent = [
        ":host { display: inline-block; }",
        "button {",
        '  font: 400 0.875rem/1.2 "72", Arial, sans-serif;',
        "  border: 1px solid #5b738b;",
        "  border-radius: 0.5rem;",
        "  background: #fff;",
        "  color: #0a6ed1;",
        "  padding: 0.5rem 0.875rem;",
        "  cursor: pointer;",
        "}",
      ].join("\n");
      this.shadowRoot.append(style);

      this._button = document.createElement("button");
      this.shadowRoot.append(this._button);
    }

    const text = this.getAttribute("text") || "Show Alert";
    const message = this.getAttribute("message") || "";

    this._button.textContent = text;
    if (this._onClick) {
      this._button.removeEventListener("click", this._onClick);
    }
    this._onClick = () => {
      if (!message) return;
      this.dispatchEvent(
        new CustomEvent("demo-alert", {
          detail: { message },
          bubbles: true,
          composed: true,
        }),
      );
    };
    this._button.addEventListener("click", this._onClick);
  }
}

if (!customElements.get("demo-alert-button")) {
  customElements.define("demo-alert-button", CustomAlertButton);
}

export default CustomAlertButton;
