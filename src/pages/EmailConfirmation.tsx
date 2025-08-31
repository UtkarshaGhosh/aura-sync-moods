import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';

const EmailConfirmation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Check if user was redirected after email confirmation
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setStatus('error');
          setMessage('Email confirmation failed. The link may have expired or already been used.');
          console.error('Email confirmation error:', error);
          return;
        }

        // If there's a session, the email was confirmed successfully
        if (data.session && data.session.user) {
          setStatus('success');
          setMessage('Email confirmed successfully! You can now log in to your account.');
          console.log('Email confirmed for user:', data.session.user.email);
        } else {
          // Check URL parameters for confirmation tokens
          const token = searchParams.get('token_hash') || searchParams.get('token');
          const type = searchParams.get('type');

          if (!token) {
            setStatus('error');
            setMessage('Invalid confirmation link. Please try signing up again.');
            return;
          }

          // Try to verify the token
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type === 'recovery' ? 'recovery' : 'email'
          });

          if (verifyError) {
            setStatus('error');
            setMessage('Email confirmation failed. The link may have expired or already been used.');
            console.error('Email verification error:', verifyError);
          } else {
            setStatus('success');
            setMessage('Email confirmed successfully! You can now log in to your account.');
            console.log('Email verified for user:', verifyData.user?.email);
          }
        }
      } catch (error) {
        setStatus('error');
        setMessage('An unexpected error occurred during email confirmation.');
        console.error('Unexpected error:', error);
      }
    };

    handleEmailConfirmation();
  }, [searchParams]);

  const handleGoToLogin = () => {
    navigate('/auth');
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="https://i.ibb.co/4nDnvPR0/1.png" alt="AuraSync logo" className="w-12 h-12 rounded-full object-cover mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-glow mb-2">AuraSync</h1>
          <p className="text-muted-foreground">Email Confirmation</p>
        </div>

        <Card className="glass border-border/50">
          <div className="p-8 text-center">
            {status === 'loading' && (
              <div className="space-y-4">
                <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
                <h2 className="text-xl font-semibold">Confirming your email...</h2>
                <p className="text-muted-foreground">
                  Please wait while we verify your email address.
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-green-600 dark:text-green-400 mb-2">
                    Email Confirmed!
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {message}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Welcome to AuraSync! Your account is now ready to use.
                  </p>
                </div>
                <div className="space-y-3">
                  <Button onClick={handleGoToLogin} className="w-full" size="lg">
                    Go to Login
                  </Button>
                  <Button onClick={handleGoHome} variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Website
                  </Button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="space-y-6">
                <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
                    Confirmation Failed
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {message}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Please try signing up again or contact support if the problem persists.
                  </p>
                </div>
                <div className="space-y-3">
                  <Button onClick={handleGoToLogin} variant="outline" className="w-full">
                    Try Signing Up Again
                  </Button>
                  <Button onClick={handleGoHome} variant="outline" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Website
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Having trouble? Contact our support team for assistance.
        </p>
      </div>
    </div>
  );
};

export default EmailConfirmation;
