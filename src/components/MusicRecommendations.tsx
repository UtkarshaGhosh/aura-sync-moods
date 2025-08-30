import React, { useState, useEffect, useCallback } from 'react';
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
  moodHistoryId?: number;
}

// Mock data for different emotions
const mockRecommendations: Record<string, Track[]> = {
    happy: [ { id: 'mock-1', name: 'Good as Hell', artist: 'Lizzo', album: 'Good as Hell', image: '/placeholder.svg', preview_url: null, }, { id: 'mock-2', name: 'Can\'t Stop the Feeling!', artist: 'Justin Timberlake', album: 'Trolls', image: '/placeholder.svg', preview_url: null, }, { id: 'mock-3', name: 'Happy', artist: 'Pharrell Williams', album: 'Girl', image: '/placeholder.svg', preview_url: null, }, ],
    sad: [ { id: 'mock-4', name: 'Someone Like You', artist: 'Adele', album: '21', image: '/placeholder.svg', preview_url: null, }, { id: 'mock-5', name: 'Breathe Me', artist: 'Sia', album: 'Colour the Small One', image: '/placeholder.svg', preview_url: null, }, { id: 'mock-6', name: 'Mad World', artist: 'Gary Jules', album: 'Donnie Darko', image: '/placeholder.svg', preview_url: null, }, ],
    calm: [ { id: 'mock-7', name: 'Weightless', artist: 'Marconi Union', album: 'Weightless', image: '/placeholder.svg', preview_url: null, }, { id: 'mock-8', name: 'River', artist: 'Leon Bridges', album: 'Coming Home', image: '/placeholder.svg', preview_url: null, }, { id: 'mock-9', name: 'Holocene', artist: 'Bon Iver', album: 'Bon Iver, Bon Iver', image: '/placeholder.svg', preview_url: null, }, ],
    neutral: [ { id: 'mock-10', name: 'The Middle', artist: 'Jimmy Eat World', album: 'Bleed American', image: '/placeholder.svg', preview_url: null, }, { id: 'mock-11', name: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours', image: '/placeholder.svg', preview_url: null, }, { id: 'mock-12', name: 'Losing You', artist: 'Solange', album: 'True', image: '/placeholder.svg', preview_url: null, }, ],
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

  const getSpotifyTracks = async (accessToken: string) => {
    const audioFeatures = getEmotionAudioFeatures(emotion);
    const response = await getRecommendations(accessToken, {
        seedGenres: getGenresForEmotion(emotion),
        ...audioFeatures,
        limit: 10,
    });
    return response.tracks.map(convertSpotifyTrack);
  };

  const generatePlaylist = useCallback(async () => {
    setIsGenerating(true);
    setTracks([]);

    if (!user) {
        setTracks(mockRecommendations[emotion] || mockRecommendations.neutral);
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
            setTracks(mockRecommendations[emotion] || mockRecommendations.neutral);
            toast.info(`Sample ${emotion} tracks`, {
                description: 'Connect Spotify in your profile for personalized music.',
            });
            return;
        }

        setIsSpotifyConnected(true);
        let currentAccessToken = profile.access_token;

        try {
            const newTracks = await getSpotifyTracks(currentAccessToken);
            setTracks(newTracks);
            toast.success(`Perfect ${emotion} vibes found!`, {
                description: `Generated ${newTracks.length} personalized tracks from Spotify.`,
            });
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
                } catch (refreshError) {
                    console.error('Failed to refresh Spotify token:', refreshError);
                    setIsSpotifyConnected(false);
                    setTracks(mockRecommendations[emotion] || mockRecommendations.neutral);
                    toast.error('Could not refresh Spotify session.', {
                        description: 'Please disconnect and reconnect your account in your profile.',
                    });
                }
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('🎵 [MusicRecs] Error generating playlist:', error);
        toast.error('Failed to generate recommendations.');
        setTracks(mockRecommendations[emotion] || mockRecommendations.neutral);
    } finally {
        setIsGenerating(false);
    }
  }, [emotion, user]);

  const getGenresForEmotion = (emotion: string): string[] => {
    switch (emotion.toLowerCase()) {
      case 'happy': return ['pop', 'dance', 'funk'];
      case 'sad': return ['blues', 'indie', 'acoustic'];
      case 'angry': return ['rock', 'metal', 'punk'];
      case 'calm': return ['ambient', 'classical', 'chill'];
      case 'excited': return ['electronic', 'pop', 'dance'];
      default: return ['pop', 'indie', 'alternative'];
    }
  };

  const saveMusicSuggestions = async (tracks: Track[], moodHistoryId: number) => {
    // This function is now called from Index.tsx
  };

  const handlePlayPause = (trackId: string) => {
    if (currentTrack === trackId && isPlaying) {
      setIsPlaying(false);
      setCurrentTrack(null);
    } else {
      setIsPlaying(true);
      setCurrentTrack(trackId);
    }
  };

  const handleSavePlaylist = () => {
    onSavePlaylist(tracks);
  };
  
  useEffect(() => {
    if (emotion) {
      generatePlaylist();
    }
  }, [emotion, generatePlaylist]);


  return (
    <Card className={cn("glass border-border/50", className)}>
        <div className="p-6 space-y-6">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-glow">
                        Music for {emotion ? emotion.charAt(0).toUpperCase() + emotion.slice(1) : 'Your Mood'}
                    </h3>
                    <Button
                        onClick={generatePlaylist}
                        disabled={isGenerating || !emotion}
                        variant="outline"
                        size="sm"
                    >
                        <Shuffle className="w-4 h-4 mr-2" />
                        {isGenerating ? 'Generating...' : 'Refresh'}
                    </Button>
                </div>
                {emotion && (
                    <div className="text-center p-3 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
                        <p className="text-sm text-muted-foreground mb-1">
                            {isGenerating ? (
                                <span className="flex items-center justify-center space-x-2">
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <span>Analyzing your <span className="capitalize font-medium text-primary">{emotion}</span> mood...</span>
                                </span>
                            ) : (
                                <span>
                                    Curated for your <span className="capitalize font-medium text-primary">{emotion}</span> mood
                                </span>
                            )}
                        </p>
                    </div>
                )}
            </div>

            {isGenerating ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 p-3 bg-muted/20 rounded-lg animate-pulse">
                            <div className="w-12 h-12 bg-muted rounded"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-muted rounded w-3/4"></div>
                                <div className="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : tracks.length > 0 ? (
                <div className="space-y-3">
                    {tracks.map((track) => (
                        <div
                            key={track.id}
                            className="flex items-center space-x-4 p-3 bg-card/50 rounded-lg border border-border/50 hover:bg-card/70 transition-colors"
                        >
                            <div className="relative">
                                <img
                                    src={track.image}
                                    alt={track.album}
                                    className="w-12 h-12 rounded object-cover"
                                />
                                <Button
                                    onClick={() => handlePlayPause(track.id)}
                                    size="sm"
                                    className="absolute inset-0 w-full h-full bg-black/50 hover:bg-black/70 rounded"
                                >
                                    {currentTrack === track.id && isPlaying ? (
                                        <Pause className="w-4 h-4" />
                                    ) : (
                                        <Play className="w-4 h-4" />
                                    )}
                                </Button>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{track.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                            </div>
                            {track.spotify_url && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(track.spotify_url, '_blank')}
                                    className="p-2"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-8 text-muted-foreground">
                    <Music className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select an emotion to get music recommendations</p>
                </div>
            )}

            {tracks.length > 0 && (
                <Button
                    onClick={handleSavePlaylist}
                    className="w-full glow-primary"
                    size="lg"
                    disabled={!isSpotifyConnected}
                >
                    <Save className="w-5 h-5 mr-2" />
                    {isSpotifyConnected ? 'Save Playlist to Spotify' : 'Connect Spotify to Save'}
                </Button>
            )}

            {tracks.length > 0 && !isSpotifyConnected && (
                <p className="text-center text-sm text-muted-foreground">
                    <a href="/profile" className="text-primary hover:underline">
                        Connect Spotify in settings
                    </a> to save playlists to your library
                </p>
            )}
        </div>
    </Card>
  );
};

export default MusicRecommendations;
