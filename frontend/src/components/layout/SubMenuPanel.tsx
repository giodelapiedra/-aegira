/**
 * SubMenuPanel Component
 * Persistent submenu panel with collapse functionality
 * Shows when user is on a page that has children in navigation
 */

import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NavItem } from '../../config/navigation';

interface SubMenuPanelProps {
  /** Parent nav item */
  parentItem: NavItem;
  /** Whether panel is collapsed */
  isCollapsed: boolean;
  /** Toggle collapse callback */
  onToggleCollapse: () => void;
  /** Additional class name */
  className?: string;
}

export function SubMenuPanel({ parentItem, isCollapsed, onToggleCollapse, className }: SubMenuPanelProps) {
  const location = useLocation();

  if (!parentItem.children || parentItem.children.length === 0) {
    return null;
  }

  // Collapsed state - show only toggle button
  if (isCollapsed) {
    return (
      <aside
        className={cn(
          'w-10 h-screen bg-white border-r border-gray-200 flex-shrink-0',
          'flex flex-col',
          className
        )}
      >
        <button
          onClick={onToggleCollapse}
          className="h-16 flex items-center justify-center border-b border-gray-100 hover:bg-gray-50 transition-colors"
          title="Expand submenu"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        'w-56 h-screen bg-white border-r border-gray-200 flex-shrink-0',
        'flex flex-col',
        className
      )}
    >
      {/* Header with collapse button */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 truncate">{parentItem.label}</h2>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title="Collapse submenu"
        >
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Submenu Items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        <div className="space-y-0.5">
          {parentItem.children.map((child) => {
            const ChildIcon = child.icon;
            const childTabId = child.href.split('tab=')[1];
            const currentTab = location.search.split('tab=')[1];
            const basePath = parentItem.href.split('?')[0];

            // Check if this child is active
            const isActive =
              location.pathname + location.search === child.href ||
              (location.pathname === basePath && currentTab === childTabId) ||
              (location.pathname === basePath && !currentTab && child.id === parentItem.children![0].id);

            return (
              <NavLink
                key={child.id}
                to={child.href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm',
                  'transition-all duration-150',
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <ChildIcon className={cn(
                  'h-4 w-4 flex-shrink-0',
                  isActive ? 'text-primary-600' : 'text-gray-400'
                )} />
                <span className="truncate">{child.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
