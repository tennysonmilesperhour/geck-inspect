import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva } from 'class-variance-authority';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Toast primitives for shadcn-style toasts.
 *
 * The previous implementation of this file rendered plain `<div>`s instead
 * of Radix's `ToastPrimitives.*` components. That's why:
 *   - The "Plan created" banner didn't look like any of the other toasts.
 *   - Clicking the X did nothing (no Radix dismiss wiring).
 *   - Toasts never auto-dismissed.
 *   - The X glitched in and out of the corner (the styling depended on
 *     data-[state=open] attributes Radix sets but plain divs never had).
 *
 * This rewrite uses `@radix-ui/react-toast` the way it's meant to be used.
 * Every toast consistently:
 *   - Animates in from the bottom-right with a slide+fade
 *   - Auto-dismisses (default duration set in use-toast.jsx)
 *   - Has a visible X close button in the top-right that actually works
 *   - Carries a status icon matched to the variant (success / error /
 *     warning / info)
 */

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4',
      'sm:right-0 md:max-w-[420px]',
      'pb-[calc(1rem+env(safe-area-inset-bottom))]',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  cn(
    'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden',
    'rounded-xl border backdrop-blur-md shadow-2xl p-4 pr-10',
    'transition-all',
    'data-[swipe=cancel]:translate-x-0',
    'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
    'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
    'data-[swipe=move]:transition-none',
    'data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[swipe=end]:animate-out',
    'data-[state=closed]:fade-out-80',
    'data-[state=closed]:slide-out-to-right-full',
    'data-[state=open]:slide-in-from-bottom-full'
  ),
  {
    variants: {
      variant: {
        default:
          'border-emerald-500/40 bg-slate-900/95 text-slate-100',
        success:
          'border-emerald-500/50 bg-slate-900/95 text-slate-100',
        destructive:
          'destructive group border-rose-500/50 bg-slate-900/95 text-slate-100',
        warning:
          'border-amber-500/50 bg-slate-900/95 text-slate-100',
        info:
          'border-slate-600 bg-slate-900/95 text-slate-100',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Map variants to their accent icon + tint. Gives every toast a clear
// status glyph in the top-left so the user never has to parse the body
// for meaning.
const VARIANT_ICONS = {
  default: { Icon: CheckCircle2, tint: 'text-emerald-400' },
  success: { Icon: CheckCircle2, tint: 'text-emerald-400' },
  destructive: { Icon: AlertCircle, tint: 'text-rose-400' },
  warning: { Icon: AlertTriangle, tint: 'text-amber-400' },
  info: { Icon: Info, tint: 'text-slate-300' },
};

// The Toast component renders its OWN close button as a direct child of
// the Root, not nested inside a wrapper div. That way the `absolute
// right-2 top-2` positioning anchors to the Root (which has `relative`)
// instead of getting trapped inside the flex-1 children wrapper — which
// was the root cause of the "X appears below the title" bug.
//
// The companion Toaster component no longer renders its own <ToastClose />
// since every Toast already provides one here.
const Toast = React.forwardRef(({ className, variant, children, ...props }, ref) => {
  const meta = VARIANT_ICONS[variant || 'default'] || VARIANT_ICONS.default;
  const Icon = meta.Icon;
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      <div className={cn('shrink-0 mt-0.5', meta.tint)}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0 pr-4">{children}</div>
      <ToastClose />
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500',
      'group-[.destructive]:border-rose-600/40 group-[.destructive]:text-rose-200 group-[.destructive]:hover:bg-rose-900/30',
      className
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 text-slate-500 transition-colors',
      'hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500',
      'group-[.destructive]:text-rose-300 group-[.destructive]:hover:bg-rose-950/50 group-[.destructive]:hover:text-rose-100',
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('text-sm font-semibold leading-tight text-slate-100', className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-xs leading-relaxed text-slate-300 mt-1', className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
