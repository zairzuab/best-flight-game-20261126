// Synthesised sound only — no audio files: an engine hum that follows the
// throttle, wind that follows the speed, a chime for each ring, a thud for
// touchdown and a beep while stalled. Everything starts on the first gesture,
// since browsers block audio before one.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Engine: a sawtooth through a lowpass, pitched by the throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      // Wind: looped white noise through a bandpass.
      const length = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter).connect(windGain).connect(ctx.destination);
      windSource.start();
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, gainValue, when = 0) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const t = ctx.currentTime + when;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(gainValue, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  let lastBeep = 0;
  return {
    start,
    toggleMute() {
      muted = !muted;
      if (ctx) ctx.resume();
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Continuous engine and wind, called every frame. */
    update(throttle, speed, stalled, now) {
      if (!ctx || muted) return;
      if (ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(0.05 + throttle * 0.11, t, 0.1);
      engineOsc.frequency.setTargetAtTime(52 + throttle * 95, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.16, speed * 0.0016), t, 0.15);
      windFilter.frequency.setTargetAtTime(350 + speed * 9, t, 0.15);
      if (stalled && now - lastBeep > 0.5) {
        lastBeep = now;
        tone(880, 0.12, 'square', 0.05);
      }
    },
    chime() {
      tone(880, 0.25, 'sine', 0.12);
      tone(1318, 0.35, 'sine', 0.1, 0.09);
    },
    thud() {
      tone(70, 0.3, 'sine', 0.25);
      tone(48, 0.4, 'sine', 0.2, 0.02);
    },
    crash() {
      tone(90, 0.6, 'sawtooth', 0.2);
      tone(55, 0.8, 'sine', 0.25, 0.05);
    },
    fanfare() {
      tone(523, 0.2, 'sine', 0.12);
      tone(659, 0.2, 'sine', 0.12, 0.12);
      tone(784, 0.4, 'sine', 0.14, 0.24);
    },
  };
}
