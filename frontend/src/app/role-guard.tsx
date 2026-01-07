import { Navigate } from 'react-router-dom';
import { useUser } from '../hooks/useUser';
import type { Role } from '../types/user';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  fallback?: string;
}

export function RoleGuard({
  children,
  allowedRoles,
  fallback = '/',
}: RoleGuardProps) {
  const { user, hasRole } = useUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const hasAccess = allowedRoles.some((role) => hasRole(role));

  if (!hasAccess) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
