/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'backdrop-blur-xl',
    'bg-white/10',
    'border-white/20',
    'shadow-2xl',
    'shadow-cyan-500/50',
    'shadow-violet-500/50',
    'ring-cyan-400/50',
    'ring-violet-400/50',
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          850: '#1e293b',
          950: '#0f172a',
        },
        sky: {
          450: '#38bdf8',
        },
        indigo: {
          950: '#0f172a', // Deep Indigo
        },
        violet: {
          550: '#8b5cf6',
          electric: '#7C3AED', // Electric Violet
        },
        cyan: {
          electric: '#06B6D4', // Electric Cyan
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Geist', 'Inter', 'sans-serif'],
        mono: ['Geist Mono', 'Courier New', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 15s ease infinite',
        'liquid': 'liquid 3s ease-in-out infinite',
        'float': 'float 20s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'drift': 'drift 30s ease-in-out infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        liquid: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '50%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '50%': { transform: 'translateY(-20px) scale(1.05)' },
        },
        glow: {
          '0%': { opacity: '0.5', filter: 'blur(20px)' },
          '100%': { opacity: '0.8', filter: 'blur(30px)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '33%': { transform: 'translate(30px, -30px)' },
          '66%': { transform: 'translate(-20px, 20px)' },
        },
      },
    },
  },
  plugins: [],
}
