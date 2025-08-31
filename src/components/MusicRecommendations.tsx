import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Save, Music, Shuffle, ExternalLink, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  searchPlaylists,
  getEmotionGenre,
  refreshSpotifyToken,
  SpotifyPlaylist
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

interface PlaylistDisplay {
  id: string;
  name: string;
  description: string;
  image: string;
  trackCount: number;
  owner: string;
  spotifyUrl: string;
}

const mockPlaylists: Record<string, PlaylistDisplay[]> = {
  happy: [
    {
      id: 'mock-h-1',
      name: 'Feel Good Pop Hits',
      description: 'Upbeat songs to brighten your day',
      image: '/placeholder.svg',
      trackCount: 50,
      owner: 'Spotify',
      spotifyUrl: ''
    },
    {
      id: 'mock-h-2',
      name: 'Happy Vibes Only',
      description: 'Pure happiness in musical form',
      image: '/placeholder.svg',
      trackCount: 30,
      owner: 'Music Curator',
      spotifyUrl: ''
    }
  ],
  sad: [
    {
      id: 'mock-s-1',
      name: 'Rainy Day Acoustics',
      description: 'Gentle songs for reflection',
      image: '/placeholder.svg',
      trackCount: 25,
      owner: 'Indie Collective',
      spotifyUrl: ''
    }
  ],
  angry: [
    {
      id: 'mock-a-1',
      name: 'Rock Rage',
      description: 'Channel your energy with powerful rock',
      image: '/placeholder.svg',
      trackCount: 40,
      owner: 'Rock Central',
      spotifyUrl: ''
    }
  ],
  calm: [
    {
      id: 'mock-c-1',
      name: 'Peaceful Moments',
      description: 'Ambient sounds for relaxation',
      image: '/placeholder.svg',
      trackCount: 35,
      owner: 'Zen Music',
      spotifyUrl: ''
    }
  ],
  excited: [
    {
      id: 'mock-e-1',
      name: 'Electronic Energy',
      description: 'High-energy electronic beats',
      image: '/placeholder.svg',
      trackCount: 45,
      owner: 'EDM Masters',
      spotifyUrl: ''
    }
  ],
  neutral: [
    {
      id: 'mock-n-1',
      name: 'Chill Mix',
      description: 'Relaxed music for any mood',
      image: '/placeholder.svg',
      trackCount: 30,
      owner: 'Chill Hub',
      spotifyUrl: ''
    }
  ]
};

const MusicRecommendations: React.FC<MusicRecommendationsProps> = ({
  emotion,
  onSavePlaylist,
  className,
  moodHistoryId
}) => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistDisplay[]>([]);
  const [allPlaylists, setAllPlaylists] = useState<PlaylistDisplay[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const BATCH_SIZE = 5;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDisplay | null>(null);

  const [language, setLanguage] = useState<'all' | 'hindi' | 'bengali' | 'tamil' | 'telugu' | 'punjabi' | 'marathi'>('all');
  const market = useMemo(() => (language === 'all' ? undefined : 'IN'), [language]);

  const headerText = useMemo(() => `${emotion.charAt(0).toUpperCase() + emotion.slice(1)} Playlists`, [emotion]);

  const insertPlaylistSuggestions = async (playlistSuggestions: PlaylistDisplay[]) => {
    if (!user || !moodHistoryId || playlistSuggestions.length === 0) return;
    try {
      // Convert playlists to track format for compatibility with existing schema
      const payload = playlistSuggestions.map((playlist, index) => ({
        mood_history_id: moodHistoryId,
        track_id: playlist.id,
        track_name: playlist.name,
        artist_name: playlist.owner,
        album_name: 'Playlist',
        image_url: playlist.image,
        preview_url: null,
        spotify_url: playlist.spotifyUrl
      }));
      const { error } = await supabase.from('music_suggestions').insert(payload);
      if (error) {
        console.warn('Failed to save playlist suggestions:', error.message);
      }
    } catch (e) {
      console.warn('Unexpected error saving playlist suggestions', e);
    }
  };

  const getLanguageKeywords = (): string[] => {
    switch (language) {
      case 'hindi':
        return ['hindi', 'bollywood', 'hindustani'];
      case 'bengali':
        return ['bengali', 'bangla'];
      case 'tamil':
        return ['tamil', 'kollywood'];
      case 'telugu':
        return ['telugu', 'tollywood'];
      case 'punjabi':
        return ['punjabi'];
      case 'marathi':
        return ['marathi'];
      default:
        return [];
    }
  };

  const getRealisticSearchTerms = (emotion: string): string[] => {
    switch (emotion.toLowerCase()) {
      case 'happy':
        return [
          'feel good hits',
          'good vibes',
          'upbeat pop',
          'positive energy',
          'happy songs',
          'mood booster',
          'feel good music'
        ];

      case 'sad':
        return [
          'sad songs',
          'emotional ballads',
          'heartbreak',
          'melancholy',
          'crying songs',
          'depressing music',
          'sad indie'
        ];

      case 'angry':
        return [
          'aggressive music',
          'heavy metal',
          'hard rock',
          'metal workout',
          'angry music',
          'intense rock',
          'rage playlist'
        ];

      case 'calm':
        return [
          'chill music',
          'relaxing playlist',
          'peaceful music',
          'ambient chill',
          'calm vibes',
          'meditation music',
          'soft music'
        ];

      case 'surprised':
        return [
          'high energy',
          'pump up music',
          'energetic hits',
          'adrenaline rush',
          'intense beats',
          'upbeat electronic',
          'energy boost'
        ];

      case 'excited':
        return [
          'pump up',
          'high energy',
          'party music',
          'energetic pop',
          'workout beats',
          'hype music',
          'dance hits'
        ];

      case 'neutral':
      default:
        return [
          'indie hits',
          'alternative music',
          'chill indie',
          'mellow music',
          'background music',
          'indie pop',
          'casual listening'
        ];
    }
  };

  const getSpotifyPlaylists = async (accessToken: string) => {
    const baseTerms = getRealisticSearchTerms(emotion);
    const langTerms = getLanguageKeywords();
    const searchTerms = baseTerms.map(term => langTerms.length ? `${langTerms[0]} ${term}` : term);

    console.log(`🎵 Searching for ${emotion} mood with terms:`, searchTerms, 'language:', language);

    for (const searchQuery of searchTerms) {
      try {
        console.log(`🎵 Searching Spotify for: "${searchQuery}" (market=${market || 'any'})`);
        const response = await searchPlaylists(accessToken, searchQuery, 20, market);
        console.log(`🎵 Search "${searchQuery}" returned ${response.playlists?.items?.length || 0} playlists`);

        if (response.playlists && response.playlists.items && response.playlists.items.length > 0) {
          console.log(`🎵 ✅ Success! Found ${response.playlists.items.length} playlists with: "${searchQuery}"`);

          const items = response.playlists?.items ?? [];
          const validItems = items.filter((p: any) => p && typeof p.id === 'string');
          if (validItems.length === 0) {
            console.log(`🎵 ❌ No valid items (some were null or missing id) for: "${searchQuery}"`);
            continue;
          }

          return validItems.map((playlist: SpotifyPlaylist): PlaylistDisplay => ({
            id: playlist.id,
            name: playlist.name || 'Untitled',
            description: playlist.description || `Curated ${emotion} playlist`,
            image: playlist.images?.[0]?.url || '/placeholder.svg',
            trackCount: playlist.tracks?.total ?? 0,
            owner: playlist.owner?.display_name || 'Unknown',
            spotifyUrl: playlist.external_urls?.spotify || ''
          }));
        } else {
          console.log(`🎵 ❌ No results for: "${searchQuery}"`);
        }
      } catch (error) {
        console.error(`🎵 💥 Error searching for "${searchQuery}":`, error);
        // Continue to next search query
      }
    }

    console.warn('🎵 ⚠️ No playlists found with any realistic search terms');
    return [];
  };

  const showBatch = (list: PlaylistDisplay[], index: number) => {
    const start = (index * BATCH_SIZE) % Math.max(list.length, 1);
    const end = start + BATCH_SIZE;
    const batch = list.slice(start, end);
    if (batch.length < BATCH_SIZE && list.length > 0) {
      batch.push(...list.slice(0, BATCH_SIZE - batch.length));
    }
    setPlaylists(batch);
    insertPlaylistSuggestions(batch);
  };

  const handleRefresh = async () => {
    if (isGenerating) return;
    if (allPlaylists.length > 0) {
      const nextIndex = (batchIndex + 1) % Math.ceil(allPlaylists.length / BATCH_SIZE || 1);
      setBatchIndex(nextIndex);
      showBatch(allPlaylists, nextIndex);
      return;
    }
    await generatePlaylists();
  };

  const generatePlaylists = useCallback(async () => {
    console.log(`🎵 Starting playlist generation for emotion: ${emotion}`);
    setIsGenerating(true);
    setPlaylists([]);
    setAllPlaylists([]);
    setBatchIndex(0);
    setSelectedPlaylist(null);

    if (!user) {
      console.log('🎵 No user found, using mock playlists');
      const fallback = mockPlaylists[emotion] || mockPlaylists.neutral;
      setPlaylists(fallback);
      setIsGenerating(false);
      return;
    }

    try {
      console.log('🎵 Fetching Spotify profile data...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('access_token, refresh_token, spotify_user_id')
        .eq('id', user.id)
        .single();

      console.log('🎵 Profile data:', {
        hasProfile: !!profile,
        hasAccessToken: !!profile?.access_token,
        hasRefreshToken: !!profile?.refresh_token,
        hasSpotifyUserId: !!profile?.spotify_user_id,
        error: profileError
      });

      if (profileError || !profile?.access_token) {
        console.log('🎵 No Spotify credentials found, using mock playlists');
        setIsSpotifyConnected(false);
        const fallback = mockPlaylists[emotion] || mockPlaylists.neutral;
        setPlaylists(fallback);
        toast.info(`Sample ${emotion} playlists`, {
          description: 'Connect Spotify in your profile for personalized playlists.'
        });
        return;
      }

      console.log('🎵 Spotify credentials found, setting as connected');
      setIsSpotifyConnected(true);
      let currentAccessToken = profile.access_token as string;

      try {
        console.log('🎵 Fetching Spotify playlists...');
        const newPlaylists = await getSpotifyPlaylists(currentAccessToken);
        console.log(`🎵 Got ${newPlaylists.length} playlists from Spotify`);
        setAllPlaylists(newPlaylists);
        showBatch(newPlaylists, 0);

        if (newPlaylists.length > 0) {
          console.log('🎵 Successfully showing Spotify playlists');
          toast.success(`Found ${emotion} playlists!`, {
            description: `Discovered ${newPlaylists.length} playlists matching your mood.`
          });
        } else {
          console.log('🎵 No Spotify playlists found, showing fallback');
          const fallback = mockPlaylists[emotion] || mockPlaylists.neutral;
          setPlaylists(fallback);
          toast.info(`No Spotify playlists found for ${emotion}`, {
            description: 'Showing sample playlists instead.'
          });
        }
      } catch (error: any) {
        console.error('🎵 Error in Spotify playlist fetch:', error);
        if (error instanceof Error && error.message === 'SPOTIFY_TOKEN_EXPIRED' && profile?.refresh_token) {
          console.log('🎵 Token expired, attempting refresh...');
          toast.info('Spotify token expired. Refreshing automatically...');
          try {
            const newTokens = await refreshSpotifyToken(profile.refresh_token);
            await supabase
              .from('profiles')
              .update({ access_token: newTokens.access_token, refresh_token: newTokens.refresh_token })
              .eq('id', user.id);

            currentAccessToken = newTokens.access_token;
            console.log('🎵 Token refreshed, retrying playlist fetch...');
            const newPlaylists = await getSpotifyPlaylists(currentAccessToken);
            setAllPlaylists(newPlaylists);
            showBatch(newPlaylists, 0);
            toast.success('Spotify connection refreshed!', {
              description: 'Here are your new playlist recommendations.'
            });
          } catch (refreshError) {
            console.error('🎵 Failed to refresh Spotify token:', refreshError);
            setIsSpotifyConnected(false);
            const fallback = mockPlaylists[emotion] || mockPlaylists.neutral;
            setPlaylists(fallback);
            toast.error('Could not refresh Spotify session.', {
              description: 'Please disconnect and reconnect your account in your profile.'
            });
          }
        } else {
          console.error('🎵 Non-token error:', error);
          throw error;
        }
      }
    } catch (error) {
      console.error('🎵 Fatal error generating playlists:', error);
      toast.error('Failed to generate playlist recommendations.');
      const fallback = mockPlaylists[emotion] || mockPlaylists.neutral;
      setPlaylists(fallback);
    } finally {
      setIsGenerating(false);
    }
  }, [emotion, user, moodHistoryId, language]);

  useEffect(() => {
    if (emotion) {
      generatePlaylists();
    }
  }, [emotion, language, generatePlaylists]);

  const handleSave = () => {
    if (playlists.length === 0) {
      toast.info('No playlists to save yet');
      return;
    }
    // Convert playlists to tracks format for compatibility
    const tracks: Track[] = playlists.map(playlist => ({
      id: playlist.id,
      name: playlist.name,
      artist: playlist.owner,
      album: 'Playlist',
      image: playlist.image,
      preview_url: null,
      spotify_url: playlist.spotifyUrl
    }));
    onSavePlaylist(tracks);
  };

  return (
    <Card className={cn('glass border-border/50', className)}>
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">{headerText}</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-muted-foreground">Language</span>
              <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
                <SelectTrigger className="w-44 rounded-full border-transparent bg-muted/30 hover:bg-muted/40 backdrop-blur-sm shadow-sm transition-all" aria-label="Language filter">
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="bengali">Bengali</SelectItem>
                  <SelectItem value="tamil">Tamil</SelectItem>
                  <SelectItem value="telugu">Telugu</SelectItem>
                  <SelectItem value="punjabi">Punjabi</SelectItem>
                  <SelectItem value="marathi">Marathi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isGenerating} className="order-last sm:order-none">
              <Shuffle className="w-4 h-4 mr-2" />
              {isGenerating ? 'Finding...' : 'Refresh'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!isSpotifyConnected || playlists.length === 0} className="bg-primary text-primary-foreground">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {playlists.length === 0 && !isGenerating && (
          <div className="text-sm text-muted-foreground">No playlists yet. Click refresh to get started.</div>
        )}

        {isGenerating && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-muted-foreground">Finding the perfect {emotion} playlists...</span>
          </div>
        )}

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {playlists.filter(Boolean).map((playlist) => (
            <div 
              key={playlist.id} 
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg bg-muted/20 cursor-pointer transition-all hover:bg-muted/30",
                selectedPlaylist?.id === playlist.id && "ring-2 ring-primary"
              )}
              onClick={() => setSelectedPlaylist(playlist)}
            >
              <img src={playlist.image} alt={playlist.name} className="w-16 h-16 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{playlist.name}</div>
                <div className="text-sm text-muted-foreground truncate">{playlist.description}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                  <Users className="w-3 h-3" />
                  {playlist.owner} • {playlist.trackCount} tracks
                </div>
              </div>
              <div className="flex items-center gap-2">
                {playlist.spotifyUrl && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(playlist.spotifyUrl, '_blank');
                    }} 
                    aria-label="Open in Spotify"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlaylist(playlist);
                  }}
                  aria-label="Select playlist"
                >
                  <Play className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {selectedPlaylist && selectedPlaylist.spotifyUrl && (
          <div className="mt-4 p-4 bg-muted/10 rounded-lg">
            <h4 className="font-medium mb-2">Now Playing: {selectedPlaylist.name}</h4>
            <iframe
              src={`https://open.spotify.com/embed/playlist/${selectedPlaylist.id}?utm_source=generator&theme=0`}
              width="100%"
              height="380"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="rounded-lg"
            />
          </div>
        )}

        {!isSpotifyConnected && (
          <div className="text-xs text-muted-foreground">
            Connect Spotify in your profile to get personalized playlist recommendations.
          </div>
        )}
      </div>
    </Card>
  );
};

export default MusicRecommendations;
