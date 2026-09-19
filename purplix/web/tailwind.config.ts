import type { Config } from 'tailwindcss'

/**
 * Design tokens — derived from the brand mark, not invented alongside it.
 *
 * The rule the whole system rests on: purple is the only decorative brand
 * accent. Crimson and steel blue are SEMANTIC — crimson means offensive,
 * steel means defensive — and appear nowhere else. A crimson button that
 * doesn't mean offence is a bug, not a style choice.
 *
 * Full ramps (50–900) rather than three stops per hue: tints, borders and
 * hover states need to be picked from a scale, otherwise every component
 * invents its own near-miss and the product drifts.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FBF6FF', 100: '#F5EBFE', 200: '#E9D6FC', 300: '#D6B3F8',
          400: '#B87BF0', 500: '#9B43E8', 600: '#7C2DBD', 700: '#661F9E',
          800: '#521880', 900: '#3D1160',
          DEFAULT: '#7C2DBD', deep: '#5B1A93', light: '#A855F7',
          tint: '#F5EBFE', line: '#E9D6FC',
        },
        crimson: {
          50: '#FFF5F7', 100: '#FDE7EC', 200: '#F9C9D3', 300: '#F09BAC',
          400: '#E05C77', 500: '#C1213F', 600: '#A61832', 700: '#8A1229',
          800: '#6B0D1F', 900: '#4D0915',
          DEFAULT: '#C1213F', deep: '#8A1229', tint: '#FDE7EC', line: '#F9C9D3',
        },
        steel: {
          50: '#F4F8FD', 100: '#E6EFFA', 200: '#CBDDF3', 300: '#A3C1E7',
          400: '#6B98D4', 500: '#35619F', 600: '#2B5189', 700: '#213F6F',
          800: '#1A3157', 900: '#13233E',
          DEFAULT: '#35619F', deep: '#213F6F', tint: '#E6EFFA', line: '#CBDDF3',
        },
        ink: '#150B26',
        body: '#4A4360',
        muted: '#867E9C',
        faint: '#A9A2BC',
        card: '#FFFFFF',
        surface: '#F7F5FB',
        sunken: '#F1EEF8',
        border: '#E7E2F0',
        hair: '#F0ECF7',
        ok: { DEFAULT: '#0E8A55', tint: '#E9F8F0', line: '#BFE6D2', deep: '#0A6640' },
        warn: { DEFAULT: '#A86808', tint: '#FDF5E7', line: '#F0DDB4', deep: '#7D4D06' },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        brand: ['Poppins', 'Inter', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.06em' }],
      },
      borderRadius: { xl: '12px', '2xl': '16px', '3xl': '22px', pill: '999px' },
      boxShadow: {
        // A three-step elevation scale. Cards sit at `xs`; anything that
        // genuinely floats gets `md` or `lg`. Nothing in between gets invented.
        xs: '0 1px 2px 0 rgba(21,11,38,0.04)',
        sm: '0 2px 6px -1px rgba(21,11,38,0.06), 0 1px 2px rgba(21,11,38,0.04)',
        md: '0 8px 24px -8px rgba(21,11,38,0.14), 0 2px 6px -2px rgba(21,11,38,0.06)',
        lg: '0 24px 56px -20px rgba(21,11,38,0.22), 0 4px 12px -4px rgba(21,11,38,0.08)',
        drawer: '-32px 0 72px -28px rgba(21,11,38,0.28)',
        brand: '0 10px 30px -10px rgba(124,45,189,0.45)',
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg, #A855F7 0%, #7C2DBD 55%, #5B1A93 100%)',
        'engine-grad': 'linear-gradient(90deg, #C1213F 0%, #7C2DBD 50%, #35619F 100%)',
        'mesh': `radial-gradient(900px 500px at 12% -5%, rgba(193,33,63,0.10), transparent 60%),
                 radial-gradient(900px 600px at 88% 8%, rgba(53,97,159,0.12), transparent 62%),
                 radial-gradient(760px 620px at 50% 108%, rgba(124,45,189,0.16), transparent 60%)`,
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(28px)' }, to: { opacity: '1', transform: 'none' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-9px)' } },
        sheen: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        'fade-up': 'fade-up .24s cubic-bezier(.22,1,.36,1) both',
        'slide-in': 'slide-in .22s cubic-bezier(.22,1,.36,1)',
        float: 'float 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
