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
          DEFAULT: 'rgb(var(--accent-color-rgb, 112 168 255) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover-rgb, 140 190 255) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground-rgb, 8 12 18) / <alpha-value>)',
          muted: 'rgb(var(--accent-color-rgb, 112 168 255) / 0.18)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-color-rgb, 112 168 255) / <alpha-value>)',
          hover: 'rgb(var(--accent-hover-rgb, 140 190 255) / <alpha-value>)',
        },
        bg: {
          base: 'rgb(var(--app-bg-rgb, 8 12 18) / <alpha-value>)',
          primary: 'rgb(var(--surface-1-rgb, 20 27 38) / <alpha-value>)',
          secondary: 'rgb(var(--surface-2-rgb, 27 35 48) / <alpha-value>)',
          tertiary: 'rgb(var(--surface-3-rgb, 37 46 61) / <alpha-value>)',
          elevated: 'rgb(var(--surface-3-rgb, 37 46 61) / <alpha-value>)',
          hover: 'rgb(var(--surface-hover-rgb, 47 58 75) / <alpha-value>)',
          tint: 'rgb(var(--surface-tint-rgb, 92 116 150) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--text-primary-rgb, 246 248 252) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary-rgb, 186 194 208) / <alpha-value>)',
          muted: 'rgb(var(--text-muted-rgb, 134 146 164) / <alpha-value>)',
          disabled: 'rgb(var(--text-disabled-rgb, 96 108 124) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--border-soft-rgb, 125 140 162) / <alpha-value>)',
          light: 'rgb(var(--border-strong-rgb, 156 170 190) / <alpha-value>)',
          hover: 'rgb(var(--border-strong-rgb, 156 170 190) / 0.95)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger-rgb, 245 96 96) / <alpha-value>)',
        },
      },
      boxShadow: {
        'card': '0 12px 32px rgb(0 0 0 / 0.28)',
        'player': '0 -10px 32px rgb(0 0 0 / 0.3)',
        'elevated': '0 24px 64px rgb(0 0 0 / 0.42)',
        'glow': '0 0 32px rgb(var(--accent-color-rgb, 112 168 255) / 0.22)',
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
