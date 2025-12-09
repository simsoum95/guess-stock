import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Hebrew"', "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          black: "#0f0f0f",
          charcoal: "#1a1a1a",
          gray: "#2a2a2a",
          accent: "#c00000"
        }
      },
      boxShadow: {
        card: "0 20px 50px -24px rgba(0,0,0,0.35)"
      }
    }
  },
  plugins: []
};

export default config;

