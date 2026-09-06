import type { Config } from "tailwindcss";

/**
 * Colours, radii and shadows are defined once in `src/app/globals.css` as CSS
 * custom properties and surfaced here under semantic names. Components should
 * use the semantic name (`bg-surface`, `text-fg-muted`) and never a raw palette
 * class like `bg-slate-900` — that is what makes the light/dark themes work and
 * what keeps the contrast guarantees true.
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: rgb("--c-canvas"),
        surface: {
          DEFAULT: rgb("--c-surface"),
          2: rgb("--c-surface-2"),
        },
        line: {
          DEFAULT: rgb("--c-border"),
          strong: rgb("--c-border-strong"),
        },
        fg: {
          DEFAULT: rgb("--c-fg"),
          muted: rgb("--c-fg-muted"),
        },
        accent: {
          DEFAULT: rgb("--c-accent"),
          fg: rgb("--c-accent-fg"),
          edge: rgb("--c-accent-edge"),
          soft: rgb("--c-accent-soft"),
          text: rgb("--c-accent-text"),
        },
        warning: {
          DEFAULT: rgb("--c-warning"),
          soft: rgb("--c-warning-soft"),
        },
        danger: {
          DEFAULT: rgb("--c-danger"),
          fg: rgb("--c-danger-fg"),
          soft: rgb("--c-danger-soft"),
        },
        focus: rgb("--c-ring"),
      },

      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "sans-serif"],
        arabic: ["var(--font-arabic)", "var(--font-sans)", "sans-serif"],
      },

      // A 1.25 (major third) ramp. Line heights are paired with each step so a
      // size change never leaves the leading behind.
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.625rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.375rem", { lineHeight: "1.9rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.2rem" }],
        "3xl": ["2.125rem", { lineHeight: "2.5rem" }],
        "4xl": ["2.75rem", { lineHeight: "3rem" }],
        "5xl": ["3.5rem", { lineHeight: "3.75rem" }],
      },

      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.5rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1.125rem",
        "2xl": "1.5rem",
        "3xl": "1.875rem",
      },

      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },

      // Minimum comfortable hit area. WCAG 2.5.8 (AA) requires 24px; 44px is
      // the comfortable target and what every interactive element should use.
      spacing: {
        13: "3.25rem",
        "touch-min": "1.5rem",
        touch: "2.75rem",
      },

      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        DEFAULT: "180ms",
        slow: "320ms",
      },

      animation: {
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in": "fade-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in-up": "fade-in-up 0.4s cubic-bezier(0.22,1,0.36,1) both",
        pop: "pop 0.3s cubic-bezier(0.22,1,0.36,1)",
        shimmer: "shimmer 1.6s linear infinite",
      },
      keyframes: {
        "pulse-ring": {
          "0%,100%": { boxShadow: "0 0 0 0 rgb(var(--c-danger) / 0.55)" },
          "50%": { boxShadow: "0 0 0 10px rgb(var(--c-danger) / 0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        pop: {
          "0%": { transform: "scale(0.85)" },
          "60%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
