/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0a0a1a",
          surface: "rgba(255,255,255,0.05)",
          "surface-hover": "rgba(255,255,255,0.08)",
          border: "rgba(255,255,255,0.08)",
          "border-hover": "rgba(255,255,255,0.12)",
        },
        ut: "#34D399",
        tim: "#6CA0C0",
        mem: "#C084FC",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ['"Usertools Sans"', '"Geist Variable"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Cascadia Code"', 'monospace'],
      },
    },
  },
};
