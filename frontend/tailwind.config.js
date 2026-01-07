/** @type {import('tailwindcss').Config} */

// Helper function to create color with opacity support
const withOpacity = (variableName) => {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${variableName}) / ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ==========================================
        // BRAND - Primary (Indigo)
        // ==========================================
        primary: {
          50: withOpacity('--color-primary-50'),
          100: withOpacity('--color-primary-100'),
          200: withOpacity('--color-primary-200'),
          300: withOpacity('--color-primary-300'),
          400: withOpacity('--color-primary-400'),
          500: withOpacity('--color-primary-500'),
          600: withOpacity('--color-primary-600'),
          700: withOpacity('--color-primary-700'),
          800: withOpacity('--color-primary-800'),
          900: withOpacity('--color-primary-900'),
          950: withOpacity('--color-primary-950'),
        },

        // ==========================================
        // STATUS - Readiness System (GREEN/YELLOW/RED)
        // ==========================================
        status: {
          green: {
            50: withOpacity('--color-status-green-50'),
            100: withOpacity('--color-status-green-100'),
            200: withOpacity('--color-status-green-200'),
            300: withOpacity('--color-status-green-300'),
            400: withOpacity('--color-status-green-400'),
            500: withOpacity('--color-status-green-500'),
            600: withOpacity('--color-status-green-600'),
            700: withOpacity('--color-status-green-700'),
            800: withOpacity('--color-status-green-800'),
            900: withOpacity('--color-status-green-900'),
          },
          yellow: {
            50: withOpacity('--color-status-yellow-50'),
            100: withOpacity('--color-status-yellow-100'),
            200: withOpacity('--color-status-yellow-200'),
            300: withOpacity('--color-status-yellow-300'),
            400: withOpacity('--color-status-yellow-400'),
            500: withOpacity('--color-status-yellow-500'),
            600: withOpacity('--color-status-yellow-600'),
            700: withOpacity('--color-status-yellow-700'),
            800: withOpacity('--color-status-yellow-800'),
            900: withOpacity('--color-status-yellow-900'),
          },
          red: {
            50: withOpacity('--color-status-red-50'),
            100: withOpacity('--color-status-red-100'),
            200: withOpacity('--color-status-red-200'),
            300: withOpacity('--color-status-red-300'),
            400: withOpacity('--color-status-red-400'),
            500: withOpacity('--color-status-red-500'),
            600: withOpacity('--color-status-red-600'),
            700: withOpacity('--color-status-red-700'),
            800: withOpacity('--color-status-red-800'),
            900: withOpacity('--color-status-red-900'),
          },
        },

        // ==========================================
        // SEMANTIC - Aliases (maps to status colors)
        // ==========================================
        success: {
          50: withOpacity('--color-success-50'),
          500: withOpacity('--color-success-500'),
          600: withOpacity('--color-success-600'),
          700: withOpacity('--color-success-700'),
        },
        warning: {
          50: withOpacity('--color-warning-50'),
          500: withOpacity('--color-warning-500'),
          600: withOpacity('--color-warning-600'),
          700: withOpacity('--color-warning-700'),
        },
        danger: {
          50: withOpacity('--color-danger-50'),
          500: withOpacity('--color-danger-500'),
          600: withOpacity('--color-danger-600'),
          700: withOpacity('--color-danger-700'),
        },

        // ==========================================
        // UI COLORS
        // ==========================================
        surface: {
          primary: withOpacity('--color-bg-primary'),
          secondary: withOpacity('--color-bg-secondary'),
          tertiary: withOpacity('--color-bg-tertiary'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      // ==========================================
      // COMPONENT SHADOWS
      // ==========================================
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'dropdown': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};
