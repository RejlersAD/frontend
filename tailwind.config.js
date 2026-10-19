/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // 1. Lock down the Font Families globally
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      heading: ['Poppins', 'Inter', 'sans-serif'],
    },
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      // 2. Strict Typographic Hierarchy (Locks font sizes and pairs them with correct line-heights)
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],     // 12px - Captions / Small details
        'sm': ['0.875rem', { lineHeight: '1.25rem' }], // 14px - Secondary body / Sidebar items
        'base': ['1rem', { lineHeight: '1.5rem' }],    // 16px - Standard Body text
        'lg': ['1.125rem', { lineHeight: '1.75rem' }], // 18px - Subheadings
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],  // 20px - Card Titles / H3
        '2xl': ['1.5rem', { lineHeight: '2rem' }],     // 24px - Section Titles / H2
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],// 30px - Main Page Titles / H1
      },
      screens: {
        'xs': '320px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      // 3. Spacing Grid (Keeps your safe-area tokens and adds an 8px atomic grid scale)
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        // Atomic spacing rules for the agent
        '1': '0.25rem',  // 4px
        '2': '0.5rem',   // 8px
        '3': '0.75rem',  // 12px
        '4': '1rem',     // 16px (Standard padding/margin)
        '5': '1.25rem',  // 20px
        '6': '1.5rem',   // 24px
        '8': '2rem',     // 32px
        '10': '2.5rem',  // 40px
        '12': '3rem',    // 48px
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
