import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
  valueLabel?: string;
  colorScale?: boolean;
}

const Slider = forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      label,
      value = 5,
      min = 1,
      max = 10,
      step = 1,
      showValue = true,
      valueLabel,
      colorScale = false,
      ...props
    },
    ref
  ) => {
    const getColorClass = (val: number) => {
      const percentage = ((val - min) / (max - min)) * 100;
      if (percentage <= 33) return 'text-danger-500';
      if (percentage <= 66) return 'text-warning-500';
      return 'text-success-500';
    };

    return (
      <div className="w-full">
        {(label || showValue) && (
          <div className="flex items-center justify-between mb-2">
            {label && (
              <label className="block text-sm font-medium text-gray-700">
                {label}
              </label>
            )}
            {showValue && (
              <span
                className={cn(
                  'text-sm font-semibold',
                  colorScale ? getColorClass(value) : 'text-gray-900'
                )}
              >
                {value}{valueLabel && ` ${valueLabel}`}
              </span>
            )}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          className={cn(
            'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer',
            'accent-primary-600',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-primary-600',
            '[&::-webkit-slider-thumb]:cursor-pointer',
            '[&::-webkit-slider-thumb]:transition-all',
            '[&::-webkit-slider-thumb]:hover:scale-110',
            className
          )}
          {...props}
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    );
  }
);

Slider.displayName = 'Slider';

export { Slider };
