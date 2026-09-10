import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Flat themed emerald. The old emerald-500 -> green-600 gradient
        // mixed the user's chosen accent (emerald-* re-tints via
        // data-secondary) with stock green-* (deliberately NOT themed),
        // so on every non-emerald accent the primary button rendered as
        // a two-color smear. Flat emerald-600 is also what ~130 call
        // sites were already overriding to by hand.
        default:
          "bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-black/20",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // Themed to match the dark-emerald shell (shadcn's stock
        // `bg-background` fell back to near-black). The global button
        // overrides that once lived in Layout.jsx are gone (see
        // layout-theme.css), so plain emerald utilities are safe here.
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