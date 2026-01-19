/**
 * Daily Monitoring Page
 * Orchestrator component for the daily monitoring dashboard
 *
 * Architecture:
 * - Stats always loaded (lightweight)
 * - Tab content lazy-loaded based on active tab
 * - Uses URL search params for tab state persistence
 *
 * Scales to 5,000+ team members via:
 * - Paginated API endpoints
 * - Lazy tab loading
 * - Virtual scrolling (optional, for check-ins)
 */

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Users, AlertTriangle } from 'lucide-react';

// UI Components
import { Button } from '../../../components/ui/Button';
import { SkeletonDashboard } from '../../../components/ui/Skeleton';
import { useToast } from '../../../components/ui/Toast';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

// Local Components
import { StatsBar, MobileStatsCards } from './components/StatsBar';
import { CriticalAlert } from './components/CriticalAlert';
import { ApproveExemptionModal } from './components/ApproveExemptionModal';
import { CreateExemptionModal } from './components/CreateExemptionModal';
import { EndLeaveEarlyModal } from '../../../components/ui/EndLeaveEarlyModal';

// Tabs (lazy-loaded based on active tab)
import { CheckinsTab } from './tabs/CheckinsTab';
import { SuddenChangesTab } from './tabs/SuddenChangesTab';
import { ExemptionsTab } from './tabs/ExemptionsTab';
import { AbsencesTab } from './tabs/AbsencesTab';

// Hooks
import { useDailyMonitoringStats } from './hooks/useDailyMonitoringStats';
import { useExemptionMutations } from './hooks/useExemptionMutations';

// Types
import type { MonitoringTab, TodayCheckin, Exemption } from './types';

// Utils
import { cn } from '../../../lib/utils';

// ============================================
// MAIN COMPONENT
// ============================================

export function DailyMonitoringPage() {
  // URL search params for tab state
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as MonitoringTab | null;

  // Tab state - sync with URL
  const [activeTab, setActiveTab] = useState<MonitoringTab>(tabFromUrl || 'checkins');

  // Modal state
  const [selectedExemption, setSelectedExemption] = useState<Exemption | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showEndEarlyModal, setShowEndEarlyModal] = useState(false);
  const [selectedCheckinForExemption, setSelectedCheckinForExemption] = useState<TodayCheckin | null>(null);

  const toast = useToast();

  // Sync tab state with URL
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl, activeTab]);

  // Update URL when tab changes
  const handleTabChange = useCallback(
    (tab: MonitoringTab) => {
      setActiveTab(tab);
      setSearchParams({ tab });
    },
    [setSearchParams]
  );

  // Fetch stats (always loaded - lightweight)
  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useDailyMonitoringStats();

  // Exemption mutations
  const {
    approveMutation,
    rejectMutation,
    endEarlyMutation,
    createExemptionMutation,
    isLoading: mutationsLoading,
  } = useExemptionMutations({
    onApproveSuccess: () => {
      setShowApproveModal(false);
      setSelectedExemption(null);
      toast.success('Exemption approved');
    },
    onApproveError: () => toast.error('Failed to approve exemption'),
    onRejectSuccess: () => {
      setShowRejectModal(false);
      setSelectedExemption(null);
      toast.success('Exemption rejected');
    },
    onRejectError: () => toast.error('Failed to reject exemption'),
    onEndEarlySuccess: () => {
      setShowEndEarlyModal(false);
      setSelectedExemption(null);
      toast.success('Exemption ended');
    },
    onEndEarlyError: () => toast.error('Failed to end exemption'),
    onCreateSuccess: () => {
      setSelectedCheckinForExemption(null);
      toast.success('Exemption created');
    },
    onCreateError: () => toast.error('Failed to create exemption'),
  });

  // Handlers
  const handleApprove = useCallback((exemption: Exemption) => {
    setSelectedExemption(exemption);
    setShowApproveModal(true);
  }, []);

  const handleReject = useCallback((exemption: Exemption) => {
    setSelectedExemption(exemption);
    setShowRejectModal(true);
  }, []);

  const handleEndEarly = useCallback((exemption: Exemption) => {
    setSelectedExemption(exemption);
    setShowEndEarlyModal(true);
  }, []);

  const handleCreateExemption = useCallback((checkin: TodayCheckin) => {
    setSelectedCheckinForExemption(checkin);
  }, []);

  // Loading state
  if (statsLoading) {
    return <SkeletonDashboard />;
  }

  // Error state
  if (statsError || !statsData) {
    const errorMessage = (statsError as any)?.response?.data?.error || 'Failed to load data';
    const isNoTeamError = errorMessage.includes('not assigned to a team');

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div
          className={cn(
            'h-16 w-16 rounded-full flex items-center justify-center mb-4',
            isNoTeamError ? 'bg-warning-100' : 'bg-danger-100'
          )}
        >
          {isNoTeamError ? (
            <Users className="h-8 w-8 text-warning-600" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-danger-600" />
          )}
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          {isNoTeamError ? 'No Team Available' : 'Failed to Load Data'}
        </h2>
        <p className="text-gray-500 mb-4 text-center max-w-md">
          {isNoTeamError
            ? 'You need to be assigned to a team to view monitoring data.'
            : 'There was an error loading the data.'}
        </p>
        {!isNoTeamError && (
          <Button onClick={() => refetchStats()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  const { team, stats } = statsData;

  // Map stats for StatsBar component
  const statsBarData = {
    greenCount: stats.greenCount,
    yellowCount: stats.yellowCount,
    redCount: stats.redCount,
    totalCheckedIn: stats.checkedIn,
    teamSize: stats.totalMembers,
  };

  return (
    <>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Daily Monitoring</h1>
            <p className="text-sm text-gray-500 mt-1">
              {team.name} &bull;{' '}
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
          <StatsBar stats={statsBarData} />
        </div>

        {/* Mobile Stats Cards */}
        <MobileStatsCards stats={statsBarData} />

        {/* Critical Alert */}
        <CriticalAlert
          criticalCount={stats.criticalChanges}
          onViewChanges={() => handleTabChange('changes')}
        />

        {/* Holiday Banner */}
        {stats.isHoliday && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-medium text-blue-800">
              Today is a holiday: {stats.holidayName}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Workers are not required to check in today.
            </p>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl overflow-x-auto">
          {[
            { id: 'checkins' as const, label: 'Check-ins', count: stats.checkedIn },
            { id: 'changes' as const, label: 'Changes', count: stats.criticalChanges },
            { id: 'exemptions' as const, label: 'Exemptions', count: stats.pendingExemptions },
            { id: 'absences' as const, label: 'Absences', count: 0 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex-1 min-w-[80px] px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    'ml-2 px-1.5 py-0.5 rounded-full text-xs',
                    activeTab === tab.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content - lazy loaded */}
        <div className="min-h-[300px] md:min-h-[400px]">
          {activeTab === 'checkins' && (
            <CheckinsTab teamId={team.id} onCreateExemption={handleCreateExemption} />
          )}

          {activeTab === 'changes' && <SuddenChangesTab teamId={team.id} />}

          {activeTab === 'exemptions' && (
            <ExemptionsTab
              teamId={team.id}
              timezone={team.timezone}
              onApprove={handleApprove}
              onReject={handleReject}
              onEndEarly={handleEndEarly}
              isLoading={mutationsLoading}
            />
          )}

          {activeTab === 'absences' && <AbsencesTab />}
        </div>
      </div>

      {/* Modals */}
      {showApproveModal && selectedExemption && (
        <ApproveExemptionModal
          exemption={selectedExemption}
          onClose={() => {
            setShowApproveModal(false);
            setSelectedExemption(null);
          }}
          onConfirm={(endDate, notes) =>
            approveMutation.mutate({ id: selectedExemption.id, endDate, notes })
          }
          isLoading={approveMutation.isPending}
          timezone={team.timezone}
        />
      )}

      {selectedCheckinForExemption && (
        <CreateExemptionModal
          checkin={selectedCheckinForExemption}
          onClose={() => setSelectedCheckinForExemption(null)}
          onConfirm={(formData) =>
            createExemptionMutation.mutate({
              userId: selectedCheckinForExemption.userId,
              checkinId: selectedCheckinForExemption.id,
              ...formData,
            })
          }
          isLoading={createExemptionMutation.isPending}
          timezone={team.timezone}
        />
      )}

      {/* Reject Exemption Modal */}
      <ConfirmModal
        isOpen={showRejectModal && !!selectedExemption}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedExemption(null);
        }}
        onConfirm={() => {
          if (selectedExemption) {
            rejectMutation.mutate({ id: selectedExemption.id });
          }
        }}
        title="Reject Exemption"
        message={`Are you sure you want to reject ${selectedExemption?.user.firstName}'s exemption request?`}
        confirmText="Reject"
        cancelText="Cancel"
        type="danger"
        action="remove"
        isLoading={rejectMutation.isPending}
      />

      {/* End Early Modal */}
      <EndLeaveEarlyModal
        isOpen={showEndEarlyModal && !!selectedExemption}
        onClose={() => {
          setShowEndEarlyModal(false);
          setSelectedExemption(null);
        }}
        onConfirm={(returnDate, notes) => {
          if (selectedExemption) {
            endEarlyMutation.mutate({
              id: selectedExemption.id,
              returnDate,
              notes,
            });
          }
        }}
        isLoading={endEarlyMutation.isPending}
        timezone={team.timezone}
        user={{
          firstName: selectedExemption?.user.firstName,
          lastName: selectedExemption?.user.lastName,
        }}
        currentEndDate={selectedExemption?.endDate || null}
      />
    </>
  );
}

export default DailyMonitoringPage;
