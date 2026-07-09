import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FFFFFF",
        surface: "#FFFFFF",
        "surface-muted": "#F7F7F8",
        border: "#E6E6E8",
        text: "#404040",
        "text-muted": "#6B6B70",
        primary: "#0D99FF",
        success: "#14AE5C",
        error: "#FF6666",
        warning: "#FEA421",
        accent: "#9747FF",
        pink: "#FF6FB6",
        teal: "#0393B5",
      },
      borderRadius: { sm: "8px", md: "12px", lg: "16px" },
      boxShadow: { card: "0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.06)" },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
