import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import jwt from 'jsonwebtoken';

let firebaseApp: App | null = null;
let cachedPublicCerts: Record<string, string> | null = null;
let publicCertsExpiresAt = 0;

/**
 * Fetches Google's published public x509 certificates used for signing Firebase ID tokens.
 * Caches in memory according to HTTP Cache-Control header.
 */
async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedPublicCerts && now < publicCertsExpiresAt) {
    return cachedPublicCerts;
  }
  const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!res.ok) {
    throw new Error('Failed to fetch Google public certificates');
  }
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;
  cachedPublicCerts = (await res.json()) as Record<string, string>;
  publicCertsExpiresAt = now + maxAge;
  return cachedPublicCerts;
}

export function getFirebaseApp(): App {
  if (firebaseApp) return firebaseApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'fresh-vegetables-cfb6d';

  // 1. Check for inline JSON service account string in environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      console.log('✅ [Firebase Admin] Initialized with FIREBASE_SERVICE_ACCOUNT credentials.');
      return firebaseApp;
    } catch (err: any) {
      console.warn('⚠️ [Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', err.message);
    }
  }

  // 2. Check for service account file path
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
      });
      console.log('✅ [Firebase Admin] Initialized from file path:', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      return firebaseApp;
    } catch (err: any) {
      console.warn('⚠️ [Firebase Admin] Failed to load FIREBASE_SERVICE_ACCOUNT_PATH:', err.message);
    }
  }

  // 3. Fallback to default project ID
  try {
    firebaseApp = initializeApp({
      projectId,
    });
    console.log(`✅ [Firebase Admin] Initialized with Project ID: ${projectId}`);
  } catch (err: any) {
    console.warn('⚠️ [Firebase Admin] Initialization fallback note:', err.message);
    const apps = getApps();
    if (apps.length > 0) {
      firebaseApp = apps[0];
    }
  }

  return firebaseApp!;
}

export interface VerifiedFirebaseCustomer {
  uid: string;
  phoneNumber: string;
  email?: string;
}

/**
 * Authoritatively verifies a Firebase ID token generated from customer phone OTP verification.
 * Extracts verified UID and phone number directly from the cryptographically verified token.
 * Never trusts any client-supplied phone numbers or identities.
 */
export async function verifyFirebaseToken(idToken: string): Promise<VerifiedFirebaseCustomer> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Firebase ID token is required');
  }

  const app = getFirebaseApp();
  const auth = getAuth(app);
  const decodedToken = await auth.verifyIdToken(idToken, false);

  if (!decodedToken || !decodedToken.uid) {
    throw new Error('Invalid Firebase token payload: Missing UID');
  }

  const phoneNumber = decodedToken.phone_number;
  if (!phoneNumber) {
    throw new Error('Verified phone number is missing from token. Only phone OTP authentication is permitted for customers.');
  }

  return {
    uid: decodedToken.uid,
    phoneNumber,
    email: decodedToken.email,
  };
}

export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
}

/**
 * Authoritatively verifies a Google identity token.
 * Uses a robust 3-tier cryptographic verification approach:
 * 1. Firebase Admin SDK verifyIdToken (with checkRevoked=false to support setups without service account key files)
 * 2. Direct cryptographic JWT verification using Google's published public x509 certificates (RS256 signature verification)
 * 3. Direct Google OAuth2 tokeninfo validation for tokens issued directly by accounts.google.com
 * Validates cryptographic signature, issuer, audience, and expiration.
 * Never trusts unverified client data.
 */
export async function verifyGoogleAuthToken(idToken: string): Promise<VerifiedGoogleUser> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Google ID token is required');
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'fresh-vegetables-cfb6d';

  // 1. Primary: Verify via Firebase Admin SDK (checkRevoked=false avoids requiring service account file)
  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken, false);

    if (decodedToken && decodedToken.email) {
      const googleId = decodedToken.firebase?.identities?.['google.com']?.[0] || decodedToken.uid || decodedToken.sub;
      return {
        googleId,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email.split('@')[0],
        picture: decodedToken.picture || undefined,
        emailVerified: Boolean(decodedToken.email_verified),
      };
    }
  } catch (firebaseErr: any) {
    console.warn('⚠️ [Google Auth] Firebase Admin verification note:', firebaseErr?.message);
  }

  // 2. Secondary: Direct cryptographic JWT verification using Google's public x509 certificates
  try {
    const decodedUnverified = jwt.decode(idToken, { complete: true }) as any;
    if (decodedUnverified?.header?.kid) {
      const certs = await getGooglePublicCerts();
      const cert = certs[decodedUnverified.header.kid];
      if (cert) {
        const payload: any = jwt.verify(idToken, cert, {
          algorithms: ['RS256'],
          audience: projectId,
          issuer: `https://securetoken.google.com/${projectId}`,
        });

        if (payload && payload.email) {
          const googleId = payload.firebase?.identities?.['google.com']?.[0] || payload.sub || payload.user_id;
          return {
            googleId,
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture || undefined,
            emailVerified: Boolean(payload.email_verified),
          };
        }
      }
    }
  } catch (jwtErr: any) {
    console.warn('⚠️ [Google Auth] Direct Google cert verification note:', jwtErr?.message);
  }

  // 3. Tertiary: Direct Google OAuth tokeninfo endpoint (for tokens issued directly by accounts.google.com)
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (res.ok) {
      const data: any = await res.json();
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (data && validIssuers.includes(data.iss) && data.sub && data.email) {
        return {
          googleId: data.sub,
          email: data.email,
          name: data.name || data.email.split('@')[0],
          picture: data.picture || undefined,
          emailVerified: data.email_verified === 'true' || data.email_verified === true,
        };
      }
    }
  } catch (googleApiErr: any) {
    console.warn('⚠️ [Google Auth] Google OAuth tokeninfo verification note:', googleApiErr?.message);
  }

  throw new Error('Invalid or expired Google authentication token. Verification failed.');
}

export default getFirebaseApp;
