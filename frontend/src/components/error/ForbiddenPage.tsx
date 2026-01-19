import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, ShieldX } from 'lucide-react';
import { Button } from '../ui/Button';
import { ErrorIllustration } from './ErrorIllustration';

interface ForbiddenPageProps {
  message?: string;
}

export function ForbiddenPage({ message }: ForbiddenPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Illustration */}
        <div className="flex justify-center mb-8">
          <ErrorIllustration type="403" />
        </div>

        {/* Error Code */}
        <h1 className="text-7xl font-bold text-danger-200 mb-2">403</h1>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-3">
          Access Denied
        </h2>

        {/* Description */}
        <p className="text-gray-500 mb-8 leading-relaxed">
          {message || "You don't have permission to access this page. Please contact your administrator if you believe this is an error."}
        </p>

        {/* Role indicator */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-danger-50 text-danger-700 rounded-full text-sm font-medium mb-8">
          <ShieldX className="h-4 w-4" />
          Insufficient Permissions
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            leftIcon={<Home className="h-4 w-4" />}
            onClick={() => navigate('/')}
          >
            Go to Home
          </Button>
          <Button
            variant="secondary"
            size="lg"
            leftIcon={<ArrowLeft className="h-4 w-4" />}
            onClick={() => navigate(-1)}
          >
            Go Back
          </Button>
        </div>

        {/* Help text */}
        <p className="mt-8 text-sm text-gray-400">
          Need access? Contact your team leader or administrator.
        </p>
      </div>
    </div>
  );
}
