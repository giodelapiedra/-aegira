/**
 * Incident Case Report - Print Preview
 * Professional document style for printing/PDF export
 * Uses centralized config from status-config.ts
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { formatDisplayDate, formatDisplayDateTime } from '../../lib/date-utils';
import { incidentService } from '../../services/incident.service';
import { useUser } from '../../hooks/useUser';
import { cn } from '../../lib/utils';
import {
  incidentStatusConfig,
  incidentSeverityConfig,
  incidentTypeConfig,
} from '../../lib/status-config';

// ============================================
// REUSABLE COMPONENTS
// ============================================

/** Section header */
const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">
    {children}
  </h3>
);

/** Table wrapper */
const DataTable = ({ children }: { children: React.ReactNode }) => (
  <table className="w-full border-collapse">{children}</table>
);

/** Table header */
const TableHeader = ({ columns }: { columns: string[] }) => (
  <thead>
    <tr className="border-y border-gray-200">
      {columns.map((col) => (
        <th
          key={col}
          className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50"
        >
          {col}
        </th>
      ))}
    </tr>
  </thead>
);

/** Info row for two-column layout */
const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between py-1">
    <span className="text-gray-500">{label}</span>
    <span className="font-medium text-gray-900">{value}</span>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export function IncidentPrintPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company } = useUser();

  const { data: incident, isLoading } = useQuery({
    queryKey: ['incident', id],
    queryFn: () => incidentService.getById(id!),
    enabled: !!id,
  });

  // Set document title for print header
  useEffect(() => {
    if (incident) {
      const originalTitle = document.title;
      document.title = `Case Report - ${incident.caseNumber}`;
      return () => {
        document.title = originalTitle;
      };
    }
  }, [incident]);

  const handlePrint = () => window.print();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not found state
  if (!incident) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <AlertTriangle className="h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-500">Incident not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  // Get configs from centralized source
  const status = incidentStatusConfig[incident.status] || incidentStatusConfig.OPEN;
  const severity = incidentSeverityConfig[incident.severity] || incidentSeverityConfig.MEDIUM;
  const incidentType = incidentTypeConfig[incident.type] || incidentTypeConfig.OTHER;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar - Hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="primary" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Document
          </Button>
        </div>
      </div>

      {/* Document Container */}
      <div className="max-w-4xl mx-auto py-8 px-4 print:py-0 print:px-0 print:max-w-none">
        <div className="bg-white rounded-lg shadow-lg print:shadow-none print:rounded-none">
          <div className="p-8 print:p-6">

            {/* ==================== HEADER ==================== */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-100">
              {/* Company Info */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 bg-primary-600 rounded-lg flex items-center justify-center">
                    <Shield className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{company?.name || 'AEGIRA'}</h1>
                    <p className="text-sm text-gray-500">Workplace Health & Safety</p>
                  </div>
                </div>
                <div className="text-sm text-gray-500 space-y-0.5">
                  {company?.address && <p>{company.address}</p>}
                  <p>{company?.city || 'Metro Manila'}, Philippines</p>
                  {company?.phone && <p>{company.phone}</p>}
                </div>
              </div>

              {/* Case Info */}
              <div className="text-right">
                <h2 className="text-xl font-bold text-primary-600 mb-2">
                  Case #{incident.caseNumber}
                </h2>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="text-gray-400">Incident Date:</span>{' '}
                    <span className="font-medium">
                      {formatDisplayDate(incident.incidentDate || incident.createdAt)}
                    </span>
                  </p>
                  <p>
                    <span className="text-gray-400">Report Filed:</span>{' '}
                    <span className="font-medium">{formatDisplayDate(incident.createdAt)}</span>
                  </p>
                  {incident.exception?.endDate && (
                    <p>
                      <span className="text-gray-400">Return to Work:</span>{' '}
                      <span className="font-medium text-green-600">{formatDisplayDate(incident.exception.endDate)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ==================== TWO COLUMN INFO ==================== */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              {/* Reporter Info */}
              <div>
                <SectionHeader>Reported By:</SectionHeader>
                <div className="text-sm text-gray-700 space-y-1">
                  <p className="font-semibold text-gray-900">
                    {incident.reporter?.firstName} {incident.reporter?.lastName}
                  </p>
                  <p>{incident.reporter?.team?.name || 'No Team'}</p>
                  <p>{incident.reporter?.email}</p>
                  {incident.reporter?.phone && <p>{incident.reporter.phone}</p>}
                </div>
              </div>

              {/* Case Status */}
              <div>
                <SectionHeader>Case Status:</SectionHeader>
                <div className="text-sm space-y-2">
                  <InfoRow
                    label="Status:"
                    value={
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', status.bgColor, status.textColor)}>
                        {status.label}
                      </span>
                    }
                  />
                  <InfoRow
                    label="Severity:"
                    value={
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', severity.bgColor, severity.textColor)}>
                        {severity.label}
                      </span>
                    }
                  />
                  <InfoRow label="Type:" value={incidentType.label} />
                  {incident.location && <InfoRow label="Location:" value={incident.location} />}
                </div>
              </div>
            </div>

            {/* ==================== INCIDENT DETAILS ==================== */}
            <div className="mb-8">
              <SectionHeader>Incident Details</SectionHeader>
              <DataTable>
                <TableHeader columns={['Field', 'Information']} />
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-3 px-4 text-sm text-gray-600 font-medium w-32">Title</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{incident.title}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 text-sm text-gray-600 font-medium align-top">Description</td>
                    <td className="py-3 px-4 text-sm text-gray-900 whitespace-pre-wrap">
                      {incident.description}
                    </td>
                  </tr>
                  {incident.aiSummary && (
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium align-top">AI Summary</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{incident.aiSummary}</td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </div>

            {/* ==================== WHS ASSIGNMENT ==================== */}
            {(incident.whsOfficer || incident.whsAssigner) && (
              <div className="mb-8">
                <SectionHeader>WHS Assignment</SectionHeader>
                <DataTable>
                  <TableHeader columns={['Role', 'Name', 'Date']} />
                  <tbody className="divide-y divide-gray-100">
                    {incident.whsAssigner && (
                      <tr>
                        <td className="py-3 px-4 text-sm text-gray-600 font-medium">Assigned By (Supervisor)</td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {incident.whsAssigner.firstName} {incident.whsAssigner.lastName}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {incident.whsAssignedAt ? formatDisplayDateTime(incident.whsAssignedAt) : '-'}
                        </td>
                      </tr>
                    )}
                    {incident.whsOfficer && (
                      <tr>
                        <td className="py-3 px-4 text-sm text-gray-600 font-medium">WHS Officer</td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {incident.whsOfficer.firstName} {incident.whsOfficer.lastName}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">-</td>
                      </tr>
                    )}
                  </tbody>
                </DataTable>
                {incident.whsAssignedNote && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm">
                    <span className="font-semibold text-amber-700">Assignment Note:</span>{' '}
                    <span className="text-amber-600">{incident.whsAssignedNote}</span>
                  </div>
                )}
              </div>
            )}

            {/* ==================== LEAVE REQUEST ==================== */}
            {incident.exception && (
              <div className="mb-8">
                <SectionHeader>Leave Request</SectionHeader>
                <DataTable>
                  <TableHeader columns={['Field', 'Information']} />
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium w-40">Leave Type</td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {incident.exception.type?.replace(/_/g, ' ') || 'Medical Leave'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium">Leave Period</td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {formatDisplayDate(incident.exception.startDate)} - {formatDisplayDate(incident.exception.endDate)}
                      </td>
                    </tr>
                    {incident.exception.reason && (
                      <tr>
                        <td className="py-3 px-4 text-sm text-gray-600 font-medium align-top">Reason</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{incident.exception.reason}</td>
                      </tr>
                    )}
                  </tbody>
                </DataTable>
              </div>
            )}

            {/* ==================== RETURN TO WORK CERTIFICATE ==================== */}
            {incident.rtwCertDate && (
              <div className="mb-8">
                <SectionHeader>Return to Work Certificate</SectionHeader>
                <DataTable>
                  <TableHeader columns={['Field', 'Information']} />
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium w-40">RTW Date</td>
                      <td className="py-3 px-4 text-sm text-gray-900 font-semibold text-green-600">
                        {formatDisplayDate(incident.rtwCertDate)}
                      </td>
                    </tr>
                    {incident.rtwUploader && (
                      <tr>
                        <td className="py-3 px-4 text-sm text-gray-600 font-medium">Uploaded By</td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {incident.rtwUploader.firstName} {incident.rtwUploader.lastName}
                        </td>
                      </tr>
                    )}
                    {incident.rtwUploadedAt && (
                      <tr>
                        <td className="py-3 px-4 text-sm text-gray-600 font-medium">Upload Date</td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {formatDisplayDateTime(incident.rtwUploadedAt)}
                        </td>
                      </tr>
                    )}
                    {incident.rtwNotes && (
                      <tr>
                        <td className="py-3 px-4 text-sm text-gray-600 font-medium align-top">Notes</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{incident.rtwNotes}</td>
                      </tr>
                    )}
                  </tbody>
                </DataTable>
              </div>
            )}

            {/* ==================== ACTIVITY TIMELINE ==================== */}
            {incident.activities && incident.activities.length > 0 && (
              <div className="mb-8">
                <SectionHeader>Activity Timeline</SectionHeader>
                <DataTable>
                  <TableHeader columns={['Date/Time', 'Action', 'By', 'Details']} />
                  <tbody className="divide-y divide-gray-100">
                    {incident.activities.map((activity) => (
                      <tr key={activity.id}>
                        <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                          {formatDisplayDateTime(activity.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                          {activity.type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {activity.user?.firstName} {activity.user?.lastName}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {activity.comment || activity.newValue || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            )}

            {/* ==================== FOOTER ==================== */}
            <div className="pt-6 border-t-2 border-gray-100">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Generated by: <span className="text-primary-600">{company?.name || 'Aegira'} WHS System</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Document generated on {formatDisplayDateTime(new Date().toISOString())}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-500">Document ID:</p>
                  <p className="font-mono text-xs text-gray-400">{incident.id}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 11pt !important;
          }

          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          .print\\:p-6 { padding: 1.5rem !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:bg-white { background-color: white !important; }

          /* Sections - keep together, reduce spacing */
          .mb-8 {
            margin-bottom: 1.25rem !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .gap-8 { gap: 1.5rem !important; }

          /* Tables */
          table {
            border: 1px solid #e5e7eb !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead { display: table-header-group !important; }
          tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          th, td { border: 1px solid #e5e7eb !important; padding: 8px 12px !important; }
          th { background-color: #f9fafb !important; }

          /* Header/Footer borders */
          .border-b-2 { border-bottom: 2px solid #e5e7eb !important; margin-bottom: 1.5rem !important; padding-bottom: 1.5rem !important; }
          .border-t-2 { border-top: 2px solid #e5e7eb !important; margin-top: 1.5rem !important; padding-top: 1rem !important; }

          /* Font sizes */
          .text-2xl { font-size: 18pt !important; }
          .text-xl { font-size: 14pt !important; }
          .text-sm { font-size: 10pt !important; }
          .text-xs { font-size: 9pt !important; }
        }

        @page { margin: 0.6in 0.5in; size: A4; }
      `}</style>
    </div>
  );
}
