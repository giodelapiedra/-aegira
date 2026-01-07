import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import {
  MousePointer,
  Trash2,
  Save,
  ArrowLeft,
  CheckSquare,
  Type,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pdfTemplateService } from '../../services/pdf-template.service';

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

// Set worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface FieldMarker extends TemplateField {
  id: string;
}

const fieldTypes = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'date', label: 'Date', icon: Calendar },
];

export function TemplateBuilderPage() {
  const navigate = useNavigate();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [markers, setMarkers] = useState<FieldMarker[]>([]);
  const [selectedType, setSelectedType] = useState<'text' | 'checkbox' | 'date'>('text');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateCategory, setTemplateCategory] = useState('RTW Certificate');
  const [isSaving, setIsSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pageScale] = useState(1);

  const pageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }

    setPdfFile(file);
    setPdfLoading(true);
    setMarkers([]);
    setCurrentPage(1);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setPdfBase64(base64);
    };
    reader.readAsDataURL(file);

    if (!templateName) {
      setTemplateName(file.name.replace('.pdf', ''));
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
    setPageSizes(new Array(numPages).fill({ width: 0, height: 0 }));
  };

  const onPageLoadSuccess = (page: any) => {
    const { width, height } = page;
    setPageSizes((prev) => {
      const newSizes = [...prev];
      newSizes[currentPage - 1] = { width, height };
      return newSizes;
    });
  };

  const getMousePos = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pageRef.current) return { x: 0, y: 0 };
    const rect = pageRef.current.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - rect.left) / pageScale),
      y: Math.round((e.clientY - rect.top) / pageScale),
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pdfFile) return;
    const pos = getMousePos(e);
    setIsDrawing(true);
    setDrawStart(pos);
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !drawStart) return;
    const pos = getMousePos(e);
    setCurrentRect({
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      width: Math.abs(pos.x - drawStart.x),
      height: Math.abs(pos.y - drawStart.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect) return;
    setIsDrawing(false);

    if (currentRect.width > 5 && currentRect.height > 5) {
      const name = fieldName || `Field ${markers.length + 1}`;
      const newMarker: FieldMarker = {
        id: Date.now().toString(),
        name,
        type: selectedType,
        page: currentPage,
        x: currentRect.x,
        y: currentRect.y,
        width: currentRect.width,
        height: currentRect.height,
      };
      setMarkers([...markers, newMarker]);
      setFieldName('');
      toast.success(`Added: ${name}`);
    }

    setDrawStart(null);
    setCurrentRect(null);
  };

  const removeMarker = (id: string) => {
    setMarkers(markers.filter((m) => m.id !== id));
  };

  const handleSaveTemplate = async () => {
    if (!pdfFile || !pdfBase64) {
      toast.error('Please upload a PDF first');
      return;
    }

    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    if (markers.length === 0) {
      toast.error('Please add at least one field');
      return;
    }

    setIsSaving(true);

    try {
      const fields: TemplateField[] = markers.map(({ id, ...rest }) => rest);

      // Debug: check what we're sending
      console.log('Saving template:', {
        name: templateName.trim(),
        category: templateCategory,
        pdfBase64Length: pdfBase64?.length || 0,
        fieldsCount: fields.length,
        pageSizesCount: pageSizes.length,
      });

      if (!pdfBase64) {
        toast.error('PDF not loaded. Please re-upload the PDF file.');
        setIsSaving(false);
        return;
      }

      await pdfTemplateService.createTemplateWithFields({
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        category: templateCategory,
        pdfBase64,
        fileName: pdfFile.name,
        fields,
        pageSizes,
      });

      toast.success('Template saved successfully!');
      navigate('/admin/templates');
    } catch (error: any) {
      console.error('Failed to save template:', error);
      const errorMessage = error.response?.data?.error || 'Failed to save template';
      console.error('Server error:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const currentPageMarkers = markers.filter((m) => m.page === currentPage);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <Link to="/admin/templates">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MousePointer className="h-5 w-5 text-primary-600" />
              Template Builder
            </h1>
            <p className="text-sm text-gray-500">Upload PDF, mark fields, save template for WHS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pdfFile && markers.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveTemplate}
              disabled={isSaving}
              leftIcon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            >
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* PDF Canvas */}
        <div className="flex-1 bg-gray-100 overflow-auto p-4 flex flex-col">
          {!pdfFile ? (
            <div className="flex-1 flex items-center justify-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="max-w-md w-full border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition-colors"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload PDF Template</h3>
                <p className="text-sm text-gray-500">Select the PDF form you want to use as a template</p>
              </div>
            </div>
          ) : (
            <>
              {/* Page Navigation */}
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

              {/* PDF Page */}
              <div className="flex-1 flex justify-center overflow-auto">
                <div
                  ref={pageRef}
                  className="relative cursor-crosshair select-none"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {pdfLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white">
                      <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                    </div>
                  )}

                  <Document
                    file={`data:application/pdf;base64,${pdfBase64}`}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading=""
                  >
                    <Page
                      pageNumber={currentPage}
                      onLoadSuccess={onPageLoadSuccess}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      scale={pageScale}
                      className="shadow-xl"
                    />
                  </Document>

                  {/* Field markers */}
                  {currentPageMarkers.map((marker) => (
                    <div
                      key={marker.id}
                      className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
                      style={{
                        left: marker.x * pageScale,
                        top: marker.y * pageScale,
                        width: marker.width * pageScale,
                        height: marker.height * pageScale,
                      }}
                    >
                      <span className="absolute -top-5 left-0 text-xs bg-blue-500 text-white px-1 rounded whitespace-nowrap">
                        {marker.name}
                      </span>
                    </div>
                  ))}

                  {/* Current drawing */}
                  {currentRect && (
                    <div
                      className="absolute border-2 border-status-green-500 bg-status-green-500/20 pointer-events-none"
                      style={{
                        left: currentRect.x * pageScale,
                        top: currentRect.y * pageScale,
                        width: currentRect.width * pageScale,
                        height: currentRect.height * pageScale,
                      }}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 border-l bg-white flex flex-col">
          {/* Template Info */}
          <div className="p-4 border-b space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., RTW Certificate"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <Input
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                placeholder="e.g., RTW Certificate"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Input
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Field Input */}
          <div className="p-4 border-b space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
              <Input
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="e.g., Worker Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
              <div className="flex gap-2">
                {fieldTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value as any)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg border text-sm transition-colors ${
                      selectedType === type.value
                        ? 'bg-primary-50 border-primary-500 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <type.icon className="h-4 w-4" />
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400">Draw a box on the PDF to add a field</p>
          </div>

          {/* Markers List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="font-medium text-gray-900 mb-3">Fields ({markers.length})</h3>
            {markers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No fields added yet.</p>
            ) : (
              <div className="space-y-2">
                {markers.map((marker) => (
                  <div
                    key={marker.id}
                    onClick={() => setCurrentPage(marker.page)}
                    className={`p-3 rounded-lg border cursor-pointer ${
                      marker.page === currentPage
                        ? 'bg-primary-50 border-primary-200'
                        : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 text-sm">{marker.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMarker(marker.id);
                        }}
                        className="text-gray-400 hover:text-status-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      Page {marker.page} | {marker.type}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
