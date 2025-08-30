import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
  // First, clear Spotify data from the user's profile
  if (user) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        spotify_user_id: null,
        access_token: null,
        refresh_token: null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error clearing Spotify data on logout:', updateError);
      // Decide if you still want to log out even if the update fails
    }
  }

  // Then, sign the user out from Supabase auth
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) {
    throw signOutError;
  }
};

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!user,
  };
};
