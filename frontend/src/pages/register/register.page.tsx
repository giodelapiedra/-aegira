import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import { Mail, Lock, Eye, EyeOff, User, Users, ArrowRight, Building2, Globe } from 'lucide-react';
import { TIMEZONE_GROUPS } from '../../constants/timezones';
import aegiraImage from '../../assets/aegira2.png';

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

    // Clear password error when typing
    if (name === 'password' || name === 'confirmPassword') {
      setPasswordError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    // Validate password strength
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

  const testimonials = [
    {
      quote: "Aegira transformed how we manage our team's readiness. The insights are invaluable.",
      author: 'Sarah Chen',
      role: 'Operations Director',
    },
    {
      quote: "Real-time tracking has improved our response times significantly.",
      author: 'Michael Torres',
      role: 'Team Lead',
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          {/* Mobile Image */}
          <div className="lg:hidden mb-8">
            <div className="relative rounded-2xl overflow-hidden shadow-xl">
              <img
                src={aegiraImage}
                alt="Aegira"
                className="w-full h-48 object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary-900/60 to-transparent" />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                <Logo
                  size="md"
                  showText
                  textVariant="short"
                  className="filter brightness-0 invert drop-shadow-lg"
                  containerClassName="justify-center"
                />
              </div>
            </div>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Create your account
            </h2>
            <p className="text-gray-500 mt-2">
              Join thousands of teams already using Aegira
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
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Company Timezone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Globe className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  name="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white text-gray-900"
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
              </div>
              <p className="mt-1.5 text-sm text-gray-500">
                This cannot be changed later. Choose your company's operating timezone.
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
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
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
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              }
              required
            />

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                required
                className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
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
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">
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

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-8">
            &copy; {new Date().getFullYear()} Aegira. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Side - Image/Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img
            src={aegiraImage}
            alt="Aegira"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/80 via-primary-800/70 to-primary-900/80" />
        </div>

        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-grid-pattern" />
        </div>

        {/* Decorative elements */}
        <div className="absolute top-40 right-20 w-64 h-64 bg-primary-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Logo */}
          <div className="mb-12">
            <Logo
              size="lg"
              showText
              textVariant="short"
              className="filter brightness-0 invert drop-shadow-lg"
              containerClassName="items-center"
            />
          </div>

          {/* Hero Text */}
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            Start Your Journey
            <br />
            <span className="text-primary-200">With Aegira Today</span>
          </h1>

          <p className="text-lg text-primary-100 mb-12 max-w-md">
            Join organizations worldwide that trust Aegira to manage their
            personnel readiness and optimize team performance.
          </p>

          {/* Testimonials */}
          <div className="space-y-6">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10"
              >
                <p className="text-primary-100 italic mb-4">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary-500/30 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{testimonial.author}</p>
                    <p className="text-sm text-primary-200">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust Badge */}
          <div className="mt-12 flex items-center gap-4 text-primary-200">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full bg-primary-500/30 border-2 border-primary-800 flex items-center justify-center text-xs text-white font-medium"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <span className="text-sm">
              Trusted by <span className="text-white font-medium">2,000+</span> organizations
            </span>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-900/50 to-transparent" />
      </div>
    </div>
  );
}
