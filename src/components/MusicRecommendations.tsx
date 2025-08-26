import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, Save, Music, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  image: string;
  preview_url: string | null;
}

interface MusicRecommendationsProps {
  emotion: string;
  onSavePlaylist: (tracks: Track[]) => void;
  className?: string;
}

// Mock data for different emotions
const mockRecommendations: Record<string, Track[]> = {
  happy: [
    {
      id: '1',
      name: 'Good as Hell',
      artist: 'Lizzo',
      album: 'Good as Hell',
      image: '/placeholder.svg',
      preview_url: null,
    },
    {
      id: '2',
      name: 'Can\'t Stop the Feeling!',
      artist: 'Justin Timberlake',
      album: 'Trolls',
      image: '/placeholder.svg',
      preview_url: null,
    },
    {
      id: '3',
      name: 'Happy',
      artist: 'Pharrell Williams',
      album: 'Girl',
      image: '/placeholder.svg',
      preview_url: null,
    },
  ],
  sad: [
    {
      id: '4',
      name: 'Someone Like You',
      artist: 'Adele',
      album: '21',
      image: '/placeholder.svg',
      preview_url: null,
    },
    {
      id: '5',
      name: 'Breathe Me',
      artist: 'Sia',
      album: 'Colour the Small One',
      image: '/placeholder.svg',
      preview_url: null,
    },
    {
      id: '6',
      name: 'Mad World',
      artist: 'Gary Jules',
      album: 'Donnie Darko',
      image: '/placeholder.svg',
      preview_url: null,
    },
  ],
  calm: [
    {
      id: '7',
      name: 'Weightless',
      artist: 'Marconi Union',
      album: 'Weightless',
      image: '/placeholder.svg',
      preview_url: null,
    },
    {
      id: '8',
      name: 'River',
      artist: 'Leon Bridges',
      album: 'Coming Home',
      image: '/placeholder.svg',
      preview_url: null,
    },
    {
      id: '9',
      name: 'Holocene',
      artist: 'Bon Iver',
      album: 'Bon Iver, Bon Iver',
      image: '/placeholder.svg',
      preview_url: null,
    },
  ],
  neutral: [
    {
      id: '10',
      name: 'The Middle',
      artist: 'Jimmy Eat World',
      album: 'Bleed American',
      image: '/placeholder.svg',
      preview_url: null,
    },
    {
      id: '11',
      name: 'Dreams',
      artist: 'Fleetwood Mac',
      album: 'Rumours',
      image: '/placeholder.svg',
      preview_url: null,
    },
    {
      id: '12',
      name: 'Losing You',
      artist: 'Solange',
      album: 'True',
      image: '/placeholder.svg',
      preview_url: null,
    },
  ],
};

const MusicRecommendations: React.FC<MusicRecommendationsProps> = ({
  emotion,
  onSavePlaylist,
  className
}) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePlaylist = async () => {
    setIsGenerating(true);
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const emotionTracks = mockRecommendations[emotion] || mockRecommendations.neutral;
    setTracks(emotionTracks);
    setIsGenerating(false);
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
  }, [emotion]);

  return (
    <Card className={cn("glass border-border/50", className)}>
      <div className="p-6 space-y-6">
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
          >
            <Save className="w-5 h-5 mr-2" />
            Save Playlist to Spotify
          </Button>
        )}
      </div>
    </Card>
  );
};

export default MusicRecommendations;