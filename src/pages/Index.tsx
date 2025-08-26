import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AuraVisualizer from '@/components/AuraVisualizer';
import EmotionDetector from '@/components/EmotionDetector';
import MusicRecommendations from '@/components/MusicRecommendations';
import { Button } from '@/components/ui/button';
import { Music, Settings, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  preview_url: string | null;
}

const Index = () => {
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const { user, loading, signOut, isAuthenticated } = useAuth();

  const handleEmotionDetected = async (emotion: string, source: 'webcam' | 'emoji') => {
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
        console.error('Error saving mood history:', error);
      }
    }
    
    toast.success(`Mood detected: ${emotion}`, {
      description: `Generating ${emotion} music recommendations...`,
      duration: 3000,
    });
  };

  const handleSavePlaylist = async (tracks: Track[]) => {
    // In a real app, this would save to user's Spotify library
    toast.success('Playlist saved!', {
      description: `Added ${tracks.length} tracks to your Spotify library`,
      duration: 3000,
    });
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
        className="fixed inset-0 transition-all duration-[3000ms] ease-out"
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
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-6 pb-12">
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

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-sm text-muted-foreground">
        <p>
          Powered by emotion detection and Spotify integration • 
          <span className="text-primary"> AuraSync</span>
        </p>
      </footer>
    </div>
  );
};

export default Index;
