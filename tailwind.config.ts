import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef2ff", 100: "#e0e7ff", 500: "#6366f1",
          600: "#4f46e5", 700: "#4338ca", 900: "#312e81",
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.5s cubic-bezier(0.4,0,0.6,1) infinite",
        "fade-in": "fade-in 0.4s ease-out",
        "pop": "pop 0.3s ease-out",
      },
      keyframes: {
        "pulse-ring": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(99,102,241,0.5)" },
          "50%": { boxShadow: "0 0 0 12px rgba(99,102,241,0)" },
        },
        "fade-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1" } },
        "pop": { "0%": { transform: "scale(0.8)" }, "60%": { transform: "scale(1.1)" }, "100%": { transform: "scale(1)" } },
      },
    },
  },
  plugins: [],
};
export default config;