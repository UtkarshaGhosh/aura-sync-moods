// Spotify Web API integration utilities

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI = `${window.location.origin}/auth/spotify/callback`;

// ... (keep all the interfaces: SpotifyUser, SpotifyTrack, SpotifyPlaylist)

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
        // Spotify may optionally return a new refresh token
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
  
  // Handle responses that might not have a JSON body (e.g., 204 No Content)
  const text = await response.text();
  return text ? JSON.parse(text) : {};
};

// ... (keep the rest of the file exactly as it is)
