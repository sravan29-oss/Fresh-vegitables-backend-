import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'fresh-vegetables-cfb6d.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'fresh-vegetables-cfb6d',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'fresh-vegetables-cfb6d.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Language set to India
auth.useDeviceLanguage();

/**
 * Initializes invisible background verification for Firebase Phone Authentication.
 * Attached to an off-screen container with zero visual challenge or user interruption.
 */
export function getInvisibleRecaptcha(containerId = 'recaptcha-invisible-container'): RecaptchaVerifier {
  if (typeof window === 'undefined') {
    throw new Error('RecaptchaVerifier can only be initialized in the browser.');
  }

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
    container.style.position = 'fixed';
    container.style.bottom = '-9999px';
    container.style.right = '-9999px';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '-9999';
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

  const verifier = getInvisibleRecaptcha();
  return await signInWithPhoneNumber(auth, formattedPhone, verifier);
}

export type { ConfirmationResult };
