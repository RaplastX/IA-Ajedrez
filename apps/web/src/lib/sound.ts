/**
 * Sonidos sintetizados con Web Audio (sin archivos ni licencias de terceros):
 * golpe de madera al mover, golpe más grave al capturar, campana de jaque, arpegio de éxito.
 * Para usar grabaciones (p. ej. de Pixabay o Freesound) basta con sustituir `play()` por
 * reproducción de AudioBuffers; ver docs/ANIMACIONES.md.
 */
import { useSettings } from '../store/settings';

export type SoundName = 'move' | 'capture' | 'check' | 'success' | 'error' | 'notify';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!useSettings.getState().sound) return null;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Golpe percusivo: ruido filtrado con envolvente corta (madera sobre madera). */
function knock(ac: AudioContext, at: number, freq: number, gain: number, duration: number) {
  const length = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 4;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(at);
}

function tone(
  ac: AudioContext,
  at: number,
  freq: number,
  duration: number,
  gain = 0.12,
  type: OscillatorType = 'sine',
) {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function play(name: SoundName) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  switch (name) {
    case 'move':
      knock(ac, t, 1400, 0.9, 0.06);
      break;
    case 'capture':
      knock(ac, t, 700, 1.1, 0.1);
      knock(ac, t + 0.035, 1600, 0.6, 0.05);
      break;
    case 'check':
      knock(ac, t, 1200, 0.7, 0.06);
      tone(ac, t + 0.02, 880, 0.35, 0.08, 'triangle');
      tone(ac, t + 0.02, 1320, 0.3, 0.04, 'sine');
      break;
    case 'success':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(ac, t + i * 0.08, f, 0.35, 0.09, 'triangle'),
      );
      break;
    case 'error':
      tone(ac, t, 220, 0.25, 0.08, 'sawtooth');
      tone(ac, t + 0.09, 196, 0.3, 0.06, 'sawtooth');
      break;
    case 'notify':
      tone(ac, t, 987.77, 0.18, 0.07);
      tone(ac, t + 0.09, 1318.5, 0.25, 0.06);
      break;
  }
}
