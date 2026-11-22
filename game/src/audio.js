// Procedural sound: small WebAudio synth voices, no audio files. The context is created
// on the first user gesture (browsers require one) and every sound is a few oscillators
// with envelopes: a pickup chime, a pebble's clink, the alert sting, a caught thud, and
// a quiet night-time pad under it all.

export function createAudio() {
  let ctx = null;
  let master = null;
  let padStarted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, gainValue, slideTo) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function startPad() {
    if (padStarted || !ensure()) return;
    padStarted = true;
    // A slow two-note pad, very quiet: the museum at night.
    for (const freq of [110, 164.81]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.016;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 0.008;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
    }
  }

  return {
    unlock() {
      ensure();
      startPad();
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.12);
      tone(1318, 0.18, 'sine', 0.09);
    },
    gem() {
      tone(659, 0.14, 'triangle', 0.14);
      tone(988, 0.2, 'triangle', 0.12);
      tone(1318, 0.3, 'triangle', 0.1);
    },
    pebble() {
      tone(2100, 0.05, 'square', 0.05, 900);
    },
    throwPebble() {
      tone(500, 0.09, 'sine', 0.05, 900);
    },
    spotted() {
      tone(1175, 0.07, 'square', 0.045);
    },
    alarm() {
      tone(392, 0.16, 'sawtooth', 0.12);
      tone(311, 0.22, 'sawtooth', 0.12);
    },
    caught() {
      tone(196, 0.35, 'sawtooth', 0.16, 98);
    },
    clear() {
      tone(523, 0.14, 'triangle', 0.13);
      tone(659, 0.14, 'triangle', 0.13);
      tone(784, 0.14, 'triangle', 0.13);
      tone(1047, 0.34, 'triangle', 0.14);
    },
  };
}
