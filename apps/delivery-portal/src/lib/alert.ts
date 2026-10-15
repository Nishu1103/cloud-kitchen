/**
 * Offer alert: a chime plus a vibration.
 *
 * A rider has the phone in a pocket, so a new job has to be felt as well as heard. The
 * tone is synthesised rather than shipped as an audio file: no asset to cache, no CSP
 * media source, and it carries over traffic.
 *
 * Browsers refuse to start audio before the user has interacted with the page, so the
 * context is created lazily and unlocked on the first gesture. Everything degrades
 * quietly - a portal that throws because audio is blocked would be worse than a silent
 * one, and the job list still updates on screen.
 */
let context: AudioContext | undefined;

type WindowWithAudio = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/**
 * The mute switch, per device rather than per account.
 *
 * A rider on a night shift in a shared room should be able to silence the chime without
 * turning off the alerts themselves, so this lives in local storage and never reaches
 * the API.
 */
const MUTE_KEY = 'ck.delivery.alertSound';

export function isAlertSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(MUTE_KEY) !== 'off';
  } catch {
    // Private-mode Safari throws on storage access; defaulting to audible is the safer
    // failure for somebody waiting on work.
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
 * Call once from a user gesture (a tap anywhere in the shell). Without this the first
 * offer of the shift is swallowed by the browser's autoplay policy.
 */
export function unlockAlert(): void {
  void audioContext()?.resume();
}

/** Three rising blips and a double buzz - noticeably more urgent than a message tone. */
export function playOfferAlert(): void {
  if (!isAlertSoundEnabled()) return;

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    // Ignored by iOS Safari, which has no vibration API; the chime covers that case.
    navigator.vibrate([120, 60, 120]);
  }

  const ctx = audioContext();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;
  for (const [index, frequency] of [740, 988, 1245].entries()) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = now + index * 0.14;

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    // Ramped rather than switched, so it reads as a chime instead of a click.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.32, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.13);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.15);
  }
}
