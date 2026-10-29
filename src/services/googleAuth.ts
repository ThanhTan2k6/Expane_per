import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth endpoints
const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Required scopes for Gmail reading and user info
export const GOOGLE_GMAIL_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export interface GoogleUserProfile {
  email: string;
  name?: string;
  picture?: string;
}

export interface GoogleAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: GoogleUserProfile;
  error?: string;
}

/**
 * Fetch Google User Info using Access Token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserProfile | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      email: data.email,
      name: data.name,
      picture: data.picture,
    };
  } catch (err) {
    console.warn('Failed to fetch Google user info:', err);
    return null;
  }
}

/**
 * Returns the exact redirect URI used for OAuth 2.0
 */
export function getGoogleRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'expane',
    path: 'auth',
  });
}

/**
 * Initiates the Google OAuth 2.0 WebBrowser / AuthSession flow
 */
export async function promptGoogleLogin(clientId?: string): Promise<GoogleAuthResult> {
  const activeClientId = clientId?.trim() || 'dummy_client_id';

  // Construct redirect URI based on platform
  const redirectUri = getGoogleRedirectUri();

  try {
    // If running in development without a real Google Cloud Client ID configured yet,
    // we guide the user to supply their client ID or provide access token
    if (!clientId || clientId === 'dummy_client_id') {
      return {
        success: false,
        error: 'NEED_CLIENT_ID',
      };
    }

    const authRequest = new AuthSession.AuthRequest({
      clientId: activeClientId,
      scopes: GOOGLE_GMAIL_SCOPES,
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    });

    const result = await authRequest.promptAsync(GOOGLE_DISCOVERY);

    if (result.type === 'success' && result.params.access_token) {
      const accessToken = result.params.access_token;
      const user = await fetchGoogleUserInfo(accessToken);

      return {
        success: true,
        accessToken,
        user: user || { email: 'gmail_user@gmail.com' },
      };
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      return {
        success: false,
        error: 'Người dùng đã hủy đăng nhập Google',
      };
    } else {
      return {
        success: false,
        error: 'Đăng nhập Google thất bại hoặc không nhận được token',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Lỗi trong quá trình đăng nhập Google',
    };
  }
}
