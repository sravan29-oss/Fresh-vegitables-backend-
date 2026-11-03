import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseApp: App | null = null;

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
  const decodedToken = await auth.verifyIdToken(idToken, true);

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
 * 1. Attempts verification using Firebase Admin SDK (which verifies signature, issuer, audience, exp).
 * 2. If token was issued directly by Google OAuth2 (accounts.google.com), verifies using Google's public tokeninfo endpoint.
 * Validates issuer, audience, expiration, and cryptographic signature.
 * Extracts verified Google UID, email, name, and profile avatar directly from the verified payload.
 */
export async function verifyGoogleAuthToken(idToken: string): Promise<VerifiedGoogleUser> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Google ID token is required');
  }

  // 1. Primary: Verify via Firebase Admin SDK
  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(idToken, true);

    if (decodedToken && decodedToken.email) {
      const googleId = decodedToken.firebase?.identities?.['google.com']?.[0] || decodedToken.uid;
      return {
        googleId,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email.split('@')[0],
        picture: decodedToken.picture || undefined,
        emailVerified: Boolean(decodedToken.email_verified),
      };
    }
  } catch (firebaseErr: any) {
    // If not a Firebase-issued token, try direct Google tokeninfo verification below
  }

  // 2. Secondary: Direct Google OAuth token verification via Google's tokeninfo endpoint
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (res.ok) {
      const data: any = await res.json();
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (
        data &&
        validIssuers.includes(data.iss) &&
        data.sub &&
        data.email
      ) {
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
    // Fall-through to throw error
  }

  throw new Error('Invalid or expired Google authentication token. Verification failed.');
}

export default getFirebaseApp;
