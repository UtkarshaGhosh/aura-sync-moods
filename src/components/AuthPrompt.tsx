import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Music, Database } from 'lucide-react';

const AuthPrompt: React.FC = () => {
  return (
    <Card className="glass border-border/50 max-w-md mx-auto">
      <div className="p-6 text-center space-y-6">
        <div className="space-y-2">
          <Database className="w-12 h-12 mx-auto text-primary" />
          <h2 className="text-xl font-semibold text-glow">Connect to Supabase</h2>
          <p className="text-muted-foreground text-sm">
            To enable Spotify authentication, mood history tracking, and playlist saving, 
            please connect your project to Supabase first.
          </p>
        </div>

        <div className="space-y-4">
          <div className="text-left space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <div>
                <p className="font-medium">User Authentication</p>
                <p className="text-muted-foreground">Secure Spotify login integration</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <div>
                <p className="font-medium">Mood History</p>
                <p className="text-muted-foreground">Track your emotional journey over time</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
              <div>
                <p className="font-medium">Playlist Saving</p>
                <p className="text-muted-foreground">Save mood-based playlists to your library</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3">
              Click the green Supabase button in the top right to get started
            </p>
            <Button disabled className="w-full" variant="outline">
              <Music className="w-4 h-4 mr-2" />
              Connect Spotify (Requires Supabase)
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AuthPrompt;