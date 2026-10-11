import { ExerciseNote } from '../types/vocal';

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private activeNodes: (OscillatorNode | GainNode)[] = [];
  private isMuted = false;
  private volume = 0.8;

  private initContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  stopAll() {
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch (e) {
        // ignore already stopped
      }
    }
    this.activeNodes = [];
  }

  /**
   * Plays a warm piano chord / note with natural exponential decay.
   */
  playPianoNote(freq: number, duration = 1.0, startTimeOffset = 0, volumeScale = 1.0) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime + startTimeOffset;

    // Fundamental + 2nd harmonic + 3rd harmonic for rich piano tone
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.35 * this.volume * volumeScale, now + 0.015);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.3);

    masterGain.connect(ctx.destination);
    this.activeNodes.push(masterGain);

    const harmonics = [
      { ratio: 1.0, gain: 0.6 },
      { ratio: 2.0, gain: 0.25 },
      { ratio: 3.0, gain: 0.12 },
      { ratio: 4.0, gain: 0.04 },
    ];

    harmonics.forEach(({ ratio, gain }) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = ratio === 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq * ratio, now);

      oscGain.gain.setValueAtTime(gain, now);
      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(now);
      osc.stop(now + duration + 0.35);

      this.activeNodes.push(osc);
      this.activeNodes.push(oscGain);
    });
  }

  /**
   * Plays a warm vocal guide lead tone (mimicking a singer guide track).
   */
  playGuideVocal(freq: number, duration = 1.0, startTimeOffset = 0) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime + startTimeOffset;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(0.3 * this.volume, now + 0.05);
    mainGain.gain.setValueAtTime(0.28 * this.volume, now + duration - 0.05);
    mainGain.gain.linearRampToValueAtTime(0.0001, now + duration);

    // Warm low-pass vocal formant filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2400, freq * 3.5), now);

    filter.connect(ctx.destination);
    mainGain.connect(filter);
    this.activeNodes.push(mainGain);
    this.activeNodes.push(filter);

    // Dual oscillator with gentle chorus detune
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.002, now);

    // Subtle natural vibrato on sustain after 0.3s
    const vibratoLfo = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibratoLfo.frequency.setValueAtTime(5.4, now); // 5.4 Hz vibrato
    vibratoGain.gain.setValueAtTime(0, now);
    vibratoGain.gain.linearRampToValueAtTime(freq * 0.015, now + 0.4); // gentle depth

    vibratoLfo.connect(vibratoGain);
    vibratoGain.connect(osc1.frequency);
    vibratoGain.connect(osc2.frequency);

    osc1.connect(mainGain);
    osc2.connect(mainGain);

    osc1.start(now);
    osc2.start(now);
    vibratoLfo.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    vibratoLfo.stop(now + duration);

    this.activeNodes.push(osc1, osc2, vibratoLfo, vibratoGain);
  }

  /**
   * Metronome click sound (high accent on beat 1, subtle wood block on others).
   */
  playClick(isAccent = false, startTimeOffset = 0) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime + startTimeOffset;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);

    gain.gain.setValueAtTime(0.2 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);

    this.activeNodes.push(osc, gain);
  }

  /**
   * Pre-exercise countdown sound: 3, 2, 1, Go!
   */
  playCountIn(beatNumber: number) {
    this.playClick(beatNumber === 1 || beatNumber === 4, 0);
  }

  /**
   * Schedules playback of an entire exercise (both guide melody + piano accompaniment).
   */
  playExerciseNotes(
    notes: ExerciseNote[],
    tempoMultiplier = 1,
    includeGuideVocal = true,
    onProgress?: (noteIndex: number) => void,
    onFinished?: () => void
  ): () => void {
    this.stopAll();
    const ctx = this.initContext();
    let currentOffset = 0;

    const timeouts: NodeJS.Timeout[] = [];

    notes.forEach((note, idx) => {
      const noteDuration = note.duration * tempoMultiplier;
      const startTime = currentOffset;

      // Schedule audio
      this.playPianoNote(note.freq, noteDuration, startTime, 0.85);
      if (includeGuideVocal) {
        this.playGuideVocal(note.freq, noteDuration, startTime);
      }

      // Schedule progress callback
      const timer = setTimeout(() => {
        if (onProgress) onProgress(idx);
      }, startTime * 1000);
      timeouts.push(timer);

      currentOffset += noteDuration + (note.restAfter || 0) * tempoMultiplier;
    });

    const endTimer = setTimeout(() => {
      if (onFinished) onFinished();
    }, currentOffset * 1000);
    timeouts.push(endTimer);

    // Cancel function
    return () => {
      this.stopAll();
      timeouts.forEach(clearTimeout);
    };
  }
}

export const synth = new AudioSynthesizer();
