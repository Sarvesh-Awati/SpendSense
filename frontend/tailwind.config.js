/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enables switching between light and dark mode manually
  theme: {
    extend: {
      colors: {
        background: {
          light: '#f4f4f1', // Warm paper
          dark: '#0B0F14',  // Deep charcoal canvas
        },
        card: {
          light: '#ffffff',
          dark: '#151A21',  // Panel surface sitting on the charcoal canvas
        },
        border: {
          light: '#e5e5e0',
          dark: '#1E242C',  // Deliberately low-contrast: borders should whisper
        },
        // Named surfaces for the light-inside-dark composition.
        surface: {
          raised: '#20252B',  // Secondary dark surface (one step up from panel)
          // Recessed surface: inputs, wells, progress tracks, hover fills.
          // Previously written as the literal `bg-[#111622]` in 114 places;
          // this makes it a token so it can be themed in one edit.
          sunk: '#111622',
          paper: '#F7F7F4',   // Warm off-white card placed on the dark canvas
          paperMuted: '#EDEDE8',
        },
        ink: {
          // Text colours for use ON the warm paper surface, in either theme.
          strong: '#12161B',
          muted: '#6B7280',
        },
        brand: {
          primary: '#10b981',   // Emerald Green (wealth/finance/growth)
          secondary: '#6366f1', // Indigo Blue (AI/automation)
          accent: '#8b5cf6',    // Purple (insights/forecasts)
        },
        text: {
          primaryLight: '#0f172a',
          primaryDark: '#f8fafc',
          secondaryLight: '#64748b',
          secondaryDark: '#94a3b8',
        },
        finance: {
          income: '#10b981',    // Emerald green for cash inflows
          expense: '#f43f5e',   // Rose red/coral for cash outflows
          savings: '#06b6d4',   // Cyan for goals & savings
          debt: '#f59e0b',      // Amber for limits & warnings
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // `font-outfit` was used throughout the app but never defined here, so
        // every display heading silently fell back to Inter. Outfit is already
        // loaded in index.html — this makes the intended type pairing real.
        outfit: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
        'rise': 'rise 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        // Staggered card entrance — kept short so it never delays reading.
        rise: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      /**
       * Semantic radius scale — one ladder, named by role rather than size.
       * Tailwind's numeric defaults (rounded-lg/xl/2xl/3xl) are intentionally
       * left intact so existing markup is unaffected; new work should use
       * these names, and migration happens per-component in later passes.
       */
      borderRadius: {
        'control': '12px', // buttons, inputs, chips, small controls
        'panel': '20px',   // compact modules
        'card': '28px',    // standard surfaces and modals
        'hero': '32px',    // the single dominant surface
      },
      /**
       * Semantic elevation scale — one ladder, two tones.
       * e1 rests, e2 floats, e3 overlays. `premium`/`float` are retained as
       * aliases of e1/e2 so the ~49 existing usages keep working and resolve
       * to the same consistent values.
       */
      boxShadow: {
        'e1': '0 1px 2px rgba(8, 11, 15, 0.04), 0 4px 12px -4px rgba(8, 11, 15, 0.08)',
        'e1-dark': '0 1px 3px rgba(0, 0, 0, 0.30), 0 6px 16px -6px rgba(0, 0, 0, 0.45)',
        'e2': '0 2px 4px rgba(8, 11, 15, 0.04), 0 12px 32px -8px rgba(8, 11, 15, 0.10)',
        'e2-dark': '0 2px 6px rgba(0, 0, 0, 0.35), 0 18px 44px -12px rgba(0, 0, 0, 0.55)',
        'e3': '0 8px 16px rgba(8, 11, 15, 0.08), 0 24px 56px -12px rgba(8, 11, 15, 0.18)',
        'e3-dark': '0 8px 20px rgba(0, 0, 0, 0.45), 0 32px 72px -16px rgba(0, 0, 0, 0.65)',

        // Legacy aliases -> the scale above. Kept so existing markup is stable.
        'premium': '0 1px 2px rgba(8, 11, 15, 0.04), 0 4px 12px -4px rgba(8, 11, 15, 0.08)',
        'premium-dark': '0 1px 3px rgba(0, 0, 0, 0.30), 0 6px 16px -6px rgba(0, 0, 0, 0.45)',
        'float': '0 2px 4px rgba(8, 11, 15, 0.04), 0 12px 32px -8px rgba(8, 11, 15, 0.10)',
        'float-dark': '0 2px 6px rgba(0, 0, 0, 0.35), 0 18px 44px -12px rgba(0, 0, 0, 0.55)',
      }
    },
  },
  plugins: [],
}
