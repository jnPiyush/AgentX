// Tokens lifted from docs/ux/prototypes/landing/index.html so videos match the site.
export const brand = {
  bg: "#05060a",
  bgPanel: "#0b0d14",
  surface: "#11141d",
  border: "rgba(255,255,255,0.08)",
  text: "#e6e9f2",
  textMuted: "#9aa3b8",
  textDim: "#6b7388",
  cyan: "#06b6d4",
  violet: "#8b5cf6",
  mint: "#34d399",
  amber: "#f59e0b",
  fontSans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontMono: '"JetBrains Mono", "SF Mono", Menlo, monospace',
} as const;

export const personaAccent = {
  pm: brand.cyan,
  architect: brand.violet,
  ux: brand.mint,
} as const;

export type Persona = keyof typeof personaAccent;
