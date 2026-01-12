import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Building2, ChevronDown } from 'lucide-react';
import { TIMEZONE_GROUPS } from '../../constants/timezones';

const REGISTER_BG_IMAGE = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1920&q=80';

export function RegisterPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    companyName: '',
    timezone: 'Asia/Manila',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const { register, isRegistering, registerError } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'password' || name === 'confirmPassword') {
      setPasswordError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      companyName: formData.companyName,
      timezone: formData.timezone,
      password: formData.password,
    });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden relative h-40 sm:h-48 overflow-hidden flex-shrink-0">
        <img
          src={REGISTER_BG_IMAGE}
          alt="Professional team meeting"
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
              Build a ready workforce today
            </h1>
          </div>
        </div>
      </div>

      {/* Desktop Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={REGISTER_BG_IMAGE}
          alt="Professional team meeting"
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
              Build a ready workforce today
            </h1>
            <p className="text-white/70 text-sm xl:text-base">
              Streamline attendance, manage exceptions, and keep operations running smoothly.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side / Main Content - Register Form */}
      <div className="flex-1 lg:w-1/2 flex items-start lg:items-center justify-center p-6 sm:p-8 lg:p-12 bg-gradient-to-br from-gray-50 via-white to-gray-100 overflow-y-auto">
        <div className="w-full max-w-md py-4 lg:py-0 animate-fade-in">
          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-6 sm:p-8 lg:shadow-none lg:bg-transparent lg:p-0">
            {/* Form Header */}
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Create your account
              </h2>
              <p className="text-gray-500 mt-2">
                Get started with your organization
              </p>
            </div>

            {/* Error Message */}
            {(registerError || passwordError) && (
              <div className="mb-6 p-4 rounded-xl bg-danger-50 border border-danger-200 animate-slide-down">
                <p className="text-sm text-danger-600">
                  {passwordError || (registerError as any)?.response?.data?.error || 'Registration failed. Please try again.'}
                </p>
              </div>
            )}

            {/* Register Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Input
                  label="First Name"
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="John"
                  leftIcon={<User className="h-5 w-5" />}
                  required
                />
                <Input
                  label="Last Name"
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Doe"
                  required
                />
              </div>

              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="john@company.com"
                leftIcon={<Mail className="h-5 w-5" />}
                required
              />

              <Input
                label="Company Name"
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="Acme Corporation"
                leftIcon={<Building2 className="h-5 w-5" />}
                helperText="You'll be the company Executive (owner)"
                required
              />

              {/* Custom Timezone Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Company Timezone
                </label>
                <div className="relative">
                  <select
                    name="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full h-11 pl-4 pr-10 border border-gray-300 rounded-xl bg-white text-gray-900 appearance-none cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                    required
                  >
                    {TIMEZONE_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label} ({tz.offset})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
                <p className="mt-1.5 text-sm text-gray-500">
                  Used for attendance tracking and reports
                </p>
              </div>

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password"
                leftIcon={<Lock className="h-5 w-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
                helperText="Must be at least 8 characters"
                required
              />

              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                leftIcon={<Lock className="h-5 w-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                }
                required
              />

              <div className="flex items-start gap-3 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  required
                  className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 transition-colors"
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  I agree to the{' '}
                  <Link to="/terms" className="text-primary-600 hover:text-primary-700 font-medium">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-primary-600 hover:text-primary-700 font-medium">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isRegistering}
                rightIcon={<ArrowRight className="h-5 w-5" />}
              >
                Create Account
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white lg:bg-transparent text-gray-500">
                  Already have an account?
                </span>
              </div>
            </div>

            {/* Sign In Link */}
            <Link to="/login">
              <Button variant="secondary" className="w-full" size="lg">
                Sign In Instead
              </Button>
            </Link>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-6">
            &copy; {new Date().getFullYear()} Aegira. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
