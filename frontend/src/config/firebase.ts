import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, Auth } from 'firebase/auth';

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
const sanitizedApiKey = typeof rawApiKey === 'string' ? rawApiKey.trim().replace(/^["']|["']$/g, '') : '';

const firebaseConfig = {
  apiKey: sanitizedApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'fresh-vegetables-cfb6d.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'fresh-vegetables-cfb6d',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fresh-vegetables-cfb6d.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

/**
 * Checks if a valid Firebase Web API key is configured.
 */
export function isFirebaseConfigured(): boolean {
  return typeof sanitizedApiKey === 'string' && sanitizedApiKey.length > 10 && !sanitizedApiKey.includes('your_');
}

/**
 * Safely retrieves or initializes the Firebase App instance.
 * Avoids throwing top-level evaluation errors when environment variables are missing.
 */
export function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  const apps = getApps();
  if (apps.length > 0) {
    cachedApp = apps[0];
    return cachedApp;
  }
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase Web API key is not configured. Please add VITE_FIREBASE_API_KEY to your Vercel Environment Variables.');
  }
  cachedApp = initializeApp(firebaseConfig);
  return cachedApp;
}

/**
 * Safely retrieves or initializes Firebase Auth on demand.
 */
export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const app = getFirebaseApp();
  cachedAuth = getAuth(app);
  try {
    cachedAuth.useDeviceLanguage();
  } catch {
    // Ignore fallback
  }
  return cachedAuth;
}

/**
 * Initializes invisible background verification for Firebase Phone Authentication.
 * Conforms to Google reCAPTCHA terms without DOM CSS suppression.
 */
export function getInvisibleRecaptcha(containerId = 'recaptcha-invisible-container'): RecaptchaVerifier {
  if (typeof window === 'undefined') {
    throw new Error('RecaptchaVerifier can only be initialized in the browser.');
  }

  const auth = getFirebaseAuth();

  // Clear existing verifier if previously rendered
  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch {
      // Ignore
    }
    (window as any).recaptchaVerifier = null;
  }

  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: 'invisible',
    callback: () => {
      // Solved invisibly in background
    },
    'expired-callback': () => {
      // Handle expiry gracefully
    },
  });

  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

/**
 * Sends a real SMS OTP via Firebase to the customer's +91 mobile number.
 */
export async function sendFirebasePhoneOtp(rawPhone: string): Promise<ConfirmationResult> {
  const digits = rawPhone.replace(/\D/g, '');
  const tenDigits = digits.length >= 10 ? digits.slice(-10) : digits;
  if (tenDigits.length !== 10) {
    throw new Error('Please enter a valid 10-digit Indian mobile number');
  }
  const formattedPhone = `+91${tenDigits}`;

  const auth = getFirebaseAuth();
  const verifier = getInvisibleRecaptcha();
  return await signInWithPhoneNumber(auth, formattedPhone, verifier);
}

export type { ConfirmationResult };
