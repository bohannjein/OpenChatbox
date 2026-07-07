import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ChatGPT-like palette. Light values are literal; the `dark` tokens are
        // driven by CSS variables so an alternate dark theme (Dracula) can
        // retint every surface at once — see globals.css (.dark / .dracula).
        sidebar: {
          light: "#f9f9f9",
          dark: "rgb(var(--surface-sidebar) / <alpha-value>)",
        },
        main: {
          light: "#ffffff",
          dark: "rgb(var(--surface-main) / <alpha-value>)",
        },
        bubble: {
          light: "#f4f4f4",
          dark: "rgb(var(--surface-bubble) / <alpha-value>)",
        },
        border: {
          light: "#e5e5e5",
          dark: "rgb(var(--surface-border) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: [
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      transitionTimingFunction: {
        // easeOutExpo — snappy start, soft landing (the app-wide "premium" curve)
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.25", transform: "scale(0.997)" },
          "50%": { opacity: "0.45", transform: "scale(1.006)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        blink: "blink 1s step-end infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "gradient-x": "gradient-x 8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
