/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0f0f0f',
        node:   '#1a1a1a',
        border: '#2a2a2a',
      },
    },
  },
  plugins: [],
};
