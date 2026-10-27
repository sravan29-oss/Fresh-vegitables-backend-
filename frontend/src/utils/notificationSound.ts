/**
 * Notification Chime Sound Synthesizer & Audio Player
 * Uses Web Audio API for 100% reliable, zero-latency playback across all browsers.
 */

let sharedAudioContext: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioContext) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass();
    }
  }
  return sharedAudioContext;
}

/**
 * Automatically resume audio context on first user interaction
 * required by modern browser autoplay policies.
 */
export function unlockAudioContext() {
  if (isAudioUnlocked || typeof window === 'undefined') return;

  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    const resume = () => {
      ctx.resume().then(() => {
        isAudioUnlocked = true;
        window.removeEventListener('click', resume);
        window.removeEventListener('keydown', resume);
        window.removeEventListener('touchstart', resume);
      }).catch(() => {});
    };

    window.addEventListener('click', resume, { passive: true });
    window.addEventListener('keydown', resume, { passive: true });
    window.addEventListener('touchstart', resume, { passive: true });
  } else if (ctx && ctx.state === 'running') {
    isAudioUnlocked = true;
  }
}

// Initialize audio unlocking
if (typeof window !== 'undefined') {
  unlockAudioContext();
}

/**
 * Play a sparkling, pleasant dual-tone organic notification chime
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Master volume limiter to prevent distortion
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.4, now);
    masterGain.connect(ctx.destination);

    // --- TONE 1: Fundamental Chime (E5 -> A5 glide, 659.25Hz -> 880Hz) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc1.connect(gain1);
    gain1.connect(masterGain);

    // --- TONE 2: Glass Bell Sparkle Overtone (1318.5Hz - E6) ---
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1318.5, now + 0.08);
    gain2.gain.setValueAtTime(0.2, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(masterGain);

    // --- TONE 3: High Chime Finish (1760Hz - A6) ---
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1760, now + 0.18);
    gain3.gain.setValueAtTime(0.25, now + 0.18);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    osc3.connect(gain3);
    gain3.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.9);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.8);

    osc3.start(now + 0.18);
    osc3.stop(now + 1.15);
  } catch (err) {
    console.warn('Audio chime playback notice:', err);
  }
}
