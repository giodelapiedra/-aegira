import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';
import {
  FileText,
  ArrowLeft,
  Download,
  Save,
  Loader2,
  AlertTriangle,
  Upload,
  CheckCircle,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { pdfTemplateService, type DetectedField } from '../../services/pdf-template.service';
import { incidentService } from '../../services/incident.service';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PageSize {
  width: number;
  height: number;
}

interface FieldData {
  fields: DetectedField[];
  pageSizes: PageSize[];
}

export function VisualPDFFillPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const incidentId = searchParams.get('incidentId');

  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [fieldData, setFieldData] = useState<FieldData | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [generatedPdf, setGeneratedPdf] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const [pageHeight, setPageHeight] = useState<number>(0);

  const { data: template, isLoading, error } = useQuery({
    queryKey: ['pdf-template', id],
    queryFn: () => pdfTemplateService.getById(id!),
    enabled: !!id,
  });

  const { data: incident } = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => incidentService.getById(incidentId!),
    enabled: !!incidentId,
  });

  const fillMutation = useMutation({
    mutationFn: async () => {
      if (!id || !pdfBase64) {
        throw new Error('PDF template file is required');
      }
      return pdfTemplateService.fillTemplate(id, {
        values: formValues,
        incidentId: incidentId || undefined,
        pdfBase64,
      });
    },
    onSuccess: (data) => {
      setGeneratedPdf(data.pdfBase64);
      setShowSuccessModal(true);
      queryClient.invalidateQueries({ queryKey: ['pdf-templates'] });
      if (incidentId) {
        queryClient.invalidateQueries({ queryKey: ['incident', incidentId] });
      }
      toast.success('PDF filled successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to fill PDF');
    },
  });

  // Parse field data from template
  useEffect(() => {
    if (template?.fields) {
      try {
        const parsed = JSON.parse(template.fields);
        // Handle both old format (array) and new format (object with fields and pageSizes)
        if (Array.isArray(parsed)) {
          setFieldData({ fields: parsed, pageSizes: [] });
        } else {
          setFieldData(parsed);
        }
      } catch {
        setFieldData(null);
      }
    }
  }, [template]);

  // Auto-load PDF from custom domain URL when template is loaded
  useEffect(() => {
    const loadPdfFromUrl = async () => {
      if (template?.fileUrl && !pdfBase64 && !isLoadingPdf) {
        setIsLoadingPdf(true);
        try {
          // Try custom domain first, fallback to proxy if it fails
          let response: Response;
          try {
            response = await fetch(template.fileUrl);
            if (!response.ok) throw new Error('Direct fetch failed');
          } catch (directError) {
            // Fallback to backend proxy if direct fetch fails
            console.log('Direct fetch failed, using proxy:', directError);
            const proxyResponse = await api.get(`/pdf-templates/${template.id}/file`, {
              responseType: 'blob',
            });
            const blob = proxyResponse.data;
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64 = result.split(',')[1];
              setPdfBase64(base64);
              const url = URL.createObjectURL(blob);
              setPdfUrl(url);
            };
            reader.readAsDataURL(blob);
            return;
          }

          const blob = await response.blob();

          // Convert blob to base64
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            setPdfBase64(base64);

            // Create blob URL for react-pdf
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error('Failed to load PDF from URL:', err);
          toast.error('Failed to load PDF file. Please upload manually.');
        } finally {
          setIsLoadingPdf(false);
        }
      }
    };

    loadPdfFromUrl();
  }, [template?.fileUrl, template?.id, pdfBase64, isLoadingPdf]);

  // Initialize form values
  useEffect(() => {
    if (fieldData?.fields) {
      const initialValues: Record<string, any> = {};
      fieldData.fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          initialValues[field.name] = field.defaultValue;
        } else if (field.type === 'checkbox') {
          initialValues[field.name] = false;
        } else {
          initialValues[field.name] = '';
        }
      });
      setFormValues(initialValues);
    }
  }, [fieldData]);

  // Pre-fill worker info from incident
  useEffect(() => {
    if (incident?.reporter && fieldData?.fields) {
      const updates: Record<string, any> = {};
      fieldData.fields.forEach((field) => {
        const nameLower = field.name.toLowerCase();
        if (nameLower.includes('worker') && nameLower.includes('name')) {
          updates[field.name] = `${incident.reporter?.firstName} ${incident.reporter?.lastName}`;
        } else if (nameLower.includes('first') && nameLower.includes('name')) {
          updates[field.name] = incident.reporter?.firstName;
        } else if (nameLower.includes('last') && nameLower.includes('name') || nameLower.includes('surname')) {
          updates[field.name] = incident.reporter?.lastName;
        } else if (nameLower.includes('email')) {
          updates[field.name] = incident.reporter?.email;
        }
      });
      if (Object.keys(updates).length > 0) {
        setFormValues((prev) => ({ ...prev, ...updates }));
      }
    }
  }, [incident, fieldData]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }

    setIsLoadingPdf(true);
    try {
      const base64 = await pdfTemplateService.fileToBase64(file);
      setPdfBase64(base64);

      // Create blob URL for react-pdf
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      toast.error('Failed to load PDF file');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
  };

  const onPageLoadSuccess = ({ width, height }: { width: number; height: number }) => {
    setPageWidth(width);
    setPageHeight(height);
  };

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = () => {
    if (!pdfBase64) {
      toast.error('Please upload the PDF template file first');
      return;
    }
    fillMutation.mutate();
  };

  const handleDownload = () => {
    if (generatedPdf && template) {
      const fileName = `${template.name.replace(/\s+/g, '_')}_filled_${Date.now()}.pdf`;
      pdfTemplateService.downloadPDF(generatedPdf, fileName);
      toast.success('PDF downloaded!');
    }
  };

  // Get fields for current page
  const currentPageFields = fieldData?.fields.filter(f => f.page === currentPage) || [];
  const currentPageSize = fieldData?.pageSizes?.[currentPage - 1];



  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto mb-3" />
        <p className="text-gray-500">Template not found</p>
        <Link to="/whs/pdf-templates">
          <Button variant="secondary" className="mt-4">Back to Templates</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Link to={incidentId ? `/incidents/${incidentId}` : '/whs/pdf-templates'}>
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary-600" />
              {template.name}
            </h1>
            {incident && (
              <p className="text-sm text-primary-600">Case #{incident.caseNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSubmit}
            isLoading={fillMutation.isPending}
            disabled={!pdfBase64}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Generate Filled PDF
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 bg-gray-100 overflow-auto" ref={containerRef}>
          {!pdfUrl ? (
            <div className="h-full flex items-center justify-center p-8">
              {isLoadingPdf ? (
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary-500 mx-auto mb-4" />
                  <p className="text-gray-600">Loading PDF from storage...</p>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="max-w-md w-full border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Upload PDF Template</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Could not auto-load PDF. Upload "{template.fileName || template.name}" manually
                  </p>
                  <Button variant="primary">Select PDF File</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="min-h-full p-4">
              {/* Zoom Controls */}
              <div className="sticky top-0 z-20 flex items-center justify-center gap-2 mb-4 bg-white/90 backdrop-blur rounded-lg p-2 shadow-sm w-fit mx-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-16 text-center">{Math.round(scale * 100)}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setScale(s => Math.min(2, s + 0.1))}
                  disabled={scale >= 2}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-gray-200 mx-2" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  Page {currentPage} of {numPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* PDF with Overlay Fields */}
              <div className="flex justify-center">
                <div className="relative inline-block shadow-xl">
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<Loader2 className="h-8 w-8 animate-spin text-primary-500" />}
                  >
                    <Page
                      pageNumber={currentPage}
                      scale={scale}
                      onLoadSuccess={onPageLoadSuccess}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />
                  </Document>

                  {/* Overlay Form Fields Container - matches PDF page size */}
                  <div
                    className="absolute top-0 left-0 pointer-events-none"
                    style={{
                      width: `${pageWidth * scale}px`,
                      height: `${pageHeight * scale}px`,
                    }}
                  >
                    {currentPageFields.map((field, idx) => {
                      // Skip if no rect data
                      if (!field.rect) {
                        console.log('Field without rect:', field.name);
                        return null;
                      }

                      const pdfPageHeight = currentPageSize?.height || pageHeight;

                      // PDF coords: origin bottom-left, we need top-left
                      // Scale from PDF units to rendered pixels
                      const scaleFactor = scale;

                      const left = field.rect.x * scaleFactor;
                      const width = field.rect.width * scaleFactor;
                      const height = field.rect.height * scaleFactor;
                      // Convert Y from bottom-origin to top-origin
                      const top = (pdfPageHeight - field.rect.y - field.rect.height) * scaleFactor;

                      const value = formValues[field.name] ?? '';

                      return (
                        <div
                          key={`${field.name}-${idx}`}
                          className="absolute pointer-events-auto"
                          style={{
                            left: `${left}px`,
                            top: `${top}px`,
                            width: `${Math.max(width, 20)}px`,
                            height: `${Math.max(height, 16)}px`,
                          }}
                        >
                          {field.type === 'checkbox' ? (
                            <input
                              type="checkbox"
                              checked={value === true || value === 'true'}
                              onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                              className="w-full h-full cursor-pointer accent-primary-600 bg-blue-200/50"
                              title={field.name}
                            />
                          ) : field.type === 'dropdown' ? (
                            <select
                              value={value}
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              className="w-full h-full text-xs bg-blue-100/70 border border-blue-400 rounded-sm px-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white"
                              title={field.name}
                            >
                              <option value="">-</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'date' ? 'date' : 'text'}
                              value={value}
                              onChange={(e) => handleFieldChange(field.name, e.target.value)}
                              className={cn(
                                "w-full h-full bg-blue-100/70 border border-blue-400 rounded-sm px-1",
                                "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white",
                                "placeholder:text-blue-400/70"
                              )}
                              style={{ fontSize: `${Math.max(8, Math.min(14, height * 0.7))}px` }}
                              title={field.name}
                              placeholder=""
                              maxLength={field.maxLength}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Field List Sidebar */}
        {pdfUrl && fieldData && fieldData.fields.length > 0 && (
          <div className="w-80 flex-shrink-0 border-l bg-white overflow-y-auto">
            <div className="p-4 border-b bg-gray-50 sticky top-0">
              <h3 className="font-semibold text-gray-900">Form Fields</h3>
              <p className="text-sm text-gray-500">{fieldData.fields.length} fields detected</p>
            </div>
            <div className="p-3 space-y-2">
              {fieldData.fields.map((field, idx) => (
                <div
                  key={`sidebar-${field.name}-${idx}`}
                  className={cn(
                    "p-2 rounded-lg border text-sm cursor-pointer transition-colors",
                    field.page === currentPage
                      ? "bg-primary-50 border-primary-200"
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                  )}
                  onClick={() => setCurrentPage(field.page)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 truncate">{field.name}</span>
                    <span className="text-xs text-gray-400">p.{field.page}</span>
                  </div>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded",
                    field.type === 'checkbox' ? "bg-status-green-100 text-status-green-700" :
                    field.type === 'dropdown' ? "bg-blue-100 text-blue-700" :
                    field.type === 'date' ? "bg-purple-100 text-purple-700" :
                    "bg-gray-100 text-gray-600"
                  )}>
                    {field.type}
                  </span>
                  {formValues[field.name] && (
                    <CheckCircle className="inline-block h-3 w-3 text-success-500 ml-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Success Modal */}
      {showSuccessModal && generatedPdf && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 text-center">
            <div className="h-16 w-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-success-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">PDF Generated!</h3>
            <p className="text-gray-500 mb-6">
              {incidentId ? 'Linked to the incident as RTW certificate.' : 'Your filled PDF is ready.'}
            </p>
            <div className="space-y-3">
              <Button onClick={handleDownload} className="w-full" leftIcon={<Download className="h-4 w-4" />}>
                Download Filled PDF
              </Button>
              {incidentId ? (
                <Link to={`/incidents/${incidentId}`} className="block">
                  <Button variant="secondary" className="w-full">Go to Incident</Button>
                </Link>
              ) : (
                <Button variant="secondary" className="w-full" onClick={() => {
                  setShowSuccessModal(false);
                  setGeneratedPdf(null);
                }}>
                  Fill Another Form
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
