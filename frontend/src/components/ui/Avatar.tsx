import { cn, getInitials } from '../../lib/utils';

export interface AvatarProps {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  status?: 'online' | 'offline' | 'away';
}

export function Avatar({
  src,
  firstName = '',
  lastName = '',
  size = 'md',
  className,
  status,
}: AvatarProps) {
  const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  const statusColors = {
    online: 'bg-success-500',
    offline: 'bg-gray-400',
    away: 'bg-warning-500',
  };

  const statusSizes = {
    xs: 'h-1.5 w-1.5',
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4',
  };

  return (
    <div className="relative inline-flex flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt={`${firstName} ${lastName}`}
          className={cn(
            'rounded-full object-cover',
            sizes[size],
            className
          )}
        />
      ) : (
        <div
          className={cn(
            'rounded-full bg-gray-100 text-gray-500 font-medium',
            'flex items-center justify-center',
            sizes[size],
            className
          )}
        >
          {getInitials(firstName, lastName)}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-white',
            statusColors[status],
            statusSizes[size]
          )}
        />
      )}
    </div>
  );
}
