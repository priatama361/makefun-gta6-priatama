const TONES = {
  shot: { frequency: 190, end: 55, duration: 0.13, type: 'square', volume: 0.16 },
  hurt: { frequency: 220, end: 90, duration: 0.28, type: 'sawtooth', volume: 0.14 },
  cash: { frequency: 660, end: 1320, duration: 0.2, type: 'triangle', volume: 0.15 },
  pickup: { frequency: 420, end: 880, duration: 0.16, type: 'sine', volume: 0.13 },
  mission: { frequency: 520, end: 1040, duration: 0.5, type: 'triangle', volume: 0.18 },
  crash: { frequency: 120, end: 40, duration: 0.24, type: 'sawtooth', volume: 0.18 },
  carjack: { frequency: 300, end: 160, duration: 0.2, type: 'square', volume: 0.12 },
  ui: { frequency: 480, end: 620, duration: 0.1, type: 'sine', volume: 0.1 },
  siren: { frequency: 700, end: 480, duration: 0.42, type: 'sine', volume: 0.07 },
};

export function createAudio() {
  let context = null;
  let master = null;
  let engineOscillator = null;
  let engineGain = null;
  let muted = false;
  let sirenTimer = 0;

  function unlock() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return;
    }
    const BrowserAudio = typeof window !== 'undefined' ? window.AudioContext ?? window.webkitAudioContext : null;
    if (BrowserAudio === undefined || BrowserAudio === null) return;
    try {
      context = new BrowserAudio();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(context.destination);
      engineOscillator = context.createOscillator();
      engineOscillator.type = 'sawtooth';
      engineOscillator.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineOscillator.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOscillator.start();
    } catch {
      context = null;
    }
  }

  function play(name) {
    if (context === null || muted) return;
    const tone = TONES[name];
    if (tone === undefined) return;
    try {
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.end), now + tone.duration);
      gain.gain.setValueAtTime(tone.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now);
      oscillator.stop(now + tone.duration + 0.02);
    } catch {
      return;
    }
  }

  function engine(speed, inCar) {
    if (context === null || engineGain === null || engineOscillator === null) return;
    const now = context.currentTime;
    const target = inCar && !muted ? Math.min(0.09, 0.015 + speed / 5200) : 0;
    engineGain.gain.setTargetAtTime(target, now, 0.12);
    engineOscillator.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.38, now, 0.1);
  }

  function update(dt, wanted) {
    if (context === null || muted || wanted <= 0) return;
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 1.1;
      play('siren');
    }
  }

  function setMuted(value) {
    muted = value;
    if (master !== null && context !== null) master.gain.setTargetAtTime(muted ? 0 : 0.55, context.currentTime, 0.05);
  }

  return { unlock, play, engine, update, setMuted, isMuted: () => muted };
}
