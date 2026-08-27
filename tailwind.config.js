/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9f3',
          100: '#d5f1e1',
          200: '#ade3c6',
          300: '#78cda5',
          400: '#45b581',
          500: '#239a66',
          600: '#177c52',
          700: '#136343',
          800: '#124f37',
          900: '#10412e',
        },
        surface: {
          50: '#f8fafb',
          100: '#f0f3f5',
          200: '#e4e8ec',
          300: '#d0d7de',
          400: '#8c95a0',
          500: '#636d79',
          600: '#4a5360',
          700: '#3a424e',
          800: '#2d333c',
          900: '#1a1f27',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
