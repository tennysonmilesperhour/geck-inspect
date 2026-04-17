/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		// Every `rounded-*` size is scaled down ~20% from Tailwind's
  		// defaults. `rounded-full` and `rounded-none` are intentionally
  		// left alone so pills/avatars still render as full circles.
  		// The sm/md/lg values flow through --radius (0.4rem) in index.css
  		// so shadcn primitives automatically inherit the reduction.
  		borderRadius: {
  			lg: 'var(--radius)',                 /* 0.4rem  (was 0.5rem)  */
  			md: 'calc(var(--radius) - 2px)',     /* 4.4px   (was 6px)     */
  			sm: 'calc(var(--radius) - 4px)',     /* 2.4px   (was 4px)     */
  			DEFAULT: '0.2rem',                   /* 3.2px   (was 4px)     */
  			xl: '0.6rem',                        /* 9.6px   (was 12px)    */
  			'2xl': '0.8rem',                     /* 12.8px  (was 16px)    */
  			'3xl': '1.2rem'                      /* 19.2px  (was 24px)    */
  		},
  		colors: {
  			// Override Tailwind's default blue-grey slate with emerald-tinted
  			// neutral tones so every bg-slate-*, text-slate-*, border-slate-*
  			// class matches the app's green theme automatically.
  			slate: {
  				50:  '#f0fdf6',
  				100: '#d1fae5',
  				200: '#a7f3d0',
  				300: '#6ee7b7',
  				400: '#34d399',
  				500: '#6b8f80',
  				600: '#4a6e5e',
  				700: '#243f35',
  				800: '#1a3a2d',
  				900: '#163026',
  				950: '#0d1f17',
  			},
  			// Gray also needs the same override — Tailwind's gray is
  			// blue-tinted too and the Layout sidebar uses gray-* classes.
  			gray: {
  				50:  '#f0fdf6',
  				100: '#d1fae5',
  				200: '#a7f3d0',
  				300: '#6ee7b7',
  				400: '#34d399',
  				500: '#6b8f80',
  				600: '#4a6e5e',
  				700: '#243f35',
  				800: '#1a3a2d',
  				900: '#163026',
  				950: '#0d1f17',
  			},
  			// Sage: the brand green palette. Values are the dark-mode scale
  			// (the app is always-dark) so text-sage-700 renders as light
  			// green text and bg-sage-50 renders as a dark green surface.
  			sage: {
  				50:  '#064e3b',
  				100: '#065f46',
  				200: '#047857',
  				300: '#059669',
  				400: '#10b981',
  				500: '#34d399',
  				600: '#6ee7b7',
  				700: '#a7f3d0',
  				800: '#d1fae5',
  				900: '#ecfdf5',
  			},
  			// Earth: the warm accent palette (orange/amber).
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