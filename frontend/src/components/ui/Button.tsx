import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variants = {
      primary: [
        'bg-primary-500 text-white',
        'shadow-sm shadow-primary-500/30',
        'hover:bg-primary-600 hover:shadow-md hover:shadow-primary-500/40',
        'active:bg-primary-700 active:shadow-sm',
        'focus:ring-primary-500',
      ].join(' '),
      secondary: [
        'bg-white text-gray-700 border border-gray-200',
        'shadow-sm shadow-gray-200/50',
        'hover:bg-gray-50 hover:border-gray-300 hover:shadow-md hover:shadow-gray-200/60',
        'active:bg-gray-100 active:shadow-sm',
        'focus:ring-primary-500',
      ].join(' '),
      danger: [
        'bg-danger-500 text-white',
        'shadow-sm shadow-danger-500/30',
        'hover:bg-danger-600 hover:shadow-md hover:shadow-danger-500/40',
        'active:bg-danger-700 active:shadow-sm',
        'focus:ring-danger-500',
      ].join(' '),
      success: [
        'bg-success-500 text-white',
        'shadow-sm shadow-success-500/30',
        'hover:bg-success-600 hover:shadow-md hover:shadow-success-500/40',
        'active:bg-success-700 active:shadow-sm',
        'focus:ring-success-500',
      ].join(' '),
      ghost: [
        'bg-transparent text-gray-700',
        'hover:bg-gray-100',
        'active:bg-gray-200',
        'focus:ring-gray-500',
      ].join(' '),
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-5 py-2.5 text-base',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : leftIcon ? (
          leftIcon
        ) : null}
        {children}
        {rightIcon && !isLoading ? rightIcon : null}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
