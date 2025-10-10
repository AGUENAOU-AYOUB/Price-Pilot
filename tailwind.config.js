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
      },
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 25px 50px -12px rgba(183, 110, 121, 0.25)',
      },
    },
  },
  plugins: [],
};
