/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../fields/src/**/*.{js,ts,jsx,tsx}", // Include field components
  ],
  safelist: [
    // Rotation classes for collapsible UI
    'rotate-90',
    // Tag colors - ensure these are always included
    'bg-blue-100', 'text-blue-800', 'dark:bg-blue-800', 'dark:text-blue-100',
    'bg-green-100', 'text-green-800', 'dark:bg-green-800', 'dark:text-green-100',
    'bg-red-100', 'text-red-800', 'dark:bg-red-800', 'dark:text-red-100',
    'bg-purple-100', 'text-purple-800', 'dark:bg-purple-800', 'dark:text-purple-100',
    'bg-gray-100', 'text-gray-800', 'dark:bg-gray-700', 'dark:text-gray-100',
    // Remove button colors
    'text-blue-600', 'hover:text-blue-800', 'dark:text-blue-300', 'dark:hover:text-blue-100',
    'text-green-600', 'hover:text-green-800', 'dark:text-green-300', 'dark:hover:text-green-100',
    'text-red-600', 'hover:text-red-800', 'dark:text-red-300', 'dark:hover:text-red-100',
    'text-purple-600', 'hover:text-purple-800', 'dark:text-purple-300', 'dark:hover:text-purple-100',
    'text-gray-600', 'hover:text-gray-800', 'dark:text-gray-300', 'dark:hover:text-gray-100',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Custom theme colors that can be overridden at runtime
        primary: {
          50: 'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
          950: 'rgb(var(--color-primary-950) / <alpha-value>)',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '112': '28rem',
        '128': '32rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};