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
    "ui5-button": {
      design?: "Default" | "Positive" | "Negative" | "Transparent" | "Emphasized" | "Attention";
      tooltip?: string;
      accessibleName?: string;
      tabindex?: number;
      "data-index"?: number;
      part?: string;
      class?: string | Record<string, boolean>;
      style?: string | Record<string, string>;
      [key: string]: unknown;
    };
    "ui5-popover": {
      open?: boolean;
      placement?: "Start" | "End" | "Top" | "Bottom";
      preventFocusRestore?: boolean;
      preventInitialFocus?: boolean;
      hideArrow?: boolean;
      accessibleName?: string;
      id?: string;
      class?: string | Record<string, boolean>;
      style?: string | Record<string, string>;
      [key: string]: unknown;
    };
  }
}
