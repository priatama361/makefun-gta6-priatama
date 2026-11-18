// A tiny synthesised sound bank. Nothing is downloaded: every cue is made from Web Audio
// oscillators and noise the first time the player interacts with the page.
export function createAudio() {
  let context = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let enabled = true;

  function ensure() {
    if (context || !enabled) return context;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      enabled = false;
      return null;
    }
    try {
      context = new AudioCtor();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
      engine = context.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engine.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engine.start();
    } catch {
      enabled = false;
      context = null;
    }
    return context;
  }

  function tone(frequency, duration, type = 'square', volume = 0.35, slide = 0) {
    if (!ensure() || context.state === 'suspended') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function play(name) {
    if (!enabled) return;
    if (name === 'shot') tone(330, 0.09, 'square', 0.28, -180);
    else if (name === 'hit') tone(150, 0.16, 'sawtooth', 0.32, -80);
    else if (name === 'cash') {
      tone(740, 0.1, 'triangle', 0.4, 260);
      window.setTimeout(() => tone(980, 0.16, 'triangle', 0.35, 180), 90);
    } else if (name === 'siren') tone(620, 0.24, 'sine', 0.22, 280);
    else if (name === 'enter') tone(420, 0.12, 'triangle', 0.3, 160);
    else if (name === 'crash') tone(90, 0.26, 'sawtooth', 0.4, -40);
    else if (name === 'mission') {
      tone(520, 0.12, 'triangle', 0.35, 120);
      window.setTimeout(() => tone(780, 0.2, 'triangle', 0.35, 160), 120);
    }
  }

  function setEngine(speed, active) {
    if (!context || !engineGain) return;
    const target = active ? 0.03 + Math.min(0.09, speed / 3000) : 0;
    engineGain.gain.value += (target - engineGain.gain.value) * 0.15;
    engine.frequency.value = 48 + Math.min(130, speed * 0.42);
  }

  function resume() {
    const active = ensure();
    if (active && active.state === 'suspended') active.resume();
  }

  function mute() { enabled = false; }

  return { play, setEngine, resume, mute };
}
