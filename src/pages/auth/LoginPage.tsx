import { useState } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, loading: authLoading, signIn, error: authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const routeError = (location.state as { authError?: string } | null)?.authError;
  const visibleError = error || routeError || authError;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // If already authenticated, redirect
  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    try {
      await signIn(data.email, data.password);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    }
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">LAND-IQ</h1>
          <p className="text-sm text-muted-foreground">Intelligent Land Record Digitization Platform</p>
        </div>

        <Card className="shadow-lg border-border/50">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>Enter your official credentials to access the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {visibleError && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {visibleError}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@tn.gov.in" 
                  {...register('email')} 
                  disabled={isSubmitting}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                </div>
                <div className="relative">
                  <Input 
                    id="password" 
                    type={showPassword ? 'text' : 'password'} 
                    {...register('password')}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t p-4">
            <p className="text-xs text-muted-foreground text-center">
              Authorized Government Personnel Only. <br/>All actions are logged and audited.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
