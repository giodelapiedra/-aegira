/**
 * Users Management Page
 * Uses TanStack Table powered DataTable with sorting, filtering, and row selection
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Edit,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import { useUser } from '../../hooks/useUser';
import type { User, Role } from '../../types/user';

const roleColors: Record<Role, string> = {
  EXECUTIVE: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  SUPERVISOR: 'bg-status-green-100 text-status-green-700',
  CLINICIAN: 'bg-pink-100 text-pink-700',
  WHS_CONTROL: 'bg-teal-100 text-teal-700',
  TEAM_LEAD: 'bg-status-yellow-100 text-status-yellow-700',
  WORKER: 'bg-gray-100 text-gray-700',
  MEMBER: 'bg-gray-100 text-gray-700',
};

const roleLabels: Record<Role, string> = {
  EXECUTIVE: 'Executive',
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  CLINICIAN: 'Clinician',
  WHS_CONTROL: 'WHS Control',
  TEAM_LEAD: 'Team Lead',
  WORKER: 'Worker',
  MEMBER: 'Member',
};

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const queryClient = useQueryClient();
  const { isExecutive } = useUser();
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('includeInactive', 'true');
      params.append('limit', String(limit));
      params.append('page', String(page));
      const response = await api.get(`/users?${params.toString()}`);
      return response.data;
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role }) => {
      await api.patch(`/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowRoleModal(false);
      setSelectedUser(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.post(`/users/${userId}/reactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const users: User[] = data?.data || [];

  // Define columns for DataTable
  const columns: Column<User>[] = useMemo(() => [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (user) => (
        <span className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
          roleColors[user.role]
        )}>
          {user.role === 'EXECUTIVE' && <Shield className="h-3 w-3" />}
          {roleLabels[user.role]}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (user) => (
        <span className={cn(
          'inline-flex px-2.5 py-1 rounded-full text-xs font-medium',
          user.isActive
            ? 'bg-success-100 text-success-700'
            : 'bg-gray-100 text-gray-600'
        )}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'team',
      header: 'Team',
      render: (user) => (
        <span className="text-sm text-gray-500">
          {user.team?.name || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      enableHiding: false,
      render: (user) => (
        user.role !== 'EXECUTIVE' ? (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedUser(user);
                setShowRoleModal(true);
              }}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title="Change Role"
            >
              <Edit className="h-4 w-4" />
            </button>
            {user.isActive ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deactivateMutation.mutate(user.id);
                }}
                className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                title="Deactivate"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  reactivateMutation.mutate(user.id);
                }}
                className="p-2 text-gray-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors"
                title="Reactivate"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null
      ),
    },
  ], [deactivateMutation, reactivateMutation]);

  const pagination = data?.pagination ? {
    page,
    limit,
    total: data.pagination.total,
    totalPages: Math.ceil(data.pagination.total / limit),
  } : undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage your company's users and roles</p>
        </div>
        <div className="flex gap-2">
          {isExecutive && (
            <Link
              to="/executive/create-account"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <UserPlus className="h-4 w-4" />
              Create Account
            </Link>
          )}
        </div>
      </div>

      {/* Selected Users Actions */}
      {selectedUsers.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm text-primary-700">
            {selectedUsers.length} user(s) selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedUsers([])}
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <DataTable
        data={users}
        columns={columns}
        keyExtractor={(user) => user.id}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        emptyTitle="No users found"
        emptyDescription="Start by inviting users to your company"
        enableGlobalFilter
        globalFilterPlaceholder="Search users by name, email..."
        enableColumnVisibility
        enableRowSelection
        onRowSelectionChange={setSelectedUsers}
      />

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change User Role</h3>
            <p className="text-sm text-gray-500 mb-4">
              Change role for <span className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</span>
            </p>
            <div className="space-y-2 mb-6">
              {(['SUPERVISOR', 'CLINICIAN', 'WHS_CONTROL', 'TEAM_LEAD', 'WORKER'] as Role[]).map((role) => (
                <button
                  key={role}
                  onClick={() => updateRoleMutation.mutate({ userId: selectedUser.id, role })}
                  disabled={updateRoleMutation.isPending}
                  className={cn(
                    'w-full p-3 rounded-lg border text-left transition-colors',
                    selectedUser.role === role
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
                  )}
                >
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                    roleColors[role]
                  )}>
                    {roleLabels[role]}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
