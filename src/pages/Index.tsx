import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuraVisualizer from '@/components/AuraVisualizer';
import EmotionDetector from '@/components/EmotionDetector';
import MusicRecommendations from '@/components/MusicRecommendations';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Music, User, LogOut, ChevronDown, ArrowUp, BarChart3, Sparkles, Camera } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { createPlaylist, addTracksToPlaylist, isSpotifyPremium } from '@/lib/spotify';
import { useI18n } from '@/i18n/I18nProvider';
import LanguageSelector from '@/components/LanguageSelector';

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
  const { t } = useI18n();
  const [currentEmotion, setCurrentEmotion] = useState<string>('neutral');
  const [currentMoodHistoryId, setCurrentMoodHistoryId] = useState<number | null>(null);
  const { user, loading, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [spotifyCredentials, setSpotifyCredentials] = useState<{
    access_token: string;
    spotify_user_id: string;
  } | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const handleScroll = () => setShowScrollToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const loadSpotifyCredentials = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('access_token, spotify_user_id')
          .eq('id', user.id)
          .single();
        if (!error && data?.access_token && data?.spotify_user_id) {
          setSpotifyCredentials({ access_token: data.access_token, spotify_user_id: data.spotify_user_id });
        }
      } catch {}
    };
    loadSpotifyCredentials();
  }, [user]);

  const handleEmotionDetected = async (emotion: string, source: 'webcam' | 'emoji' | 'upload') => {
    setCurrentEmotion(emotion);
    if (user) {
      try {
        const { data: moodEntry, error } = await supabase
          .from('mood_history')
          .insert({ user_id: user.id, emotion, source })
          .select()
          .single();
        if (!error && moodEntry) setCurrentMoodHistoryId(moodEntry.id);
      } catch {}
    }
  };

  const handleSavePlaylist = async (tracks: Track[]) => {
    if (!spotifyCredentials || tracks.length === 0) return;
    try {
      const premium = await isSpotifyPremium(spotifyCredentials.access_token);
      if (!premium) return;
    } catch {}

    try {
      const playlistName = `AuraSync - ${currentEmotion.charAt(0).toUpperCase() + currentEmotion.slice(1)} Vibes`;
      const playlistDescription = `AI-generated playlist for your ${currentEmotion} mood. Created by AuraSync on ${new Date().toLocaleDateString()}`;

      const playlist = await createPlaylist(
        spotifyCredentials.spotify_user_id,
        playlistName,
        playlistDescription,
        spotifyCredentials.access_token
      );

      const trackUris = tracks.filter(track => track.id && !track.id.startsWith('mock')).map(track => `spotify:track:${track.id}`);
      if (trackUris.length === 0) return;

      await addTracksToPlaylist(playlist.id, trackUris, spotifyCredentials.access_token);
    } catch (error) {
      if (error instanceof Error && error.message === 'SPOTIFY_TOKEN_EXPIRED') {
        setSpotifyCredentials(null);
      }
    }
  };

  const handleLogout = async () => {
    try { await signOut(); } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div
        className="fixed inset-0 transition-all duration-[3000ms] ease-out"
        style={{
          background: `radial-gradient(circle at 50% 50%, 
            hsl(var(--emotion-${currentEmotion}) / 0.1) 0%,
            hsl(var(--background)) 50%,
            hsl(var(--emotion-${currentEmotion}) / 0.05) 100%)`
        }}
      />

      <header className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="https://i.ibb.co/4nDnvPR0/1.png" alt="AuraSync logo" className="w-8 h-8 rounded-full object-cover" />
            <h1 className="text-2xl font-bold text-glow">AuraSync</h1>
          </div>

          <div className="flex items-center space-x-4">
            <nav className="hidden md:flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={() => scrollToSection('main-app')}>
                {t('nav.app')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => scrollToSection('features')}>
                {t('nav.features')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => scrollToSection('how-it-works')}>
                {t('nav.how')}
              </Button>
            </nav>
            <LanguageSelector />
            <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
              <User className="w-4 h-4 mr-2" />
              {t('nav.profile')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              {t('nav.logout')}
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto text-center mt-12 mb-8">
          <h2 className="text-4xl md:text-5xl font-bold text-glow mb-4">
            {t('index.hero.title')}
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            {t('index.hero.subtitle')}
          </p>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => scrollToSection('main-app')} size="lg">
              {t('nav.start_ai')}
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => scrollToSection('features')} size="lg">
              {t('nav.learn_more')}
            </Button>
          </div>
        </div>
      </header>

      <main id="main-app" className="relative z-10 container mx-auto px-6 pb-12">
        <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          <div className="lg:col-span-1 space-y-6">
            <EmotionDetector onEmotionDetected={handleEmotionDetected} />
          </div>

          <div className="lg:col-span-1 flex items-center justify-center">
            <div className="text-center space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-glow mb-2">{t('index.aura.title')}</h2>
                <p className="text-muted-foreground">
                  {t('index.aura.reflect')}
                  <span className="capitalize font-medium text-primary ml-1">{currentEmotion}</span>
                </p>
              </div>

              <AuraVisualizer emotion={currentEmotion} intensity={0.8} className="w-64 h-64 mx-auto" />

              <p className="text-sm text-muted-foreground max-w-sm">
                {t('index.aura.desc')}
              </p>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <MusicRecommendations emotion={currentEmotion} onSavePlaylist={handleSavePlaylist} moodHistoryId={currentMoodHistoryId} />
          </div>
        </div>
      </main>

      <section id="features" className="relative z-10 py-16 bg-muted/20">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-glow mb-12">{t('features.title')}</h2>

            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6 text-center glass border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{t('features.ai.title')}</h3>
                <p className="text-muted-foreground">{t('features.ai.desc')}</p>
              </Card>

              <Card className="p-6 text-center glass border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Music className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{t('features.playlists.title')}</h3>
                <p className="text-muted-foreground">{t('features.playlists.desc')}</p>
              </Card>

              <Card className="p-6 text-center glass border-border/50">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{t('features.aura.title')}</h3>
                <p className="text-muted-foreground">{t('features.aura.desc')}</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-glow mb-12">{t('how.title')}</h2>

            <div className="space-y-12">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="md:w-1/2">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{t('how.step1.title')}</h3>
                  <p className="text-muted-foreground">{t('how.step1.desc')}</p>
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
                  <h3 className="text-xl font-semibold mb-3">{t('how.step2.title')}</h3>
                  <p className="text-muted-foreground">{t('how.step2.desc')}</p>
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
                  <h3 className="text-xl font-semibold mb-3">{t('how.step3.title')}</h3>
                  <p className="text-muted-foreground">{t('how.step3.desc')}</p>
                </div>
                <div className="md=w-1/2">
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

      <footer className="relative z-10 text-center py-6 text-sm text-muted-foreground">
        <p>{t('footer.powered')}</p>
      </footer>

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
