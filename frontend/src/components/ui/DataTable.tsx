/**
 * TanStack Table Powered DataTable Component
 * Features: sorting, pagination, column visibility, global filter, row selection
 */

import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  Columns3,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { LoadingSpinner, SkeletonTableRow } from './LoadingSpinner';
import { EmptyState } from './EmptyState';

// ============================================
// TYPES
// ============================================

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  enableHiding?: boolean;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  className?: string;
  stickyHeader?: boolean;
  // New TanStack features
  enableGlobalFilter?: boolean;
  globalFilterPlaceholder?: string;
  enableColumnVisibility?: boolean;
  enableRowSelection?: boolean;
  onRowSelectionChange?: (selectedRows: T[]) => void;
}

// ============================================
// COMPONENT
// ============================================

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  pagination,
  onPageChange,
  sortBy,
  sortOrder,
  onSort,
  emptyTitle = 'No data found',
  emptyDescription,
  onRowClick,
  className,
  stickyHeader = false,
  // New features
  enableGlobalFilter = false,
  globalFilterPlaceholder = 'Search...',
  enableColumnVisibility = false,
  enableRowSelection = false,
  onRowSelectionChange,
}: DataTableProps<T>) {
  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>(
    sortBy ? [{ id: sortBy, desc: sortOrder === 'desc' }] : []
  );
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Convert our column format to TanStack format
  const tanstackColumns = useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = [];

    // Add selection column if enabled
    if (enableRowSelection) {
      cols.push({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      });
    }

    // Convert our columns to TanStack format
    columns.forEach((col, index) => {
      cols.push({
        id: col.key,
        accessorFn: (row) => (row as Record<string, unknown>)[col.key],
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <div
              className={cn(
                'flex items-center gap-1',
                col.sortable && 'cursor-pointer select-none hover:text-gray-700'
              )}
              onClick={() => {
                if (col.sortable) {
                  // If using external sort handler
                  if (onSort) {
                    onSort(col.key);
                  } else {
                    column.toggleSorting();
                  }
                }
              }}
            >
              {col.header}
              {col.sortable && (
                <span className="ml-1">
                  {isSorted === 'asc' ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : isSorted === 'desc' ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronsUpDown className="h-4 w-4 text-gray-400" />
                  )}
                </span>
              )}
            </div>
          );
        },
        cell: ({ row, getValue }) => {
          if (col.render) {
            return col.render(row.original, index);
          }
          return getValue() as React.ReactNode;
        },
        enableSorting: col.sortable ?? false,
        enableHiding: col.enableHiding !== false,
        meta: {
          className: col.className,
          headerClassName: col.headerClassName,
        },
      });
    });

    return cols;
  }, [columns, enableRowSelection, onSort]);

  // Create TanStack table instance
  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: {
      sorting: onSort ? (sortBy ? [{ id: sortBy, desc: sortOrder === 'desc' }] : []) : sorting,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: onSort ? undefined : setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(newSelection);

      if (onRowSelectionChange) {
        const selectedRows = Object.keys(newSelection)
          .filter((key) => newSelection[key])
          .map((key) => data[parseInt(key)]);
        onRowSelectionChange(selectedRows);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: onSort ? undefined : getSortedRowModel(),
    getFilteredRowModel: enableGlobalFilter ? getFilteredRowModel() : undefined,
    getRowId: (row) => keyExtractor(row),
    enableRowSelection,
  });

  const hasData = data.length > 0;
  const showPagination = pagination && pagination.totalPages > 1;
  const visibleRows = table.getRowModel().rows;

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 overflow-hidden', className)}>
      {/* Toolbar */}
      {(enableGlobalFilter || enableColumnVisibility) && (
        <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
          {/* Global Filter */}
          {enableGlobalFilter && (
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={globalFilterPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}

          {/* Column Visibility Toggle */}
          {enableColumnVisibility && (
            <div className="relative">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Columns3 className="h-4 w-4" />
                Columns
              </button>

              {showColumnMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowColumnMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[180px] z-20">
                    {table.getAllLeafColumns().map((column) => {
                      if (column.id === 'select') return null;
                      if (!column.getCanHide()) return null;

                      const colDef = columns.find((c) => c.key === column.id);
                      return (
                        <label
                          key={column.id}
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <div
                            className={cn(
                              'h-4 w-4 rounded border flex items-center justify-center',
                              column.getIsVisible()
                                ? 'bg-primary-600 border-primary-600'
                                : 'border-gray-300'
                            )}
                          >
                            {column.getIsVisible() && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <input
                            type="checkbox"
                            checked={column.getIsVisible()}
                            onChange={column.getToggleVisibilityHandler()}
                            className="sr-only"
                          />
                          <span className="text-sm text-gray-700">
                            {colDef?.header || column.id}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Selection info */}
          {enableRowSelection && Object.keys(rowSelection).length > 0 && (
            <span className="text-sm text-gray-500">
              {Object.keys(rowSelection).filter((k) => rowSelection[k]).length} selected
            </span>
          )}
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={cn(
              'bg-gray-50 border-b border-gray-200',
              stickyHeader && 'sticky top-0 z-10'
            )}>
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as { headerClassName?: string } | undefined;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider',
                        meta?.headerClassName
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonTableRow key={i} columns={table.getVisibleLeafColumns().length} />
              ))
            ) : visibleRows.length > 0 ? (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'hover:bg-gray-50 transition-colors',
                    onRowClick && 'cursor-pointer',
                    row.getIsSelected() && 'bg-primary-50'
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <td
                        key={cell.id}
                        className={cn('px-6 py-4', meta?.className)}
                        onClick={(e) => {
                          // Prevent row click when clicking checkbox
                          if (cell.column.id === 'select') {
                            e.stopPropagation();
                          }
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length}>
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    variant="compact"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-200">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : visibleRows.length > 0 ? (
          visibleRows.map((row) => (
            <div
              key={row.id}
              className={cn(
                'p-4',
                onRowClick && 'cursor-pointer hover:bg-gray-50',
                row.getIsSelected() && 'bg-primary-50'
              )}
              onClick={() => onRowClick?.(row.original)}
            >
              {enableRowSelection && (
                <div className="mb-3">
                  <input
                    type="checkbox"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </div>
              )}
              {row.getVisibleCells().map((cell) => {
                if (cell.column.id === 'select') return null;
                const colDef = columns.find((c) => c.key === cell.column.id);
                return (
                  <div key={cell.id} className="flex justify-between py-1">
                    <span className="text-sm text-gray-500">{colDef?.header || cell.column.id}</span>
                    <span className="text-sm text-gray-900 text-right">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            variant="compact"
          />
        )}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-700 px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// TABLE CELL HELPERS
// ============================================

export function TableCellText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-sm text-gray-900', className)}>{children}</span>;
}

export function TableCellMuted({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('text-sm text-gray-500', className)}>{children}</span>;
}

export function TableCellTruncate({ children, maxWidth = '200px' }: { children: React.ReactNode; maxWidth?: string }) {
  return (
    <span className="block truncate text-sm text-gray-900" style={{ maxWidth }}>
      {children}
    </span>
  );
}
