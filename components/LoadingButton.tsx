"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Spinner } from "./Skeletons";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

/**
 * Enhanced button with loading state support
 */
export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      isLoading = false,
      loadingText,
      children,
      variant = "primary",
      size = "md",
      fullWidth = false,
      disabled,
      className = "",
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      inline-flex items-center justify-center gap-2
      font-medium rounded-lg transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const variantClasses = {
      primary: `
        bg-blue-600 text-white hover:bg-blue-700
        focus:ring-blue-500
        dark:bg-blue-600 dark:hover:bg-blue-700
      `,
      secondary: `
        bg-slate-200 text-slate-700 hover:bg-slate-300
        focus:ring-slate-500
        dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600
      `,
      danger: `
        bg-red-600 text-white hover:bg-red-700
        focus:ring-red-500
      `,
      ghost: `
        bg-transparent text-slate-600 hover:bg-slate-100
        focus:ring-slate-500
        dark:text-slate-300 dark:hover:bg-slate-800
      `,
    };

    const sizeClasses = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    };

    const widthClass = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`
          ${baseClasses}
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${widthClass}
          ${className}
        `}
        {...props}
      >
        {isLoading && <Spinner size={size === "lg" ? "md" : "sm"} />}
        {isLoading && loadingText ? loadingText : children}
      </button>
    );
  }
);

LoadingButton.displayName = "LoadingButton";

/**
 * Icon button component
 */
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string; // Required for accessibility
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      variant = "ghost",
      size = "md",
      disabled,
      className = "",
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      inline-flex items-center justify-center
      rounded-lg transition-colors duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const variantClasses = {
      primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
      secondary:
        "bg-slate-200 text-slate-700 hover:bg-slate-300 focus:ring-slate-500 dark:bg-slate-700 dark:text-slate-200",
      ghost:
        "bg-transparent text-slate-500 hover:bg-slate-100 focus:ring-slate-500 dark:text-slate-400 dark:hover:bg-slate-800",
    };

    const sizeClasses = {
      sm: "w-8 h-8",
      md: "w-10 h-10",
      lg: "w-12 h-12",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        aria-label={label}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";
