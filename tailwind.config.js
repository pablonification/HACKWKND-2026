/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // Disable preflight to avoid conflicting with Ionic's CSS reset
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Satoshi', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['PlayfairDisplay', 'Georgia', 'serif'],
        body: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        semai: {
          green: '#2D6A4F',
          gold: '#C9A84C',
          earth: '#8B5E3C',
          sky: '#74C0FC',
          cream: '#F5F0E8',
        },
      },
    },
  },
  plugins: [],
};
