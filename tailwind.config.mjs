/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          950: "#071526",
          900: "#0f2744",
          800: "#14365a",
          700: "#1c4877",
          600: "#245c94",
        },
        accent: {
          DEFAULT: "#c62828",
          hover: "#9e1f1f",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Outfit"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 18px 50px -24px rgba(15, 39, 68, 0.35)",
      },
    },
  },
  plugins: [],
};
