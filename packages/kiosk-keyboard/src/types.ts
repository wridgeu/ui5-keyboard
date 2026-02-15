/**
 * Describes a single key on the keyboard.
 */
export interface KeyDefinition {
  /** The character or action this key produces. */
  value: string;
  /** Display label (defaults to value). */
  label?: string;
  /** Label to show when Shift is active. */
  shiftLabel?: string;
  /** Value to produce when Shift is active (defaults to label/value uppercased). */
  shiftValue?: string;
  /** CSS width class: "1u" (default), "1.5u", "2u", "2.25u", "space", etc. */
  width?: string;
  /** Key type for styling: "default", "modifier", "action", "space". */
  type?: "default" | "modifier" | "action" | "space";
  /** UI5 icon URI for icon-only keys (e.g. "sap-icon://arrow-left"). */
  icon?: string;
}

/**
 * A row of keys on the keyboard.
 */
export type KeyRow = KeyDefinition[];

/**
 * Complete layout definition — an array of rows.
 */
export type LayoutDefinition = KeyRow[];
