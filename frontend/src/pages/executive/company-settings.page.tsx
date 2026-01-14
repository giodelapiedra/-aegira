import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Globe, Save, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { getTimezoneLabel } from '../../constants/timezones';
import { useAuthStore } from '../../store/auth.store';

interface Company {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  industry?: string;
  size?: string;
  address?: string;
  phone?: string;
  website?: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    users: number;
    teams: number;
  };
}

export function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const setCompany = useAuthStore((state) => state.setCompany);

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', 'my'],
    queryFn: async () => {
      const response = await api.get<Company>('/companies/my');
      return response.data;
    },
  });

  const [formData, setFormData] = useState<{
    name: string;
    timezone: string;
    industry: string;
    address: string;
    phone: string;
    website: string;
  } | null>(null);

  // Initialize form data when company loads
  if (company && !formData) {
    setFormData({
      name: company.name || '',
      timezone: company.timezone || 'Asia/Manila',
      industry: company.industry || '',
      address: company.address || '',
      phone: company.phone || '',
      website: company.website || '',
    });
  }

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      const response = await api.patch<Company>('/companies/my', data);
      return response.data;
    },
    onSuccess: (updatedCompany) => {
      // Update React Query cache
      queryClient.invalidateQueries({ queryKey: ['company'] });

      // Update auth store so all components get the new company data
      setCompany({
        id: updatedCompany.id,
        name: updatedCompany.name,
        slug: updatedCompany.slug,
        logo: updatedCompany.logo,
        industry: updatedCompany.industry,
        size: updatedCompany.size,
        isActive: updatedCompany.isActive,
        timezone: updatedCompany.timezone,
      });

      // Update local form data
      setFormData({
        name: updatedCompany.name || '',
        timezone: updatedCompany.timezone || 'Asia/Manila',
        industry: updatedCompany.industry || '',
        address: updatedCompany.address || '',
        phone: updatedCompany.phone || '',
        website: updatedCompany.website || '',
      });

      toast.success('Company settings updated successfully');
    },
    onError: () => {
      toast.error('Failed to update company settings');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      // Exclude timezone from update (it's read-only)
      const { timezone: _, ...updateData } = formData;
      updateMutation.mutate(updateData);
    }
  };

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary-100 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
          <p className="text-gray-500">Manage your company information and preferences</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Your company's basic details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  placeholder="e.g., Security, Healthcare"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+63 xxx xxx xxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Company address"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Timezone Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-gray-400" />
              <div>
                <CardTitle>Timezone</CardTitle>
                <CardDescription>
                  Your company's timezone for shift schedules and check-in times
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-lg font-semibold text-gray-900">
                {getTimezoneLabel(formData.timezone)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Timezone was set during company registration and cannot be changed to maintain data integrity.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats (read-only) */}
        {company && (
          <Card>
            <CardHeader>
              <CardTitle>Company Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{company._count.users}</p>
                  <p className="text-sm text-gray-500">Total Users</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{company._count.teams}</p>
                  <p className="text-sm text-gray-500">Teams</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-lg font-semibold text-gray-900">{company.slug}</p>
                  <p className="text-sm text-gray-500">Company Slug</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className={`text-lg font-semibold ${company.isActive ? 'text-success-600' : 'text-danger-600'}`}>
                    {company.isActive ? 'Active' : 'Inactive'}
                  </p>
                  <p className="text-sm text-gray-500">Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
