/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--accent-color, #1DB954)',
          hover: 'var(--spice-button-active, #1ed760)',
          muted: 'rgba(29, 185, 84, 0.6)',
        },
        accent: {
          DEFAULT: 'var(--accent-color, #1DB954)',
          hover: 'var(--spice-button-active, #1ed760)',
        },
        bg: {
          base: '#000000',
          primary: '#121212',
          secondary: '#181818',
          tertiary: '#1E1E1E',
          elevated: '#242424',
          hover: '#2A2A2A',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#B3B3B3',
          muted: '#9A9A9A',
          disabled: '#6A6A6A',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          light: 'rgba(255, 255, 255, 0.12)',
          hover: 'rgba(255, 255, 255, 0.2)',
        },
      },
      boxShadow: {
        'card': '0 4px 16px rgba(0, 0, 0, 0.4)',
        'player': '0 -4px 20px rgba(0, 0, 0, 0.6)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.5)',
        'glow': '0 0 20px rgba(var(--accent-color-rgb), 0.35)',
      },
      animation: {
        'fadeIn': 'fadeIn 0.25s ease-out',
        'slideUp': 'slideUp 0.35s ease-out',
        'scaleIn': 'scaleIn 0.2s ease-out',
        'subtle-pulse': 'subtlePulse 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'scale-in': 'scaleIn 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        subtlePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
