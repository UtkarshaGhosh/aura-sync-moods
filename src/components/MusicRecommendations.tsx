import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export interface Track {
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

const mockRecommendations: Record<string, Track[]> = {
  happy: [
    {
      id: 'mock-h-1',
      name: 'Sunny Days',
      artist: 'The Brights',
      album: 'Gold Sky',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: ''
    },
    {
      id: 'mock-h-2',
      name: 'Smile Again',
      artist: 'Good Vibes',
      album: 'Feel Great',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: ''
    }
  ],
  sad: [
    {
      id: 'mock-s-1',
      name: 'Blue Hour',
      artist: 'Quiet Rivers',
      album: 'Rainy Streets',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: ''
    }
  ],
  angry: [
    {
      id: 'mock-a-1',
      name: 'Roar Inside',
      artist: 'Voltage',
      album: 'Ignite',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: ''
    }
  ],
  calm: [
    {
      id: 'mock-c-1',
      name: 'Gentle Breeze',
      artist: 'Evening Shore',
      album: 'Sea Foam',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: ''
    }
  ],
  excited: [
    {
      id: 'mock-e-1',
      name: 'Lift Off',
      artist: 'Star Trails',
      album: 'Orbit',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: ''
    }
  ],
  neutral: [
    {
      id: 'mock-n-1',
      name: 'Wandering',
      artist: 'Open Roads',
      album: 'Horizons',
      image: '/placeholder.svg',
      preview_url: null,
      spotify_url: ''
    }
  ]
};

const getGenresForEmotion = (emotion: string): string[] => {
  switch (emotion.toLowerCase()) {
    case 'happy':
      return ['pop', 'dance', 'indie-pop'];
    case 'sad':
      return ['acoustic', 'piano', 'ambient'];
    case 'angry':
      return ['rock', 'metal', 'hard-rock'];
    case 'calm':
      return ['chill', 'lo-fi', 'ambient'];
    case 'excited':
      return ['edm', 'house', 'electro'];
    case 'neutral':
    default:
      return ['pop', 'indie', 'alternative'];
  }
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

  const headerText = useMemo(() => `Music for your ${emotion} mood`, [emotion]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTrack(null);
  };

  const playPreview = (track: Track) => {
    if (!track.preview_url) {
      toast.info('No preview available for this track');
      return;
    }
    if (currentTrack === track.id && isPlaying) {
      stopAudio();
      return;
    }
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(track.preview_url);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setCurrentTrack(null);
      };
      setCurrentTrack(track.id);
      setIsPlaying(true);
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
        toast.error('Could not play preview');
      });
    } catch (e) {
      setIsPlaying(false);
    }
  };

  const insertSuggestions = async (suggestions: Track[]) => {
    if (!user || !moodHistoryId || suggestions.length === 0) return;
    try {
      const payload = suggestions.map((t) => ({
        mood_history_id: moodHistoryId,
        track_id: t.id,
        track_name: t.name,
        artist_name: t.artist,
        album_name: t.album,
        image_url: t.image,
        preview_url: t.preview_url,
        spotify_url: t.spotify_url || null
      }));
      const { error } = await supabase.from('music_suggestions').insert(payload);
      if (error) {
        console.warn('Failed to save music suggestions:', error.message);
      }
    } catch (e) {
      console.warn('Unexpected error saving suggestions', e);
    }
  };

  const getSpotifyTracks = async (accessToken: string) => {
    const audioFeatures = getEmotionAudioFeatures(emotion);
    const response = await getRecommendations(accessToken, {
      seedGenres: getGenresForEmotion(emotion),
      ...audioFeatures,
      limit: 10
    });
    return response.tracks.map(convertSpotifyTrack);
  };

  const generatePlaylist = useCallback(async () => {
    setIsGenerating(true);
    setTracks([]);

    if (!user) {
      const fallback = mockRecommendations[emotion] || mockRecommendations.neutral;
      setTracks(fallback);
      setIsGenerating(false);
      return;
    }

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('access_token, refresh_token, spotify_user_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.access_token) {
        setIsSpotifyConnected(false);
        const fallback = mockRecommendations[emotion] || mockRecommendations.neutral;
        setTracks(fallback);
        toast.info(`Sample ${emotion} tracks`, {
          description: 'Connect Spotify in your profile for personalized music.'
        });
        return;
      }

      setIsSpotifyConnected(true);
      let currentAccessToken = profile.access_token as string;

      try {
        const newTracks = await getSpotifyTracks(currentAccessToken);
        const converted: Track[] = newTracks.map((t: any) => t);
        setTracks(converted);
        insertSuggestions(converted);
        if (converted.length > 0) {
          toast.success(`Perfect ${emotion} vibes found!`, {
            description: `Generated ${converted.length} personalized tracks from Spotify.`
          });
        } else {
          const fallback = mockRecommendations[emotion] || mockRecommendations.neutral;
          setTracks(fallback);
          toast.info(`Could not find Spotify tracks for ${emotion}`, {
            description: 'Displaying sample recommendations instead.'
          });
        }
      } catch (error: any) {
        if (error instanceof Error && error.message === 'SPOTIFY_TOKEN_EXPIRED' && profile?.refresh_token) {
          toast.info('Spotify token expired. Refreshing automatically...');
          try {
            const newTokens = await refreshSpotifyToken(profile.refresh_token);
            await supabase
              .from('profiles')
              .update({ access_token: newTokens.access_token, refresh_token: newTokens.refresh_token })
              .eq('id', user.id);

            currentAccessToken = newTokens.access_token;
            const newTracks = await getSpotifyTracks(currentAccessToken);
            const converted: Track[] = newTracks.map((t: any) => t);
            setTracks(converted);
            insertSuggestions(converted);
            toast.success('Spotify connection refreshed!', {
              description: 'Here are your new recommendations.'
            });
          } catch (refreshError) {
            console.error('Failed to refresh Spotify token:', refreshError);
            setIsSpotifyConnected(false);
            const fallback = mockRecommendations[emotion] || mockRecommendations.neutral;
            setTracks(fallback);
            toast.error('Could not refresh Spotify session.', {
              description: 'Please disconnect and reconnect your account in your profile.'
            });
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error generating playlist:', error);
      toast.error('Failed to generate recommendations.');
      const fallback = mockRecommendations[emotion] || mockRecommendations.neutral;
      setTracks(fallback);
    } finally {
      setIsGenerating(false);
    }
  }, [emotion, user, moodHistoryId]);

  useEffect(() => {
    if (emotion) {
      generatePlaylist();
    }
    // Stop any playing audio on emotion change
    return () => stopAudio();
  }, [emotion, generatePlaylist]);

  const handleSave = () => {
    if (tracks.length === 0) {
      toast.info('Nothing to save yet');
      return;
    }
    onSavePlaylist(tracks);
  };

  return (
    <Card className={cn('glass border-border/50', className)}>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">{headerText}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={generatePlaylist} disabled={isGenerating}>
              <Shuffle className="w-4 h-4 mr-2" />
              {isGenerating ? 'Generating...' : 'New Mix'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!isSpotifyConnected || tracks.length === 0}>
              <Save className="w-4 h-4 mr-2" />
              Save Playlist
            </Button>
          </div>
        </div>

        {tracks.length === 0 && (
          <div className="text-sm text-muted-foreground">No tracks yet. Generate a mix to get started.</div>
        )}

        <div className="space-y-3">
          {tracks.map((track) => (
            <div key={track.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/20">
              <img src={track.image} alt={track.name} className="w-12 h-12 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{track.name}</div>
                <div className="text-sm text-muted-foreground truncate">{track.artist} • {track.album}</div>
              </div>
              {track.spotify_url && (
                <Button variant="ghost" size="icon" onClick={() => window.open(track.spotify_url!, '_blank')} aria-label="Open in Spotify">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => playPreview(track)}
                disabled={!track.preview_url}
                aria-label={currentTrack === track.id && isPlaying ? 'Pause preview' : 'Play preview'}
              >
                {currentTrack === track.id && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
            </div>
          ))}
        </div>

        {!isSpotifyConnected && (
          <div className="text-xs text-muted-foreground">
            Connect Spotify in your profile to get personalized recommendations.
          </div>
        )}
      </div>
    </Card>
  );
};

export default MusicRecommendations;
