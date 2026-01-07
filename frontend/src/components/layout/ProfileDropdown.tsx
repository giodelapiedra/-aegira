import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Building2,
} from 'lucide-react';

export function ProfileDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const { logout } = useAuth();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      EXECUTIVE: 'Executive',
      ADMIN: 'Admin',
      SUPERVISOR: 'Supervisor',
      TEAM_LEAD: 'Team Lead',
      MEMBER: 'Member',
    };
    return labels[role] || role;
  };

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 p-1.5 pr-3 rounded-xl transition-all',
          'hover:bg-gray-100',
          isOpen && 'bg-gray-100'
        )}
      >
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
          <span className="text-xs font-semibold text-white">
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </span>
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-gray-900 leading-tight">
            {user?.firstName}
          </p>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-gray-400 transition-transform hidden sm:block',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* User Info Header */}
          <div className="p-4 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-md">
                <span className="text-sm font-bold text-white">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Role & Company Badges */}
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium">
                <Shield className="h-3 w-3" />
                {getRoleLabel(user?.role || 'MEMBER')}
              </div>
              {user?.company?.name && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                  <Building2 className="h-3 w-3" />
                  {user.company.name}
                </div>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <Link
              to="/settings/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <User className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="font-medium">Profile</p>
                <p className="text-xs text-gray-500">Edit your information</p>
              </div>
            </Link>

            <Link
              to="/settings/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Settings className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="font-medium">Settings</p>
                <p className="text-xs text-gray-500">Manage your account</p>
              </div>
            </Link>
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-danger-600 hover:bg-danger-50 transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-danger-50 flex items-center justify-center">
                <LogOut className="h-4 w-4 text-danger-500" />
              </div>
              <div className="text-left">
                <p className="font-medium">Sign Out</p>
                <p className="text-xs text-danger-400">Log out of your account</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
