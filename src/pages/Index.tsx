import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuraVisualizer from '@/components/AuraVisualizer';
import EmotionDetector from '@/components/EmotionDetector';
import MusicRecommendations from '@/components/MusicRecommendations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Music, Settings, LogOut, ChevronDown, ArrowUp, BarChart3, History, Sparkles, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createPlaylist, addTracksToPlaylist } from '@/lib/spotify';

interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  preview_url: string | null;
  spotify_url?: string;
}

const Index = () => {
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const { user, loading, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [spotifyCredentials, setSpotifyCredentials] = useState<{
    access_token: string;
    spotify_user_id: string;
  } | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Smooth scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };

  // Scroll to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Scroll event listener
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load Spotify credentials
  useEffect(() => {
    const loadSpotifyCredentials = async () => {
      console.log('🔍 Loading Spotify credentials...');

      if (!user) {
        console.log('❌ No user found, skipping Spotify credentials load');
        return;
      }

      console.log('✅ User found:', {
        id: user.id,
        email: user.email,
        isAuthenticated: !!user
      });

      try {
        console.log('📡 Querying profiles table for user:', user.id);

        const { data, error } = await supabase
          .from('profiles')
          .select('access_token, spotify_user_id')
          .eq('id', user.id)
          .single();

        console.log('📊 Query result:', { data, error });

        if (error) {
          console.error('❌ Error loading Spotify credentials:');
          console.error('- Code:', error.code);
          console.error('- Message:', error.message);
          console.error('- Details:', error.details);
          console.error('- Hint:', error.hint);
          console.error('- Full error:', JSON.stringify(error, null, 2));

          // Check if it's an RLS policy issue
          if (error.code === 'PGRST116' || error.message?.includes('permission')) {
            console.error('🔒 This appears to be a Row Level Security (RLS) policy issue');
            console.error('💡 The user may not have permission to access their profile data');
          }

          return;
        }

        console.log('✅ Successfully loaded profile data:', {
          hasAccessToken: !!data?.access_token,
          hasSpotifyUserId: !!data?.spotify_user_id,
          accessTokenLength: data?.access_token?.length || 0
        });

        if (data?.access_token && data?.spotify_user_id) {
          setSpotifyCredentials({
            access_token: data.access_token,
            spotify_user_id: data.spotify_user_id,
          });
          console.log('🎵 Spotify credentials set successfully');
        } else {
          console.log('⚠️ No Spotify credentials found in profile');
        }
      } catch (error) {
        console.error('💥 Unexpected error loading Spotify credentials:', error);
        console.error('Error type:', typeof error);
        console.error('Error constructor:', error?.constructor?.name);
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
      }
    };

    loadSpotifyCredentials();
  }, [user]);

  const handleEmotionDetected = async (emotion: string, source: 'emoji' | 'upload') => {
    setCurrentEmotion(emotion);
    
    // Save to mood_history table
    if (user) {
      try {
        const { error } = await supabase
          .from('mood_history')
          .insert({
            user_id: user.id,
            emotion,
            source
          });
        
        if (error) {
          console.error('Error saving mood history:', error);
        }
      } catch (error) {
        console.error('💥 Error saving mood history:', error);
        if (error instanceof Error) {
          console.error('- Message:', error.message);
        }
      }
    }
    
    toast.success(`${emotion.charAt(0).toUpperCase() + emotion.slice(1)} mood detected!`, {
      description: `🎵 Your aura is updating and personalized ${emotion} music is being generated...`,
      duration: 4000,
    });
  };

  const handleSavePlaylist = async (tracks: Track[]) => {
    if (!spotifyCredentials) {
      toast.error('Spotify not connected', {
        description: 'Please connect your Spotify account in settings.',
      });
      return;
    }

    if (tracks.length === 0) {
      toast.error('No tracks to save', {
        description: 'Generate some music recommendations first.',
      });
      return;
    }

    try {
      const playlistName = `AuraSync - ${currentEmotion.charAt(0).toUpperCase() + currentEmotion.slice(1)} Vibes`;
      const playlistDescription = `AI-generated playlist for your ${currentEmotion} mood. Created by AuraSync on ${new Date().toLocaleDateString()}`;

      toast.info('Creating playlist...', {
        description: 'Saving to your Spotify library.',
      });

      // Create playlist
      const playlist = await createPlaylist(
        spotifyCredentials.spotify_user_id,
        playlistName,
        playlistDescription,
        spotifyCredentials.access_token
      );

      // Get track URIs (only for tracks that have Spotify IDs)
      const trackUris = tracks
        .filter(track => track.id && !track.id.startsWith('mock'))
        .map(track => `spotify:track:${track.id}`);

      if (trackUris.length === 0) {
        toast.warning('No Spotify tracks to save', {
          description: 'These recommendations don\'t have Spotify links. Try connecting Spotify for personalized tracks.',
        });
        return;
      }

      // Add tracks to playlist
      await addTracksToPlaylist(
        playlist.id,
        trackUris,
        spotifyCredentials.access_token
      );

      toast.success('Playlist saved to Spotify!', {
        description: `"${playlistName}" with ${trackUris.length} tracks added to your library.`,
        action: {
          label: 'Open in Spotify',
          onClick: () => window.open(playlist.external_urls.spotify, '_blank'),
        },
      });

    } catch (error) {
      console.error('Error saving playlist:', error);

      if (error instanceof Error && error.message === 'SPOTIFY_TOKEN_EXPIRED') {
        toast.error('Spotify session expired', {
          description: 'Please reconnect your Spotify account in settings.',
        });
        setSpotifyCredentials(null);
      } else {
        toast.error('Failed to save playlist', {
          description: error instanceof Error ? error.message : 'Please try again.',
        });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Error logging out');
    }
  };

  // Show loading spinner while checking auth
  if (loading) {
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
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background gradient */}
      <div
        className="fixed inset-0 transition-all duration-[3s] ease-out"
        style={{
          background: `radial-gradient(circle at 50% 50%, 
            hsl(var(--emotion-${currentEmotion}) / 0.1) 0%,
            hsl(var(--background)) 50%,
            hsl(var(--emotion-${currentEmotion}) / 0.05) 100%)`
        }}
      />

      {/* Header */}
      <header className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent" />
            <h1 className="text-2xl font-bold text-glow">AuraSync</h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Navigation Menu */}
            <nav className="hidden md:flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => scrollToSection('main-app')}>
                App
              </Button>
              <Button variant="ghost" size="sm" onClick={() => scrollToSection('features')}>
                Features
              </Button>
              <Button variant="ghost" size="sm" onClick={() => scrollToSection('how-it-works')}>
                How it Works
              </Button>
            </nav>

            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Intro Section */}
        <div className="max-w-4xl mx-auto text-center mt-12 mb-8">
          <h2 className="text-4xl md:text-5xl font-bold text-glow mb-4">
            Discover Your Emotional Journey
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Experience AI-powered emotion detection that transforms your feelings into personalized music and visual experiences.
          </p>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => scrollToSection('main-app')} size="lg">
              Start Detecting
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => scrollToSection('features')} size="lg">
              Learn More
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-app" className="relative z-10 container mx-auto px-6 pb-12">
        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {/* Left Panel - Emotion Detection */}
          <div className="lg:col-span-1 space-y-6">
            <EmotionDetector
              onEmotionDetected={handleEmotionDetected}
            />
          </div>

          {/* Center - Aura Visualizer */}
          <div className="lg:col-span-1 flex items-center justify-center">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-glow mb-2">Your Aura</h2>
                <p className="text-muted-foreground">
                  Reflecting your current mood:
                  <span className="capitalize font-medium text-primary ml-1">
                    {currentEmotion}
                  </span>
                </p>
              </div>

              <AuraVisualizer
                emotion={currentEmotion}
                intensity={0.8}
                className="w-64 h-64 mx-auto"
              />

              <p className="text-sm text-muted-foreground max-w-sm">
                Your aura changes color and intensity based on your detected emotions,
                creating a personalized visual representation of your inner state.
              </p>
            </div>
          </div>

          {/* Right Panel - Music Recommendations */}
          <div className="lg:col-span-1 space-y-6">
            <MusicRecommendations
              emotion={currentEmotion}
              onSavePlaylist={handleSavePlaylist}
            />
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-16 bg-muted/20">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-glow mb-12">Powerful Features</h2>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6 text-center glass border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI Emotion Detection</h3>
                <p className="text-muted-foreground">
                  Advanced facial recognition technology analyzes your expressions in real-time to detect emotions with high accuracy.
                </p>
              </Card>

              <Card className="p-6 text-center glass border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Music className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Personalized Playlists</h3>
                <p className="text-muted-foreground">
                  Get music recommendations tailored to your current mood and save them directly to your Spotify account.
                </p>
              </Card>

              <Card className="p-6 text-center glass border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Dynamic Aura Visualization</h3>
                <p className="text-muted-foreground">
                  Watch your aura change colors and patterns based on your emotions, creating a beautiful visual representation.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-glow mb-12">How It Works</h2>

            <div className="space-y-12">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="md:w-1/2">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Enable Your Camera</h3>
                  <p className="text-muted-foreground">
                    Allow camera access to start emotion detection. Our AI analyzes your facial expressions in real-time while keeping your privacy secure.
                  </p>
                </div>
                <div className="md:w-1/2">
                  <Card className="p-6 glass border-border/50">
                    <div className="w-full h-32 bg-muted/50 rounded-lg flex items-center justify-center">
                      <Camera className="w-12 h-12 text-muted-foreground" />
                    </div>
                  </Card>
                </div>
              </div>

              <div className="flex flex-col md:flex-row-reverse items-center gap-8">
                <div className="md:w-1/2">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">2</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Emotion Analysis</h3>
                  <p className="text-muted-foreground">
                    Our AI processes your expressions and identifies emotions like happiness, sadness, surprise, and more with remarkable accuracy.
                  </p>
                </div>
                <div className="md:w-1/2">
                  <Card className="p-6 glass border-border/50">
                    <div className="w-full h-32 bg-muted/50 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-12 h-12 text-muted-foreground" />
                    </div>
                  </Card>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="md:w-1/2">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">3</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">Personalized Experience</h3>
                  <p className="text-muted-foreground">
                    Watch your aura transform and receive music recommendations that match your mood. Take photos to capture your emotional moments.
                  </p>
                </div>
                <div className="md:w-1/2">
                  <Card className="p-6 glass border-border/50">
                    <div className="w-full h-32 bg-muted/50 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-12 h-12 text-muted-foreground" />
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-sm text-muted-foreground">
        <p>
          Powered by emotion detection and Spotify integration •
          <span className="text-primary"> AuraSync</span>
        </p>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 rounded-full w-12 h-12 shadow-lg"
          size="icon"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};

export default Index;
