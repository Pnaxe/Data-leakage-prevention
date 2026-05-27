/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        midnight: "#071426",
        navy: "#0b1f3a",
        panel: "#102a48",
        signal: "#e11d48",
        frost: "#e7eef8",
        cosmos: "#2b1b62",
        void: "#071426",
        ultraviolet: "#7c4dff",
        page: "#f5f6fb"
      }
    }
  },
  plugins: []
};
