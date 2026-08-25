/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        ink: "#22252c",
        canvas: "#f7f8fb",
        navy: "#293969",
        lilac: "#eef0fb"
      },
      boxShadow: { soft: "0 12px 32px rgba(34, 37, 44, .07)" },
      borderRadius: { xl: "18px", "2xl": "24px" }
    }
  },
  plugins: []
};
