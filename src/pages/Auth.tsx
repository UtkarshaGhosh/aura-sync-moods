import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Music, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Auth: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [confirmationStatus, setConfirmationStatus] = useState<'checking' | 'confirmed' | 'error' | null>(null);
  const navigate = useNavigate();

  // Handle email confirmation on page load
  useEffect(() => {
    const handleEmailConfirmation = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const type = urlParams.get('type');
      const error = urlParams.get('error_description');

      if (error) {
        console.error('Email confirmation error:', error);
        toast.error('Email confirmation failed', {
          description: error,
        });
        setConfirmationStatus('error');
        return;
      }

      if (type === 'signup' && accessToken && refreshToken) {
        setConfirmationStatus('checking');
        console.log('Processing email confirmation...');

        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            toast.error('Failed to confirm email', {
              description: sessionError.message,
            });
            setConfirmationStatus('error');
          } else {
            console.log('Email confirmed successfully:', data.user?.email);
            setConfirmationStatus('confirmed');
            toast.success('Email confirmed successfully!', {
              description: 'You can now sign in to your account.',
            });
            setPendingEmail(null);

            // Clear URL parameters and redirect
            window.history.replaceState({}, document.title, window.location.pathname);
            setTimeout(() => {
              navigate('/');
            }, 2000);
          }
        } catch (error) {
          console.error('Confirmation error:', error);
          setConfirmationStatus('error');
          toast.error('Failed to process email confirmation');
        }
      }
    };

    handleEmailConfirmation();
  }, [navigate]);

  const getRedirectUrl = () => {
    // Get the current URL without any paths
    const currentUrl = window.location.origin;
    console.log('Current origin for email redirect:', currentUrl);
    return currentUrl;
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('displayName') as string;

    const redirectUrl = getRedirectUrl();
    console.log('Sign up with redirect URL:', redirectUrl);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName,
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Account already exists', {
            description: 'Please sign in instead or use a different email address.',
          });
        } else {
          toast.error('Sign up failed', {
            description: error.message,
          });
        }
      } else {
        setPendingEmail(email);
        toast.success('Account created!', {
          description: 'Check your email to confirm your account.',
        });
      }
    } catch (error) {
      toast.error('An unexpected error occurred', {
        description: 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = useCallback(async (email: string) => {
    const redirectUrl = getRedirectUrl();
    console.log('Resend confirmation with redirect URL:', redirectUrl);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectUrl,
        }
      });

      if (error) {
        toast.error('Failed to resend confirmation', {
          description: error.message,
        });
      } else {
        toast.success('Confirmation email sent!', {
          description: 'Please check your email inbox.',
        });
      }
    } catch (error) {
      toast.error('Failed to resend confirmation', {
        description: 'Please try again later.',
      });
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    console.log('Attempting to sign in with email:', email);

    try {
      // Clear any existing session first
      await supabase.auth.signOut();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Sign in response:', { data, error });

      if (error) {
        console.error('Sign in error:', error);
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid credentials', {
            description: 'Please check your email and password.',
          });
        } else if (error.message.includes('Email not confirmed')) {
          setPendingEmail(email);
          toast.error('Email not confirmed', {
            description: 'Try refreshing the page, or click below to resend confirmation.',
            action: {
              label: 'Resend Email',
              onClick: () => handleResendConfirmation(email),
            },
          });
        } else {
          toast.error('Sign in failed', {
            description: error.message,
          });
        }
      } else {
        setPendingEmail(null);
        console.log('Sign in successful:', data.user?.email);
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch (error) {
      toast.error('An unexpected error occurred', {
        description: 'Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-glow mb-2">AuraSync</h1>
          <p className="text-muted-foreground">Connect your emotions to music</p>
        </div>

        {confirmationStatus === 'checking' && (
          <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              Processing email confirmation...
            </AlertDescription>
          </Alert>
        )}

        {confirmationStatus === 'confirmed' && (
          <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Email confirmed successfully! Redirecting to your dashboard...
            </AlertDescription>
          </Alert>
        )}

        {pendingEmail && !confirmationStatus && (
          <Alert className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <div className="flex items-center justify-between">
                <span>Waiting for email confirmation for <strong>{pendingEmail}</strong></span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleResendConfirmation(pendingEmail)}
                    className="h-8"
                  >
                    Resend Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPendingEmail(null);
                      localStorage.clear();
                      window.location.reload();
                    }}
                    className="h-8"
                  >
                    Clear & Refresh
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card className="glass border-border/50">
          <div className="p-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    <Music className="w-4 h-4 mr-2" />
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        name="displayName"
                        type="text"
                        placeholder="Your Name"
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        className="pl-10"
                        minLength={6}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    <Music className="w-4 h-4 mr-2" />
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};

export default Auth;
