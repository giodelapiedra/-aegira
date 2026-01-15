/**
 * MemberCard Component
 * Mobile card view for team member
 */

import { memo } from 'react';
import { Avatar } from '../../../../components/ui/Avatar';
import { MoreVertical, Eye, ArrowRightLeft, UserMinus, Mail, CheckCircle } from 'lucide-react';
import { getRoleDisplay, getRoleStyle } from '../utils/member-helpers';
import type { MemberItemProps } from '../types';

/**
 * Mobile card component for displaying team member
 * Memoized for performance
 */
export const MemberCard = memo(function MemberCard({
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
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
      {/* Card Header with Avatar and Actions */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar
                src={member.avatar}
                firstName={member.firstName}
                lastName={member.lastName}
                size="lg"
              />
              {/* Status indicator on avatar */}
              {member.isActive && !member.isOnLeave && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {member.firstName} {member.lastName}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium capitalize ${getRoleStyle(member.role)}`}>
                  {getRoleDisplay(member.role)}
                </span>
                {member.isOnLeave ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                    On Leave
                  </span>
                ) : member.isActive ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          {hasActions && (
            <div className="relative z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu(isMenuOpen ? null : member.id);
                }}
                className="p-2 -m-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all relative z-10"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {isMenuOpen && (
                <>
                  {/* Backdrop to close menu on outside click */}
                  <div
                    className="fixed inset-0 z-[50]"
                    onClick={() => onToggleMenu(null)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-gray-200 shadow-2xl py-1.5 z-[60] min-w-max">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewProfile(member);
                        onToggleMenu(null);
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors whitespace-nowrap"
                    >
                      <Eye className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      View Profile
                    </button>
                    {onTransfer && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTransfer(member);
                        }}
                        className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors whitespace-nowrap"
                      >
                        <ArrowRightLeft className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        Transfer
                      </button>
                    )}
                    {onDeactivate && (
                      <>
                        <div className="border-t border-gray-100 my-1.5 mx-2" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeactivate(member);
                          }}
                          className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors whitespace-nowrap"
                        >
                          <UserMinus className="h-4 w-4 flex-shrink-0" />
                          Deactivate
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Card Details */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="truncate">{member.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle className="h-4 w-4 text-gray-400" />
              <span>{member.checkinCount} check-ins</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action - View Profile */}
      <button
        onClick={() => onViewProfile(member)}
        className="w-full py-3 px-4 bg-gray-50 text-sm font-medium text-primary-600 hover:bg-gray-100 transition-colors border-t border-gray-100 flex items-center justify-center gap-2 rounded-b-2xl"
      >
        <Eye className="h-4 w-4" />
        View Full Profile
      </button>
    </div>
  );
});
