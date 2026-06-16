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
        ink: "#15161a",
        paper: "#f8f7f2",
        moss: "#4f6f52",
        ember: "#c9542c",
        tide: "#2f6f8f",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(21, 22, 26, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
