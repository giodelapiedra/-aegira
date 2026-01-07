import { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  showPageNumbers?: boolean;
  showFirstLast?: boolean;
  showItemCount?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  onPageChange,
  showPageNumbers = true,
  showFirstLast = true,
  showItemCount = true,
  className,
  size = 'md',
}: PaginationProps) {
  // Don't render if only 1 page
  if (totalPages <= 1) return null;

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
    lg: 'h-10 w-10 text-base',
  };

  const buttonSize = sizeClasses[size];

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 5; // Max page numbers to show

    if (totalPages <= maxVisible + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if at edges
      if (currentPage <= 3) {
        end = Math.min(totalPages - 1, maxVisible - 1);
      } else if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - maxVisible + 2);
      }

      // Add ellipsis before if needed
      if (start > 2) {
        pages.push('ellipsis');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis after if needed
      if (end < totalPages - 1) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  // Calculate item range for display
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems || currentPage * pageSize);

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-4', className)}>
      {/* Item count */}
      {showItemCount && totalItems !== undefined && (
        <p className="text-sm text-gray-500 order-2 sm:order-1">
          Showing <span className="font-medium text-gray-700">{startItem}</span> to{' '}
          <span className="font-medium text-gray-700">{endItem}</span> of{' '}
          <span className="font-medium text-gray-700">{totalItems}</span> results
        </p>
      )}

      {/* Pagination controls */}
      <div className="flex items-center gap-1 order-1 sm:order-2">
        {/* First page */}
        {showFirstLast && (
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={cn(
              buttonSize,
              'rounded-lg flex items-center justify-center transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              currentPage === 1
                ? 'text-gray-300'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            )}
            title="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}

        {/* Previous page */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            buttonSize,
            'rounded-lg flex items-center justify-center transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            currentPage === 1
              ? 'text-gray-300'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          )}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {showPageNumbers && (
          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) => {
              if (page === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className={cn(buttonSize, 'flex items-center justify-center text-gray-400')}
                  >
                    ...
                  </span>
                );
              }

              const isActive = page === currentPage;
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={cn(
                    buttonSize,
                    'rounded-lg font-medium transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  {page}
                </button>
              );
            })}
          </div>
        )}

        {/* Next page */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            buttonSize,
            'rounded-lg flex items-center justify-center transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            currentPage === totalPages
              ? 'text-gray-300'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          )}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Last page */}
        {showFirstLast && (
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={cn(
              buttonSize,
              'rounded-lg flex items-center justify-center transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              currentPage === totalPages
                ? 'text-gray-300'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            )}
            title="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Hook for pagination logic
export function usePagination<T>(
  data: T[] | undefined,
  options: { pageSize?: number; initialPage?: number } = {}
) {
  const { pageSize = 10, initialPage = 1 } = options;
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalItems = data?.length || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Reset to page 1 if current page exceeds total
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1);
  }

  const paginatedData = data?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    pageSize,
    paginatedData,
    paginationProps: {
      currentPage,
      totalPages,
      totalItems,
      pageSize,
      onPageChange: setCurrentPage,
    },
  };
}
