// All sound is synthesized with WebAudio: no audio files, no network.
// The context is created on the first user gesture, so loading the page
// never autoplays anything.
let ctx = null;
let muted = false;

export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; if (typeof window !== 'undefined') window.__muted = muted; return muted; }

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  } catch (e) { ctx = null; }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol || 0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch (e) { /* sound is decoration; never break the game */ }
}

export const sfx = {
  shoot(kind) {
    if (kind === 'frost') tone(880, 0.09, 'triangle', 0.05, 660);
    else if (kind === 'bloom') tone(520, 0.14, 'sine', 0.07, 780);
    else tone(700, 0.07, 'square', 0.04, 990);
  },
  kill() { tone(420, 0.12, 'sine', 0.09, 840); },
  leak() { tone(160, 0.3, 'sawtooth', 0.1, 70); },
  place() { tone(523, 0.1, 'sine', 0.09); tone(784, 0.16, 'sine', 0.08); },
  upgrade() { tone(523, 0.09, 'triangle', 0.08); tone(659, 0.09, 'triangle', 0.08); tone(880, 0.16, 'triangle', 0.08); },
  sell() { tone(660, 0.1, 'sine', 0.07, 440); },
  error() { tone(200, 0.12, 'square', 0.06, 150); },
  waveStart() { tone(392, 0.12, 'triangle', 0.09); tone(523, 0.12, 'triangle', 0.09); tone(659, 0.2, 'triangle', 0.09); },
  waveClear() { tone(659, 0.12, 'sine', 0.09); tone(880, 0.2, 'sine', 0.09); },
  win() { [523, 659, 784, 1047].forEach(function (f, i) { setTimeout(function () { tone(f, 0.25, 'sine', 0.1); }, i * 140); }); },
  lose() { [400, 350, 300, 200].forEach(function (f, i) { setTimeout(function () { tone(f, 0.3, 'sawtooth', 0.07); }, i * 170); }); },
};
