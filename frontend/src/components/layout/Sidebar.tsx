/**
 * Sidebar Component - Icon Rail Style
 * Mobile: Full-width drawer with expanded navigation
 * Desktop: Collapsed icon-only sidebar with hover flyout
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useUser } from '../../hooks/useUser';
import { getNavigationForRole, type NavItem, type NavSection } from '../../config/navigation';
import { X, LogOut, Settings, ChevronRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  /** ID of nav item that has persistent SubMenuPanel visible */
  activeSubMenuId?: string;
}

export function Sidebar({ isOpen, onClose, activeSubMenuId }: SidebarProps) {
  const { user } = useUser();
  const { logout } = useAuth();
  const location = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<NavItem | null>(null);
  const [flyoutPosition, setFlyoutPosition] = useState<number>(0);
  const [expandedMobileItem, setExpandedMobileItem] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileFlyoutRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navItemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Memoize navigation based on role
  const userRole = user?.role || 'MEMBER';
  const navigation = useMemo(
    () => getNavigationForRole(userRole as any),
    [userRole]
  );

  // Memoize flattened nav items
  const allNavItems = useMemo(
    () => navigation.flatMap(section => section.items),
    [navigation]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideProfileButton = profileMenuRef.current && !profileMenuRef.current.contains(target);
      const isOutsideFlyout = profileFlyoutRef.current && !profileFlyoutRef.current.contains(target);

      // Only close if click is outside both the profile button and the flyout menu
      if (isOutsideProfileButton && (isOutsideFlyout || !profileFlyoutRef.current)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Handle mouse enter on nav item - with position tracking (desktop only)
  const handleMouseEnter = useCallback((item: NavItem, itemId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (item.children && item.children.length > 0 && item.id !== activeSubMenuId) {
      const element = navItemRefs.current.get(itemId);
      if (element) {
        const rect = element.getBoundingClientRect();
        setFlyoutPosition(rect.top);
      }
      setHoveredItem(item);
    }
  }, [activeSubMenuId]);

  // Handle mouse leave with delay
  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 200);
  }, []);

  // Handle flyout mouse enter (cancel the hide timeout)
  const handleFlyoutMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  // Close flyout on click
  const handleFlyoutItemClick = useCallback(() => {
    setHoveredItem(null);
    onClose();
  }, [onClose]);

  // Toggle mobile expanded item
  const toggleMobileExpand = useCallback((itemId: string) => {
    setExpandedMobileItem(prev => prev === itemId ? null : itemId);
  }, []);

  // Get role display name
  const getRoleDisplay = useCallback((role: string) => {
    const roleMap: Record<string, string> = {
      'EXECUTIVE': 'Executive',
      'ADMIN': 'Administrator',
      'SUPERVISOR': 'Supervisor',
      'TEAM_LEAD': 'Team Leader',
      'MEMBER': 'Team Member',
      'WORKER': 'Team Member',
    };
    return roleMap[role] || role;
  }, []);

  // Set ref for nav item
  const setNavItemRef = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      navItemRefs.current.set(id, element);
    } else {
      navItemRefs.current.delete(id);
    }
  }, []);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ============================================ */}
      {/* MOBILE SIDEBAR - Full drawer */}
      {/* ============================================ */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:hidden',
          'bg-slate-900',
          'flex flex-col',
          'transition-transform duration-300 ease-out',
          'w-[280px]',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <Logo size="sm" showText={true} />
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Mobile User Profile */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar
                src={user?.avatar}
                firstName={user?.firstName}
                lastName={user?.lastName}
                size="md"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 text-slate-300">
                {getRoleDisplay(user?.role || 'MEMBER')}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3">
          <div className="space-y-1">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const basePath = item.href.split('?')[0];
              const isActive = location.pathname === basePath ||
                (basePath !== '/' && location.pathname.startsWith(basePath));
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedMobileItem === item.id;

              return (
                <div key={item.id}>
                  {hasChildren ? (
                    // Parent item with children - expandable
                    <>
                      <button
                        onClick={() => toggleMobileExpand(item.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                          'transition-all duration-200',
                          isActive
                            ? 'bg-primary-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        )}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="flex-1 text-left text-sm font-medium">{item.label}</span>
                        <ChevronDown className={cn(
                          'h-4 w-4 transition-transform duration-200',
                          isExpanded ? 'rotate-180' : ''
                        )} />
                      </button>

                      {/* Expanded children */}
                      {isExpanded && (
                        <div className="mt-1 ml-4 pl-4 border-l border-slate-700 space-y-1">
                          {item.children!.map((child) => {
                            const ChildIcon = child.icon;
                            const childTabId = child.href.split('tab=')[1];
                            const currentTab = location.search.split('tab=')[1];
                            const isChildActive =
                              location.pathname + location.search === child.href ||
                              (location.pathname === basePath && currentTab === childTabId) ||
                              (location.pathname === basePath && !currentTab && child.id === item.children![0].id);

                            return (
                              <NavLink
                                key={child.id}
                                to={child.href}
                                onClick={onClose}
                                className={cn(
                                  'flex items-center gap-3 px-4 py-2.5 rounded-xl',
                                  'transition-all duration-200 text-sm',
                                  isChildActive
                                    ? 'bg-primary-600/20 text-primary-400 font-medium'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                )}
                              >
                                <ChildIcon className="h-4 w-4 flex-shrink-0" />
                                <span>{child.label}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    // Regular item without children
                    <NavLink
                      to={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl',
                        'transition-all duration-200',
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </NavLink>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Mobile Bottom Actions */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <NavLink
            to="/settings/profile"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings className="h-5 w-5" />
            <span className="text-sm font-medium">Settings</span>
          </NavLink>
          <button
            onClick={() => { onClose(); logout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ============================================ */}
      {/* DESKTOP SIDEBAR - Icon Rail */}
      {/* ============================================ */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen hidden lg:flex',
          'bg-slate-900 border-r border-slate-800',
          'flex-col w-[72px]'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-slate-800 flex-shrink-0">
          <Logo size="sm" showText={false} />
        </div>

        {/* Navigation Icons */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
          <div className="space-y-1">
            {allNavItems.map((item) => {
              const Icon = item.icon;
              const basePath = item.href.split('?')[0];
              const isActive = location.pathname === basePath ||
                (basePath !== '/' && location.pathname.startsWith(basePath));
              const hasChildren = item.children && item.children.length > 0;

              return (
                <div
                  key={item.id}
                  ref={(el) => setNavItemRef(item.id, el)}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(item, item.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <NavLink
                    to={item.href}
                    className={cn(
                      'flex flex-col items-center justify-center py-2.5 px-1 rounded-xl',
                      'transition-all duration-200 group relative',
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full" />
                    )}

                    <div className="relative">
                      <Icon className="h-5 w-5" />
                      {hasChildren && !isActive && (
                        <ChevronRight className="absolute -right-1 -bottom-1 h-2.5 w-2.5 text-slate-500" />
                      )}
                    </div>
                    <span className="text-[10px] mt-1 font-medium truncate max-w-full px-1">
                      {item.label.split(' ')[0]}
                    </span>

                    {/* Tooltip - only for items WITHOUT children */}
                    {!hasChildren && (
                      <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[60] pointer-events-none shadow-lg">
                        {item.label}
                      </div>
                    )}
                  </NavLink>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom Section - Profile */}
        <div className="border-t border-slate-800 flex-shrink-0 relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className={cn(
              'w-full flex flex-col items-center justify-center py-3 transition-colors',
              profileMenuOpen ? 'bg-slate-800' : 'hover:bg-slate-800'
            )}
          >
            <div className="relative">
              <Avatar
                src={user?.avatar}
                firstName={user?.firstName}
                lastName={user?.lastName}
                size="sm"
              />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full" />
            </div>
            <ChevronRight className={cn(
              'h-3 w-3 text-slate-500 mt-1 transition-transform',
              profileMenuOpen ? 'rotate-90' : ''
            )} />
          </button>
        </div>
      </aside>

      {/* Desktop Profile Flyout Menu */}
      {profileMenuOpen && (
        <div
          ref={profileFlyoutRef}
          className="fixed left-[72px] bottom-4 z-[60] hidden lg:block"
        >
          <div className="w-64 bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150">
            {/* User Info Header */}
            <div className="p-4 bg-gradient-to-r from-primary-500 to-primary-600">
              <div className="flex items-center gap-3">
                <Avatar
                  src={user?.avatar}
                  firstName={user?.firstName}
                  lastName={user?.lastName}
                  size="md"
                  className="ring-2 ring-white/30"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-primary-100 truncate">
                    {user?.email}
                  </p>
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/20 text-white">
                    {getRoleDisplay(user?.role || 'MEMBER')}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <NavLink
                to="/settings/profile"
                onClick={() => setProfileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Settings className="h-4 w-4 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium">Settings</p>
                  <p className="text-xs text-gray-500">Manage your account</p>
                </div>
              </NavLink>

              <div className="my-2 border-t border-gray-100" />

              <button
                onClick={() => { setProfileMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
                  <LogOut className="h-4 w-4 text-red-500" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Sign Out</p>
                  <p className="text-xs text-red-400">End your session</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Hover Flyout Submenu */}
      {hoveredItem && hoveredItem.children && hoveredItem.children.length > 0 && (
        <div
          className="fixed z-[55] hidden lg:block"
          style={{
            left: '72px',
            top: `${Math.max(flyoutPosition, 64)}px`,
          }}
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Bridge element */}
          <div className="absolute -left-2 top-0 w-2 h-full" />

          <div className="w-56 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">{hoveredItem.label}</h3>
            </div>

            <nav className="py-2 px-2">
              <div className="space-y-0.5">
                {hoveredItem.children.map((child) => {
                  const ChildIcon = child.icon;
                  const childTabId = child.href.split('tab=')[1];
                  const currentTab = location.search.split('tab=')[1];
                  const basePath = hoveredItem.href.split('?')[0];
                  const isChildActive =
                    location.pathname + location.search === child.href ||
                    (location.pathname === basePath && currentTab === childTabId) ||
                    (location.pathname === basePath && !currentTab && child.id === hoveredItem.children![0].id);

                  return (
                    <NavLink
                      key={child.id}
                      to={child.href}
                      onClick={handleFlyoutItemClick}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm',
                        'transition-all duration-150',
                        isChildActive
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      )}
                    >
                      <ChildIcon className={cn(
                        'h-4 w-4 flex-shrink-0',
                        isChildActive ? 'text-primary-600' : 'text-gray-400'
                      )} />
                      <span className="truncate">{child.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// Export helper to get active nav item with children
export function getActiveNavItemWithChildren(pathname: string, navigation: NavSection[]): NavItem | null {
  for (const section of navigation) {
    for (const item of section.items) {
      const basePath = item.href.split('?')[0];
      if ((pathname === basePath || pathname.startsWith(basePath)) && item.children && item.children.length > 0) {
        return item;
      }
    }
  }
  return null;
}
