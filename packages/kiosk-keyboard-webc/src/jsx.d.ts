/**
 * Augment JSX IntrinsicElements with UI5 Web Component tags used in templates.
 */
declare namespace preact.JSX {
  interface IntrinsicElements {
    "ui5-icon": {
      name?: string;
      mode?: "Image" | "Decorative" | "Interactive";
      class?: string | Record<string, boolean>;
      style?: string | Record<string, string>;
      [key: string]: unknown;
    };
  }
}
