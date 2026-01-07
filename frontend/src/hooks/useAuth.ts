import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import type { LoginCredentials, RegisterData } from '../types/user';

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, company, isAuthenticated, login, logout: logoutStore } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (data) => {
      // Clear any stale data from previous user session
      queryClient.clear();

      // RefreshToken is stored in httpOnly cookie by backend
      login(data.user, data.company, data.accessToken);

      // Redirect based on role
      switch (data.user.role) {
        case 'EXECUTIVE':
          navigate('/executive');
          break;
        case 'ADMIN':
          navigate('/dashboard');
          break;
        case 'SUPERVISOR':
          navigate('/dashboard');
          break;
        case 'TEAM_LEAD':
          navigate('/team/approvals');
          break;
        default:
          navigate('/');
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) => authService.register(data),
    onSuccess: (data) => {
      // Clear any stale data from previous session
      queryClient.clear();

      // RefreshToken is stored in httpOnly cookie by backend
      login(data.user, data.company, data.accessToken);
      // Executive goes to executive dashboard after registration
      navigate('/executive');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // RefreshToken is sent via httpOnly cookie
      await authService.logout();
    },
    onSettled: () => {
      // Clear ALL cached data to prevent data leakage between users
      queryClient.clear();
      logoutStore();
      navigate('/login');
    },
  });

  return {
    user,
    company,
    isAuthenticated,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}
