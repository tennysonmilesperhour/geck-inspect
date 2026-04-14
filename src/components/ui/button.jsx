import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold shadow-lg",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // Themed to match the rest of the app's dark-emerald shell. The
        // previous `bg-background` fell back to near-black in dark mode,
        // and any outline button wrapped in a Radix trigger
        // (DialogTrigger, DropdownMenuTrigger, etc.) escaped the global
        // `button:not([data-state])` emerald override in Layout.jsx —
        // rendering as a pure-black button against the green theme.
        //
        // NOTE: we deliberately use arbitrary `bg-[rgba(...)]` values
        // instead of `bg-emerald-*` here. Layout.jsx has a selector
        // `.dark button[class*="bg-emerald"]` that force-promotes any
        // button with `bg-emerald` in its class list to a full primary
        // gradient — which would make outline buttons look like solid
        // CTAs. Arbitrary values don't trigger that substring match.
        outline:
          "border border-emerald-900/60 bg-emerald-950/30 text-emerald-100/80 shadow-sm hover:bg-emerald-900/40 hover:text-white hover:border-emerald-700/60",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props} />)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }