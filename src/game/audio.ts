/**
 * Procedural Web Audio Sound Engine for Sky Warrior: Flight Combat
 * 100% procedural synthesized audio with zero external file dependencies.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Engine loop nodes
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineNoiseSource: AudioBufferSourceNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;

  // Lock-on tone nodes
  private lockToneOsc: OscillatorNode | null = null;
  private lockToneGain: GainNode | null = null;
  private isLockBeeping: boolean = false;
  private lockBeepTimer: number | null = null;

  // Warning alarm
  private warningTimer: number | null = null;

  constructor() {
    // Sound engine begins in standby until first user interaction
  }

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupEngineSynth();
      this.setupLockTone();
      this.isInitialized = true;
    } catch {
      // AudioContext unavailable or blocked
    }
  }

  private setupEngineSynth() {
    if (!this.ctx || !this.masterGain) return;

    // Create 3-second noise buffer for looping jet rumble
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02; // Pink-like noise
      lastOut = output[i];
      output[i] *= 3.5;
    }

    this.engineNoiseSource = this.ctx.createBufferSource();
    this.engineNoiseSource.buffer = noiseBuffer;
    this.engineNoiseSource.loop = true;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    // Sub-bass turbine whine
    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.setValueAtTime(75, this.ctx.currentTime);
    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

    this.engineSubOsc.connect(subGain);
    subGain.connect(this.masterGain);

    this.engineNoiseSource.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineNoiseSource.start();
    this.engineSubOsc.start();
  }

  private setupLockTone() {
    if (!this.ctx || !this.masterGain) return;

    this.lockToneOsc = this.ctx.createOscillator();
    this.lockToneOsc.type = 'sawtooth';
    this.lockToneOsc.frequency.setValueAtTime(880, this.ctx.currentTime);

    this.lockToneGain = this.ctx.createGain();
    this.lockToneGain.gain.setValueAtTime(0, this.ctx.currentTime);

    const lockFilter = this.ctx.createBiquadFilter();
    lockFilter.type = 'bandpass';
    lockFilter.frequency.setValueAtTime(950, this.ctx.currentTime);
    lockFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.lockToneOsc.connect(lockFilter);
    lockFilter.connect(this.lockToneGain);
    this.lockToneGain.connect(this.masterGain);

    this.lockToneOsc.start();
  }

  public updateEngine(throttle: number, isBoosting: boolean) {
    if (!this.isInitialized || !this.ctx || !this.engineFilter || !this.engineGain || !this.engineSubOsc) return;

    const baseFreq = 220 + throttle * 400 + (isBoosting ? 500 : 0);
    const baseVol = 0.12 + throttle * 0.15 + (isBoosting ? 0.18 : 0);
    const subFreq = 65 + throttle * 85 + (isBoosting ? 90 : 0);

    const t = this.ctx.currentTime;
    this.engineFilter.frequency.setTargetAtTime(baseFreq, t, 0.1);
    this.engineGain.gain.setTargetAtTime(baseVol, t, 0.1);
    this.engineSubOsc.frequency.setTargetAtTime(subFreq, t, 0.1);
  }

  public setLockStatus(status: 'none' | 'seeking' | 'locked') {
    if (!this.isInitialized || !this.ctx || !this.lockToneGain || !this.lockToneOsc) return;

    if (status === 'locked') {
      if (this.lockBeepTimer) {
        window.clearInterval(this.lockBeepTimer);
        this.lockBeepTimer = null;
      }
      this.isLockBeeping = false;
      this.lockToneOsc.frequency.setTargetAtTime(1180, this.ctx.currentTime, 0.05);
      this.lockToneGain.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.05);
    } else if (status === 'seeking') {
      if (!this.isLockBeeping) {
        this.isLockBeeping = true;
        this.lockToneOsc.frequency.setValueAtTime(780, this.ctx.currentTime);
        this.lockBeepTimer = window.setInterval(() => {
          if (!this.ctx || !this.lockToneGain) return;
          const ct = this.ctx.currentTime;
          this.lockToneGain.gain.cancelScheduledValues(ct);
          this.lockToneGain.gain.setValueAtTime(0.1, ct);
          this.lockToneGain.gain.exponentialRampToValueAtTime(0.001, ct + 0.1);
        }, 320);
      }
    } else {
      if (this.lockBeepTimer) {
        window.clearInterval(this.lockBeepTimer);
        this.lockBeepTimer = null;
      }
      this.isLockBeeping = false;
      this.lockToneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  public playGunShot() {
    if (!this.isInitialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Fast Gatling cannon burst
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.06);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  public playMissileLaunch() {
    if (!this.isInitialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Rocket ignition sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    // Whoosh noise
    const noise = this.ctx.createBufferSource();
    const bSize = this.ctx.sampleRate * 0.6;
    const buf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(2200, t + 0.3);
    filter.Q.setValueAtTime(2.0, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.65);
    noise.start(t);
    noise.stop(t + 0.65);
  }

  public playExplosion() {
    if (!this.isInitialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Low rumble oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.9);

    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);

    // Filtered noise blast
    const noise = this.ctx.createBufferSource();
    const bSize = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + 1.2);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.65, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 1.2);
    noise.start(t);
    noise.stop(t + 1.2);
  }

  public playCheckpointChime() {
    if (!this.isInitialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const notes = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6 arpeggio
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.4);
    });
  }

  public playWarning(type: 'pullup' | 'missile') {
    if (!this.isInitialized || !this.ctx || !this.masterGain || this.isMuted) return;
    if (this.warningTimer) return; // Prevent overlapping klaxons

    const freq1 = type === 'pullup' ? 620 : 900;
    const freq2 = type === 'pullup' ? 440 : 1200;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq1, t);
    osc.frequency.setValueAtTime(freq2, t + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.38);

    this.warningTimer = window.setTimeout(() => {
      this.warningTimer = null;
    }, 600);
  }

  public playUiClick() {
    if (!this.isInitialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    osc.frequency.exponentialRampToValueAtTime(450, t + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playThunder() {
    if (!this.isInitialized || !this.ctx || !this.masterGain || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Initial lightning strike crack
    const crack = this.ctx.createOscillator();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(380, t);
    crack.frequency.exponentialRampToValueAtTime(30, t + 0.12);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.45, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    crack.connect(crackGain);
    crackGain.connect(this.masterGain);

    crack.start(t);
    crack.stop(t + 0.16);

    // Deep rolling thunder rumble
    const rumbleSource = this.ctx.createBufferSource();
    const duration = 2.8;
    const bSize = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.05 * white) / 1.05; // Brownish noise
      data[i] = last * 4.0;
    }
    rumbleSource.buffer = buf;

    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(140, t);
    rumbleFilter.frequency.linearRampToValueAtTime(60, t + duration);

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.01, t);
    rumbleGain.gain.linearRampToValueAtTime(0.7, t + 0.18);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    rumbleSource.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    rumbleSource.start(t);
    rumbleSource.stop(t + duration);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }
}

export const soundEngine = new SoundEngine();
