// Spotify Web API integration utilities

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = `${window.location.origin}/auth/spotify/callback`;

// Spotify OAuth scopes needed for the app
const SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-library-modify',
  'user-library-read',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ');

export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string; width: number; height: number }>;
  product?: 'premium' | 'free' | 'open' | string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string; id: string }>;
  album: {
    name: string;
    images: Array<{ url: string; width: number; height: number }>;
  };
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  external_urls: {
    spotify: string;
  };
  images: Array<{ url: string; width: number; height: number }>;
  tracks: {
    total: number;
  };
  owner: {
    display_name: string;
  };
}

// Generate Spotify authorization URL with PKCE
export const getSpotifyAuthUrl = async (): Promise<string> => {
  if (!SPOTIFY_CLIENT_ID) {
    throw new Error('Spotify Client ID not configured. Please add VITE_SPOTIFY_CLIENT_ID to your environment variables.');
  }
  const state = generateRandomString(16);
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem('spotify_auth_state', state);
  localStorage.setItem('spotify_code_verifier', codeVerifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    show_dialog: 'true',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

// Exchange authorization code for access token using PKCE
export const exchangeCodeForTokens = async (code: string, state: string) => {
  const storedState = localStorage.getItem('spotify_auth_state');
  const codeVerifier = localStorage.getItem('spotify_code_verifier');
  if (!storedState || storedState !== state) {
    throw new Error('State mismatch. Potential CSRF attack.');
  }
  if (!codeVerifier) {
    throw new Error('Code verifier not found. Please restart the authentication process.');
  }
  localStorage.removeItem('spotify_auth_state');
  localStorage.removeItem('spotify_code_verifier');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      client_id: SPOTIFY_CLIENT_ID!,
      code_verifier: codeVerifier,
    }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
  }
  const tokenData = await response.json();
  return {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    token_type: tokenData.token_type,
  };
};

// NEW: Function to refresh the access token
export const refreshSpotifyToken = async (refreshToken: string) => {
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: SPOTIFY_CLIENT_ID!,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Token refresh failed: ${errorData.error_description || response.statusText}`);
    }
    
    const tokenData = await response.json();
    return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken,
    };
};


// Make authenticated request to Spotify API
export const spotifyApiRequest = async (
  endpoint: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<any> => {
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('SPOTIFY_TOKEN_EXPIRED');
    }
    throw new Error(`Spotify API error: ${response.status} ${response.statusText}`);
  }
  
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};


// Get current user profile
export const getSpotifyProfile = async (accessToken: string): Promise<SpotifyUser> => {
  return spotifyApiRequest('/me', accessToken);
};

// Helper: determine if current user is Spotify Premium
export const isSpotifyPremium = async (
  accessToken?: string
): Promise<boolean> => {
  try {
    if (accessToken) {
      const me = await getSpotifyProfile(accessToken);
      if (me?.product) {
        localStorage.setItem('spotify_product', me.product);
      }
      return me?.product === 'premium';
    }
    const cached = localStorage.getItem('spotify_product');
    return cached === 'premium';
  } catch {
    return false;
  }
};

// Get recommendations based on seed data
export const getRecommendations = async (
  accessToken: string,
  options: {
    seedGenres?: string[];
    seedTracks?: string[];
    seedArtists?: string[];
    targetValence?: number;
    targetEnergy?: number;
    limit?: number;
  }
): Promise<{ tracks: SpotifyTrack[] }> => {
  const params = new URLSearchParams();

  if (options.seedGenres?.length) {
    params.append('seed_genres', options.seedGenres.join(','));
  }
  if (options.seedTracks?.length) {
    params.append('seed_tracks', options.seedTracks.join(','));
  }
  if (options.seedArtists?.length) {
    params.append('seed_artists', options.seedArtists.join(','));
  }
  if (options.targetValence !== undefined) {
    params.append('target_valence', options.targetValence.toString());
  }
  if (options.targetEnergy !== undefined) {
    params.append('target_energy', options.targetEnergy.toString());
  }
  if (options.limit) {
    params.append('limit', options.limit.toString());
  }

  return spotifyApiRequest(`/recommendations?${params.toString()}`, accessToken);
};

// Create a new playlist
export const createPlaylist = async (
  userId: string,
  name: string,
  description: string,
  accessToken: string
): Promise<SpotifyPlaylist> => {
  return spotifyApiRequest(`/users/${userId}/playlists`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      public: false,
    }),
  });
};

// Add tracks to playlist
export const addTracksToPlaylist = async (
  playlistId: string,
  trackUris: string[],
  accessToken: string
): Promise<{ snapshot_id: string }> => {
  return spotifyApiRequest(`/playlists/${playlistId}/tracks`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      uris: trackUris,
    }),
  });
};

// Map emotion to Spotify audio features with optional intensity (0..1)
export const getEmotionAudioFeatures = (emotion: string, intensity: number = 0.5) => {
  const e = emotion.toLowerCase();
  const base = (() => {
    switch (e) {
      case 'happy': return { targetValence: 0.8, targetEnergy: 0.7 };
      case 'sad': return { targetValence: 0.2, targetEnergy: 0.3 };
      case 'angry': return { targetValence: 0.1, targetEnergy: 0.9 };
      case 'calm': return { targetValence: 0.6, targetEnergy: 0.2 };
      case 'excited': return { targetValence: 0.9, targetEnergy: 0.9 };
      case 'neutral':
      default: return { targetValence: 0.5, targetEnergy: 0.5 };
    }
  })();

  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  // Adjust energy more strongly with intensity; center at 0.5
  const energy = clamp(base.targetEnergy + (intensity - 0.5) * 0.8, 0, 1);

  // For negatively valenced emotions, higher intensity should not increase valence
  const negativeEmotion = e === 'sad' || e === 'angry';
  const valenceAdjust = (intensity - 0.5) * (negativeEmotion ? -0.6 : 0.6);
  const valence = clamp(base.targetValence + valenceAdjust, 0, 1);

  return { targetValence: valence, targetEnergy: energy };
};

// Map emotion to genre for playlist search
export const getEmotionGenre = (emotion: string): string => {
  switch (emotion.toLowerCase()) {
    case 'happy': return 'pop';
    case 'sad': return 'acoustic';
    case 'angry': return 'rock';
    case 'calm': return 'ambient';
    case 'excited': return 'electronic';
    case 'neutral':
    default: return 'chill';
  }
};

// Search for playlists by genre/emotion
export const searchPlaylists = async (
  accessToken: string,
  query: string,
  limit: number = 20,
  market?: string
): Promise<{ playlists: { items: SpotifyPlaylist[] } }> => {
  const params = new URLSearchParams({
    q: query,
    type: 'playlist',
    limit: limit.toString()
  });

  if (market) {
    params.append('market', market);
  }

  return spotifyApiRequest(`/search?${params.toString()}`, accessToken);
};

// Generate random string for OAuth state and PKCE
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Generate PKCE code challenge
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Convert track data to our app format
export const convertSpotifyTrack = (spotifyTrack: SpotifyTrack) => ({
  id: spotifyTrack.id,
  name: spotifyTrack.name,
  artist: spotifyTrack.artists.map(artist => artist.name).join(', '),
  album: spotifyTrack.album.name,
  image: spotifyTrack.album.images[0]?.url || '/placeholder.svg',
  preview_url: spotifyTrack.preview_url,
  spotify_url: spotifyTrack.external_urls.spotify,
});
