/**
 * Audible new-order alert.
 *
 * A kitchen tablet sits on a counter with nobody looking at it, so a new order has to
 * make a noise. The tone is synthesised rather than shipped as an audio file: no asset
 * to cache, no CSP media source, and it stays audible over kitchen noise.
 *
 * Browsers refuse to start audio before the user has interacted with the page, so the
 * context is created lazily and unlocked on the first gesture. Everything degrades
 * quietly - a portal that throws because audio is blocked would be worse than a silent
 * one, and the board still updates visually.
 */
let context: AudioContext | undefined;

type WindowWithAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/**
 * The mute switch, per device rather than per account.
 *
 * A counter tablet should chime while the owner's phone in the same kitchen stays quiet,
 * so this lives in local storage and never reaches the API.
 */
const MUTE_KEY = 'ck.vendor.alertSound';

export function isAlertSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MUTE_KEY) !== 'off';
  } catch {
    // Private-mode Safari throws on storage access; defaulting to audible is the safer
    // failure for a kitchen.
    return true;
  }
}

export function setAlertSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Nothing to do: the switch simply will not persist across reloads.
  }
}

function audioContext(): AudioContext | undefined {
  if (typeof window === 'undefined') return undefined;
  if (context) return context;

  const Ctor = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
  if (!Ctor) return undefined;

  try {
    context = new Ctor();
    return context;
  } catch {
    return undefined;
  }
}

/**
 * Call once from a user gesture (a click anywhere in the shell). Without this the
 * first alert of the shift is swallowed by the browser's autoplay policy.
 */
export function unlockAlertSound(): void {
  void audioContext()?.resume();
}

/** Two short rising blips - distinct from a phone notification, easy to recognise. */
export function playNewOrderAlert(): void {
  if (!isAlertSoundEnabled()) return;

  const ctx = audioContext();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  for (const [index, frequency] of [880, 1320].entries()) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = now + index * 0.18;

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    // Ramped rather than switched, so it reads as a chime instead of a click.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.18);
  }
}
