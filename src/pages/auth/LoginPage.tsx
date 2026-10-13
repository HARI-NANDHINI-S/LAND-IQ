import { useState, useEffect } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  UserPlus,
  LogIn,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  MapPin,
  Landmark,
} from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { geoService } from '@/services/geographic/geoService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DocumentBoyIllustration } from '@/components/auth/DocumentBoyIllustration';

// --- ZOD SCHEMAS ---
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    state_id: z.string().optional(),
    district_id: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function LoginPage() {
  const { user, loading: authLoading, signIn, signUp, resetPassword, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>(location.pathname === '/register' ? 'signup' : 'signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Geographic state for dependent dropdowns during registration
  const [states, setStates] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [districts, setDistricts] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  const routeError = (location.state as { authError?: string } | null)?.authError;
  const visibleError = serverError || routeError || authError;

  // --- FORM HOOKS ---
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      state_id: '',
      district_id: '',
      password: '',
      confirm_password: '',
    },
  });

  const forgotForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  // Load States on mount
  useEffect(() => {
    let isMounted = true;
    geoService
      .getStates()
      .then((data) => {
        if (isMounted) setStates(data);
      })
      .catch((err) => {
        console.warn('Failed to load geographic states', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Load Districts when state changes
  useEffect(() => {
    if (!selectedStateId) {
      setDistricts([]);
      return;
    }
    setLoadingDistricts(true);
    geoService
      .getDistricts(selectedStateId)
      .then((data) => {
        setDistricts(data);
      })
      .catch((err) => {
        console.warn('Failed to load districts', err);
      })
      .finally(() => {
        setLoadingDistricts(false);
      });
  }, [selectedStateId]);

  // If already authenticated, redirect
  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  // --- SUBMISSIONS ---
  const onLoginSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      await signIn(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setServerError(err.message || 'Failed to sign in. Please check your credentials.');
    }
  };

  const onRegisterSubmit = async (data: RegisterFormValues) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      await signUp(data.email, data.password, {
        full_name: data.full_name,
        state_id: data.state_id,
        district_id: data.district_id,
      });
      setSuccessMessage(
        'Account created successfully! Your customer profile has been initialized. You may now sign in.',
      );
      setMode('signin');
      loginForm.setValue('email', data.email);
    } catch (err: any) {
      setServerError(err.message || 'Registration failed. Please check the entered information.');
    }
  };

  const onForgotSubmit = async (data: ForgotPasswordFormValues) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      await resetPassword(data.email);
      setSuccessMessage('Password recovery link sent! Please check your email inbox.');
    } catch (err: any) {
      setServerError(err.message || 'Unable to process password reset request.');
    }
  };

  // Password strength helper
  const watchPassword = registerForm.watch('password');
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };
  const pwdStrength = getPasswordStrength(watchPassword || '');

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-muted/30 to-background flex flex-col justify-center items-center px-4 py-8 lg:px-8">
      {/* Brand Header */}
      <div className="w-full max-w-5xl mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-600 to-primary text-white shadow-lg shadow-primary/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-foreground">LAND-IQ</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                v2.0
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              National Land Record Digitization & Intelligence Platform
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <Landmark className="h-4 w-4 text-primary" />
          <span>Govt of India Land Governance Standards</span>
        </div>
      </div>

      {/* Main Dual-Column Container */}
      <div className="w-full max-w-5xl bg-card/80 backdrop-blur-xl border border-border/60 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* LEFT COLUMN: Animated Document Boy Carrying Box */}
        <div className="lg:col-span-6 bg-gradient-to-b from-primary/5 via-amber-500/5 to-primary/10 p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-border/40 relative">
          <div className="space-y-2 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/80 border border-primary/20 text-xs font-semibold text-primary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Digital Land Archives
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Official Land Deeds at Your Fingertips
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Carrying, digitizing, and safeguarding millions of cadastral land parcels across 36
              States & Union Territories with OCR & anomaly intelligence.
            </p>
          </div>

          {/* Central Animated Illustration */}
          <div className="my-auto py-4">
            <DocumentBoyIllustration
              isRegisteredSuccess={Boolean(successMessage && mode === 'signin')}
            />
          </div>

          {/* Bottom Feature Badges */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border/40 text-center">
            <div className="p-2 rounded-xl bg-background/50 border border-border/30">
              <p className="text-base font-bold text-foreground">36</p>
              <p className="text-[11px] text-muted-foreground font-medium">States & UTs</p>
            </div>
            <div className="p-2 rounded-xl bg-background/50 border border-border/30">
              <p className="text-base font-bold text-foreground">780+</p>
              <p className="text-[11px] text-muted-foreground font-medium">Districts</p>
            </div>
            <div className="p-2 rounded-xl bg-background/50 border border-border/30">
              <p className="text-base font-bold text-foreground">9 Roles</p>
              <p className="text-[11px] text-muted-foreground font-medium">RBAC Security</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Form (Sign In / Register / Forgot Password) */}
        <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-center bg-card/60">
          {/* Status Banners */}
          {visibleError && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-destructive/15 border border-destructive/25 p-3.5 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="leading-snug">{visibleError}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 p-3.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="leading-snug">{successMessage}</div>
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {mode === 'signin' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">Sign In</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Access your authorized land-records workspace or customer portal
                </p>
              </div>

              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email Address</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="officer@tn.gov.in or user@domain.com"
                    autoComplete="email"
                    {...loginForm.register('email')}
                    disabled={loginForm.formState.isSubmitting}
                    className="h-11 rounded-xl"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setServerError(null);
                        setSuccessMessage(null);
                        setMode('forgot');
                      }}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      autoComplete="current-password"
                      {...loginForm.register('password')}
                      disabled={loginForm.formState.isSubmitting}
                      className="h-11 rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {loginForm.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={loginForm.formState.isSubmitting}
                  className="w-full h-11 rounded-xl font-semibold text-base shadow-lg shadow-primary/25 mt-2"
                >
                  {loginForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" /> Sign In
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-4 text-center border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setServerError(null);
                      setSuccessMessage(null);
                      setMode('signup');
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Create Account (Customer / Landowner)
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* 2. CREATE ACCOUNT FORM (REGISTRATION) */}
          {mode === 'signup' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Create Customer Account
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Self-service registration for landowners, citizens, and applicants
                </p>
              </div>

              <form
                onSubmit={registerForm.handleSubmit(onRegisterSubmit)}
                className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar"
              >
                <div className="space-y-1">
                  <Label htmlFor="reg-name">Full Name *</Label>
                  <Input
                    id="reg-name"
                    placeholder="Senthil Kumar"
                    {...registerForm.register('full_name')}
                    disabled={registerForm.formState.isSubmitting}
                    className="h-10 rounded-xl"
                  />
                  {registerForm.formState.errors.full_name && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg-email">Email Address *</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="senthil@gmail.com"
                    {...registerForm.register('email')}
                    disabled={registerForm.formState.isSubmitting}
                    className="h-10 rounded-xl"
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                {/* Dependent Geography Selection: State -> District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary" /> State / UT
                    </Label>
                    <Controller
                      name="state_id"
                      control={registerForm.control}
                      render={({ field }) => (
                        <Select
                          value={field.value ?? ''}
                          onValueChange={(val) => {
                            field.onChange(val);
                            setSelectedStateId(val);
                            registerForm.setValue('district_id', '');
                          }}
                          disabled={registerForm.formState.isSubmitting}
                        >
                          <SelectTrigger className="h-10 rounded-xl">
                            <SelectValue placeholder="Select State" />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {states.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} ({s.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" /> District
                    </Label>
                    <Controller
                      name="district_id"
                      control={registerForm.control}
                      render={({ field }) => (
                        <Select
                          value={field.value ?? ''}
                          onValueChange={field.onChange}
                          disabled={
                            registerForm.formState.isSubmitting ||
                            !selectedStateId ||
                            loadingDistricts
                          }
                        >
                          <SelectTrigger className="h-10 rounded-xl">
                            <SelectValue
                              placeholder={
                                !selectedStateId
                                  ? 'Pick State first'
                                  : loadingDistricts
                                  ? 'Loading...'
                                  : 'Select District'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {districts.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                {/* Password & Confirm Password */}
                <div className="space-y-1">
                  <Label htmlFor="reg-password">Password (min 8 characters) *</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      {...registerForm.register('password')}
                      disabled={registerForm.formState.isSubmitting}
                      className="h-10 rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {registerForm.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}

                  {/* Password Strength Meter */}
                  {watchPassword && (
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            pwdStrength <= 25
                              ? 'bg-destructive w-1/4'
                              : pwdStrength <= 50
                              ? 'bg-amber-500 w-2/4'
                              : pwdStrength <= 75
                              ? 'bg-blue-500 w-3/4'
                              : 'bg-emerald-500 w-full'
                          }`}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {pwdStrength <= 25 && 'Weak password'}
                        {pwdStrength > 25 && pwdStrength <= 50 && 'Moderate password'}
                        {pwdStrength > 50 && pwdStrength <= 75 && 'Good password'}
                        {pwdStrength > 75 && 'Strong password'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="reg-confirm">Confirm Password *</Label>
                  <div className="relative">
                    <Input
                      id="reg-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      {...registerForm.register('confirm_password')}
                      disabled={registerForm.formState.isSubmitting}
                      className="h-10 rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {registerForm.formState.errors.confirm_password && (
                    <p className="text-xs text-destructive">
                      {registerForm.formState.errors.confirm_password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={registerForm.formState.isSubmitting}
                  className="w-full h-11 rounded-xl font-semibold text-base shadow-lg shadow-primary/25 mt-3"
                >
                  {registerForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" /> Register Customer Account
                    </>
                  )}
                </Button>
              </form>

              <div className="pt-3 text-center border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setServerError(null);
                      setSuccessMessage(null);
                      setMode('signin');
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Back to Sign In
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* 3. FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setServerError(null);
                    setSuccessMessage(null);
                    setMode('signin');
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 font-medium"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </button>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Reset Your Password
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter your registered email address to receive password recovery instructions
                </p>
              </div>

              <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Registered Email Address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="name@tn.gov.in"
                    {...forgotForm.register('email')}
                    disabled={forgotForm.formState.isSubmitting}
                    className="h-11 rounded-xl"
                  />
                  {forgotForm.formState.errors.email && (
                    <p className="text-xs text-destructive">
                      {forgotForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={forgotForm.formState.isSubmitting}
                  className="w-full h-11 rounded-xl font-semibold text-base shadow-lg shadow-primary/25"
                >
                  {forgotForm.formState.isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Link...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" /> Send Recovery Link
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Security & Regulatory Footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-4">
        <span>Protected by Supabase Role-Based Access Control</span>
        <span>•</span>
        <span>End-to-End Cryptographic Audit Logging</span>
        <span>•</span>
        <span>256-bit AES Storage</span>
      </div>
    </div>
  );
}
