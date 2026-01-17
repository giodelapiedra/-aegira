import { useState, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { profileService } from '../../services/profile.service';
import { useUser } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { SkeletonProfile } from '../../components/ui/Skeleton';
import type { Gender } from '../../types/user';
import {
  User,
  Mail,
  Phone,
  Building2,
  Users,
  Lock,
  Save,
  Eye,
  EyeOff,
  Calendar,
  Cake,
  Globe,
  Camera,
  Trash2,
  Loader2,
  ChevronDown,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getTimezoneLabel } from '../../constants/timezones';

export function ProfilePage() {
  const { user, company, refreshUser } = useUser();
  const { logout } = useAuth();
  const toast = useToast();

  // Profile form state
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [birthDate, setBirthDate] = useState(user?.birthDate ? user.birthDate.split('T')[0] : '');
  const [gender, setGender] = useState<Gender | ''>(user?.gender || '');

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

  // Collapsible sections state
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Avatar upload state
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await refreshUser();
      setFirstName(updatedUser.firstName);
      setLastName(updatedUser.lastName);
      setPhone(updatedUser.phone || '');
      setBirthDate(updatedUser.birthDate ? updatedUser.birthDate.split('T')[0] : '');
      setGender(updatedUser.gender || '');
      toast.success('Profile Updated', 'Your changes have been saved.');
    },
    onError: (error: any) => {
      toast.error('Update Failed', error.response?.data?.error || 'Failed to update profile.');
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: () => profileService.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsPasswordOpen(false);
      toast.success('Password Changed', 'Your password has been updated.');
    },
    onError: (error: any) => {
      toast.error('Password Change Failed', error.response?.data?.error || 'Failed to change password.');
    },
  });

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Avatar Updated', 'Your profile photo has been changed.');
    },
    onError: (error: any) => {
      toast.error('Upload Failed', error.response?.data?.error || 'Failed to upload avatar.');
    },
  });

  // Avatar remove mutation
  const removeAvatarMutation = useMutation({
    mutationFn: () => profileService.removeAvatar(),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Avatar Removed', 'Your profile photo has been removed.');
    },
    onError: (error: any) => {
      toast.error('Remove Failed', error.response?.data?.error || 'Failed to remove avatar.');
    },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid File', 'Please upload a valid image file (JPG, PNG, GIF, or WebP).');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File Too Large', 'Image size must be less than 5MB.');
      return;
    }

    uploadAvatarMutation.mutate(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate();
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Passwords Mismatch', 'New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }

    changePasswordMutation.mutate();
  };

  const handleDeleteAccount = () => {
    // For now, just logout - actual deletion would need backend endpoint
    logout();
  };

  const getRoleBadge = (role: string) => {
    const config: Record<string, { variant: 'default' | 'primary' | 'success' | 'warning' | 'danger'; label: string }> = {
      EXECUTIVE: { variant: 'primary', label: 'Executive' },
      ADMIN: { variant: 'primary', label: 'Admin' },
      SUPERVISOR: { variant: 'success', label: 'Supervisor' },
      TEAM_LEAD: { variant: 'warning', label: 'Team Lead' },
      MEMBER: { variant: 'default', label: 'Member' },
      WORKER: { variant: 'default', label: 'Worker' },
    };
    return config[role] || { variant: 'default', label: role };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: company?.timezone,
    });
  };

  if (!user) {
    return <SkeletonProfile />;
  }

  const roleConfig = getRoleBadge(user.role);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="h-32 w-32 rounded-2xl overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <span className="text-4xl font-bold text-white">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </span>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className={cn(
                    'absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity',
                    (uploadAvatarMutation.isPending || removeAvatarMutation.isPending)
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  )}>
                    {(uploadAvatarMutation.isPending || removeAvatarMutation.isPending) ? (
                      <Loader2 className="h-8 w-8 text-white animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-1 text-white"
                      >
                        <Camera className="h-6 w-6" />
                        <span className="text-xs font-medium">Change</span>
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              {/* Photo Actions */}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatarMutation.isPending || removeAvatarMutation.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Upload
                </button>
                {user.avatar && (
                  <button
                    type="button"
                    onClick={() => removeAvatarMutation.mutate()}
                    disabled={uploadAvatarMutation.isPending || removeAvatarMutation.isPending}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-danger-50 hover:text-danger-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* User Info */}
            <div className="flex-1 flex flex-col justify-center sm:border-l sm:pl-6 border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
                <Badge variant={roleConfig.variant}>{roleConfig.label}</Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span>{company?.name || 'No company'}</span>
                </div>
                {user.team && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span>{user.team.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span>Joined {formatDate(user.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <span>{company?.timezone ? getTimezoneLabel(company.timezone) : 'No timezone set'}</span>
                </div>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Personal Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary-500" />
            Personal Information
          </CardTitle>
          <CardDescription>Manage your personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Birth Date
                </label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  leftIcon={<Cake className="h-5 w-5" />}
                />
                {age !== null && (
                  <p className="mt-1.5 text-sm text-gray-500">
                    Age: <span className="font-medium text-gray-700">{age} years old</span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Gender | '')}
                  className="w-full h-10 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                  <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
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

      {/* Security Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary-500" />
            Security
          </CardTitle>
          <CardDescription>Manage your account security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Change Password - Collapsible */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setIsPasswordOpen(!isPasswordOpen);
                setIsDeleteOpen(false);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
                  <KeyRound className="h-5 w-5 text-primary-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Change Password</p>
                  <p className="text-sm text-gray-500">Update your account password</p>
                </div>
              </div>
              <ChevronDown className={cn(
                'h-5 w-5 text-gray-400 transition-transform duration-200',
                isPasswordOpen && 'rotate-180'
              )} />
            </button>

            {/* Password Form - Collapsible Content */}
            <div className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out',
              isPasswordOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            )}>
              <form onSubmit={handlePasswordSubmit} className="p-4 pt-0 space-y-4 border-t border-gray-100">
                <div className="pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Confirm Password
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

                <p className="text-xs text-gray-500">
                  Password must be at least 6 characters long.
                </p>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    isLoading={changePasswordMutation.isPending}
                    leftIcon={<Lock className="h-4 w-4" />}
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Delete Account - Collapsible */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setIsDeleteOpen(!isDeleteOpen);
                setIsPasswordOpen(false);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-danger-50 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-danger-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Delete Account</p>
                  <p className="text-sm text-gray-500">Permanently delete your account</p>
                </div>
              </div>
              <ChevronDown className={cn(
                'h-5 w-5 text-gray-400 transition-transform duration-200',
                isDeleteOpen && 'rotate-180'
              )} />
            </button>

            {/* Delete Account - Collapsible Content */}
            <div className={cn(
              'overflow-hidden transition-all duration-300 ease-in-out',
              isDeleteOpen ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'
            )}>
              <div className="p-4 pt-0 border-t border-gray-100">
                <div className="p-4 bg-danger-50 rounded-xl border border-danger-200 mt-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-danger-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-danger-800">Warning: This action cannot be undone</p>
                      <p className="text-sm text-danger-700 mt-1">
                        Once you delete your account, all of your data will be permanently removed.
                        This includes your check-in history, incidents, and all personal information.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => setShowDeleteModal(true)}
                    leftIcon={<Trash2 className="h-4 w-4" />}
                  >
                    Delete My Account
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-full bg-danger-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-danger-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
                  <p className="text-sm text-gray-500">This action is permanent</p>
                </div>
              </div>

              <p className="text-gray-600 mb-4">
                Are you sure you want to delete your account? This will permanently remove all your data and cannot be undone.
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Type <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">DELETE</span> to confirm
                </label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteConfirmText('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={deleteConfirmText !== 'DELETE'}
                  onClick={handleDeleteAccount}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
