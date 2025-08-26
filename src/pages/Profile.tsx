import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  User, 
  Music, 
  ArrowLeft, 
  Save, 
  Trash2, 
  ExternalLink,
  CheckCircle,
  XCircle,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getSpotifyAuthUrl } from '@/lib/spotify';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  spotify_user_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  created_at: string;
}

const Profile: React.FC = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load user profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
          toast.error('Failed to load profile');
        } else if (data) {
          setProfile(data);
          setDisplayName(data.display_name || '');
        } else {
          // Create profile if it doesn't exist
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
              avatar_url: user.user_metadata?.avatar_url || null,
            })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            toast.error('Failed to create profile');
          } else {
            setProfile(newProfile);
            setDisplayName(newProfile.display_name || '');
          }
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user || !profile) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Failed to save profile');
      } else {
        setProfile(prev => prev ? { ...prev, display_name: displayName.trim() || null } : null);
        toast.success('Profile updated successfully');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectSpotify = () => {
    try {
      const authUrl = getSpotifyAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Spotify auth error:', error);
      toast.error('Failed to start Spotify connection', {
        description: error instanceof Error ? error.message : 'Please check your configuration.',
      });
    }
  };

  const handleDisconnectSpotify = async () => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          spotify_user_id: null,
          access_token: null,
          refresh_token: null,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error disconnecting Spotify:', error);
        toast.error('Failed to disconnect Spotify');
      } else {
        setProfile(prev => prev ? {
          ...prev,
          spotify_user_id: null,
          access_token: null,
          refresh_token: null,
        } : null);
        toast.success('Spotify disconnected successfully');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to disconnect Spotify');
    }
  };

  const isSpotifyConnected = profile?.spotify_user_id && profile?.access_token;

  // Show loading spinner while checking auth
  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-glow">Profile & Settings</h1>
            <p className="text-muted-foreground">Manage your account and music preferences</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="glass border-border/50">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Settings className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Profile Information</h2>
                </div>

                <div className="space-y-6">
                  {/* Avatar and Basic Info */}
                  <div className="flex items-center gap-6">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-lg">
                        {displayName ? displayName.charAt(0).toUpperCase() : 
                         user?.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{user?.email}</p>
                      <p className="text-sm text-muted-foreground mt-2">Member since</p>
                      <p className="text-sm">{new Date(profile?.created_at || '').toLocaleDateString()}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Display Name */}
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your display name"
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleSaveProfile}
                        disabled={isSaving || displayName === (profile?.display_name || '')}
                        size="sm"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Spotify Integration */}
            <Card className="glass border-border/50">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <Music className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Spotify Integration</h2>
                  {isSpotifyConnected ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                      <XCircle className="w-3 h-3 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>

                {isSpotifyConnected ? (
                  <div className="space-y-4">
                    <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Your Spotify account is connected! You can now save playlists and get personalized recommendations.
                      </AlertDescription>
                    </Alert>

                    <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                      <div>
                        <p className="font-medium">Spotify User ID</p>
                        <p className="text-sm text-muted-foreground">{profile.spotify_user_id}</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleDisconnectSpotify}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Alert>
                      <Music className="h-4 w-4" />
                      <AlertDescription>
                        Connect your Spotify account to save playlists, get personalized recommendations, and sync your music preferences.
                      </AlertDescription>
                    </Alert>

                    <div className="text-center py-6">
                      <Button 
                        onClick={handleConnectSpotify}
                        className="bg-green-500 hover:bg-green-600 text-white"
                        size="lg"
                      >
                        <Music className="w-5 h-5 mr-2" />
                        Connect Spotify Account
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>By connecting Spotify, you'll be able to:</strong></p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>Save AI-generated playlists to your Spotify library</li>
                        <li>Get recommendations based on your music taste</li>
                        <li>Access your existing playlists for mood analysis</li>
                        <li>Play preview tracks directly in the app</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="glass border-border/50">
              <div className="p-6">
                <h3 className="font-semibold mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Account Status</span>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Music Service</span>
                    <span className="text-sm">
                      {isSpotifyConnected ? 'Spotify' : 'Not Connected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Profile Complete</span>
                    <span className="text-sm">
                      {displayName && isSpotifyConnected ? '100%' : displayName ? '50%' : '25%'}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="glass border-border/50">
              <div className="p-6">
                <h3 className="font-semibold mb-4">Need Help?</h3>
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Having trouble with your account or Spotify integration?
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Help Center
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
