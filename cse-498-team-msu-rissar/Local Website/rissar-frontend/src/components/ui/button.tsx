/**
 * Button Component
 * 
 * A customizable button component with multiple variants and sizes.
 * Built on top of standard HTML button element.
 * 
 * @component
 */
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand-accent-green text-white shadow-md hover:bg-brand-green disabled:bg-brand-accent-green/40 disabled:text-white/80 dark:bg-brand-accent-green dark:hover:bg-brand-green dark:disabled:bg-brand-accent-green/30",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300 disabled:text-white/80 dark:bg-red-700 dark:hover:bg-red-600 dark:disabled:bg-red-500",
        outline:
          "border-2 border-brand-green bg-white text-brand-green shadow-sm hover:bg-brand-green/10 hover:text-brand-green disabled:border-border disabled:text-gray-400 disabled:bg-white dark:border-brand-accent-green dark:bg-black dark:text-brand-accent-green dark:hover:bg-brand-accent-green/20 dark:disabled:text-brand-accent-green/40",
        secondary:
          "bg-brand-accent-green-2 text-white shadow-sm hover:bg-brand-green disabled:bg-brand-accent-green-2/50 disabled:text-white/80 dark:bg-brand-green dark:hover:bg-brand-accent-green",
        ghost: "text-black hover:bg-brand-green/10 disabled:text-gray-400 disabled:bg-transparent dark:text-white dark:hover:bg-brand-accent-green/20 dark:disabled:text-gray-500",
        link: "text-brand-green underline-offset-4 hover:underline dark:text-brand-accent-green",
        resume: "bg-green-500 text-white shadow-sm hover:bg-green-600 disabled:bg-green-300 disabled:text-white/80 dark:bg-green-600 dark:hover:bg-green-500 dark:disabled:bg-green-400",
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
