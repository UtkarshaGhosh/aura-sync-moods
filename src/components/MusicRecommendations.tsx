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

// ... (keep the Track interface and mockRecommendations object)

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
            if (newTracks.length > 0) {
              toast.success(`Perfect ${emotion} vibes found!`, {
                  description: `Generated ${newTracks.length} personalized tracks from Spotify.`,
              });
            } else {
              setTracks(mockRecommendations[emotion] || mockRecommendations.neutral);
              toast.info(`Could not find Spotify tracks for ${emotion}`, {
                  description: 'Displaying sample recommendations instead.',
              });
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

  // ... (keep the rest of the functions as they are)

  useEffect(() => {
    if (emotion) {
      generatePlaylist();
    }
  }, [emotion, generatePlaylist]);

  // ... (keep the JSX return statement as it is)
};

export default MusicRecommendations;
