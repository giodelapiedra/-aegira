import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import {
  FileText,
  Trash2,
  AlertTriangle,
  Eye,
  Pencil,
  CheckSquare,
  List,
  Calendar,
  Type,
  Hash,
} from 'lucide-react';
import { pdfTemplateService, type PDFTemplate, type DetectedField } from '../../services/pdf-template.service';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { cn } from '../../lib/utils';

const fieldTypeIcons: Record<string, any> = {
  text: Type,
  checkbox: CheckSquare,
  dropdown: List,
  radio: Hash,
  date: Calendar,
  signature: Pencil,
};

export function TemplatesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showFieldsModal, setShowFieldsModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PDFTemplate | null>(null);

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['pdf-templates'],
    queryFn: () => pdfTemplateService.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pdfTemplateService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf-templates'] });
      toast.success('Template Deleted', 'The template has been removed.');
    },
    onError: () => {
      toast.error('Delete Failed', 'Could not delete template.');
    },
  });

  const parseFields = (fieldsJson: string): DetectedField[] => {
    try {
      const parsed = JSON.parse(fieldsJson);
      return parsed.fields || parsed || [];
    } catch {
      return [];
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'RTW':
      case 'RTW Certificate':
        return 'bg-success-50 text-success-700';
      case 'MEDICAL':
        return 'bg-primary-50 text-primary-700';
      case 'SAFETY':
        return 'bg-warning-50 text-warning-700';
      case 'COMPLIANCE':
        return 'bg-info-50 text-info-700';
      default:
        return 'bg-gray-50 text-gray-600';
    }
  };

  const openFieldsModal = (template: PDFTemplate) => {
    setSelectedTemplate(template);
    setShowFieldsModal(true);
  };

  const closeFieldsModal = () => {
    setShowFieldsModal(false);
    setSelectedTemplate(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-10 w-10 text-danger-500 mx-auto mb-3" />
        <p className="text-gray-500">Failed to load templates</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary-600" />
            PDF Templates
          </h1>
          <p className="text-gray-500 mt-1">
            Manage PDF templates for WHS to fill
          </p>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates && templates.length > 0 ? (
          templates.map((template) => {
            const fields = parseFields(template.fields);
            return (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{template.name}</h3>
                        {template.category && (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full', getCategoryColor(template.category))}>
                            {template.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>
                  )}

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Fields</span>
                      <span className="font-medium text-gray-900">{fields.length} fields</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Pages</span>
                      <span className="font-medium text-gray-900">{template.pageCount}</span>
                    </div>
                    {template._count && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Times Used</span>
                        <span className="font-medium text-gray-900">{template._count.filledForms}</span>
                      </div>
                    )}
                  </div>

                  {/* Field Type Summary */}
                  {fields.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {Object.entries(
                        fields.reduce((acc, f) => {
                          acc[f.type] = (acc[f.type] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([type, count]) => {
                        const Icon = fieldTypeIcons[type] || Type;
                        return (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                          >
                            <Icon className="h-3 w-3" />
                            {count} {type}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => openFieldsModal(template)}
                      leftIcon={<Eye className="h-4 w-4" />}
                    >
                      View Fields
                    </Button>
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this template?')) {
                          deleteMutation.mutate(template.id);
                        }
                      }}
                      className="p-2 hover:bg-danger-50 text-gray-400 hover:text-danger-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Yet</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  PDF templates that WHS users can fill out for return-to-work certificates and other forms will appear here.
                </p>
                <p className="text-sm text-gray-400">
                  Use the Template Builder to create new templates.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* View Fields Modal */}
      {showFieldsModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedTemplate.name}</h3>
                <p className="text-sm text-gray-500">Template Fields</p>
              </div>
              <button
                onClick={closeFieldsModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {parseFields(selectedTemplate.fields).length > 0 ? (
                parseFields(selectedTemplate.fields).map((field, index) => {
                  const Icon = fieldTypeIcons[field.type] || Type;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                          <Icon className="h-4 w-4 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{field.name}</p>
                          <p className="text-xs text-gray-500">
                            Type: {field.type} | Page: {field.page}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-10 w-10 text-warning-500 mx-auto mb-3" />
                  <p className="text-gray-500">No fields defined for this template</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
              <Button variant="secondary" className="flex-1" onClick={closeFieldsModal}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
