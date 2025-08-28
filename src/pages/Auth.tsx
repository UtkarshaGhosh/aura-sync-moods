import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, Mail, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Auth: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');
  const navigate = useNavigate();

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };


  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const displayName = formData.get('displayName') as string;

    // Clear any previous errors
    setEmailError('');
    setSignupError('');
    setSignupSuccess('');

    // Validate email format
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      toast.error('Password too short', {
        description: 'Password must be at least 6 characters long.',
      });
      setIsLoading(false);
      return;
    }

    try {
      // First, try to sign up and handle the response appropriately
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      });

      if (error) {
        // Debug: Log the exact error to console
        console.error('Supabase signup error:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.status || 'no status code');

        // Handle specific error types with comprehensive patterns
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('already registered') ||
            errorMessage.includes('user already registered') ||
            errorMessage.includes('email address is already in use') ||
            errorMessage.includes('already exists') ||
            errorMessage.includes('duplicate') ||
            errorMessage.includes('taken') ||
            error.status === 422) {

          const errorMsg = 'An account with this email address already exists. Please sign in instead or use a different email address.';
          setSignupError(errorMsg);

          toast.error('Account Already Exists!', {
            description: errorMsg,
            duration: 5000,
          });

        } else if (errorMessage.includes('password should be at least') ||
                   errorMessage.includes('password') && errorMessage.includes('weak')) {
          toast.error('Password too weak', {
            description: 'Password should be at least 6 characters long.',
          });
        } else if (errorMessage.includes('invalid email') ||
                   errorMessage.includes('email') && errorMessage.includes('invalid')) {
          toast.error('Invalid email', {
            description: 'Please enter a valid email address.',
          });
        } else {
          // Fallback: Show the actual error message from Supabase
          const errorMsg = `Error: ${error.message}`;
          setSignupError(errorMsg);

          toast.error('Sign up failed', {
            description: errorMsg,
            duration: 6000,
          });
        }
      } else {
        // Debug: Log the signup response
        console.log('Supabase signup response:', { data, error: null });
        console.log('User object:', data.user);
        console.log('Session object:', data.session);

        // Check if this might be a duplicate email scenario
        // Supabase sometimes returns success for existing emails for security reasons
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          // This usually indicates the email is already registered
          const errorMsg = 'An account with this email address already exists. Please sign in instead.';
          setSignupError(errorMsg);

          toast.error('Account Already Exists!', {
            description: errorMsg,
            duration: 5000,
          });
        } else if (data.user && !data.user.email_confirmed_at) {
          // Account created successfully, waiting for email confirmation
          const successMsg = 'Please check your email and click the confirmation link to activate your account.';
          setSignupSuccess(successMsg);

          toast.success('Account created successfully!', {
            description: successMsg,
          });
        } else if (data.user && data.user.email_confirmed_at) {
          // Account was created and is already confirmed (shouldn't happen with email confirmation enabled)
          toast.success('Account created and confirmed!', {
            description: 'You can now sign in to your account.',
          });
        } else {
          // Fallback success message
          toast.success('Account created successfully!', {
            description: 'Please check your email and click the confirmation link to activate your account.',
          });
        }
      }
    } catch (error) {
      console.error('Unexpected signup error:', error);
      toast.error('An unexpected error occurred', {
        description: 'Please try again later.',
      });
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
            description: 'Please check your email and password. If you just signed up, make sure you\'ve confirmed your email address.',
          });
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Email not confirmed', {
            description: 'Please check your email and click the confirmation link before signing in.',
          });
        } else if (error.message.includes('User not found')) {
          toast.error('Account not found', {
            description: 'No account found with this email address. Please sign up first.',
          });
        } else {
          toast.error('Sign in failed', {
            description: error.message,
          });
        }
      } else {
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
                {/* Visual error/success feedback */}
                {signupError && (
                  <div className="p-3 mb-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400 font-medium">⚠️ Account Already Exists</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{signupError}</p>
                  </div>
                )}

                {signupSuccess && (
                  <div className="p-3 mb-4 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">✅ Success</p>
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
                    {emailError && (
                      <p className="text-sm text-red-500">{emailError}</p>
                    )}
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
                    <p>📧 Each email address can only be used for one account.</p>
                    <p>You'll receive a confirmation email to activate your account.</p>
                  </div>
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
