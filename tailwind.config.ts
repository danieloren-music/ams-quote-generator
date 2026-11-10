import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#18222f',
        paper: '#f4f6f8',
        line: '#e1e5ea',
        navy: { DEFAULT: '#0e1b2c', soft: '#16273d', line: '#22364f' },
        brand: { DEFAULT: '#0f7a89', dark: '#0b5c68', soft: '#e4f3f5' },
      },
      fontFamily: { sans: ['Heebo', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06)' },
    },
  },
  plugins: [],
};
export default config;
