import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useUser } from '../../hooks/useUser';
import { getNavigationForRole } from '../../config/navigation';
import { X, LogOut, Settings, ChevronRight, ChevronUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Logo } from '../ui/Logo';
import { Avatar } from '../ui/Avatar';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isExpanded: boolean;
  onExpandChange: (expanded: boolean) => void;
}

export function Sidebar({ isOpen, onClose, isExpanded, onExpandChange }: SidebarProps) {
  const { user } = useUser();
  const { logout } = useAuth();
  const location = useLocation();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const userRole = user?.role || 'MEMBER';
  const navigation = getNavigationForRole(userRole as any);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close profile menu when sidebar collapses
  useEffect(() => {
    if (!isExpanded) {
      setProfileMenuOpen(false);
    }
  }, [isExpanded]);

  // Get role display name
  const getRoleDisplay = (role: string) => {
    const roleMap: Record<string, string> = {
      'EXECUTIVE': 'Executive',
      'ADMIN': 'Administrator',
      'SUPERVISOR': 'Supervisor',
      'TEAM_LEAD': 'Team Leader',
      'MEMBER': 'Team Member',
    };
    return roleMap[role] || role;
  };

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

      {/* Sidebar */}
      <aside
        onMouseEnter={() => onExpandChange(true)}
        onMouseLeave={() => onExpandChange(false)}
        className={cn(
          'fixed top-0 left-0 z-50 h-screen bg-white border-r border-gray-200',
          'transform transition-all duration-200 ease-out',
          'flex flex-col',
          // Mobile: full width when open, hidden when closed
          'lg:translate-x-0',
          isOpen ? 'translate-x-0 w-72 shadow-xl' : '-translate-x-full w-72',
          // Desktop: collapsed by default, expanded on hover with shadow
          isExpanded ? 'lg:w-72 lg:shadow-2xl' : 'lg:w-[72px]'
        )}
      >
        {/* Logo Header */}
        <div className={cn(
          'h-16 flex items-center border-b border-gray-100 flex-shrink-0 bg-gradient-to-r from-primary-50 to-white',
          isExpanded ? 'justify-between px-5' : 'justify-center lg:justify-center px-5 lg:px-0'
        )}>
          <div className={cn(
            'flex items-center gap-3',
            !isExpanded && 'lg:justify-center'
          )}>
            <Logo
              size="md"
              showText={isExpanded}
              textVariant="full"
              containerClassName={cn(
                !isExpanded && 'lg:justify-center'
              )}
            />
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className={cn(
          'flex-1 overflow-y-auto py-4',
          isExpanded ? 'px-3' : 'px-3 lg:px-2'
        )}>
          {navigation.map((section, sectionIndex) => (
            <div key={section.id} className={cn(sectionIndex > 0 && 'mt-6')}>
              {/* Section Header - hidden when collapsed */}
              <div className={cn(
                'flex items-center gap-2 px-3 mb-2 transition-all duration-300',
                isExpanded ? 'opacity-100' : 'lg:opacity-0 lg:h-0 lg:mb-0 lg:overflow-hidden'
              )}>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                  {section.title}
                </p>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Section Items */}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.href ||
                    (item.href !== '/' && location.pathname.startsWith(item.href));

                  return (
                    <NavLink
                      key={item.id}
                      to={item.href}
                      onClick={onClose}
                      title={!isExpanded ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-xl text-sm font-medium',
                        'transition-all duration-200 group relative',
                        isExpanded ? 'px-3 py-2.5' : 'px-3 py-2.5 lg:px-0 lg:py-2 lg:justify-center',
                        isActive
                          ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      )}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />
                      )}

                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                        isActive
                          ? 'bg-primary-100 text-primary-600'
                          : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      <span className={cn(
                        'flex-1 truncate transition-all duration-300',
                        isExpanded ? 'opacity-100 w-auto' : 'lg:opacity-0 lg:w-0 lg:hidden'
                      )}>
                        {item.label}
                      </span>

                      {/* Hover arrow - only when expanded */}
                      <ChevronRight className={cn(
                        'h-4 w-4 transition-all',
                        isExpanded
                          ? 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'
                          : 'hidden',
                        isActive && isExpanded && 'opacity-50 translate-x-0'
                      )} />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section - Profile with Dropdown */}
        <div className="border-t border-gray-200 flex-shrink-0 bg-gray-50/50 relative" ref={profileMenuRef}>
          {/* Dropdown Menu - only when expanded */}
          {profileMenuOpen && isExpanded && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10">
              <NavLink
                to="/settings/profile"
                onClick={() => {
                  setProfileMenuOpen(false);
                  onClose();
                }}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Settings className="h-4 w-4 text-gray-500" />
                <span>Settings</span>
              </NavLink>
              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Profile Button */}
          <button
            onClick={() => isExpanded && setProfileMenuOpen(!profileMenuOpen)}
            className={cn(
              'w-full flex items-center gap-3 hover:bg-gray-100 transition-colors',
              isExpanded ? 'px-4 py-3' : 'px-4 py-3 lg:px-0 lg:py-3 lg:justify-center'
            )}
          >
            <Avatar
              src={user?.avatar}
              firstName={user?.firstName}
              lastName={user?.lastName}
              size="md"
            />
            <div className={cn(
              'flex-1 min-w-0 text-left transition-all duration-300',
              isExpanded ? 'opacity-100 w-auto' : 'lg:opacity-0 lg:w-0 lg:hidden'
            )}>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-primary-600 font-medium">
                {getRoleDisplay(user?.role || 'MEMBER')}
              </p>
            </div>
            <ChevronUp className={cn(
              'h-4 w-4 text-gray-400 transition-transform',
              profileMenuOpen ? 'rotate-180' : '',
              !isExpanded && 'lg:hidden'
            )} />
          </button>
        </div>
      </aside>
    </>
  );
}
