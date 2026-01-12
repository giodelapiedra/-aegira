import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'warning';
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
    // 3D Button style with border-b-4
    const variants = {
      primary: [
        'bg-primary-500 text-white',
        'border-b-4 border-primary-700',
        'hover:bg-primary-400 hover:border-primary-600',
        'active:border-b-0 active:translate-y-1',
      ].join(' '),
      secondary: [
        'bg-gray-200 text-gray-700',
        'border-b-4 border-gray-400',
        'hover:bg-gray-100 hover:border-gray-300',
        'active:border-b-0 active:translate-y-1',
      ].join(' '),
      danger: [
        'bg-danger-500 text-white',
        'border-b-4 border-danger-700',
        'hover:bg-danger-400 hover:border-danger-600',
        'active:border-b-0 active:translate-y-1',
      ].join(' '),
      success: [
        'bg-success-500 text-white',
        'border-b-4 border-success-700',
        'hover:bg-success-400 hover:border-success-600',
        'active:border-b-0 active:translate-y-1',
      ].join(' '),
      warning: [
        'bg-warning-500 text-white',
        'border-b-4 border-warning-700',
        'hover:bg-warning-400 hover:border-warning-600',
        'active:border-b-0 active:translate-y-1',
      ].join(' '),
      ghost: [
        'bg-transparent text-gray-700',
        'hover:bg-gray-100',
        'active:bg-gray-200',
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
          'inline-flex items-center justify-center gap-2 font-bold rounded',
          'transition-all duration-100 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
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
