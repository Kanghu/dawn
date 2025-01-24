/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./**/*.liquid'],
  theme: {
    extend: {
      colors: {
        'als-gray': '#919296',
      },
    },
  },
  variants: {
    extend: {
      display: ['group-hover', 'hover'],
    },
  },
  plugins: [],
};
