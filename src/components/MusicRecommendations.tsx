import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, Save, Music, Shuffle, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  getRecommendations,
  getEmotionAudioFeatures,
  convertSpotifyTrack,
  SpotifyTrack,
  refreshSpotifyToken
} from '@/lib/spotify';

interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  preview_url: string | null;
  spotify_url?: string;
}

interface MusicRecommendationsProps {
  emotion: string;
  onSavePlaylist: (tracks: Track[]) => void;
  className?: string;
  moodHistoryId?: number | null;
}

const genreMap: Record<string, string[]> = {
  happy: ['pop', 'dance', 'party', 'summer', 'funk'],
  sad: ['acoustic', 'piano', 'singer-songwriter', 'ambient', 'chill'],
  angry: ['metal', 'hard-rock', 'punk', 'industrial'],
  calm: ['chill', 'ambient', 'lo-fi', 'classical', 'sleep'],
  excited: ['edm', 'house', 'dance', 'pop', 'electro'],
  surprised: ['indie-pop', 'alternative', 'electronic'],
  neutral: ['indie', 'pop', 'alternative']
};

const getGenresForEmotion = (emotion: string): string[] => {
  return genreMap[emotion.toLowerCase()] || genreMap.neutral;
};

const buildMockTracks = (emotion: string): Track[] => {
  const base: Track[] = [
    {
      id: `mock-${emotion}-1`,
      name: 'Midnight Drive',
      artist: 'Neon Skyline',
      album: 'City Lights',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: undefined,
    },
    {
      id: `mock-${emotion}-2`,
      name: 'Ocean Breeze',
      artist: 'Blue Horizon',
      album: 'Tidal Waves',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: undefined,
    },
    {
      id: `mock-${emotion}-3`,
      name: 'Golden Hour',
      artist: 'Sunset Avenue',
      album: 'Evening Glow',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: undefined,
    },
    {
      id: `mock-${emotion}-4`,
      name: 'Starlight',
      artist: 'Aurora Fields',
      album: 'Northern Skies',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: undefined,
    },
    {
      id: `mock-${emotion}-5`,
      name: 'Echoes',
      artist: 'Glass Garden',
      album: 'Reflections',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: undefined,
    },
  ];
  return base;
};

const MusicRecommendations: React.FC<MusicRecommendationsProps> = ({
  emotion,
  onSavePlaylist,
  className,
  moodHistoryId
}) => {
  const { user } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getSpotifyTracks = async (accessToken: string) => {
    const audioFeatures = getEmotionAudioFeatures(emotion);
    const response = await getRecommendations(accessToken, {
      seedGenres: getGenresForEmotion(emotion),
      ...audioFeatures,
      limit: 10,
    });
    return response.tracks.map(convertSpotifyTrack) as Track[];
  };

  const persistSuggestions = useCallback(async (newTracks: Track[]) => {
    if (!user || !moodHistoryId || newTracks.length === 0) return;
    try {
      await supabase.from('music_suggestions').insert(
        newTracks.map(t => ({
          mood_history_id: moodHistoryId,
          track_id: t.id,
          track_name: t.name,
          artist_name: t.artist,
          album_name: t.album || null,
          image_url: t.image || null,
          preview_url: t.preview_url,
          spotify_url: t.spotify_url || null,
        }))
      );
    } catch (e) {
      console.warn('Failed to persist music suggestions:', e);
    }
  }, [user, moodHistoryId]);

  const generatePlaylist = useCallback(async () => {
    setIsGenerating(true);
    setTracks([]);

    if (!user) {
      const mock = buildMockTracks(emotion);
      setTracks(mock);
      setIsGenerating(false);
      return;
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('access_token, refresh_token, spotify_user_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.access_token || !profile?.refresh_token) {
        setIsSpotifyConnected(false);
        const mock = buildMockTracks(emotion);
        setTracks(mock);
        toast.info(`Sample ${emotion} tracks`, {
          description: 'Connect Spotify in your profile for personalized music.',
        });
        await persistSuggestions(mock);
        return;
      }

      setIsSpotifyConnected(true);
      let currentAccessToken = profile.access_token;

      try {
        const newTracks = await getSpotifyTracks(currentAccessToken);
        setTracks(newTracks);
        if (newTracks.length > 0) {
          toast.success(`Perfect ${emotion} vibes found!`, {
            description: `Generated ${newTracks.length} personalized tracks from Spotify.`,
          });
          await persistSuggestions(newTracks);
        } else {
          const mock = buildMockTracks(emotion);
          setTracks(mock);
          toast.info(`Could not find Spotify tracks for ${emotion}`, {
            description: 'Displaying sample recommendations instead.',
          });
          await persistSuggestions(mock);
        }
      } catch (error) {
        if (error instanceof Error && error.message === 'SPOTIFY_TOKEN_EXPIRED') {
          toast.info('Spotify token expired. Refreshing automatically...');
          try {
            const newTokens = await refreshSpotifyToken(profile.refresh_token);
            await supabase.from('profiles').update({
              access_token: newTokens.access_token,
              refresh_token: newTokens.refresh_token
            }).eq('id', user.id);

            currentAccessToken = newTokens.access_token;
            const newTracks = await getSpotifyTracks(currentAccessToken);
            setTracks(newTracks);
            toast.success('Spotify connection refreshed!', {
              description: 'Here are your new recommendations.',
            });
            await persistSuggestions(newTracks);
          } catch (refreshError) {
            console.error('Failed to refresh Spotify token:', refreshError);
            setIsSpotifyConnected(false);
            const mock = buildMockTracks(emotion);
            setTracks(mock);
            toast.error('Could not refresh Spotify session.', {
              description: 'Please disconnect and reconnect your account in your profile.',
            });
            await persistSuggestions(mock);
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('MusicRecs: Error generating playlist:', error);
      toast.error('Failed to generate recommendations.');
      const mock = buildMockTracks(emotion);
      setTracks(mock);
      await persistSuggestions(mock);
    } finally {
      setIsGenerating(false);
    }
  }, [emotion, user, persistSuggestions]);

  const handlePlayPause = (track: Track) => {
    if (!track.preview_url) return;

    if (audioRef.current && currentTrack === track.id) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    audioRef.current = new Audio(track.preview_url);
    audioRef.current.onended = () => {
      setIsPlaying(false);
      setCurrentTrack(null);
    };
    audioRef.current.play().then(() => {
      setIsPlaying(true);
      setCurrentTrack(track.id);
    }).catch(() => {
      setIsPlaying(false);
      setCurrentTrack(null);
    });
  };

  const handleSave = () => {
    if (tracks.length === 0) {
      toast.info('Generate some recommendations first');
      return;
    }
    onSavePlaylist(tracks);
  };

  const headerStatus = useMemo(() => {
    if (isGenerating) return 'Generating...';
    return isSpotifyConnected ? 'Spotify Connected' : 'Sample Mode';
  }, [isGenerating, isSpotifyConnected]);

  useEffect(() => {
    if (emotion) {
      generatePlaylist();
    }
    // Cleanup audio on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [emotion, generatePlaylist]);

  return (
    <Card className={cn('glass border-border/50 p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Music Recommendations</h3>
        </div>
        <span className={cn('text-xs px-2 py-1 rounded', isSpotifyConnected ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600')}>
          {headerStatus}
        </span>
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" onClick={generatePlaylist} disabled={isGenerating} variant="secondary">
          <Shuffle className="w-4 h-4 mr-2" />
          Refresh
        </Button>
        <Button size="sm" onClick={handleSave} disabled={tracks.length === 0}>
          <Save className="w-4 h-4 mr-2" />
          Save Playlist
        </Button>
      </div>

      {tracks.length === 0 ? (
        <div className="text-sm text-muted-foreground">No tracks yet. Choose a mood to generate music.</div>
      ) : (
        <ul className="space-y-3">
          {tracks.map((track) => (
            <li key={track.id} className="flex items-center gap-3 p-2 rounded border border-border/50">
              <img src={track.image} alt={track.name} className="w-12 h-12 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{track.name}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artist} • {track.album}</p>
              </div>
              {track.preview_url && (
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => handlePlayPause(track)}>
                  {currentTrack === track.id && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              )}
              {track.spotify_url && (
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(track.spotify_url!, '_blank')}>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

export default MusicRecommendations;
