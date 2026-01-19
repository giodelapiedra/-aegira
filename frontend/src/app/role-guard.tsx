import { Navigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import { ForbiddenPage } from '../components/error';
import type { Role } from '../types/user';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  redirectOnForbidden?: boolean;
  fallback?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  redirectOnForbidden = false,
  fallback = '/',
}: RoleGuardProps) {
  const { user, hasRole } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess = allowedRoles.some((role) => hasRole(role));

  if (!hasAccess) {
    // Option to redirect instead of showing forbidden page
    if (redirectOnForbidden) {
      return <Navigate to={fallback} replace />;
    }
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
