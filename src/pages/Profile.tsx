import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Music, ArrowLeft, Save, Trash2, ExternalLink, CheckCircle, XCircle, Settings, History } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getSpotifyAuthUrl } from '@/lib/spotify';
import EmotionHistory from '@/components/EmotionHistory';
import { useI18n } from '@/i18n/I18nProvider';
import LanguageSelector from '@/components/LanguageSelector';

interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  spotify_user_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  created_at: string;
}

const Profile: React.FC = () => {
  const { t } = useI18n();
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error);
          toast.error(t('toasts.profile.load_failed'));
        } else if (data) {
          setProfile(data);
          setDisplayName(data.display_name || '');
        } else {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({ id: user.id, display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User', avatar_url: user.user_metadata?.avatar_url || null })
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            toast.error(t('toasts.profile.create_failed'));
          } else {
            setProfile(newProfile);
            setDisplayName(newProfile.display_name || '');
          }
        }
      } catch (error) {
        console.error('Error:', error);
        toast.error(t('toasts.profile.load_failed'));
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user, t]);

  const handleSaveProfile = async () => {
    if (!user || !profile) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ display_name: displayName.trim() || null }).eq('id', user.id);
      if (error) {
        console.error('Error updating profile:', error);
        toast.error(t('toasts.profile.save_failed'));
      } else {
        setProfile(prev => (prev ? { ...prev, display_name: displayName.trim() || null } : null));
        toast.success(t('toasts.profile.save_success'));
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('toasts.profile.save_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectSpotify = async () => {
    try {
      const authUrl = await getSpotifyAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Spotify auth error:', error);
      toast.error(t('toasts.spotify.connect_failed.title'), { description: t('toasts.spotify.connect_failed.desc') });
    }
  };

  const handleDisconnectSpotify = async () => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase.from('profiles').update({ spotify_user_id: null, access_token: null, refresh_token: null }).eq('id', user.id);
      if (error) {
        console.error('Error disconnecting Spotify:', error);
        toast.error(t('toasts.spotify.disconnect_failed'));
      } else {
        try { localStorage.removeItem('spotify_product'); } catch {}
        setProfile(prev => (prev ? { ...prev, spotify_user_id: null, access_token: null, refresh_token: null } : null));
        toast.success(t('toasts.spotify.disconnect_success'));
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(t('toasts.spotify.disconnect_failed'));
    }
  };

  const isSpotifyConnected = profile?.spotify_user_id && profile?.access_token;

  if (loading || isLoading) {
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}> 
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('profile.back')}
          </Button>
          <div className="ml-auto"><LanguageSelector /></div>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-glow">{t('profile.title')}</h1>
          <p className="text-muted-foreground">{t('profile.subtitle')}</p>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('profile.tabs.settings')}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              {t('profile.tabs.history')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="glass border-border/50">
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <Settings className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-semibold">{t('profile.section.profile_info')}</h2>
                    </div>

                    <div className="space-y-6">
                      <div className="flex items-center gap-6">
                        <Avatar className="w-20 h-20">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-lg">
                            {displayName ? displayName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">{t('profile.email')}</p>
                          <p className="font-medium">{user?.email}</p>
                          <p className="text-sm text-muted-foreground mt-2">{t('profile.member_since')}</p>
                          <p className="text-sm">{new Date(profile?.created_at || '').toLocaleDateString()}</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="displayName">{t('profile.display_name')}</Label>
                        <div className="flex gap-2">
                          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('profile.display_name_placeholder')} className="flex-1" />
                          <Button onClick={handleSaveProfile} disabled={isSaving || displayName === (profile?.display_name || '')} size="sm">
                            <Save className="w-4 h-4 mr-2" />
                            {isSaving ? t('profile.saving') : t('profile.save')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="glass border-border/50">
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <Music className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-semibold">{t('profile.spotify.section_title')}</h2>
                      {isSpotifyConnected ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {t('profile.connected')}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                          <XCircle className="w-3 h-3 mr-1" />
                          {t('profile.not_connected')}
                        </Badge>
                      )}
                    </div>

                    {isSpotifyConnected ? (
                      <div className="space-y-4">
                        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <AlertDescription className="text-green-800 dark:text-green-200">
                            {t('profile.spotify.connected_msg')}
                          </AlertDescription>
                        </Alert>

                        <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg">
                          <div>
                            <p className="font-medium">{t('profile.spotify.user_id')}</p>
                            <p className="text-sm text-muted-foreground">{profile?.spotify_user_id}</p>
                          </div>
                          <Button variant="destructive" size="sm" onClick={handleDisconnectSpotify}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('profile.disconnect')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Alert>
                          <Music className="h-4 w-4" />
                          <AlertDescription>{t('profile.spotify.connect_msg')}</AlertDescription>
                        </Alert>

                        <div className="text-center py-6">
                          <Button onClick={handleConnectSpotify} className="bg-green-500 hover:bg-green-600 text-white" size="lg">
                            <Music className="w-5 h-5 mr-2" />
                            {t('profile.spotify.connect_button')}
                            <ExternalLink className="w-4 h-4 ml-2" />
                          </Button>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-2">
                          <p><strong>{t('profile.spotify.benefits_title')}</strong></p>
                          <ul className="list-disc list-inside space-y-1 ml-4">
                            <li>{t('profile.spotify.benefit.save')}</li>
                            <li>{t('profile.spotify.benefit.reco')}</li>
                            <li>{t('profile.spotify.benefit.access')}</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="glass border-border/50">
                  <div className="p-6">
                    <h3 className="font-semibold mb-4">{t('profile.quick_stats')}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('profile.account_status')}</span>
                        <Badge variant="secondary">{t('profile.active')}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('profile.music_service')}</span>
                        <span className="text-sm">{isSpotifyConnected ? 'Spotify' : t('profile.not_connected')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('profile.profile_complete')}</span>
                        <span className="text-sm">{displayName && isSpotifyConnected ? '100%' : displayName ? '50%' : '25%'}</span>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="glass border-border/50">
                  <div className="p-6">
                    <h3 className="font-semibold mb-4">{t('profile.help.title')}</h3>
                    <div className="space-y-3 text-sm">
                      <p className="text-muted-foreground">{t('profile.help.desc')}</p>
                      <Button variant="outline" size="sm" className="w-full">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {t('profile.help.center')}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <EmotionHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
