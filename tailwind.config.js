export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: '#2C2C2C',
        pearl: '#F8F8F8',
        diamond: '#C0C0C0',
        rosegold: '#B76E79',
        champagne: '#D4AF6A',
        slategray: '#6B6B6B',
        platinum: '#E5E5E5',
        blush: '#F5F0F0',
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
        },
        success: {
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          500: '#f59e0b',
        },
        error: {
          500: '#ef4444',
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          500: '#6b7280',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ['"Poppins"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 25px 50px -12px rgba(37, 99, 235, 0.2)',
      },
    },
  },
  plugins: [],
};
