import clsx from "clsx";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

/** Stop mouse wheel from changing focused number inputs while scrolling the page. */
export function blurOnNumberWheel(e: React.WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur();
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, suppressHydrationWarning, type, onWheel, ...props }, ref) {
    // ponytail: browsers/password managers rewrite autocomplete before hydration
    const suppress = suppressHydrationWarning ?? props.autoComplete != null;
    return (
      <input
        ref={ref}
        type={type}
        className={clsx("input", className)}
        suppressHydrationWarning={suppress}
        onWheel={(e) => {
          if (type === "number") blurOnNumberWheel(e);
          onWheel?.(e);
        }}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx("input min-h-[80px] resize-y", className)}
        {...props}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={clsx("input", className)} {...props}>
        {children}
      </select>
    );
  }
);
