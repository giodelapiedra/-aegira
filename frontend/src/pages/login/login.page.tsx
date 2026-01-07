import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import { Mail, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoggingIn, loginError } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  const features = [
    'Real-time personnel readiness tracking',
    'AI-powered health insights',
    'Streamlined approval workflows',
    'Comprehensive analytics dashboard',
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1920&q=80')`
          }}
        />

        {/* Dark Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 via-primary-800/85 to-primary-900/95" />
        <div className="absolute inset-0 bg-black/30" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 drop-shadow-lg">
          {/* Logo */}
          <div className="mb-12">
            <Logo
              size="lg"
              showText
              textVariant="short"
              className="filter brightness-0 invert"
              containerClassName="items-center"
            />
          </div>

          {/* Hero Text */}
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6 [text-shadow:_0_2px_10px_rgba(0,0,0,0.3)]">
            Personnel Readiness
            <br />
            <span className="text-primary-200">Management System</span>
          </h1>

          <p className="text-lg text-white/90 mb-10 max-w-md [text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
            Empower your organization with real-time insights into team readiness,
            health tracking, and streamlined operations.
          </p>

          {/* Features List */}
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-white/90 [text-shadow:_0_1px_2px_rgba(0,0,0,0.2)]"
              >
                <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="flex gap-12 mt-16">
            <div className="[text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
              <p className="text-3xl font-bold text-white">99.9%</p>
              <p className="text-white/70 text-sm">Uptime</p>
            </div>
            <div className="[text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
              <p className="text-3xl font-bold text-white">50K+</p>
              <p className="text-white/70 text-sm">Personnel Tracked</p>
            </div>
            <div className="[text-shadow:_0_1px_3px_rgba(0,0,0,0.3)]">
              <p className="text-3xl font-bold text-white">24/7</p>
              <p className="text-white/70 text-sm">Support</p>
            </div>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-900/50 to-transparent" />
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center p-6 sm:p-12 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Logo
              size="lg"
              showText
              textVariant="short"
              containerClassName="justify-center mb-4"
            />
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Welcome back
            </h2>
            <p className="text-gray-500 mt-2">
              Enter your credentials to access your account
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
              <span className="px-4 bg-gray-50 text-gray-500">
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

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-8">
            &copy; {new Date().getFullYear()} Aegira. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
