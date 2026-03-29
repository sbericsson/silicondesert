import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      colors: {
        surface: {
          base: '#0f1117',
          elevated: '#1a1f2e',
          sunken: '#131720',
          border: '#2a3040'
        },
        text: {
          primary: '#f0f0f0',
          secondary: '#9ca3af',
          muted: '#4b5563',
          disabled: '#3a4050'
        },
        accent: {
          DEFAULT: '#4b9e6f',
          hover: '#3d8a5e',
          dim: '#1a2818',
          text: '#6fcf97'
        },
        warning: {
          DEFAULT: '#f59e0b',
          dim: '#2d1f0e',
          text: '#fcd34d'
        },
        danger: {
          DEFAULT: '#ef4444',
          dim: '#2d1010',
          text: '#fca5a5'
        },
        info: {
          dim: '#1e3a5f',
          text: '#93c5fd'
        }
      }
    }
  },
  plugins: []
}

export default config
