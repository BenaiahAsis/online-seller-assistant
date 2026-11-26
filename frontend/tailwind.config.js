import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAF8',
        ink: '#1A1A1A',
        muted: '#5F5F5A',
        line: '#E5E5E0',
        accent: {
          DEFAULT: '#0F766E',
          hover: '#115E59',
        },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};
