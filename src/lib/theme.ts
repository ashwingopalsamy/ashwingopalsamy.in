export const STEEL_1 = "#ffffff";
export const STEEL_2 = "#eaebec";
export const STEEL_3 = "#dcdee0";
export const STEEL_4 = "#cbced0";
export const STEEL_5 = "#abaeb1";
export const STEEL_6 = "#6c6f72";
export const STEEL_7 = "#45484a";
export const STEEL_8 = "#2c2e30";
export const STEEL_9 = "#151617";

export const CANVAS_LIGHT = STEEL_1;
export const CANVAS_DARK = STEEL_9;

export const INK_LIGHT = STEEL_9;
export const INK_DARK = STEEL_1;

export const MUTED_LIGHT = STEEL_8;
export const MUTED_DARK = STEEL_3;

export const RULE_LIGHT = STEEL_3;
export const RULE_DARK = STEEL_7;

export const RULE_STRONG_LIGHT = STEEL_4;
export const RULE_STRONG_DARK = STEEL_6;

export function canvasHex(theme: "light" | "dark"): string {
  return theme === "dark" ? CANVAS_DARK : CANVAS_LIGHT;
}

export function mermaidFallbacks(theme: "light" | "dark") {
  const dark = theme === "dark";
  return {
    canvas: dark ? CANVAS_DARK : CANVAS_LIGHT,
    ink: dark ? INK_DARK : INK_LIGHT,
    muted: dark ? MUTED_DARK : MUTED_LIGHT,
    rule: dark ? RULE_DARK : RULE_LIGHT,
    ruleStrong: dark ? RULE_STRONG_DARK : RULE_STRONG_LIGHT,
  };
}
