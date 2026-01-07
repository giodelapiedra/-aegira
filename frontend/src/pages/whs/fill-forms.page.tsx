import { useState, useEffect, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  FileText,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  Link as LinkIcon,
  CheckCircle,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pdfTemplateService } from '../../services/pdf-template.service';
import api from '../../services/api';

interface PageSize {
  width: number;
  height: number;
}

interface TemplateField {
  name: string;
  type: 'text' | 'checkbox' | 'date';
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}

interface PDFTemplate {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  category?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  fields: string;
  pageCount: number;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface IncidentOption {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  reporter: { firstName: string; lastName: string };
}

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function FillFormsPage() {
  const [templates, setTemplates] = useState<PDFTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PDFTemplate | null>(null);
  const [incidents, setIncidents] = useState<IncidentOption[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<string>('');
  const [incidentSearch, setIncidentSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pdfBase64, setPdfBase64] = useState('');
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [pageScale] = useState(1);

  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await pdfTemplateService.getAll();
      console.log('Loaded templates from API:', data);
      console.log('Number of templates:', data?.length || 0);
      console.log('Templates details:', data?.map(t => ({ id: t.id, name: t.name, isActive: t.isActive, companyId: t.companyId })));
      // API already filters by isActive: true, no need to filter again
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Failed to load templates:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error(error.response?.data?.error || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = async (template: PDFTemplate) => {
    setSelectedTemplate(template);
    setPdfLoading(true);
    setGeneratedUrl(null);
    setValues({});
    setCurrentPage(1);

    try {
      // Parse fields from template
      const fieldsData = JSON.parse(template.fields || '{}');
      setFields(fieldsData.fields || []);
      setPageSizes(fieldsData.pageSizes || []);

      // Always use backend proxy to avoid CORS issues
      console.log('Fetching PDF via proxy for template:', template.id);
      const proxyResponse = await api.get(`/pdf-templates/${template.id}/file`, {
        responseType: 'blob',
      });
      const blob = proxyResponse.data;

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setPdfBase64(base64);
      };
      reader.readAsDataURL(blob);

      // Load incidents for linking
      const incidentData = await pdfTemplateService.getIncidentsForTemplate(template.id);
      setIncidents(incidentData);
    } catch (error) {
      console.error('Failed to load template:', error);
      toast.error('Failed to load template');
      setSelectedTemplate(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleValueChange = (fieldName: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    // Check required fields
    const hasValues = Object.keys(values).some((k) => values[k]);
    if (!hasValues) {
      toast.error('Please fill in at least one field');
      return;
    }

    setGenerating(true);

    try {
      const result = await pdfTemplateService.generateFilledPDF(selectedTemplate.id, {
        values,
        incidentId: selectedIncident || undefined,
      });

      setGeneratedUrl(result.generatedUrl);

      if (selectedIncident) {
        const linkedCase = incidents.find((i) => i.id === selectedIncident);
        toast.success(`PDF generated and linked to case ${linkedCase?.caseNumber || ''}!`);
      } else {
        toast.success('PDF generated successfully!');
      }

      // Download the PDF
      pdfTemplateService.downloadPDF(result.pdfBase64, `${selectedTemplate.name}_filled.pdf`);
    } catch (error: any) {
      console.error('Failed to generate PDF:', error);
      toast.error(error.response?.data?.error || 'Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  const goBack = () => {
    setSelectedTemplate(null);
    setPdfBase64('');
    setFields([]);
    setValues({});
    setSelectedIncident('');
    setGeneratedUrl(null);
  };

  const filteredIncidents = incidents.filter(
    (i) =>
      i.caseNumber.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      i.title.toLowerCase().includes(incidentSearch.toLowerCase()) ||
      `${i.reporter.firstName} ${i.reporter.lastName}`.toLowerCase().includes(incidentSearch.toLowerCase())
  );

  const currentPageFields = fields.filter((f) => f.page === currentPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Template Selection View
  if (!selectedTemplate) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Fill Forms</h1>
        <p className="text-gray-500 mb-6">Select a template to fill out</p>

        {templates.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Available</h3>
            <p className="text-gray-500">Ask an administrator to create templates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => selectTemplate(template)}
                className="p-4 bg-white border rounded-xl cursor-pointer hover:border-primary-400 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <FileText className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{template.name}</h3>
                    {template.category && (
                      <span className="inline-block text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1">
                        {template.category}
                      </span>
                    )}
                    {template.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">{template.pageCount} page(s)</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Form Filling View
  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={goBack} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back
          </Button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{selectedTemplate.name}</h1>
            <p className="text-sm text-gray-500">Fill in the fields and generate PDF</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {generatedUrl && (
            <div className="flex items-center gap-2 text-status-green-600 text-sm mr-4">
              <CheckCircle className="h-4 w-4" />
              PDF Generated
            </div>
          )}
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={generating}
            leftIcon={generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          >
            {generating ? 'Generating...' : 'Generate & Download'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* PDF Preview */}
        <div className="flex-1 bg-gray-100 overflow-auto p-4 flex flex-col">
          {pdfLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : (
            <>
              {/* Page Navigation */}
              {numPages > 1 && (
                <div className="flex items-center justify-center gap-2 mb-4 bg-white rounded-lg p-2 shadow-sm w-fit mx-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium px-3">
                    Page {currentPage} of {numPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    disabled={currentPage === numPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* PDF with overlay inputs */}
              <div className="flex-1 flex justify-center overflow-auto">
                <div ref={pageRef} className="relative">
                  <Document
                    file={`data:application/pdf;base64,${pdfBase64}`}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading=""
                  >
                    <Page
                      pageNumber={currentPage}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      scale={pageScale}
                      className="shadow-xl"
                    />
                  </Document>

                  {/* Overlay inputs */}
                  {currentPageFields.map((field) => (
                    <div
                      key={field.name}
                      className="absolute"
                      style={{
                        left: field.x * pageScale,
                        top: field.y * pageScale,
                        width: field.width * pageScale,
                        height: field.height * pageScale,
                      }}
                    >
                      {field.type === 'checkbox' ? (
                        <label className="flex items-center justify-center w-full h-full cursor-pointer">
                          <input
                            type="checkbox"
                            checked={values[field.name] === true}
                            onChange={(e) => handleValueChange(field.name, e.target.checked)}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                          />
                        </label>
                      ) : (
                        <input
                          type={field.type === 'date' ? 'date' : 'text'}
                          value={values[field.name] || ''}
                          onChange={(e) => handleValueChange(field.name, e.target.value)}
                          placeholder={field.name}
                          className="w-full h-full px-1 text-sm bg-status-yellow-50/80 border border-status-yellow-300 focus:bg-status-yellow-50 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                          style={{ fontSize: Math.min(field.height * 0.6, 14) }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar - Incident Linking */}
        <div className="w-80 flex-shrink-0 border-l bg-white flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-medium text-gray-900 mb-1 flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Link to Case (Optional)
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Select a case to automatically attach the generated PDF
            </p>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                placeholder="Search cases..."
                className="pl-9"
              />
            </div>

            {selectedIncident && (
              <div className="mb-3 p-2 bg-primary-50 border border-primary-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary-700">
                    {incidents.find((i) => i.id === selectedIncident)?.caseNumber}
                  </span>
                  <button
                    onClick={() => setSelectedIncident('')}
                    className="text-primary-600 text-xs hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {filteredIncidents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No cases needing RTW certificate</p>
            ) : (
              <div className="space-y-2">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    onClick={() => setSelectedIncident(incident.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedIncident === incident.id
                        ? 'bg-primary-50 border-primary-300'
                        : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 text-sm">{incident.caseNumber}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-status-yellow-100 text-status-yellow-700">
                        {incident.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1">{incident.title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {incident.reporter.firstName} {incident.reporter.lastName}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fields Summary */}
          <div className="p-4 border-t bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Fields Summary</h4>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Total fields: {fields.length}</div>
              <div>Filled: {Object.keys(values).filter((k) => values[k]).length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
