import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const SpotifyCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setErrorMessage(`Spotify authorization failed: ${error}`);
        toast.error('Spotify connection failed', {
          description: error,
        });
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setErrorMessage('Missing authorization code or state parameter');
        return;
      }

      if (!user) {
        setStatus('error');
        setErrorMessage('User not authenticated');
        return;
      }

      try {
        // Verify state parameter
        const storedState = localStorage.getItem('spotify_auth_state');
        if (!storedState || storedState !== state) {
          throw new Error('State mismatch. Potential security issue.');
        }

        localStorage.removeItem('spotify_auth_state');

        // For now, we'll simulate the token exchange since it should be done server-side
        // In a real implementation, send the code to your backend
        console.log('Authorization code received:', code);
        
        // Simulate successful token exchange
        const mockSpotifyData = {
          spotify_user_id: 'mock_user_' + Math.random().toString(36).substr(2, 9),
          access_token: 'mock_access_token_' + Math.random().toString(36).substr(2, 9),
          refresh_token: 'mock_refresh_token_' + Math.random().toString(36).substr(2, 9),
        };

        // Update user profile with Spotify data
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            spotify_user_id: mockSpotifyData.spotify_user_id,
            access_token: mockSpotifyData.access_token,
            refresh_token: mockSpotifyData.refresh_token,
          })
          .eq('id', user.id);

        if (updateError) {
          throw new Error('Failed to save Spotify connection: ' + updateError.message);
        }

        setStatus('success');
        toast.success('Spotify connected successfully!', {
          description: 'You can now save playlists and get personalized recommendations.',
        });

        // Redirect to profile page after a short delay
        setTimeout(() => {
          window.location.href = '/profile';
        }, 2000);

      } catch (error) {
        console.error('Spotify callback error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
        toast.error('Failed to connect Spotify', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    handleCallback();
  }, [searchParams, user]);

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5">
      <div className="w-full max-w-md px-6">
        <Card className="glass border-border/50">
          <div className="p-8 text-center space-y-6">
            {status === 'processing' && (
              <>
                <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                <div>
                  <h2 className="text-xl font-semibold mb-2">Connecting Spotify</h2>
                  <p className="text-muted-foreground">
                    Please wait while we set up your Spotify connection...
                  </p>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
                <div>
                  <h2 className="text-xl font-semibold mb-2 text-green-700 dark:text-green-400">
                    Spotify Connected!
                  </h2>
                  <p className="text-muted-foreground">
                    Your Spotify account has been successfully connected. Redirecting to your profile...
                  </p>
                </div>
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    You can now save AI-generated playlists directly to your Spotify library!
                  </AlertDescription>
                </Alert>
              </>
            )}

            {status === 'error' && (
              <>
                <XCircle className="w-12 h-12 mx-auto text-red-500" />
                <div>
                  <h2 className="text-xl font-semibold mb-2 text-red-700 dark:text-red-400">
                    Connection Failed
                  </h2>
                  <p className="text-muted-foreground">
                    We couldn't connect your Spotify account. Please try again.
                  </p>
                </div>
                {errorMessage && (
                  <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                    <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
                      {errorMessage}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="pt-4">
                  <a 
                    href="/profile" 
                    className="text-primary hover:text-primary/80 underline"
                  >
                    Return to Profile
                  </a>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SpotifyCallback;
