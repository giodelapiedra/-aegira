import { useState, useMemo, useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar, getActiveNavItemWithChildren } from './Sidebar';
import { SubMenuPanel } from './SubMenuPanel';
import { Header } from './Header';
import { AbsenceJustificationModal } from '../absences/AbsenceJustificationModal';
import { absenceService } from '../../services/absence.service';
import { useAuthStore } from '../../store/auth.store';
import { getNavigationForRole } from '../../config/navigation';
import { cn } from '../../lib/utils';

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSubMenuCollapsed, setIsSubMenuCollapsed] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  // Reset submenu to expanded state when navigating to a new page
  useEffect(() => {
    setIsSubMenuCollapsed(false);
  }, [location.pathname]);

  // Memoize navigation - only recalculate when role changes
  const userRole = user?.role || 'MEMBER';
  const navigation = useMemo(
    () => getNavigationForRole(userRole as any),
    [userRole]
  );

  // Memoize active item check - only recalculate when pathname or navigation changes
  const activeItemWithChildren = useMemo(
    () => getActiveNavItemWithChildren(location.pathname, navigation),
    [location.pathname, navigation]
  );
  const hasSubMenu = activeItemWithChildren !== null;

  // Check for pending absence justifications (only for workers)
  const isWorker = user?.role === 'WORKER' || user?.role === 'MEMBER';

  const { data: pendingAbsences } = useQuery({
    queryKey: ['absences', 'my-pending'],
    queryFn: () => absenceService.getMyPending(),
    enabled: isWorker, // Only run for workers
    refetchOnWindowFocus: true,
    staleTime: 30000, // 30 seconds
  });

  // Handle successful justification submission
  const handleJustificationComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['absences', 'my-pending'] });
  }, [queryClient]);

  // Memoized callbacks for sidebar and submenu
  const handleSidebarClose = useCallback(() => setIsSidebarOpen(false), []);
  const handleSidebarOpen = useCallback(() => setIsSidebarOpen(true), []);
  const handleToggleSubMenu = useCallback(() => setIsSubMenuCollapsed(prev => !prev), []);

  // Show blocking modal if worker has pending absences
  const showAbsenceModal = isWorker && pendingAbsences?.hasBlocking && pendingAbsences.data.length > 0;

  // Calculate content padding based on submenu state
  // SubMenu expanded: 224px (w-56), collapsed: 40px (w-10)
  const contentPaddingClass = hasSubMenu
    ? isSubMenuCollapsed
      ? 'lg:pl-10'
      : 'lg:pl-56'
    : '';

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Blocking Absence Justification Modal */}
      {showAbsenceModal && (
        <AbsenceJustificationModal
          absences={pendingAbsences.data}
          onComplete={handleJustificationComplete}
        />
      )}

      {/* Sidebar - Icon Rail with Hover Flyout (hidden when printing) */}
      <div className="print:hidden">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={handleSidebarClose}
          activeSubMenuId={activeItemWithChildren?.id}
        />
      </div>

      {/* Main content area */}
      <div className="lg:pl-[72px] print:pl-0 min-h-screen flex">
        {/* Persistent SubMenu Panel - shows when on page with children (hidden when printing) */}
        {hasSubMenu && activeItemWithChildren && (
          <div className="print:hidden">
            <SubMenuPanel
              parentItem={activeItemWithChildren}
              isCollapsed={isSubMenuCollapsed}
              onToggleCollapse={handleToggleSubMenu}
              className="hidden lg:flex fixed left-[72px] top-0 z-40"
            />
          </div>
        )}

        {/* Content wrapper */}
        <div className={cn(
          'flex-1 flex flex-col min-h-screen transition-all duration-200 print:pl-0',
          contentPaddingClass
        )}>
          {/* Header (hidden when printing) */}
          <div className="print:hidden">
            <Header onMenuClick={handleSidebarOpen} />
          </div>

          {/* Page content */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 print:p-0">
            <div className="max-w-7xl mx-auto print:max-w-none">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
