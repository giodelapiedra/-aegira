import { useNavigate } from 'react-router-dom';
import { Home, RefreshCw, Bug } from 'lucide-react';
import { Button } from '../ui/Button';
import { ErrorIllustration } from './ErrorIllustration';

interface ErrorFallbackProps {
  error?: Error | null;
  onReset?: () => void;
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const navigate = useNavigate();

  const handleRefresh = () => {
    if (onReset) {
      onReset();
    }
    window.location.reload();
  };

  const handleGoHome = () => {
    if (onReset) {
      onReset();
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Illustration */}
        <div className="flex justify-center mb-8">
          <ErrorIllustration type="error" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Something Went Wrong
        </h2>

        {/* Description */}
        <p className="text-gray-500 mb-6 leading-relaxed">
          An unexpected error occurred. Don't worry, our team has been notified.
          Please try refreshing the page or go back to home.
        </p>

        {/* Error details (development only) */}
        {error && import.meta.env.DEV && (
          <div className="mb-6 p-4 bg-gray-100 rounded-lg text-left">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Bug className="h-4 w-4" />
              Error Details
            </div>
            <p className="text-xs text-gray-600 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={handleRefresh}
          >
            Refresh Page
          </Button>
          <Button
            variant="secondary"
            size="lg"
            leftIcon={<Home className="h-4 w-4" />}
            onClick={handleGoHome}
          >
            Go to Home
          </Button>
        </div>

        {/* Help text */}
        <p className="mt-8 text-sm text-gray-400">
          If the problem persists, please contact support.
        </p>
      </div>
    </div>
  );
}
