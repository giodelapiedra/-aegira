import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  ArrowLeft,
  Eye,
  EyeOff,
  Users,
  Cake,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../lib/utils';
import api from '../../services/api';
import type { Role, Gender } from '../../types/user';

interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: Role;
  teamId?: string;
  birthDate?: string;
  gender?: Gender;
}

interface Team {
  id: string;
  name: string;
}

const roleOptions: { value: Role; label: string; description: string }[] = [
  { value: 'SUPERVISOR', label: 'Supervisor', description: 'Multi-team oversight and analytics' },
  { value: 'CLINICIAN', label: 'Clinician', description: 'Manages rehabilitation programs' },
  { value: 'WHS_CONTROL', label: 'WHS Control', description: 'Manages safety compliance and forms' },
  { value: 'TEAM_LEAD', label: 'Team Lead', description: 'Single team management and approvals' },
  { value: 'WORKER', label: 'Worker', description: 'Basic worker access for daily check-ins' },
];

export function CreateAccountPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ name: string; email: string } | null>(null);

  const [formData, setFormData] = useState<CreateUserData>({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: 'WORKER',
    teamId: undefined,
    birthDate: '',
    gender: undefined,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateUserData, string>>>({});

  // Compute age from birthDate
  const age = useMemo(() => {
    if (!formData.birthDate) return null;
    const today = new Date();
    const birth = new Date(formData.birthDate);
    let calculatedAge = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      calculatedAge--;
    }
    return calculatedAge;
  }, [formData.birthDate]);

  // Fetch teams for optional assignment
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const response = await api.get('/teams');
      return response.data;
    },
  });

  const teams: Team[] = teamsData?.data || [];

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserData) => {
      const response = await api.post('/users', data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreatedUser({ name: `${variables.firstName} ${variables.lastName}`, email: variables.email });
      setShowSuccess(true);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        role: 'WORKER',
        teamId: undefined,
        birthDate: '',
        gender: undefined,
      });
      setErrors({});
      toast.success('Account Created', `${variables.firstName} ${variables.lastName} has been added.`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to create user';
      setErrors({ email: message });
      toast.error('Creation Failed', message);
    },
  });

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateUserData, string>> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.firstName) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      createUserMutation.mutate(formData);
    }
  };

  const handleCreateAnother = () => {
    setShowSuccess(false);
    setCreatedUser(null);
  };

  if (showSuccess && createdUser) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="h-16 w-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-success-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Account Created Successfully!</h2>
          <p className="text-gray-500 mb-6">
            <span className="font-medium text-gray-900">{createdUser.name}</span> can now log in with their email{' '}
            <span className="font-medium text-gray-900">{createdUser.email}</span> and the password you set.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleCreateAnother} leftIcon={<UserPlus className="h-4 w-4" />} className="flex-1">
              Create Another Account
            </Button>
            <Link
              to="/executive/users"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Users className="h-4 w-4" />
              View All Users
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/executive/users"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create User Account</h1>
          <p className="text-gray-500 mt-1">Create a new user account for your company</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* User Information Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-4">User Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-danger-500">*</span>
              </label>
              <Input
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="John"
                error={errors.firstName}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-danger-500">*</span>
              </label>
              <Input
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Doe"
                error={errors.lastName}
              />
            </div>
          </div>

          {/* Birth Date and Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Birth Date <span className="text-gray-400">(Optional)</span>
              </label>
              <Input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                max={new Date().toISOString().split('T')[0]}
                leftIcon={<Cake className="h-5 w-5" />}
              />
              {age !== null && (
                <p className="mt-1 text-sm text-gray-500">
                  Age: <span className="font-medium text-gray-700">{age} years old</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gender <span className="text-gray-400">(Optional)</span>
              </label>
              <select
                value={formData.gender || ''}
                onChange={(e) => setFormData({ ...formData, gender: (e.target.value as Gender) || undefined })}
                className="w-full h-10 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
            </div>
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address <span className="text-danger-500">*</span>
          </label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john.doe@company.com"
            error={errors.email}
          />
          <p className="text-xs text-gray-500 mt-1">
            The user will use this email to log in
          </p>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-danger-500">*</span>
          </label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter a secure password"
              error={errors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Minimum 8 characters. Share this password with the user securely.
          </p>
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Role <span className="text-danger-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormData({ ...formData, role: option.value })}
                className={cn(
                  'p-4 rounded-lg border text-left transition-all',
                  formData.role === option.value
                    ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500/20'
                    : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
                )}
              >
                <span className="font-medium text-gray-900">{option.label}</span>
                <p className="text-xs text-gray-500 mt-1">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Team Assignment (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Team Assignment <span className="text-gray-400">(Optional)</span>
          </label>
          <select
            value={formData.teamId || ''}
            onChange={(e) => setFormData({ ...formData, teamId: e.target.value || undefined })}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          >
            <option value="">No team assigned</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            You can assign the user to a team later
          </p>
        </div>

        {/* Error Message */}
        {createUserMutation.isError && (
          <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{(createUserMutation.error as any)?.response?.data?.error || 'Failed to create account'}</span>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-gray-100">
          <Link
            to="/executive/users"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            leftIcon={<UserPlus className="h-4 w-4" />}
            isLoading={createUserMutation.isPending}
            className="flex-1"
          >
            Create Account
          </Button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
        <h4 className="font-medium text-primary-900 mb-2">What happens next?</h4>
        <ul className="text-sm text-primary-700 space-y-1">
          <li>The user account will be created immediately</li>
          <li>They can log in using the email and password you set</li>
          <li>They will automatically be part of your company</li>
          <li>You can change their role or team later from User Management</li>
        </ul>
      </div>
    </div>
  );
}
