import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Calendar, 
  Music, 
  Camera, 
  Smile, 
  Upload, 
  ExternalLink,
  Play,
  MoreHorizontal,
  TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';

interface MoodHistoryEntry {
  id: number;
  emotion: string;
  source: string;
  created_at: string;
  music_suggestions?: MusicSuggestion[];
}

interface MusicSuggestion {
  id: number;
  track_id: string;
  track_name: string;
  artist_name: string;
  album_name: string | null;
  image_url: string | null;
  preview_url: string | null;
  spotify_url: string | null;
  created_at: string;
}

const EmotionHistory: React.FC = () => {
  const { user } = useAuth();
  const [moodHistory, setMoodHistory] = useState<MoodHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'all'>('week');

  useEffect(() => {
    if (user) {
      loadMoodHistory();
    }
  }, [user, selectedPeriod]);

  const loadMoodHistory = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Calculate date filter based on selected period
      let dateFilter = '';
      const now = new Date();
      if (selectedPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = weekAgo.toISOString();
      } else if (selectedPeriod === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = monthAgo.toISOString();
      }

      // First try with music_suggestions, fallback without if table doesn't exist
      let query = supabase
        .from('mood_history')
        .select(`
          *,
          music_suggestions (*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      let { data, error } = await query.limit(50);

      // If music_suggestions table doesn't exist, try without it
      if (error && (error.code === 'PGRST116' || error.message?.includes('music_suggestions'))) {
        console.warn('music_suggestions table not found, loading mood history without music suggestions');

        let fallbackQuery = supabase
          .from('mood_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (dateFilter) {
          fallbackQuery = fallbackQuery.gte('created_at', dateFilter);
        }

        const fallbackResult = await fallbackQuery.limit(50);
        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) {
        console.error('Error loading mood history:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          fullError: error
        });
      } else {
        setMoodHistory(data || []);
      }
    } catch (error) {
      console.error('Error loading mood history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getEmotionColor = (emotion: string) => {
    const colors = {
      happy: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      sad: 'bg-blue-100 text-blue-800 border-blue-200',
      angry: 'bg-red-100 text-red-800 border-red-200',
      surprised: 'bg-purple-100 text-purple-800 border-purple-200',
      fearful: 'bg-gray-100 text-gray-800 border-gray-200',
      disgusted: 'bg-green-100 text-green-800 border-green-200',
      neutral: 'bg-slate-100 text-slate-800 border-slate-200',
    };
    return colors[emotion as keyof typeof colors] || colors.neutral;
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'webcam':
        return <Camera className="w-4 h-4" />;
      case 'emoji':
        return <Smile className="w-4 h-4" />;
      case 'upload':
        return <Upload className="w-4 h-4" />;
      default:
        return <Camera className="w-4 h-4" />;
    }
  };

  const getEmotionStats = () => {
    const emotionCounts = moodHistory.reduce((acc, entry) => {
      acc[entry.emotion] = (acc[entry.emotion] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = moodHistory.length;
    return Object.entries(emotionCounts)
      .map(([emotion, count]) => ({
        emotion,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  };

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const emotionStats = getEmotionStats();

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-glow">Emotion Journey</h2>
        <div className="flex items-center space-x-2">
          {(['week', 'month', 'all'] as const).map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time'}
            </Button>
          ))}
        </div>
      </div>

      {/* Emotion Statistics */}
      {emotionStats.length > 0 && (
        <Card className="glass border-border/50">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Emotion Overview</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {emotionStats.map(({ emotion, count, percentage }) => (
                <div key={emotion} className="text-center space-y-2">
                  <Badge
                    variant="secondary"
                    className={`w-full justify-center capitalize ${getEmotionColor(emotion)}`}
                  >
                    {emotion}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    {count} time{count !== 1 ? 's' : ''} ({percentage}%)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Emotion History */}
      <Card className="glass border-border/50">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Recent Activity</h3>
            <Badge variant="secondary">{moodHistory.length} entries</Badge>
          </div>

          {moodHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No emotion data yet.</p>
              <p className="text-sm">Start using AI detection to see your emotional journey!</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {moodHistory.map((entry, index) => (
                  <div key={entry.id}>
                    <div className="flex items-start space-x-4">
                      {/* Emotion Badge */}
                      <div className="flex-shrink-0">
                        <Badge
                          variant="secondary"
                          className={`capitalize ${getEmotionColor(entry.emotion)}`}
                        >
                          {entry.emotion}
                        </Badge>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            {getSourceIcon(entry.source)}
                            <span className="capitalize">{entry.source} detection</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>

                        {/* Music Suggestions */}
                        {entry.music_suggestions && entry.music_suggestions.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Music className="w-4 h-4" />
                              Music Suggestions ({entry.music_suggestions.length})
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {entry.music_suggestions.slice(0, 4).map((song) => (
                                <div key={song.id} className="flex items-center space-x-3 p-2 bg-muted/20 rounded-lg">
                                  <Avatar className="w-8 h-8">
                                    <AvatarImage src={song.image_url || undefined} />
                                    <AvatarFallback className="text-xs">♪</AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{song.track_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{song.artist_name}</p>
                                  </div>
                                  {song.spotify_url && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => window.open(song.spotify_url!, '_blank')}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                            {entry.music_suggestions.length > 4 && (
                              <Button variant="ghost" size="sm" className="text-xs">
                                <MoreHorizontal className="w-4 h-4 mr-1" />
                                View {entry.music_suggestions.length - 4} more
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {index < moodHistory.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </Card>
    </div>
  );
};

export default EmotionHistory;
