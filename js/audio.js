/* audio.js — sonidos generados con Web Audio (no usa archivos: todo es original y no pesa nada). Se activa con el primer toque. */
let ctx = null, master = null, enabled = true, vol = 0.6, last = {};
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); } catch (e) { ctx = null; }
}
export function setVolume(v) { vol = v; if (master) master.gain.value = v; }
export function setEnabled(e) { enabled = e; }
function env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(type, f0, f1, dur, peak = 0.3, delay = 0) {
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, dur, peak); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise(dur, peak = 0.3, lp = 4000, hp = 200, delay = 0) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'lowpass'; f.frequency.value = lp; f2.type = 'highpass'; f2.frequency.value = hp; env(g, t, 0.004, dur, peak); s.connect(f); f.connect(f2); f2.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const SFX = {
  sword: () => { noise(0.12, 0.22, 7000, 1500); tone('square', 900, 400, 0.07, 0.06); },
  hit: () => { noise(0.1, 0.25, 2500, 150); tone('sine', 160, 70, 0.1, 0.25); },
  heavy: () => { noise(0.2, 0.35, 1800, 80); tone('sine', 110, 45, 0.25, 0.4); },
  arrow: () => { noise(0.18, 0.12, 6000, 2500); tone('triangle', 700, 1400, 0.1, 0.05); },
  magic: () => { tone('sawtooth', 300, 900, 0.3, 0.12); tone('sine', 600, 1500, 0.35, 0.1, 0.03); },
  boom: () => { noise(0.5, 0.45, 1200, 40); tone('sine', 90, 30, 0.5, 0.5); },
  death: () => { tone('sawtooth', 260, 70, 0.25, 0.12); noise(0.12, 0.12, 1500, 100); },
  coin: () => { tone('square', 1318, 1318, 0.06, 0.07); tone('square', 1760, 1760, 0.1, 0.07, 0.06); },
  click: () => { tone('triangle', 520, 380, 0.05, 0.12); },
  deny: () => { tone('square', 180, 120, 0.12, 0.1); },
  horn: () => { tone('sawtooth', 196, 196, 0.5, 0.18); tone('sawtooth', 294, 294, 0.6, 0.15, 0.25); },
  victory: () => { [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, f, 0.3, 0.2, i * 0.15)); },
  defeat: () => { [330, 294, 247, 196].forEach((f, i) => tone('sawtooth', f, f * 0.98, 0.4, 0.14, i * 0.2)); },
  spawn: () => { tone('triangle', 330, 440, 0.08, 0.07); },
  upgrade: () => { [523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.12, 0.16, i * 0.07)); },
};
const MIN_GAP = { sword: 0.05, hit: 0.04, heavy: 0.1, arrow: 0.06, magic: 0.1, boom: 0.15, death: 0.07, coin: 0.08, spawn: 0.1 };
export function sfx(name) {
  if (!ctx || !enabled || ctx.state !== 'running') return;
  const now = ctx.currentTime, gap = MIN_GAP[name] || 0; if (now - (last[name] || 0) < gap) return; last[name] = now;
  try { SFX[name] && SFX[name](); } catch (e) { /* un fallo de audio nunca debe detener el juego */ }
}
