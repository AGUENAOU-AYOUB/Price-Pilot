export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          burgundy: '#8B3A62',
          rose: '#C4A5B0',
          blush: '#F5E6ED',
          cream: '#FAF7F8',
          charcoal: '#2C2C2C',
        },
        primary: {
          50: '#FBEEF5',
          100: '#F6DEEA',
          200: '#EBC0D7',
          300: '#E0A1C4',
          400: '#D282AD',
          500: '#C36495',
          600: '#8B3A62',
          700: '#74314F',
          800: '#5C283F',
          900: '#3D1728',
        },
        secondary: {
          100: '#F5E6ED',
          200: '#E9CFDA',
          300: '#D9B3C4',
          400: '#C899AD',
          500: '#B98099',
          600: '#9F637E',
        },
        neutral: {
          50: '#FAF7F8',
          100: '#F2EAEE',
          200: '#E0D3DA',
          300: '#CDBBC4',
          400: '#A68D9B',
          500: '#7F6676',
          600: '#5B4653',
          700: '#42313C',
          800: '#2F222B',
          900: '#221820',
        },
        success: {
          50: '#F1FBF4',
          500: '#4BB693',
          600: '#35856B',
        },
        warning: {
          50: '#FFF8EC',
          500: '#EAA355',
        },
        error: {
          50: '#FDEBEC',
          500: '#D95C6C',
        },
      },
      fontFamily: {
        sans: ['"Poppins"', '"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 30px 70px -35px rgba(139, 58, 98, 0.4)',
      },
    },
  },
  plugins: [],
};
