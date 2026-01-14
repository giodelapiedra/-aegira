/**
 * MemberRow Component
 * Desktop table row for team member
 */

import { memo } from 'react';
import { Avatar } from '../../../../components/ui/Avatar';
import { MoreVertical, Eye, ArrowRightLeft, UserMinus } from 'lucide-react';
import { getRoleDisplay, getRoleStyle } from '../utils/member-helpers';
import type { MemberItemProps } from '../types';

/**
 * Desktop table row component for displaying team member
 * Memoized for performance
 */
export const MemberRow = memo(function MemberRow({
  member,
  isMenuOpen,
  onToggleMenu,
  onViewProfile,
  onTransfer,
  onDeactivate,
  showActions = true,
}: MemberItemProps) {
  const hasActions = showActions && (onTransfer || onDeactivate);

  return (
    <tr className="hover:bg-gray-50/80 transition-all border-b border-gray-100 last:border-b-0">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={member.avatar}
            firstName={member.firstName}
            lastName={member.lastName}
            size="sm"
          />
          <span className="text-sm font-medium text-gray-900">
            {member.firstName} {member.lastName}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 text-sm text-gray-500">{member.email}</td>
      <td className="px-6 py-4">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium capitalize ${getRoleStyle(member.role)}`}>
          {getRoleDisplay(member.role)}
        </span>
      </td>
      <td className="px-6 py-4">
        {member.isOnLeave ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            On Leave
          </span>
        ) : member.isActive ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Inactive
          </span>
        )}
      </td>
      <td className="px-6 py-4 text-center">
        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-gray-100 text-sm font-medium text-gray-700">
          {member.checkinCount}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="relative flex justify-end">
          {hasActions ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu(isMenuOpen ? null : member.id);
                }}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => {
                      onViewProfile(member);
                      onToggleMenu(null);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Eye className="h-4 w-4 text-gray-400" />
                    View Profile
                  </button>
                  {onTransfer && (
                    <button
                      onClick={() => onTransfer(member)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                    >
                      <ArrowRightLeft className="h-4 w-4 text-gray-400" />
                      Transfer
                    </button>
                  )}
                  {onDeactivate && (
                    <>
                      <div className="border-t border-gray-100 my-1.5 mx-2" />
                      <button
                        onClick={() => onDeactivate(member)}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                      >
                        <UserMinus className="h-4 w-4" />
                        Deactivate
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => onViewProfile(member)}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            >
              <Eye className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});
