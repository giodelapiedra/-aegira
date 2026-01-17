/**
 * Check-ins Tab Component
 * Displays today's check-ins with search and filtering
 */

import { useState, useCallback, useEffect } from 'react';
import { Users, Search } from 'lucide-react';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { CheckinCard } from '../components/CheckinCard';
import { CheckinTable } from '../components/CheckinTable';
import { NotCheckedInSection } from '../components/NotCheckedInSection';
import { useCheckinsPaginated } from '../hooks/useCheckins';
import { useNotCheckedIn } from '../hooks/useNotCheckedIn';
import type { TodayCheckin } from '../../../../services/daily-monitoring.service';

interface CheckinsTabProps {
  teamId?: string;
  onCreateExemption: (checkin: TodayCheckin) => void;
}

export function CheckinsTab({ teamId, onCreateExemption }: CheckinsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search to reduce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch check-ins (server-side search)
  const { data: checkinsData, isLoading: checkinsLoading } = useCheckinsPaginated({
    teamId,
    search: debouncedSearch || undefined,
  });

  // Fetch not checked in (server-side search)
  const { data: notCheckedInData } = useNotCheckedIn({
    teamId,
    search: debouncedSearch || undefined,
  });

  const checkins = checkinsData?.data || [];
  const notCheckedInMembers = notCheckedInData?.data || [];

  const handleCreateExemption = useCallback(
    (checkin: TodayCheckin) => {
      onCreateExemption(checkin);
    },
    [onCreateExemption]
  );

  if (checkinsLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Search Bar */}
      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 md:py-2 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors"
        />
      </div>

      {/* Check-ins List */}
      {checkins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-12">
          <EmptyState
            icon={Users}
            title="No check-ins yet"
            description="Team members haven't checked in today."
          />
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {checkins.map((checkin) => (
              <CheckinCard
                key={checkin.id}
                checkin={checkin}
                onCreateExemption={handleCreateExemption}
              />
            ))}
          </div>

          {/* Desktop Table View */}
          <CheckinTable checkins={checkins} onCreateExemption={handleCreateExemption} />
        </>
      )}

      {/* Not Checked In Section */}
      <NotCheckedInSection members={notCheckedInMembers} />
    </div>
  );
}
