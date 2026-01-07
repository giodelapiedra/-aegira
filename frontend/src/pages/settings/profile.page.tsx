import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '../../services/profile.service';
import { useUser } from '../../hooks/useUser';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import type { Gender } from '../../types/user';
import {
  User,
  Mail,
  Phone,
  Building2,
  Users,
  Shield,
  Lock,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Cake,
  Globe,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getTimezoneLabel } from '../../constants/timezones';

export function ProfilePage() {
  const { user, company, refreshUser } = useUser();
  const queryClient = useQueryClient();

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate ? user.birthDate.split('T')[0] : '');
  const [gender, setGender] = useState<Gender | ''>(user?.gender || '');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Compute age from birthDate
  const age = useMemo(() => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let calculatedAge = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      calculatedAge--;
    }
    return calculatedAge;
  }, [birthDate]);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: () => profileService.updateProfile({
      firstName,
      lastName,
      phone,
      birthDate: birthDate || undefined,
      gender: gender || undefined,
    }),
    onSuccess: async (updatedUser) => {
      // Refresh user in store
      await refreshUser();

      // Update form state with new values
      setFirstName(updatedUser.firstName);
      setLastName(updatedUser.lastName);
      setPhone(updatedUser.phone || '');
      setBirthDate(updatedUser.birthDate ? updatedUser.birthDate.split('T')[0] : '');
      setGender(updatedUser.gender || '');

      // Clear any error and show success
      setProfileError('');
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 5000);

      // Scroll to top to see success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (error: any) => {
      setProfileError(error.response?.data?.error || 'Failed to update profile. Please try again.');
      setProfileSuccess(false);
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: () => profileService.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      setPasswordError('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (error: any) => {
      setPasswordError(error.response?.data?.error || 'Failed to change password');
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    changePasswordMutation.mutate();
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { variant: 'default' | 'primary' | 'success' | 'warning' | 'danger'; label: string }> = {
      EXECUTIVE: { variant: 'primary', label: 'Executive' },
      ADMIN: { variant: 'primary', label: 'Admin' },
      SUPERVISOR: { variant: 'success', label: 'Supervisor' },
      TEAM_LEAD: { variant: 'warning', label: 'Team Lead' },
      MEMBER: { variant: 'default', label: 'Member' },
    };
    return config[role] || { variant: 'default', label: role };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: company?.timezone || 'Asia/Manila',
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const roleConfig = getRoleBadge(user.role);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Global Success Notification */}
      {profileSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-3 px-5 py-4 bg-success-500 text-white rounded-xl shadow-lg shadow-success-500/25">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Profile Updated Successfully!</p>
              <p className="text-sm text-white/80">Your changes have been saved.</p>
            </div>
          </div>
        </div>
      )}

      {/* Global Error Notification */}
      {profileError && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <div className="flex items-center gap-3 px-5 py-4 bg-danger-500 text-white rounded-xl shadow-lg shadow-danger-500/25">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Update Failed</p>
              <p className="text-sm text-white/80">{profileError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
          <span className="text-2xl font-bold text-white">
            {user.firstName.charAt(0)}{user.lastName.charAt(0)}
          </span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
          <p className="text-gray-500">Manage your account information</p>
        </div>
      </div>

      {/* Account Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-gray-400" />
            Account Overview
          </CardTitle>
          <CardDescription>Your account details and role information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                  <p className="font-medium text-gray-900">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Role</p>
                  <Badge variant={roleConfig.variant}>{roleConfig.label}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Company</p>
                  <p className="font-medium text-gray-900">{company?.name || user.company?.name || '-'}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Team</p>
                  <p className="font-medium text-gray-900">{user.team?.name || 'Not assigned'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Company Timezone Section */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">Company Timezone</p>
                <p className="font-semibold text-blue-900">
                  {company?.timezone ? getTimezoneLabel(company.timezone) : 'Not set'}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  All schedules and check-in times use this timezone
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="h-4 w-4" />
              <span>Member since {formatDate(user.createdAt)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-gray-400" />
            Edit Profile
          </CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number (optional)"
                leftIcon={<Phone className="h-5 w-5" />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Birth Date
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    leftIcon={<Cake className="h-5 w-5" />}
                  />
                </div>
                {age !== null && (
                  <p className="mt-1 text-sm text-gray-500">
                    Age: <span className="font-medium text-gray-700">{age} years old</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender | '')}
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

            {profileSuccess && (
              <div className="flex items-center gap-2 p-3 bg-success-50 border border-success-200 rounded-lg text-success-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Profile updated successfully!</span>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                isLoading={updateProfileMutation.isPending}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-gray-400" />
            Change Password
          </CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>
            </div>

            {/* Password requirements */}
            <div className="text-xs text-gray-500">
              Password must be at least 6 characters long.
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="flex items-center gap-2 p-3 bg-success-50 border border-success-200 rounded-lg text-success-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Password changed successfully!</span>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="secondary"
                isLoading={changePasswordMutation.isPending}
                leftIcon={<Lock className="h-4 w-4" />}
              >
                Change Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
