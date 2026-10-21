class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.055);
  }

  playDiceRoll() {
    const ctx = this.getContext();
    if (!ctx) return;
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300 + i * 95, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.07, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.05);
    }
  }

  playSuccess(isMasterwork = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = isMasterwork ? [440, 554.37, 659.25, 880, 1108.73] : [440, 554.37, 659.25];
    notes.forEach((freq, idx) => {
      const delay = idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.11, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.36);
    });
  }

  playFail() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(85, ctx.currentTime + 0.32);
    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  playCoin() {
    const ctx = this.getContext();
    if (!ctx) return;
    [987.77, 1318.51].forEach((freq, idx) => {
      const delay = idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.2);
    });
  }

  playCauldronBubble() {
    const ctx = this.getContext();
    if (!ctx) return;
    for (let i = 0; i < 4; i++) {
      const delay = i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 + i * 45, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(320 + i * 60, ctx.currentTime + delay + 0.06);
      gain.gain.setValueAtTime(0.09, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.09);
    }
  }

  playAnvilHammer() {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1250, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.29);
  }

  playArtificerChime() {
    const ctx = this.getContext();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const delay = idx * 0.04;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.42);
    });
  }

  playBuffApply() {
    const ctx = this.getContext();
    if (!ctx) return;
    [330, 440, 554.37, 659.25].forEach((freq, idx) => {
      const delay = idx * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.1, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.26);
    });
  }

  // === CAPE FARSTONE ATMOSPHERIC AMBIENT SOUNDSCAPE ===
  private ambientMasterGain: GainNode | null = null;
  private oceanGain: GainNode | null = null;
  private emberTimer: number | null = null;
  private bellTimer: number | null = null;
  private ambientPlaying: boolean = false;

  isAmbientPlaying(): boolean {
    return this.ambientPlaying;
  }

  toggleAmbientSoundscape(): boolean {
    if (this.ambientPlaying) {
      this.stopAmbientSoundscape();
      return false;
    } else {
      this.startAmbientSoundscape();
      return true;
    }
  }

  startAmbientSoundscape() {
    const ctx = this.getContext();
    if (!ctx) return;
    if (this.ambientPlaying) return;

    this.ambientPlaying = true;

    // Master Ambient Bus
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 2.0); // Gentle fade-in
    masterGain.connect(ctx.destination);
    this.ambientMasterGain = masterGain;

    // 1. OCEAN SURF NOISE (Cape Farstone waves crashing upon basalt cliffs)
    // Create 3 seconds of looped filtered noise
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      // Pinkish/brown noise filter
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const surfFilter = ctx.createBiquadFilter();
    surfFilter.type = 'lowpass';
    surfFilter.frequency.setValueAtTime(320, ctx.currentTime);
    surfFilter.Q.setValueAtTime(2.5, ctx.currentTime);

    // LFO to modulate wave swelling (0.12 Hz cycle = ~8.3 sec per wave)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(280, ctx.currentTime); // Swells between 140Hz and 600Hz
    lfo.connect(lfoGain);
    lfoGain.connect(surfFilter.frequency);

    const oceanGain = ctx.createGain();
    oceanGain.gain.setValueAtTime(0.55, ctx.currentTime);
    this.oceanGain = oceanGain;

    noiseSource.connect(surfFilter);
    surfFilter.connect(oceanGain);
    oceanGain.connect(masterGain);

    noiseSource.start();
    lfo.start();

    // 2. HEARTH CRACKLES (Random charcoal pops in the lair's fireplace)
    const scheduleEmber = () => {
      if (!this.ambientPlaying) return;
      const emberDelay = Math.random() * 2800 + 1200; // 1.2 to 4 seconds
      this.emberTimer = window.setTimeout(() => {
        this.playEmberPop();
        scheduleEmber();
      }, emberDelay);
    };
    scheduleEmber();

    // 3. DISTANT BLACK BELL TOLL OF FAR STONE (Every 35-50 seconds)
    const scheduleBell = () => {
      if (!this.ambientPlaying) return;
      const bellDelay = Math.random() * 25000 + 35000;
      this.bellTimer = window.setTimeout(() => {
        this.playBellChime(true);
        scheduleBell();
      }, bellDelay);
    };
    scheduleBell();
  }

  stopAmbientSoundscape() {
    if (!this.ambientPlaying) return;
    this.ambientPlaying = false;
    if (this.emberTimer) {
      window.clearTimeout(this.emberTimer);
      this.emberTimer = null;
    }
    if (this.bellTimer) {
      window.clearTimeout(this.bellTimer);
      this.bellTimer = null;
    }
    if (this.ambientMasterGain && this.ctx) {
      try {
        const ct = this.ctx.currentTime;
        this.ambientMasterGain.gain.setValueAtTime(this.ambientMasterGain.gain.value, ct);
        this.ambientMasterGain.gain.linearRampToValueAtTime(0.0001, ct + 1.2);
        setTimeout(() => {
          if (!this.ambientPlaying && this.ambientMasterGain) {
            this.ambientMasterGain.disconnect();
            this.ambientMasterGain = null;
          }
        }, 1300);
      } catch {
        this.ambientMasterGain = null;
      }
    }
  }

  private playEmberPop() {
    const ctx = this.getContext();
    if (!ctx || !this.ambientMasterGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400 + Math.random() * 1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.035);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    gain.gain.setValueAtTime(0.045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientMasterGain);

    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  }

  playBellChime(isDistant = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    // Deep bell harmonics (110 Hz, 220 Hz, 330 Hz, 440 Hz)
    const baseFreq = 164.81; // E3 note
    const harmonics = [1, 2, 2.76, 4.07, 5.43];
    const baseGain = isDistant ? 0.04 : 0.12;
    const decay = isDistant ? 4.5 : 3.2;

    harmonics.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * ratio, ctx.currentTime);
      gain.gain.setValueAtTime(baseGain / (idx + 1), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + decay + 0.1);
    });
  }

  // === SLAG ALEMBIC & TRANSMUTATION SFX ===
  playDistillationBubble() {
    const ctx = this.getContext();
    if (!ctx) return;
    for (let i = 0; i < 6; i++) {
      const delay = i * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220 + i * 75, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(450 + i * 90, ctx.currentTime + delay + 0.09);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.13);
    }
  }

  playTransmutationBoom() {
    const ctx = this.getContext();
    if (!ctx) return;
    // Deep bass boom + soaring harmonic chord
    const oscBass = ctx.createOscillator();
    const gainBass = ctx.createGain();
    oscBass.type = 'sawtooth';
    oscBass.frequency.setValueAtTime(90, ctx.currentTime);
    oscBass.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.8);
    gainBass.gain.setValueAtTime(0.25, ctx.currentTime);
    gainBass.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
    oscBass.connect(gainBass);
    gainBass.connect(ctx.destination);
    oscBass.start();
    oscBass.stop(ctx.currentTime + 0.95);

    // Celestial chime chord
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, idx) => {
      const delay = 0.12 + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.14, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 1.25);
    });
  }
}

export const sfx = new SoundEffects();

