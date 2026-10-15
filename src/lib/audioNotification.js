/**
 * Web Audio API Synthesizer for high-fidelity chat & call sound notifications.
 * Zero external audio file dependencies — instant, reliable across mobile and desktop.
 */

let audioCtx = null;
let activeRingtoneInterval = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a synthesized message chime:
 * Modern high-clarity 2-step chime (587Hz -> 880Hz)
 */
export function playMessageChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now); // D6 harmonic
    osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.12);

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.48);
    osc2.stop(now + 0.48);
  } catch (err) {
    console.warn('[AudioNotification] Message chime error:', err);
  }
}

/**
 * Play a single ring burst:
 * Classic dual-tone (440Hz + 480Hz) with smooth envelope
 */
function playRingBurst() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(480, now);

    // Fade in, hold, fade out (1.4s burst)
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.22, now + 0.08);
    gainNode.gain.setValueAtTime(0.22, now + 1.25);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.5);
    osc2.stop(now + 1.5);
  } catch (err) {
    console.warn('[AudioNotification] Ring burst error:', err);
  }
}

/**
 * Start repeating ringing sound for incoming calls or initiated spaces
 * @param {number} maxDurationMs Maximum time to ring before auto-stopping (default 24s)
 */
export function startCallRingtone(maxDurationMs = 24000) {
  stopCallRingtone();
  playRingBurst();

  activeRingtoneInterval = setInterval(() => {
    playRingBurst();
  }, 2600);

  if (maxDurationMs > 0) {
    setTimeout(() => {
      stopCallRingtone();
    }, maxDurationMs);
  }
}

/**
 * Stop any currently ringing call tone
 */
export function stopCallRingtone() {
  if (activeRingtoneInterval) {
    clearInterval(activeRingtoneInterval);
    activeRingtoneInterval = null;
  }
}

/**
 * Play an uplifting space started / chime notification:
 * 3-note melodic arpeggio (C5 - E5 - G5)
 */
export function playSpaceTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.1;
      const duration = 0.4;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.16, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });
  } catch (err) {
    console.warn('[AudioNotification] Space tone error:', err);
  }
}

export function playNotificationTone(type = 'message') {
  if (type === 'call') {
    startCallRingtone(6000); // Ring for up to 6 seconds
  } else if (type === 'space') {
    playSpaceTone();
  } else {
    playMessageChime();
  }
}
