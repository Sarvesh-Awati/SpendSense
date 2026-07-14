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
          light: '#f8fafc', // Light slate
          dark: '#0b0f19',  // Deep obsidian slate (fintech premium feel)
        },
        card: {
          light: '#ffffff',
          dark: '#161c2a',  // Subtle slate/blue-gray container
        },
        border: {
          light: '#e2e8f0',
          dark: '#1e293b',
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
        sans: ['Inter', 'Outfit', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-subtle': 'pulseSubtle 2s infinite ease-in-out',
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
        }
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 8px -1px rgba(0, 0, 0, 0.03)',
        'premium-dark': '0 4px 30px -10px rgba(0, 0, 0, 0.7), 0 2px 10px -5px rgba(0, 0, 0, 0.5)',
        'glow-green': '0 0 15px rgba(16, 185, 129, 0.15)',
        'glow-indigo': '0 0 15px rgba(99, 102, 241, 0.15)',
      }
    },
  },
  plugins: [],
}
