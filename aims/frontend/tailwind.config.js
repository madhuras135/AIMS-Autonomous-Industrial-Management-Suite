/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseSlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
        blinkAlert: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.15" },
        },
        wavePulse: {
          "0%": { transform: "scaleX(0.94)", opacity: "0.6" },
          "50%": { transform: "scaleX(1.04)", opacity: "1" },
          "100%": { transform: "scaleX(0.94)", opacity: "0.6" },
        },
        scanline: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        fadeInUp: "fadeInUp 0.4s ease-out forwards",
        fadeIn: "fadeIn 0.5s ease-out forwards",
        pulseSlow: "pulseSlow 2.8s ease-in-out infinite",
        blinkAlert: "blinkAlert 1.1s ease-in-out infinite",
        wavePulse: "wavePulse 2.2s ease-in-out infinite",
        scanline: "scanline 3s linear infinite",
      },
    },
  },
  plugins: [],
};
