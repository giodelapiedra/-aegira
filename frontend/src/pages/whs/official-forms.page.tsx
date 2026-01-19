/**
 * Official Forms Page
 *
 * Fill official government forms (e.g., Certificate of Capacity)
 * with auto-fill from incident data
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  FileText,
  ArrowLeft,
  Download,
  Printer,
  CheckCircle,
  Loader2,
  FileCheck,
  ChevronDown,
  User,
  Calendar,
  Building,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formsService } from '../../services/forms.service';

export function OfficialFormsPage() {
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<string>('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [generatedPdf, setGeneratedPdf] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<number>(1);

  // Queries
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['form-templates'],
    queryFn: () => formsService.getTemplates(),
  });

  const { data: templateDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['form-template-details', selectedTemplate],
    queryFn: () => formsService.getTemplateDetails(selectedTemplate!),
    enabled: !!selectedTemplate,
  });

  const { data: incidents } = useQuery({
    queryKey: ['form-incidents', selectedTemplate],
    queryFn: () => formsService.getIncidentsForForm(selectedTemplate!),
    enabled: !!selectedTemplate,
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: () =>
      formsService.generateForm(selectedTemplate!, formValues, {
        incidentId: selectedIncident || undefined,
      }),
    onSuccess: (data) => {
      setGeneratedPdf(data.pdfBase64);
      if (data.attachedUrl) {
        toast.success(`Form generated and attached to incident! ${data.filledFields.length} fields filled.`);
      } else {
        toast.success(`Form generated! ${data.filledFields.length} fields filled.`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to generate form');
    },
  });

  // Auto-fill when incident is selected
  useEffect(() => {
    if (selectedIncident && incidents && templateDetails) {
      const incident = incidents.find((i) => i.id === selectedIncident);
      if (incident) {
        const autoFilledValues: Record<string, any> = {};

        for (const field of templateDetails.fields) {
          if (field.autoFillFrom) {
            const value = getNestedValue(incident, field.autoFillFrom);
            if (value) {
              autoFilledValues[field.key] = value;
            }
          }
        }

        setFormValues((prev) => ({ ...autoFilledValues, ...prev }));
      }
    }
  }, [selectedIncident, incidents, templateDetails]);

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    if (!templateDetails) return {};
    return templateDetails.fields.reduce(
      (acc, field) => {
        const section = field.section || 1;
        if (!acc[section]) acc[section] = [];
        acc[section].push(field);
        return acc;
      },
      {} as Record<number, typeof templateDetails.fields>
    );
  }, [templateDetails]);

  // Section titles
  const sectionTitles: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'Section 1', subtitle: 'Injured Person Details' },
    2: { title: 'Section 2', subtitle: 'Medical Certification' },
    3: { title: 'Section 3', subtitle: 'Capacity for Work' },
    4: { title: 'Section 4', subtitle: 'Practitioner Details' },
    5: { title: 'Section 5', subtitle: 'Employment Declaration' },
  };

  // Get selected incident details
  const selectedIncidentData = useMemo(() => {
    if (!selectedIncident || !incidents) return null;
    return incidents.find((i) => i.id === selectedIncident);
  }, [selectedIncident, incidents]);

  // Handlers
  const handleFieldChange = (key: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handleDownload = () => {
    if (generatedPdf && templateDetails) {
      const fileName = `${templateDetails.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      formsService.downloadPdf(generatedPdf, fileName);
    }
  };

  const handlePrint = () => {
    if (generatedPdf) {
      formsService.openPdfInNewTab(generatedPdf);
    }
  };

  const handleBack = () => {
    setSelectedTemplate(null);
    setSelectedIncident('');
    setFormValues({});
    setGeneratedPdf(null);
    setActiveSection(1);
  };

  // Loading state
  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
      </div>
    );
  }

  // Template Selection View
  if (!selectedTemplate) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Official Forms</h1>
          <p className="text-gray-500 mt-1">
            Select a form template to fill out
          </p>
        </div>

        {!templates || templates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Forms Available</h3>
              <p className="text-gray-500">No official form templates have been configured yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary-400 hover:shadow-lg transition-all"
                onClick={() => setSelectedTemplate(template.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary-50 rounded-xl">
                      <FileCheck className="h-8 w-8 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                        <span className="px-2 py-1 bg-gray-100 rounded">{template.category}</span>
                        <span>{template.pageCount} pages</span>
                        <span>{template.fieldCount} fields</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Form Fill View
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-gray-200" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">{templateDetails?.name || 'Loading...'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {generatedPdf && (
              <>
                <Button variant="secondary" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print / Preview
                </Button>
                <Button variant="secondary" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </>
            )}
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !selectedIncident}
              title={!selectedIncident ? 'Please select an incident first' : ''}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileCheck className="h-4 w-4 mr-2" />
              )}
              Generate PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Incident Selection Bar */}
      <div className="flex-shrink-0 bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Select Incident: <span className="text-red-500">*</span>
          </label>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <select
                value={selectedIncident}
                onChange={(e) => setSelectedIncident(e.target.value)}
                className={`w-full px-4 py-2 pr-10 border rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none cursor-pointer ${
                  !selectedIncident ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">-- Select an incident (required) --</option>
                {incidents?.map((incident) => (
                  <option key={incident.id} value={incident.id}>
                    {incident.caseNumber} - {incident.reporter.firstName} {incident.reporter.lastName} ({incident.title})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
          {selectedIncidentData && (
            <div className="flex items-center gap-3 px-4 py-2 bg-primary-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-primary-700">
                <User className="h-4 w-4" />
                <span className="font-medium">
                  {selectedIncidentData.reporter.firstName} {selectedIncidentData.reporter.lastName}
                </span>
              </div>
              <div className="h-4 w-px bg-primary-200" />
              <div className="flex items-center gap-2 text-sm text-primary-600">
                <Building className="h-4 w-4" />
                <span>{selectedIncidentData.company.name}</span>
              </div>
              <div className="h-4 w-px bg-primary-200" />
              <div className="flex items-center gap-2 text-sm text-primary-600">
                <Calendar className="h-4 w-4" />
                <span>{new Date(selectedIncidentData.incidentDate).toLocaleDateString()}</span>
              </div>
              <button
                onClick={() => setSelectedIncident('')}
                className="ml-2 p-1 hover:bg-primary-100 rounded"
              >
                <X className="h-4 w-4 text-primary-600" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {detailsLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="p-6">
            {/* Success Message */}
            {generatedPdf && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">PDF Generated Successfully!</p>
                  <p className="text-sm text-green-600">
                    Click "Print / Preview" to view or "Download" to save.
                  </p>
                </div>
              </div>
            )}

            {/* Section Tabs */}
            <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
              {Object.entries(fieldsBySection).map(([section, fields]) => {
                const sectionNum = Number(section);
                const info = sectionTitles[sectionNum] || { title: `Section ${section}`, subtitle: '' };
                const isActive = activeSection === sectionNum;
                const filledCount = fields.filter((f) => formValues[f.key]).length;

                return (
                  <button
                    key={section}
                    onClick={() => setActiveSection(sectionNum)}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-primary-300'
                    }`}
                  >
                    <div className="text-sm font-medium">{info.title}</div>
                    <div className={`text-xs ${isActive ? 'text-primary-100' : 'text-gray-400'}`}>
                      {info.subtitle} ({filledCount}/{fields.length})
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Section Fields */}
            {fieldsBySection[activeSection] && (
              <Card>
                <CardHeader className="border-b bg-gray-50">
                  <CardTitle>
                    {sectionTitles[activeSection]?.title} - {sectionTitles[activeSection]?.subtitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                    {fieldsBySection[activeSection].map((field) => (
                      <div
                        key={field.key}
                        className={
                          field.type === 'textarea' ? 'md:col-span-2 lg:col-span-3' : ''
                        }
                      >
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                          {field.autoFillFrom && formValues[field.key] && (
                            <span className="text-xs text-green-600 ml-2">(auto-filled)</span>
                          )}
                        </label>

                        {field.type === 'checkbox' ? (
                          <label className="flex items-center gap-2 cursor-pointer py-2">
                            <input
                              type="checkbox"
                              checked={formValues[field.key] === true}
                              onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            <span className="text-sm text-gray-600">Yes</span>
                          </label>
                        ) : field.type === 'dropdown' ? (
                          <div className="relative">
                            <select
                              value={formValues[field.key] || ''}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none bg-white"
                            >
                              <option value="">Select...</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                          </div>
                        ) : field.type === 'radio' ? (
                          <div className="flex items-center gap-4 py-2">
                            {field.options?.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={field.key}
                                  value={opt}
                                  checked={formValues[field.key] === opt}
                                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-600">{opt}</span>
                              </label>
                            ))}
                          </div>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            value={formValues[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                          />
                        ) : field.type === 'date' ? (
                          <Input
                            type="date"
                            value={formValues[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="py-2.5"
                          />
                        ) : (
                          <Input
                            type="text"
                            value={formValues[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder={`Enter ${field.label.toLowerCase()}...`}
                            className="py-2.5"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => setActiveSection((prev) => Math.max(1, prev - 1))}
                disabled={activeSection === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Previous Section
              </Button>

              <div className="text-sm text-gray-500">
                Section {activeSection} of {Object.keys(fieldsBySection).length}
              </div>

              {activeSection < Object.keys(fieldsBySection).length ? (
                <Button
                  variant="secondary"
                  onClick={() => setActiveSection((prev) => prev + 1)}
                >
                  Next Section
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !selectedIncident}
                  title={!selectedIncident ? 'Please select an incident first' : ''}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileCheck className="h-4 w-4 mr-2" />
                  )}
                  Generate PDF
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
