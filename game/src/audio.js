// Small WebAudio sound cues, all synthesized locally at runtime: no audio
// files and no network. The first user gesture unlocks the audio context.

export function createAudio() {
  let context = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let noise = null;
  let muted = false;
  const LEVEL = 0.36;

  function unlock() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = muted ? 0 : LEVEL;
    master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    noise = buffer;
    engine = context.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 64;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engine.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engine.start();
  }

  function burst(duration, volume, frequency, type = 'lowpass') {
    if (context === null || muted) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
    source.stop(context.currentTime + duration);
  }

  function tone(frequency, duration, volume, type = 'sine', delay = 0) {
    if (context === null || muted) return;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.7), at + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }

  function melody(notes, spacing = 0.1) {
    notes.forEach((note, index) => tone(note, spacing + 0.08, 0.2, 'triangle', index * spacing));
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master !== null) master.gain.value = muted ? 0 : LEVEL;
    },
    isMuted() {
      return muted;
    },
    setEngine(speed, active) {
      if (context === null || engine === null || engineGain === null) return;
      engine.frequency.setTargetAtTime(62 + speed * 0.36, context.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(active && !muted ? 0.052 : 0, context.currentTime, 0.12);
    },
    play(name) {
      if (context === null || muted) return;
      if (name === 'shot') burst(0.09, 0.55, 2100, 'highpass');
      else if (name === 'cash') melody([880, 1320], 0.08);
      else if (name === 'hit') tone(170, 0.24, 0.42, 'square');
      else if (name === 'crash') burst(0.4, 0.65, 850);
      else if (name === 'shop') melody([660, 990, 1320], 0.07);
      else if (name === 'story') melody([520, 660, 880, 1170], 0.11);
      else if (name === 'rankup') melody([660, 880, 1100, 1320, 1760], 0.09);
      else if (name === 'wanted') tone(330, 0.3, 0.24, 'triangle');
      else if (name === 'enter') tone(240, 0.12, 0.2, 'square');
      else if (name === 'over') tone(120, 0.9, 0.5, 'sawtooth');
    },
  };
}
