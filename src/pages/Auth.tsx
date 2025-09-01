import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, Mail, Lock, User, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Auth: React.FC = () => {
  const [tab, setTab] = useState<'signin' | 'signup' | 'changepw'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');

  // Change password flow states (email link confirmation)
  const [cpEmail, setCpEmail] = useState('');
  const [cpStage, setCpStage] = useState<'request' | 'reset'>('request');
  const [cpPassword, setCpPassword] = useState('');
  const [cpPassword2, setCpPassword2] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Detect redirect from Supabase password recovery link
  useEffect(() => {
    const type = searchParams.get('type');
    const reset = searchParams.get('reset_password');
    if (type === 'recovery' || reset === '1') {
      setTab('changepw');
      setCpStage('reset');
    }
  }, [searchParams]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('displayName') as string;

    setEmailError('');
    setSignupError('');
    setSignupSuccess('');

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast.error('Password too short', {
        description: 'Password must be at least 6 characters long.',
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });

      if (error) {
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('user already registered') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('duplicate') ||
          errorMessage.includes('taken') ||
          error.status === 422
        ) {
          const errorMsg = 'An account with this email already exists. Please sign in instead.';
          setSignupError(errorMsg);
          toast.error('Account Already Exists', { description: errorMsg });
        } else if (errorMessage.includes('password')) {
          toast.error('Password too weak', { description: 'Use at least 6 characters.' });
        } else if (errorMessage.includes('email')) {
          toast.error('Invalid email', { description: 'Please enter a valid email address.' });
        } else {
          setSignupError(`Error: ${error.message}`);
          toast.error('Sign up failed', { description: error.message });
        }
      } else {
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          const errorMsg = 'An account with this email address already exists. Please sign in instead.';
          setSignupError(errorMsg);
          toast.error('Account Already Exists', { description: errorMsg });
        } else {
          const successMsg = 'Please check your email and click the confirmation link to activate your account.';
          setSignupSuccess(successMsg);
          toast.success('Account created!', { description: successMsg });
        }
      }
    } catch {
      toast.error('An unexpected error occurred', { description: 'Please try again later.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await supabase.auth.signOut();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid credentials', {
            description:
              "Please check your email and password. If you just signed up, make sure you've confirmed your email address.",
          });
        } else if (error.message.toLowerCase().includes('not confirmed')) {
          toast.error('Email not confirmed', {
            description: 'Please check your email and click the confirmation link before signing in.',
          });
        } else if (error.message.includes('User not found')) {
          toast.error('Account not found', {
            description: 'No account found with this email address. Please sign up first.',
          });
        } else {
          toast.error('Sign in failed', { description: error.message });
        }
      } else {
        toast.success('Welcome back!');
        navigate('/');
      }
    } catch {
      toast.error('An unexpected error occurred', { description: 'Please try again later.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Change Password: send confirmation email (recovery link), then allow reset on return
  const handleCpRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateEmail(cpEmail)) {
      toast.error('Invalid email', { description: 'Enter a valid email address.' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cpEmail, {
        redirectTo: `${window.location.origin}/auth?reset_password=1`,
      });
      if (error) {
        toast.error('Failed to send reset email', { description: error.message });
      } else {
        toast.success('Password reset email sent', {
          description: 'Check your inbox and follow the confirmation link.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCpReset = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (cpPassword.length < 6) {
      toast.error('Weak password', { description: 'Use at least 6 characters.' });
      return;
    }
    if (cpPassword !== cpPassword2) {
      toast.error("Passwords don't match");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: cpPassword });
      if (error) {
        toast.error('Failed to update password', { description: error.message });
      } else {
        toast.success('Password changed successfully');
        await supabase.auth.signOut();
        setCpStage('request');
        setCpEmail('');
        setCpPassword('');
        setCpPassword2('');
        setTab('signin');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="https://i.ibb.co/4nDnvPR0/1.png"
            alt="AuraSync logo"
            className="w-12 h-12 rounded-full object-cover mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-glow mb-2">AuraSync</h1>
          <p className="text-muted-foreground">Connect your emotions to music</p>
        </div>

        <Card className="glass border-border/50">
          <div className="p-6">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                <TabsTrigger value="changepw">Change Password</TabsTrigger>
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
                {signupError && (
                  <div className="p-3 mb-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">Account Already Exists</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{signupError}</p>
                  </div>
                )}

                {signupSuccess && (
                  <div className="p-3 mb-4 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">Success</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">{signupSuccess}</p>
                  </div>
                )}

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
                        className={`pl-10 ${emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                        required
                        disabled={isLoading}
                        onChange={(e) => {
                          const email = e.target.value;
                          if (email && !validateEmail(email)) {
                            setEmailError('Please enter a valid email address');
                          } else {
                            setEmailError('');
                          }
                        }}
                      />
                    </div>
                    {emailError && <p className="text-sm text-red-500">{emailError}</p>}
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

                  <Button type="submit" className="w-full" disabled={isLoading || !!emailError}>
                    <Music className="w-4 h-4 mr-2" />
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>

                  <div className="text-xs text-muted-foreground text-center mt-3 p-2 bg-muted/20 rounded">
                    <p>Each email address can only be used for one account.</p>
                    <p>You'll receive a confirmation email to activate your account.</p>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="changepw">
                {cpStage === 'request' && (
                  <form onSubmit={handleCpRequest} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cp-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cp-email"
                          name="cp-email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10"
                          value={cpEmail}
                          onChange={(e) => setCpEmail(e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">We'll email you a secure link to confirm your identity.</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      Send Reset Link
                    </Button>
                  </form>
                )}

                {cpStage === 'reset' && (
                  <form onSubmit={handleCpReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cp-password">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cp-password"
                          name="cp-password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          value={cpPassword}
                          onChange={(e) => setCpPassword(e.target.value)}
                          minLength={6}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cp-password2">Confirm New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="cp-password2"
                          name="cp-password2"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10"
                          value={cpPassword2}
                          onChange={(e) => setCpPassword2(e.target.value)}
                          minLength={6}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Update Password
                    </Button>
                  </form>
                )}
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
