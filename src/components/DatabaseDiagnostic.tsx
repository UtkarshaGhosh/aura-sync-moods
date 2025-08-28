import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const DatabaseDiagnostic: React.FC = () => {
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLog = (message: string) => {
    console.log(message);
    setDiagnostics(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics([]);
    
    try {
      addLog('🔍 Starting database diagnostics...');
      
      // Test 1: Check authentication
      addLog(`👤 User authentication: ${user ? '✅ Authenticated' : '❌ Not authenticated'}`);
      if (user) {
        addLog(`   - User ID: ${user.id}`);
        addLog(`   - Email: ${user.email}`);
      }
      
      // Test 2: Check Supabase connection
      addLog('🔌 Testing Supabase connection...');
      try {
        const { data: healthCheck, error: healthError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);
        
        if (healthError) {
          addLog(`❌ Supabase connection failed: ${healthError.message}`);
          addLog(`   - Code: ${healthError.code}`);
          addLog(`   - Details: ${healthError.details || 'None'}`);
          addLog(`   - Hint: ${healthError.hint || 'None'}`);
        } else {
          addLog('✅ Supabase connection successful');
        }
      } catch (error) {
        addLog(`❌ Supabase connection error: ${error}`);
      }
      
      // Test 3: Check if profiles table exists and is accessible
      if (user) {
        addLog('📋 Testing profiles table access...');
        try {
          const { data: tableTest, error: tableError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
          
          if (tableError) {
            addLog(`❌ Profiles table access failed: ${tableError.message}`);
            addLog(`   - Code: ${tableError.code}`);
            addLog(`   - Details: ${tableError.details || 'None'}`);
            
            if (tableError.code === 'PGRST116') {
              addLog('🔒 This is likely a Row Level Security (RLS) policy issue');
              addLog('💡 The profiles table exists but RLS is blocking access');
            } else if (tableError.code?.startsWith('42')) {
              addLog('🗃️ This appears to be a table structure issue');
            }
          } else {
            addLog('✅ Profiles table is accessible');
            if (tableTest) {
              addLog('✅ User profile record exists');
            } else {
              addLog('⚠️ User profile record does not exist');
            }
          }
        } catch (error) {
          addLog(`❌ Profiles table test error: ${error}`);
        }
        
        // Test 4: Try to create a profile record if it doesn't exist
        addLog('🔨 Attempting to create/update profile record...');
        try {
          const { data: upsertData, error: upsertError } = await supabase
            .from('profiles')
            .upsert({ 
              id: user.id,
              display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'Unknown User',
              avatar_url: user.user_metadata?.avatar_url || null
            })
            .select();
          
          if (upsertError) {
            addLog(`❌ Profile upsert failed: ${upsertError.message}`);
            addLog(`   - Code: ${upsertError.code}`);
          } else {
            addLog('✅ Profile record created/updated successfully');
          }
        } catch (error) {
          addLog(`❌ Profile upsert error: ${error}`);
        }
        
        // Test 5: Try to read Spotify credentials
        addLog('🎵 Testing Spotify credentials access...');
        try {
          const { data: spotifyData, error: spotifyError } = await supabase
            .from('profiles')
            .select('access_token, spotify_user_id, refresh_token')
            .eq('id', user.id)
            .single();
          
          if (spotifyError) {
            addLog(`❌ Spotify credentials read failed: ${spotifyError.message}`);
            addLog(`   - Code: ${spotifyError.code}`);
          } else {
            addLog('✅ Spotify credentials query successful');
            addLog(`   - Has access token: ${!!spotifyData.access_token}`);
            addLog(`   - Has refresh token: ${!!spotifyData.refresh_token}`);
            addLog(`   - Has Spotify user ID: ${!!spotifyData.spotify_user_id}`);
          }
        } catch (error) {
          addLog(`❌ Spotify credentials test error: ${error}`);
        }
      }
      
      addLog('🏁 Diagnostics complete!');
      
    } catch (error) {
      addLog(`💥 Unexpected error during diagnostics: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="p-6 max-w-2xl mx-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Database Diagnostics</h3>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            variant="outline"
            size="sm"
          >
            {isRunning ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </div>
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Diagnostic Log:</h4>
          <div className="bg-black/80 rounded-lg p-4 max-h-96 overflow-y-auto">
            {diagnostics.length === 0 ? (
              <p className="text-gray-400 text-sm">Click "Run Diagnostics" to test database connectivity...</p>
            ) : (
              <div className="space-y-1">
                {diagnostics.map((log, index) => (
                  <p key={index} className="text-xs font-mono text-green-400 leading-tight">
                    {log}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          <p>This tool helps identify issues with:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li>User authentication state</li>
            <li>Supabase database connectivity</li>
            <li>Profiles table access and RLS policies</li>
            <li>Spotify credentials storage/retrieval</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default DatabaseDiagnostic;
