import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { cn } from '../../lib/utils';
import { NotificationDropdown } from './NotificationDropdown';
import { ProfileDropdown } from './ProfileDropdown';

interface HeaderProps {
  onMenuClick: () => void;
}

// Page titles based on route
const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: 'Home', subtitle: 'Your readiness dashboard' },
  '/notifications': { title: 'Notifications', subtitle: 'View all your notifications' },
  '/checkin': { title: 'Daily Check-in', subtitle: 'Complete your readiness assessment' },
  '/report-incident': { title: 'Report Incident', subtitle: 'Submit a new incident report' },
  '/request-exception': { title: 'Request Exception', subtitle: 'Submit leave or exception request' },
  '/my-history': { title: 'My History', subtitle: 'View your check-in records' },
  '/my-incidents': { title: 'My Incidents', subtitle: 'Track your reported incidents' },
  '/my-schedule': { title: 'My Schedule', subtitle: 'View your work schedule' },
  '/team/overview': { title: 'Team Overview', subtitle: 'Monitor your team\'s readiness' },
  '/team/approvals': { title: 'Approvals', subtitle: 'Review pending requests' },
  '/team/incidents': { title: 'Team Incidents', subtitle: 'Manage team incidents' },
  '/dashboard': { title: 'Dashboard', subtitle: 'Organization overview' },
  '/personnel': { title: 'All Personnel', subtitle: 'Manage personnel records' },
  '/rehabilitation': { title: 'Rehabilitation', subtitle: 'Track rehabilitation progress' },
  '/analytics': { title: 'Analytics', subtitle: 'View reports and insights' },
  '/executive': { title: 'Executive Dashboard', subtitle: 'Company overview and insights' },
  '/executive/users': { title: 'User Management', subtitle: 'Manage company users' },
  '/executive/teams': { title: 'Team Management', subtitle: 'Create and manage teams' },
  '/executive/settings': { title: 'Company Settings', subtitle: 'Configure company preferences' },
  '/settings/profile': { title: 'Profile Settings', subtitle: 'Manage your account information' },
};

export function Header({ onMenuClick }: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { user, company } = useUser();
  const location = useLocation();

  const currentPage = pageTitles[location.pathname] || {
    title: `Welcome back, ${user?.firstName}!`,
    subtitle: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: company?.timezone,
    })
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex-shrink-0 sticky top-0 z-30">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Left side */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Mobile menu button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>

          {/* Page title */}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {currentPage.title}
            </h1>
            {currentPage.subtitle && (
              <p className="text-sm text-gray-500 truncate hidden sm:block">
                {currentPage.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search (desktop) */}
          <div className="hidden md:block relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className={cn(
                  'w-64 pl-9 pr-4 py-2 text-sm rounded-xl',
                  'border border-gray-200 bg-gray-50',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                  'placeholder:text-gray-400 transition-all'
                )}
              />
            </div>
          </div>

          {/* Search button (mobile) */}
          <button
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Search"
          >
            <Search className="h-5 w-5 text-gray-600" />
          </button>

          {/* Notifications */}
          <NotificationDropdown />

          {/* Profile Dropdown */}
          <ProfileDropdown />
        </div>
      </div>

      {/* Mobile search bar */}
      {isSearchOpen && (
        <div className="md:hidden px-4 pb-3 bg-white border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              autoFocus
              className={cn(
                'w-full pl-9 pr-4 py-2 text-sm rounded-xl',
                'border border-gray-200 bg-gray-50',
                'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
                'placeholder:text-gray-400'
              )}
            />
          </div>
        </div>
      )}
    </header>
  );
}
