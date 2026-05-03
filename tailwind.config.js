/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		// Every `rounded-*` size is scaled down ~8% from Tailwind's
  		// defaults (was 20%, bumped up 15% on 2026-05-03).
  		// `rounded-full` and `rounded-none` are intentionally
  		// left alone so pills/avatars still render as full circles.
  		// The sm/md/lg values flow through --radius (0.46rem) in index.css
  		// so shadcn primitives automatically inherit the reduction.
  		borderRadius: {
  			lg: 'var(--radius)',                 /* 0.46rem (was 0.5rem)  */
  			md: 'calc(var(--radius) - 2px)',     /* 5.36px  (was 6px)     */
  			sm: 'calc(var(--radius) - 4px)',     /* 3.36px  (was 4px)     */
  			DEFAULT: '0.23rem',                  /* 3.68px  (was 4px)     */
  			xl: '0.69rem',                       /* 11.04px (was 12px)    */
  			'2xl': '0.92rem',                    /* 14.72px (was 16px)    */
  			'3xl': '1.38rem'                     /* 22.08px (was 24px)    */
  		},
  		colors: {
  			// sage / slate / gray scales are driven by CSS variables
  			// defined per-theme in src/index.css under :root[data-theme].
  			// hsl(var(--x) / <alpha-value>) preserves Tailwind's opacity
  			// modifier syntax (bg-slate-900/50 etc). Switching data-theme
  			// on <html> re-tints every utility using these scales without
  			// touching component code.
  			//
  			// `slate` and `gray` are overridden here (Tailwind's defaults
  			// are blue-grey) so neutrals carry the active theme's hue.
  			// `sage` is the brand accent scale (50 = darkest surface,
  			// 900 = lightest text) matching the always-dark render model.
  			// `earth` is a warm-accent palette intentionally NOT themed —
  			// it stays orange across all themes for semantic alerts /
  			// breeder perks / hatchling badges.
  			slate: {
  				50:  'hsl(var(--slate-50) / <alpha-value>)',
  				100: 'hsl(var(--slate-100) / <alpha-value>)',
  				200: 'hsl(var(--slate-200) / <alpha-value>)',
  				300: 'hsl(var(--slate-300) / <alpha-value>)',
  				400: 'hsl(var(--slate-400) / <alpha-value>)',
  				500: 'hsl(var(--slate-500) / <alpha-value>)',
  				600: 'hsl(var(--slate-600) / <alpha-value>)',
  				700: 'hsl(var(--slate-700) / <alpha-value>)',
  				800: 'hsl(var(--slate-800) / <alpha-value>)',
  				900: 'hsl(var(--slate-900) / <alpha-value>)',
  				950: 'hsl(var(--slate-950) / <alpha-value>)',
  			},
  			gray: {
  				50:  'hsl(var(--slate-50) / <alpha-value>)',
  				100: 'hsl(var(--slate-100) / <alpha-value>)',
  				200: 'hsl(var(--slate-200) / <alpha-value>)',
  				300: 'hsl(var(--slate-300) / <alpha-value>)',
  				400: 'hsl(var(--slate-400) / <alpha-value>)',
  				500: 'hsl(var(--slate-500) / <alpha-value>)',
  				600: 'hsl(var(--slate-600) / <alpha-value>)',
  				700: 'hsl(var(--slate-700) / <alpha-value>)',
  				800: 'hsl(var(--slate-800) / <alpha-value>)',
  				900: 'hsl(var(--slate-900) / <alpha-value>)',
  				950: 'hsl(var(--slate-950) / <alpha-value>)',
  			},
  			sage: {
  				50:  'hsl(var(--sage-50) / <alpha-value>)',
  				100: 'hsl(var(--sage-100) / <alpha-value>)',
  				200: 'hsl(var(--sage-200) / <alpha-value>)',
  				300: 'hsl(var(--sage-300) / <alpha-value>)',
  				400: 'hsl(var(--sage-400) / <alpha-value>)',
  				500: 'hsl(var(--sage-500) / <alpha-value>)',
  				600: 'hsl(var(--sage-600) / <alpha-value>)',
  				700: 'hsl(var(--sage-700) / <alpha-value>)',
  				800: 'hsl(var(--sage-800) / <alpha-value>)',
  				900: 'hsl(var(--sage-900) / <alpha-value>)',
  			},
  			// emerald is the app's "brand accent" — overridden to read
  			// CSS variables driven by the data-secondary attribute so
  			// users can mix-and-match a theme (backgrounds/surfaces)
  			// with an independent accent color. Defaults in :root
  			// match Tailwind's stock emerald, so no visible change
  			// until the user picks a non-"normal" accent. green-* is
  			// deliberately left untouched so "success green" keeps
  			// its semantic meaning across all accent choices.
  			emerald: {
  				50:  'hsl(var(--emerald-50) / <alpha-value>)',
  				100: 'hsl(var(--emerald-100) / <alpha-value>)',
  				200: 'hsl(var(--emerald-200) / <alpha-value>)',
  				300: 'hsl(var(--emerald-300) / <alpha-value>)',
  				400: 'hsl(var(--emerald-400) / <alpha-value>)',
  				500: 'hsl(var(--emerald-500) / <alpha-value>)',
  				600: 'hsl(var(--emerald-600) / <alpha-value>)',
  				700: 'hsl(var(--emerald-700) / <alpha-value>)',
  				800: 'hsl(var(--emerald-800) / <alpha-value>)',
  				900: 'hsl(var(--emerald-900) / <alpha-value>)',
  				950: 'hsl(var(--emerald-950) / <alpha-value>)',
  			},
  			earth: {
  				50:  '#6f2e0c',
  				100: '#8e3a16',
  				200: '#b7472a',
  				300: '#d35400',
  				400: '#e67e22',
  				500: '#ed9455',
  				600: '#f4b885',
  				700: '#f9d5b5',
  				800: '#fdeee0',
  				900: '#fef7f0',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'morph-slide-in-right': {
  				'0%': { transform: 'translateX(100%)', opacity: '0' },
  				'100%': { transform: 'translateX(0)', opacity: '1' }
  			},
  			'morph-slide-out-left': {
  				'0%': { transform: 'translateX(0)', opacity: '1' },
  				'100%': { transform: 'translateX(-100%)', opacity: '0' }
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'morph-slide-in-right': 'morph-slide-in-right 0.7s cubic-bezier(0.22, 1, 0.36, 1)',
  			'morph-slide-out-left': 'morph-slide-out-left 0.7s cubic-bezier(0.22, 1, 0.36, 1)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}