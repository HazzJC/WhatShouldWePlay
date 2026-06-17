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
        ink: "#171514",
        paper: "#fff9ef",
        linen: "#f5ead8",
        coral: "#d95d39",
        coralDark: "#b84427",
        teal: "#157a7b",
        tealDark: "#0f5f63",
        gold: "#e5aa2f",
        moss: "#3f7a57",
        slate: "#334155",
        ember: "#d95d39",
        tide: "#157a7b",
      },
      boxShadow: {
        soft: "0 18px 48px rgba(23, 21, 20, 0.10)",
        card: "0 10px 30px rgba(23, 21, 20, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
