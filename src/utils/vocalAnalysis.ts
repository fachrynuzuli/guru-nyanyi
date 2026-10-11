import { VocalExercise, PitchFrame, PerformanceMetrics, NoteEvaluationDetail } from '../types/vocal';
import { getCentsDeviation, freqToMidi } from './pitchDetector';

/**
 * Performs rigorous vocal pedagogical analysis on the recorded pitch frames against the exercise.
 */
export function analyzeVocalPerformance(
  exercise: VocalExercise,
  frames: PitchFrame[],
  tempoMultiplier = 1
): PerformanceMetrics {
  // Compute timeline layout for exercise notes
  let currentTime = 0;
  const noteTimelines = exercise.notes.map((note, index) => {
    const startTime = currentTime;
    const duration = note.duration * tempoMultiplier;
    currentTime += duration + (note.restAfter || 0) * tempoMultiplier;
    return {
      index,
      note,
      startTime,
      endTime: startTime + duration,
      duration,
    };
  });

  const totalExpectedDuration = currentTime;
  const noteEvaluations: NoteEvaluationDetail[] = [];

  let totalCentsDevSum = 0;
  let totalPitchFramesCount = 0;
  let totalInTuneFramesCount = 0;
  let totalOnsetOffsetSum = 0;
  let onsetsDetectedCount = 0;
  let totalDurationRatioSum = 0;

  // Temporary arrays for vibrato and drift calculation across sustained notes
  const sustainedSegments: { targetMidi: number; frames: { time: number; cents: number; freq: number }[] }[] = [];

  for (const item of noteTimelines) {
    const targetMidi = item.note.midi;
    const targetFreq = item.note.freq;

    // Frames within window of this note (with generous ±0.35s tolerance)
    const noteWindowFrames = frames.filter(
      (f) => f.time >= item.startTime - 0.2 && f.time <= item.endTime + 0.35
    );

    const voicedFrames = noteWindowFrames.filter((f) => f.isVoiced && f.freq !== null);

    let onsetTime: number | null = null;
    let onsetOffsetMs: number | null = null;
    let actualDuration = 0;
    let centsSum = 0;
    let inTuneCount = 0;
    const segmentPoints: { time: number; cents: number; freq: number }[] = [];

    if (voicedFrames.length > 0) {
      // First voiced frame is onset
      const firstVoiced = voicedFrames[0];
      onsetTime = firstVoiced.time;
      onsetOffsetMs = Math.round((onsetTime - item.startTime) * 1000);
      totalOnsetOffsetSum += Math.abs(onsetOffsetMs);
      onsetsDetectedCount++;

      // Compute actual voiced duration
      const lastVoiced = voicedFrames[voicedFrames.length - 1];
      actualDuration = Math.max(0.1, lastVoiced.time - firstVoiced.time);

      for (const f of voicedFrames) {
        if (f.freq) {
          const cents = getCentsDeviation(f.freq, targetFreq);
          centsSum += Math.abs(cents);
          if (Math.abs(cents) <= 25) {
            inTuneCount++;
          }
          segmentPoints.push({ time: f.time, cents, freq: f.freq });
        }
      }
    }

    const durationRatio = actualDuration > 0 ? Math.min(1.2, actualDuration / item.duration) : 0;
    totalDurationRatioSum += durationRatio;

    let accuracyScore = 0;
    let centsDeviationAvg: number | null = null;
    let pitchDrift = 0;

    if (voicedFrames.length > 0) {
      centsDeviationAvg = Math.round(centsSum / voicedFrames.length);
      totalCentsDevSum += centsDeviationAvg * voicedFrames.length;
      totalPitchFramesCount += voicedFrames.length;
      totalInTuneFramesCount += inTuneCount;

      // Note accuracy score (100 = 0 cents off, 0 = 100+ cents off)
      const centsPenalty = Math.min(100, centsDeviationAvg * 1.5);
      accuracyScore = Math.max(0, Math.round(100 - centsPenalty));

      // Calculate pitch drift (slope of cents over time in cents/sec)
      if (segmentPoints.length >= 6) {
        pitchDrift = calculateLinearDrift(segmentPoints);
        if (item.duration >= 0.7) {
          sustainedSegments.push({ targetMidi, frames: segmentPoints });
        }
      }
    }

    // Determine status
    let status: NoteEvaluationDetail['status'] = 'missed';
    if (voicedFrames.length === 0 || accuracyScore < 25) {
      status = 'missed';
    } else if (centsDeviationAvg !== null && Math.abs(centsDeviationAvg) <= 20) {
      status = 'perfect';
    } else if (centsDeviationAvg !== null && centsDeviationAvg > 20) {
      status = 'sharp';
    } else if (centsDeviationAvg !== null && centsDeviationAvg < -20) {
      status = 'flat';
    } else {
      status = 'good';
    }

    noteEvaluations.push({
      noteIndex: item.index,
      pitch: item.note.pitch,
      targetMidi,
      targetFreq,
      expectedStartTime: item.startTime,
      expectedDuration: item.duration,
      actualStartTime: onsetTime,
      actualDuration,
      onsetOffsetMs,
      centsDeviationAvg,
      accuracyScore,
      pitchDrift: Math.round(pitchDrift * 10) / 10,
      status,
    });
  }

  // 1. Overall Pitch Metrics
  const avgPitchDeviationCents = totalPitchFramesCount > 0 ? Math.round(totalCentsDevSum / totalPitchFramesCount) : 50;
  const inTunePercentage = totalPitchFramesCount > 0 ? Math.round((totalInTuneFramesCount / totalPitchFramesCount) * 100) : 0;
  const pitchScore = Math.max(0, Math.min(100, Math.round(100 - avgPitchDeviationCents * 1.25)));

  // 2. Rhythm & Timing Metrics
  const avgOnsetOffsetMs = onsetsDetectedCount > 0 ? Math.round(totalOnsetOffsetSum / onsetsDetectedCount) : 350;
  // Score drops for onset offsets > 100ms
  const onsetScore = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, avgOnsetOffsetMs - 50) * 0.25)));
  const durationAccuracy = noteTimelines.length > 0 ? Math.round((totalDurationRatioSum / noteTimelines.length) * 100) : 0;
  const rhythmScore = Math.round(onsetScore * 0.5 + durationAccuracy * 0.5);

  // 3. Note Control: Pitch Drift & Vibrato Analysis
  let totalDrift = 0;
  for (const n of noteEvaluations) {
    totalDrift += Math.abs(n.pitchDrift);
  }
  const avgPitchDrift = noteEvaluations.length > 0 ? Math.round((totalDrift / noteEvaluations.length) * 10) / 10 : 0;
  
  // Stability score decreases if pitch drifts heavily (e.g. sagging flat by 15 cents/sec)
  const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - avgPitchDrift * 3)));

  // Analyze vibrato from sustained segments
  const vibratoResult = analyzeVibratoFromSegments(sustainedSegments);

  // Vibrato score (rewards natural 4.5-6.5 Hz vibrato with 30-70 cents depth)
  let vibratoScore = 50;
  if (vibratoResult.detected) {
    const rateFit = Math.max(0, 1 - Math.abs(vibratoResult.rateHz - 5.5) / 2); // peak at 5.5Hz
    const depthFit = Math.max(0, 1 - Math.abs(vibratoResult.depthCents - 50) / 40); // peak at 50 cents
    vibratoScore = Math.round((rateFit * 0.5 + depthFit * 0.5) * vibratoResult.consistency);
  } else {
    // If student held steady straight-tone with low drift, still award note control
    vibratoScore = Math.round(stabilityScore * 0.7);
  }

  // 4. Overall Weighted Vocal Score
  const overallScore = Math.round(
    pitchScore * 0.40 +
    rhythmScore * 0.30 +
    stabilityScore * 0.15 +
    vibratoScore * 0.15
  );

  const totalSungSeconds = frames.length > 0 ? frames[frames.length - 1].time : 0;

  return {
    pitchScore,
    rhythmScore,
    stabilityScore,
    vibratoScore,
    overallScore,
    avgPitchDeviationCents,
    inTunePercentage,
    avgOnsetOffsetMs,
    durationAccuracy,
    pitchDriftCentsPerSec: avgPitchDrift,
    vibratoDetected: vibratoResult.detected,
    vibratoRateHz: vibratoResult.rateHz,
    vibratoDepthCents: vibratoResult.depthCents,
    vibratoConsistency: vibratoResult.consistency,
    totalSungSeconds: Math.round(totalSungSeconds * 10) / 10,
    notesEvaluated: noteEvaluations,
  };
}

/**
 * Calculates linear regression slope of pitch cents over time.
 * Returns cents per second (e.g. -12.4 means sagging flat by 12.4 cents/sec).
 */
function calculateLinearDrift(points: { time: number; cents: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;

  let sumT = 0;
  let sumC = 0;
  let sumTC = 0;
  let sumT2 = 0;

  const t0 = points[0].time;
  for (const p of points) {
    const t = p.time - t0;
    sumT += t;
    sumC += p.cents;
    sumTC += t * p.cents;
    sumT2 += t * t;
  }

  const denominator = n * sumT2 - sumT * sumT;
  if (Math.abs(denominator) < 1e-6) return 0;
  const slope = (n * sumTC - sumT * sumC) / denominator;
  return slope;
}

/**
 * Detects cyclic vibrato oscillation in vocal pitch data.
 * Checks for 4 to 8 cycles per second with amplitude > 20 cents.
 */
function analyzeVibratoFromSegments(
  segments: { targetMidi: number; frames: { time: number; cents: number; freq: number }[] }[]
): {
  detected: boolean;
  rateHz: number;
  depthCents: number;
  consistency: number;
} {
  if (segments.length === 0) {
    return { detected: false, rateHz: 0, depthCents: 0, consistency: 0 };
  }

  let totalCycles = 0;
  let totalDuration = 0;
  let totalPeakToValleyCents = 0;
  let validExtremaPairs = 0;

  for (const seg of segments) {
    const pts = seg.frames;
    if (pts.length < 15) continue;

    // Moving average filter to eliminate jitter while preserving 4-7Hz vibrato wave
    const smoothed: { time: number; cents: number }[] = [];
    const window = 3;
    for (let i = window; i < pts.length - window; i++) {
      let sum = 0;
      for (let j = -window; j <= window; j++) {
        sum += pts[i + j].cents;
      }
      smoothed.push({ time: pts[i].time, cents: sum / (2 * window + 1) });
    }

    if (smoothed.length < 10) continue;

    // Find local peaks and valleys
    const peaks: { time: number; cents: number }[] = [];
    const valleys: { time: number; cents: number }[] = [];

    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1].cents;
      const curr = smoothed[i].cents;
      const next = smoothed[i + 1].cents;

      if (curr > prev && curr > next) {
        peaks.push(smoothed[i]);
      } else if (curr < prev && curr < next) {
        valleys.push(smoothed[i]);
      }
    }

    // Pair adjacent peaks and valleys to measure cycle period and depth
    const allExtrema = [...peaks.map(p => ({ ...p, type: 'peak' })), ...valleys.map(v => ({ ...v, type: 'valley' }))]
      .sort((a, b) => a.time - b.time);

    for (let i = 0; i < allExtrema.length - 1; i++) {
      const e1 = allExtrema[i];
      const e2 = allExtrema[i + 1];

      if (e1.type !== e2.type) {
        const deltaT = Math.abs(e2.time - e1.time);
        const depth = Math.abs(e2.cents - e1.cents);

        // Half cycle should be between 0.06s and 0.16s (corresponds to 3.1Hz - 8.3Hz)
        if (deltaT >= 0.06 && deltaT <= 0.16 && depth >= 15 && depth <= 180) {
          totalCycles += 0.5;
          totalDuration += deltaT;
          totalPeakToValleyCents += depth;
          validExtremaPairs++;
        }
      }
    }
  }

  if (validExtremaPairs >= 4 && totalDuration > 0.4) {
    const rateHz = Math.round((totalCycles / totalDuration) * 10) / 10;
    const depthCents = Math.round((totalPeakToValleyCents / validExtremaPairs) / 2); // peak amplitude
    const isHealthyRate = rateHz >= 4.0 && rateHz <= 7.5;
    const consistency = Math.min(100, Math.round((validExtremaPairs / (totalCycles * 2 || 1)) * 90));

    return {
      detected: isHealthyRate && depthCents >= 18,
      rateHz,
      depthCents,
      consistency,
    };
  }

  return { detected: false, rateHz: 0, depthCents: 0, consistency: 0 };
}
