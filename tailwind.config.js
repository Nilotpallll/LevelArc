/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        navy: '#0A0E1A',
        navy2: '#0F1428',
        panel: '#131829',
        purple: '#7C3AED',
        cyan: '#00F5FF',
        pink: '#FF2D78',
        lime: '#A3FF47',
        amber: '#FFB347',
        gold: '#D9B876',
      },
      boxShadow: {
        glow: '0 0 30px rgba(124,58,237,0.4)',
      },
    },
  },
  plugins: [],
}
