/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      overrideBrowserslist: [
        'Chrome >= 95',
        'Edge >= 95',
        'Firefox >= 100',
        'Safari >= 15',
        'iOS >= 15',
      ],
    },
  },
};
export default config;
