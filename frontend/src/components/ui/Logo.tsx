import { cn } from '../../lib/utils';
import logoImage from '../../assets/AEGIRA.png';

export interface LogoProps {
  /**
   * Size variant of the logo
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Whether to show text label below the logo
   * @default false
   */
  showText?: boolean;
  
  /**
   * Text variant - 'full' shows "Aegira" with subtitle, 'short' shows only "Aegira"
   * @default 'short'
   */
  textVariant?: 'full' | 'short';
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Logo container className
   */
  containerClassName?: string;
  
  /**
   * Custom width (overrides size)
   */
  width?: number | string;
  
  /**
   * Custom height (overrides size)
   */
  height?: number | string;
}

const sizeMap = {
  sm: { image: 'h-8 w-8', text: 'text-sm' },
  md: { image: 'h-10 w-10', text: 'text-base' },
  lg: { image: 'h-12 w-12', text: 'text-lg' },
  xl: { image: 'h-16 w-16', text: 'text-xl' },
};

export function Logo({
  size = 'md',
  showText = false,
  textVariant = 'short',
  className,
  containerClassName,
  width,
  height,
}: LogoProps) {
  const sizeClasses = sizeMap[size];

  return (
    <div className={cn('flex items-center gap-3', containerClassName)}>
      <img
        src={logoImage}
        alt="Aegira Logo"
        className={cn(
          'object-contain flex-shrink-0',
          !width && !height && sizeClasses.image,
          className
        )}
        style={{
          ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
          ...(height && { height: typeof height === 'number' ? `${height}px` : height }),
        }}
      />
      {showText && (
        <div className={cn(
          'flex flex-col transition-all duration-300 overflow-hidden',
          sizeClasses.text
        )}>
          <h1 className="font-bold text-gray-900 whitespace-nowrap">Aegira</h1>
          {textVariant === 'full' && (
            <p className="text-[10px] text-primary-600 font-medium uppercase tracking-wider whitespace-nowrap">
              Readiness System
            </p>
          )}
        </div>
      )}
    </div>
  );
}

