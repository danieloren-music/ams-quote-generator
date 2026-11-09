import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1b2430',
        paper: '#f6f7f9',
        line: '#dfe3e8',
        brand: { DEFAULT: '#0f6d7a', dark: '#0a4f59', soft: '#e3f1f3' },
      },
      fontFamily: { sans: ['var(--font-heebo)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
