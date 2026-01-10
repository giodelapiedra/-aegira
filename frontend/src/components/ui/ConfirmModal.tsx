import { Trash2, UserMinus, LogOut, X, HelpCircle, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/utils';

export type ConfirmModalType = 'danger' | 'warning' | 'info' | 'success';
export type ConfirmModalAction = 'delete' | 'remove' | 'logout' | 'approve' | 'custom';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmModalType;
  action?: ConfirmModalAction;
  isLoading?: boolean;
}

const typeStyles: Record<ConfirmModalType, { bg: string; iconBg: string; iconColor: string }> = {
  danger: {
    bg: 'bg-danger-100',
    iconBg: 'bg-danger-100',
    iconColor: 'text-danger-600',
  },
  warning: {
    bg: 'bg-warning-100',
    iconBg: 'bg-warning-100',
    iconColor: 'text-warning-600',
  },
  info: {
    bg: 'bg-primary-100',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
  },
  success: {
    bg: 'bg-success-100',
    iconBg: 'bg-success-100',
    iconColor: 'text-success-600',
  },
};

const actionIcons: Record<ConfirmModalAction, typeof Trash2> = {
  delete: Trash2,
  remove: UserMinus,
  logout: LogOut,
  approve: CheckCircle,
  custom: HelpCircle,
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  action = 'custom',
  isLoading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const styles = typeStyles[type];
  const Icon = actionIcons[action];

  const handleConfirm = () => {
    onConfirm();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>

        {/* Icon */}
        <div className="text-center mb-6">
          <div
            className={cn(
              'h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4',
              styles.iconBg
            )}
          >
            <Icon className={cn('h-8 w-8', styles.iconColor)} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="text-sm text-gray-500 mt-2">{message}</div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={type === 'danger' ? 'danger' : type === 'success' ? 'success' : 'primary'}
            className="flex-1"
            onClick={handleConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
