/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#000",
          white: "#FFF",
          green: "#17453B",
          "accent-green": "#008208",
          "accent-green-2": "#008934",
        },
      },
    },
  },
  plugins: [],
}
