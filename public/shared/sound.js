'use strict';

/* Âm thanh tổng hợp bằng WebAudio (không cần file), dùng chung cho các game. */
(function () {
  let muted = false;
  try { muted = localStorage.getItem('arcade_muted') === '1'; } catch (e) { /* bỏ qua */ }

  const Sound = {
    ac: null,
    get muted() { return muted; },
    set muted(v) {
      muted = v;
      try { localStorage.setItem('arcade_muted', v ? '1' : '0'); } catch (e) { /* bỏ qua */ }
    },
    init() {
      if (!this.ac) { try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
      if (this.ac.state === 'suspended') this.ac.resume();
    },
    tone(f, d, type = 'sine', v = 0.1, f2 = null, delay = 0) {
      if (muted || !this.ac) return;
      const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.ac.destination);
      o.start(t); o.stop(t + d + 0.02);
    },
    noise(d, v = 0.3, freq = 900) {
      if (muted || !this.ac) return;
      const len = Math.floor(this.ac.sampleRate * d), buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
      src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = v;
      src.connect(f).connect(g).connect(this.ac.destination);
      src.start();
    },
  };

  window.Sound = Sound;
})();
