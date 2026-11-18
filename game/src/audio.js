export function createAudio() {
  let context = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let noise = null;
  let muted = false;

  function unlock() {
    if (context !== null) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.34;
    master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    noise = buffer;
    engine = context.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 60;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
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

  function tone(frequency, duration, volume, type = 'sine') {
    if (context === null || muted) return;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * 0.6), context.currentTime + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master !== null) master.gain.value = muted ? 0 : 0.34;
    },
    isMuted() {
      return muted;
    },
    setEngine(speed, active) {
      if (context === null || engine === null || engineGain === null) return;
      engine.frequency.setTargetAtTime(58 + speed * 0.34, context.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(active && !muted ? 0.055 : 0, context.currentTime, 0.12);
    },
    play(name) {
      if (context === null || muted) return;
      if (name === 'shot') burst(0.09, 0.5, 2200, 'highpass');
      else if (name === 'cash') {
        tone(880, 0.12, 0.25);
        window.setTimeout(() => tone(1320, 0.16, 0.22), 80);
      } else if (name === 'hit') tone(180, 0.22, 0.4, 'square');
      else if (name === 'crash') burst(0.42, 0.7, 900);
      else if (name === 'job') {
        tone(520, 0.14, 0.24);
        window.setTimeout(() => tone(780, 0.2, 0.24), 110);
      } else if (name === 'wanted') tone(320, 0.3, 0.22, 'triangle');
      else if (name === 'over') tone(140, 0.9, 0.5, 'sawtooth');
    },
  };
}
