/**
 * MemberSearchBar Component
 * Search input for filtering team members
 */

import { Search } from 'lucide-react';

interface MemberSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Search bar for filtering team members
 */
export function MemberSearchBar({
  value,
  onChange,
  placeholder = 'Search by name or email...',
}: MemberSearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full sm:max-w-sm pl-10 pr-4 py-3 md:py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm"
      />
    </div>
  );
}
