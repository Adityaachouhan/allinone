/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dynamic store primary theme colors (driven by CSS variables)
        primary: {
          50: 'var(--color-primary-50, #f0fdf4)',
          100: 'var(--color-primary-100, #dcfce7)',
          200: 'var(--color-primary-200, #bbf7d0)',
          300: 'var(--color-primary-300, #86efac)',
          400: 'var(--color-primary-400, #4ade80)',
          500: 'var(--color-primary-500, #22c55e)',
          600: 'var(--color-primary-600, #16a34a)',
          700: 'var(--color-primary-700, #15803d)',
          800: 'var(--color-primary-800, #166534)',
          900: 'var(--color-primary-900, #14532d)',
        },
        green: {
          50: 'var(--color-primary-50, #f0fdf4)',
          100: 'var(--color-primary-100, #dcfce7)',
          200: 'var(--color-primary-200, #bbf7d0)',
          300: 'var(--color-primary-300, #86efac)',
          400: 'var(--color-primary-400, #4ade80)',
          500: 'var(--color-primary-500, #22c55e)',
          600: 'var(--color-primary-600, #16a34a)',
          700: 'var(--color-primary-700, #15803d)',
          800: 'var(--color-primary-800, #166534)',
          900: 'var(--color-primary-900, #14532d)',
        },
        // Warm accent — amber/orange for CTAs and deals
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 8px 24px -4px rgb(0 0 0 / 0.12), 0 2px 8px -2px rgb(0 0 0 / 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
