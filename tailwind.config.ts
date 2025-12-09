import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Noto Sans Hebrew"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Playfair Display"', '"Cormorant Garamond"', "Georgia", "serif"],
        hebrew: ['"Noto Sans Hebrew"', "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        luxury: {
          white: "#FFFFFF",
          noir: "#111111",
          grey: "#6E6E6E",
          gold: "#C2A878",
          "gold-light": "rgba(194, 168, 120, 0.1)"
        }
      },
      spacing: {
        "luxury": "10rem",
        "luxury-lg": "16rem",
        "luxury-xl": "24rem"
      },
      boxShadow: {
        "luxury": "0 2px 8px rgba(17, 17, 17, 0.06)",
        "luxury-sm": "0 1px 4px rgba(17, 17, 17, 0.04)",
        "luxury-hover": "0 4px 20px rgba(17, 17, 17, 0.08)"
      },
      animation: {
        "fade-in-luxury": "fadeInLuxury 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards"
      },
      keyframes: {
        fadeInLuxury: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      transitionDuration: {
        "luxury": "600ms",
        "luxury-slow": "800ms"
      },
      transitionTimingFunction: {
        "luxury": "cubic-bezier(0.4, 0, 0.2, 1)"
      }
    }
  },
  plugins: []
};

export default config;
