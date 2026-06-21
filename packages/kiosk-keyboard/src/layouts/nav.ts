import type { LayoutDefinition } from "../types";
import navRow from "./nav-row";

/**
 * Standalone navigation layout (arrows, Home/End, Page Up/Down).
 *
 * @public
 * @since 0.1.0
 */
const nav: LayoutDefinition = [
  // Row 1: Home / Up / End
  navRow.slice(0, 3),
  // Row 2: Left / Down / Right
  navRow.slice(5, 8),
  // Row 3: PgUp / PgDn / Enter
  [...navRow.slice(3, 5), { value: "{enter}", type: "action" as const }],
  // Row 4: layout controls
  [
    { value: "{layout:base}", label: "ABC", width: "1.5", type: "modifier" },
    {
      value: "{backspace}",
      label: "",
      width: "1.5",
      type: "action",
    },
    { value: "{layout:fkeys}", label: "Fn", width: "1.5", type: "modifier" },
  ],
];

export default nav;
