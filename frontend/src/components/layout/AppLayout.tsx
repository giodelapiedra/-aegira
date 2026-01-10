import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AbsenceJustificationModal } from '../absences/AbsenceJustificationModal';
import { absenceService } from '../../services/absence.service';
import { useAuthStore } from '../../store/auth.store';

export function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  // Check for pending absence justifications (only for workers)
  const isWorker = user?.role === 'WORKER' || user?.role === 'MEMBER';

  const { data: pendingAbsences } = useQuery({
    queryKey: ['absences', 'my-pending'],
    queryFn: () => absenceService.getMyPending(),
    enabled: isWorker, // Only run for workers
    refetchOnWindowFocus: true,
    staleTime: 30000, // 30 seconds
  });

  // Handle successful justification submission
  const handleJustificationComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['absences', 'my-pending'] });
  };

  // Show blocking modal if worker has pending absences
  const showAbsenceModal = isWorker && pendingAbsences?.hasBlocking && pendingAbsences.data.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Blocking Absence Justification Modal */}
      {showAbsenceModal && (
        <AbsenceJustificationModal
          absences={pendingAbsences.data}
          onComplete={handleJustificationComplete}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isExpanded={isSidebarExpanded}
        onExpandChange={setIsSidebarExpanded}
      />

      {/* Main content area - fixed offset, sidebar floats over when expanded */}
      <div className="lg:pl-[72px] min-h-screen flex flex-col">
        {/* Header */}
        <Header onMenuClick={() => setIsSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
