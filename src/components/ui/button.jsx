import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 relative overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-500/20 hover:bg-emerald-500/30 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:border-emerald-400/50 before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-200",
        destructive:
          "bg-red-500/20 hover:bg-red-500/30 backdrop-blur-sm border border-red-400/30 text-red-300 shadow-lg shadow-red-500/10",
        outline:
          "border border-white/15 bg-white/5 backdrop-blur-sm hover:bg-white/10 text-white/80 hover:text-white shadow-sm",
        secondary:
          "bg-white/8 backdrop-blur-sm border border-white/10 text-white/70 hover:bg-white/15 hover:text-white shadow-sm",
        ghost: "hover:bg-white/10 text-white/70 hover:text-white backdrop-blur-sm",
        link: "text-emerald-400 underline-offset-4 hover:underline hover:text-emerald-300",
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