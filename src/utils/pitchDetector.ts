/**
 * High-performance vocal pitch detection and music theory math.
 * Implements a modified YIN algorithm optimized for human vocal range (65 Hz to 1200 Hz).
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): { note: string; octave: number; fullName: string } {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  const note = NOTE_NAMES[noteIndex];
  return {
    note,
    octave,
    fullName: `${note}${octave}`,
  };
}

export function noteNameToMidi(name: string): number {
  const match = name.match(/^([A-G][#b]?)(-?\d+)$/i);
  if (!match) return 60; // C4 fallback
  let note = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);
  
  if (note === 'DB') note = 'C#';
  if (note === 'EB') note = 'D#';
  if (note === 'GB') note = 'F#';
  if (note === 'AB') note = 'G#';
  if (note === 'BB') note = 'A#';

  const index = NOTE_NAMES.indexOf(note);
  if (index === -1) return 60;
  return (octave + 1) * 12 + index;
}

export function noteNameToFreq(name: string): number {
  return midiToFreq(noteNameToMidi(name));
}

/**
 * Calculates cents deviation from a target frequency or closest note.
 * 100 cents = 1 semitone. Positive = sharp, Negative = flat.
 */
export function getCentsDeviation(currentFreq: number, targetFreq: number): number {
  if (currentFreq <= 0 || targetFreq <= 0) return 0;
  return Math.round(1200 * Math.log2(currentFreq / targetFreq));
}

/**
 * Computes RMS (root-mean-square) volume of audio buffer.
 */
export function computeRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * YIN Pitch Detection Algorithm.
 * Robust against background room noise and vocal harmonics.
 */
export class PitchDetector {
  private bufferSize: number;
  private sampleRate: number;
  private yinBuffer: Float32Array;
  private threshold: number; // typically 0.10 - 0.15

  constructor(bufferSize = 2048, sampleRate = 44100, threshold = 0.15) {
    this.bufferSize = bufferSize;
    this.sampleRate = sampleRate;
    this.threshold = threshold;
    this.yinBuffer = new Float32Array(bufferSize / 2);
  }

  setSampleRate(rate: number) {
    this.sampleRate = rate;
  }

  detect(buffer: Float32Array, rmsThreshold = 0.015): { freq: number; confidence: number } | null {
    const rms = computeRms(buffer);
    if (rms < rmsThreshold) {
      return null; // Silence or background room noise
    }

    const halfBufferSize = Math.floor(this.bufferSize / 2);

    // Human singing range constraints:
    // Min vocal frequency ~65 Hz (C2 - Bass)
    // Max vocal frequency ~1200 Hz (D6 - Soprano)
    const minPeriod = Math.floor(this.sampleRate / 1200);
    const maxPeriod = Math.min(halfBufferSize - 1, Math.floor(this.sampleRate / 65));

    // Step 1: Difference Function
    for (let tau = 0; tau < halfBufferSize; tau++) {
      this.yinBuffer[tau] = 0;
    }
    for (let tau = 1; tau < halfBufferSize; tau++) {
      for (let i = 0; i < halfBufferSize; i++) {
        const delta = buffer[i] - buffer[i + tau];
        this.yinBuffer[tau] += delta * delta;
      }
    }

    // Step 2: Cumulative Mean Normalized Difference Function
    this.yinBuffer[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau < halfBufferSize; tau++) {
      runningSum += this.yinBuffer[tau];
      this.yinBuffer[tau] = runningSum > 0 ? (this.yinBuffer[tau] * tau) / runningSum : 1;
    }

    // Step 3: Absolute Thresholding
    let tauEstimate = -1;
    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (this.yinBuffer[tau] < this.threshold) {
        while (tau + 1 < maxPeriod && this.yinBuffer[tau + 1] < this.yinBuffer[tau]) {
          tau++;
        }
        tauEstimate = tau;
        break;
      }
    }

    // If no tau was under threshold, find the global minimum in valid vocal period range
    if (tauEstimate === -1) {
      let minVal = Infinity;
      for (let tau = minPeriod; tau <= maxPeriod; tau++) {
        if (this.yinBuffer[tau] < minVal) {
          minVal = this.yinBuffer[tau];
          tauEstimate = tau;
        }
      }
      // If even the best minimum is poor confidence (> 0.45), reject
      if (minVal > 0.45) {
        return null;
      }
    }

    // Step 4: Parabolic Interpolation for sub-sample accuracy
    let betterTau: number;
    const x0 = tauEstimate < 1 ? tauEstimate : tauEstimate - 1;
    const x2 = tauEstimate + 1 < halfBufferSize ? tauEstimate + 1 : tauEstimate;

    if (x0 === tauEstimate) {
      betterTau = this.yinBuffer[tauEstimate] <= this.yinBuffer[x2] ? tauEstimate : x2;
    } else if (x2 === tauEstimate) {
      betterTau = this.yinBuffer[tauEstimate] <= this.yinBuffer[x0] ? tauEstimate : x0;
    } else {
      const s0 = this.yinBuffer[x0];
      const s1 = this.yinBuffer[tauEstimate];
      const s2 = this.yinBuffer[x2];
      const denom = 2 * (2 * s1 - s2 - s0);
      betterTau = denom !== 0 ? tauEstimate + (s2 - s0) / denom : tauEstimate;
    }

    const freq = this.sampleRate / betterTau;
    if (freq < 65 || freq > 1300 || isNaN(freq)) {
      return null;
    }

    const confidence = Math.max(0, Math.min(1, 1 - (this.yinBuffer[tauEstimate] || 0)));
    return { freq, confidence };
  }
}
