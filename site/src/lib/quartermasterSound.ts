let audio: AudioContext | undefined;
export function unlockCoinSound() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
  } catch { /* Sound is optional; gameplay never depends on audio support. */ }
}
export function playCoinSound() {
  if (!audio || audio.state !== 'running') return;
  try {
    // A short, quiet metallic double clink, synthesized locally.
    const start = audio.currentTime;
    for (const [delay, frequency, volume] of [[0, 1850, .045], [.075, 2450, .035], [.12, 3700, .012]]) {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, start + delay);
      gain.gain.setValueAtTime(.0001, start + delay);
      gain.gain.exponentialRampToValueAtTime(volume, start + delay + .004);
      gain.gain.exponentialRampToValueAtTime(.0001, start + delay + .24);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start + delay); oscillator.stop(start + delay + .25);
    }
  } catch { /* Keep browser audio failures separate from account actions. */ }
}
