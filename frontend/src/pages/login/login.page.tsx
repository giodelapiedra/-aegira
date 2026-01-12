import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

const LOGIN_BG_IMAGE = 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1920&q=80';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoggingIn, loginError } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden relative h-48 sm:h-56 overflow-hidden">
        <img
          src={LOGIN_BG_IMAGE}
          alt="Team collaborating"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/60" />
        <div className="relative z-10 h-full flex flex-col justify-between p-6">
          <Logo
            size="md"
            showText
            textVariant="short"
            className="filter brightness-0 invert drop-shadow-lg"
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">
              Your team's readiness starts here
            </h1>
          </div>
        </div>
      </div>

      {/* Desktop Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={LOGIN_BG_IMAGE}
          alt="Team collaborating"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14">
          <Logo
            size="lg"
            showText
            textVariant="short"
            className="filter brightness-0 invert drop-shadow-lg"
          />

          <div className="backdrop-blur-xl bg-black/30 border border-white/10 rounded-2xl p-6 xl:p-8 transform transition-all duration-300 hover:bg-black/40">
            <h1 className="text-2xl xl:text-3xl font-bold text-white leading-tight mb-2">
              Your team's readiness starts here
            </h1>
            <p className="text-white/70 text-sm xl:text-base">
              Track daily check-ins, monitor attendance, and keep your workforce prepared.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side / Main Content - Login Form */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="w-full max-w-md animate-fade-in">
          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-6 sm:p-8 lg:shadow-none lg:bg-transparent lg:p-0">
            {/* Form Header */}
            <div className="mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Welcome back
              </h2>
              <p className="text-gray-500 mt-2">
                Sign in to continue to your dashboard
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 animate-slide-down">
                <p className="text-sm text-danger-600">
                  {(loginError as any)?.response?.data?.error || 'Invalid email or password'}
                </p>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                leftIcon={<Mail className="h-5 w-5" />}
                required
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                leftIcon={<Lock className="h-5 w-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                }
                required
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 transition-colors"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    Remember me
                  </span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoggingIn}
              >
                Sign In
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white lg:bg-transparent text-gray-500">
                  New to Aegira?
                </span>
              </div>
            </div>

            {/* Sign Up Link */}
            <Link to="/register">
              <Button variant="secondary" className="w-full" size="lg">
                Create an Account
              </Button>
            </Link>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-8">
            &copy; {new Date().getFullYear()} Aegira. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
