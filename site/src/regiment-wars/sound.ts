import type { Rarity } from './catalogue';
let context: AudioContext | undefined;
export function mutePackAudio() { try { if (context?.state === 'running') void context.suspend().catch(() => {}); } catch { /* Muting is best effort when an audio device disappears. */ } }
export function unlockPackAudio() {
  try { context ??= new AudioContext(); if (context.state === 'suspended') void context.resume().catch(() => {}); } catch { /* Sound is optional; blocked audio must never block a pack. */ }
}
function note(frequency: number, at: number, length: number, volume: number, type: OscillatorType = 'sine') {
  if (!context || context.state !== 'running') return;
  const oscillator = context.createOscillator(); const gain = context.createGain(); const time = context.currentTime + at;
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(volume, time + .012); gain.gain.exponentialRampToValueAtTime(.001, time + length);
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start(time); oscillator.stop(time + length + .02);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
function paper(at: number, length = .16, volume = .065) {
  if (!context || context.state !== 'running') return;
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * length), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (0.45 + 0.55 * Math.sin(i / context.sampleRate * 73) ** 2);
  const source = context.createBufferSource(); const filter = context.createBiquadFilter(); const gain = context.createGain(); const time = context.currentTime + at;
  source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 2300; filter.Q.value = .7;
  gain.gain.setValueAtTime(.001, time); gain.gain.linearRampToValueAtTime(volume, time + .025); gain.gain.exponentialRampToValueAtTime(.001, time + length);
  source.connect(filter); filter.connect(gain); gain.connect(context.destination); source.start(time); source.stop(time + length);
  source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
}
function drum(at: number, accent = false) { note(accent ? 105 : 145, at, .12, accent ? .09 : .045, 'triangle'); paper(at, .07, accent ? .05 : .025); }
function brass(frequency: number, at: number, length = .55, volume = .04) {
  note(frequency, at, length, volume, 'triangle'); note(frequency * 2, at + .02, length * .8, volume * .2, 'sine');
}
export function packSound(kind: 'seal' | 'deal' | Rarity | 'complete') {
  try {
    if (kind === 'seal') { paper(0, .3, .12); paper(.16, .2, .09); [.37, .46, .54, .61].forEach((t, i) => drum(t, i === 3)); }
    else if (kind === 'deal') { paper(0, .12, .04); paper(.08, .1, .03); }
    else if (kind === 'common') { paper(0, .12, .065); drum(.06); }
    else if (kind === 'rare') { paper(0); drum(.08); brass(293.66, .17, .5); brass(440, .32, .65, .035); }
    else { paper(0); [0, .07, .14, .21].forEach((t, i) => drum(t, i === 3)); brass(220, .25, .4, .045); brass(293.66, .46, .65, .045); brass(369.99, .64, .85, .035); brass(440, .64, .85, .028); }
  } catch { /* A device can lose its audio context while its saved game remains valid. */ }
}
