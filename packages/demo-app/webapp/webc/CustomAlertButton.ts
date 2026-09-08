// The app stylesheet cannot reach into a shadow root, so the button carries its
// own sheet, shared by every instance. Custom properties do cross the boundary,
// so the theme's button tokens size and colour it like the sap.m controls beside it.
const style = new CSSStyleSheet();
style.replaceSync(`
  :host {
    display: inline-block;
    margin: 0.25rem 0;
  }

  button {
    box-sizing: border-box;
    height: var(--sapElement_Height);
    padding: 0 0.6875rem;
    border: var(--sapButton_BorderWidth) solid var(--sapButton_BorderColor);
    border-radius: var(--sapButton_BorderCornerRadius);
    background: var(--sapButton_Background);
    color: var(--sapButton_TextColor);
    font-family: var(--sapFontFamily);
    font-size: var(--sapFontSize);
    cursor: pointer;
  }
`);

class CustomAlertButton extends HTMLElement {
  static get observedAttributes(): string[] {
    return ["text", "message"];
  }

  private _button: HTMLButtonElement | null = null;
  private _onClick: (() => void) | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).adoptedStyleSheets = [style];
  }

  connectedCallback(): void {
    this._render();
  }

  disconnectedCallback(): void {
    if (this._button && this._onClick) {
      this._button.removeEventListener("click", this._onClick);
    }
    this._onClick = null;
    this._button = null;
  }

  attributeChangedCallback(): void {
    this._render();
  }

  get text(): string {
    return this.getAttribute("text") || "Show Alert";
  }

  set text(next: string) {
    const normalized = String(next ?? "");
    if (this.getAttribute("text") !== normalized) {
      this.setAttribute("text", normalized);
    }
  }

  get message(): string {
    return this.getAttribute("message") || "";
  }

  set message(next: string) {
    const normalized = String(next ?? "");
    if (this.getAttribute("message") !== normalized) {
      this.setAttribute("message", normalized);
    }
  }

  private _render(): void {
    if (!this.shadowRoot) return;

    if (!this._button) {
      this._button = document.createElement("button");
      this.shadowRoot.append(this._button);
    }

    const text = this.text;
    const message = this.message;

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
