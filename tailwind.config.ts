import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        linen: "rgb(var(--color-linen) / <alpha-value>)",
        coral: "rgb(var(--color-coral) / <alpha-value>)",
        coralDark: "rgb(var(--color-coral-dark) / <alpha-value>)",
        teal: "rgb(var(--color-teal) / <alpha-value>)",
        tealDark: "rgb(var(--color-teal-dark) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        moss: "rgb(var(--color-moss) / <alpha-value>)",
        slate: "rgb(var(--color-slate) / <alpha-value>)",
        ember: "rgb(var(--color-ember) / <alpha-value>)",
        tide: "rgb(var(--color-tide) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 18px 56px rgb(var(--color-shadow) / 0.22)",
        card: "0 10px 34px rgb(var(--color-shadow) / 0.15)",
      },
    },
  },
  plugins: [],
};

export default config;
