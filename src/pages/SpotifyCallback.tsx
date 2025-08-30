import React, { useEffect, useState } from 'react';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { exchangeCodeForTokens, getSpotifyProfile } from '@/lib/spotify';

const SpotifyCallback: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent reprocessing if we've already handled this callback
      if (hasProcessed) {
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // If no parameters, user probably navigated back - redirect to profile
      if (!code && !state && !error) {
        navigate('/profile', { replace: true });
        return;
      }

      if (error) {
        setStatus('error');
        setErrorMessage(`Spotify authorization failed: ${error}`);
        toast.error('Spotify connection failed', {
          description: error,
        });
        // Clear URL parameters after error
        setSearchParams({}, { replace: true });
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setErrorMessage('Missing authorization code or state parameter');
        // Clear URL parameters after error
        setSearchParams({}, { replace: true });
        return;
      }

      // This check is now safe because the useEffect waits for the user object
      if (!user) {
        setStatus('error');
        setErrorMessage('User not authenticated');
        return;
      }

      try {
        setHasProcessed(true); // Mark as processing to prevent rerun

        // Exchange authorization code for tokens using PKCE
        const tokenData = await exchangeCodeForTokens(code, state);

        // Get user profile from Spotify
        const spotifyProfile = await getSpotifyProfile(tokenData.access_token);

        // Update user profile with Spotify data
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            spotify_user_id: spotifyProfile.id,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
          })
          .eq('id', user.id);

        if (updateError) {
          throw new Error('Failed to save Spotify connection: ' + updateError.message);
        }

        setStatus('success');
        toast.success('Spotify connected successfully!', {
          description: 'You can now save playlists and get personalized recommendations.',
        });

        // Clear URL parameters and redirect to profile page
        setSearchParams({}, { replace: true });
        setTimeout(() => {
          navigate('/profile', { replace: true });
        }, 2000);

      } catch (error) {
        console.error('Spotify callback error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
        toast.error('Failed to connect Spotify', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
        // Clear URL parameters after error
        setSearchParams({}, { replace: true });
      }
    };

    // Only run the handleCallback function if the user object is available.
    if (user) {
        handleCallback();
    }
  }, [searchParams, user, navigate, setSearchParams, hasProcessed]); // Added dependencies

  if (!isAuthenticated && status !== 'processing') {
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
                  <Button
                    onClick={() => navigate('/profile', { replace: true })}
                    variant="outline"
                  >
                    Return to Profile
                  </Button>
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
