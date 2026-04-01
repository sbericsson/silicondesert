import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-barlow)', 'system-ui', 'sans-serif'],
        condensed: ['var(--font-barlow-condensed)', 'system-ui', 'sans-serif']
      },
      colors: {
        surface: {
          base: 'var(--surface-base)',
          elevated: 'var(--surface-elevated)',
          sunken: 'var(--surface-sunken)',
          border: 'var(--surface-border)'
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          disabled: 'var(--text-disabled)'
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          bright: 'var(--accent-bright)',
          dim: 'var(--accent-dim)',
          text: 'var(--accent-text)'
        },
        warning: {
          DEFAULT: 'var(--warning)',
          dim: 'var(--warning-dim)',
          text: 'var(--warning-text)'
        },
        danger: {
          DEFAULT: 'var(--danger)',
          dim: 'var(--danger-dim)',
          text: 'var(--danger-text)'
        },
        info: {
          dim: 'var(--info-dim)',
          text: 'var(--info-text)'
        }
      }
    }
  },
  plugins: []
}

export default config
