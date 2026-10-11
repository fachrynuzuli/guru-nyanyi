import React, { useRef, useEffect } from 'react';
import { VocalExercise, PitchFrame } from '../types/vocal';
import { midiToNoteName } from '../utils/pitchDetector';

interface PianoRollVisualizerProps {
  exercise: VocalExercise;
  currentTime: number;
  totalDuration: number;
  pitchFrames: PitchFrame[];
  currentPitch: {
    freq: number | null;
    midi: number | null;
    centsOffset: number | null;
    noteName: string | null;
    vibratoRateHz?: number;
    vibratoDepthCents?: number;
    driftCents?: number;
  } | null;
  isPlayingGuide: boolean;
  isRecording: boolean;
  tempoMultiplier?: number;
}

export const PianoRollVisualizer: React.FC<PianoRollVisualizerProps> = ({
  exercise,
  currentTime,
  totalDuration,
  pitchFrames,
  currentPitch,
  isRecording,
  tempoMultiplier = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Calculate range of MIDI notes in exercise to scale canvas vertically
  const midiValues = exercise.notes.map((n) => n.midi);
  const minMidi = Math.min(...midiValues) - 2;
  const maxMidi = Math.max(...midiValues) + 2;
  const noteRange = Math.max(7, maxMidi - minMidi + 1);

  // Compute note time layout
  const noteLayouts = React.useMemo(() => {
    let t = 0;
    return exercise.notes.map((note) => {
      const start = t;
      const dur = note.duration * tempoMultiplier;
      t += dur + (note.restAfter || 0) * tempoMultiplier;
      return {
        ...note,
        startTime: start,
        endTime: start + dur,
        duration: dur,
      };
    });
  }, [exercise, tempoMultiplier]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Dark sleek stage background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    const pianoKeyWidth = 48;
    const chartWidth = width - pianoKeyWidth;
    const chartLeft = pianoKeyWidth;

    // Helper functions for coordinates
    const midiToY = (midi: number) => {
      const normalized = (maxMidi - midi) / noteRange;
      return 15 + normalized * (height - 30);
    };

    const timeToX = (time: number) => {
      const progress = totalDuration > 0 ? time / totalDuration : 0;
      return chartLeft + progress * (chartWidth - 20);
    };

    // Draw horizontal pitch guide grid lines and piano keys on the left
    for (let m = minMidi; m <= maxMidi; m++) {
      const y = midiToY(m);
      const { note, octave, fullName } = midiToNoteName(m);
      const isBlackKey = note.includes('#');

      // Grid line
      ctx.strokeStyle = isBlackKey ? 'rgba(51, 65, 85, 0.4)' : 'rgba(71, 85, 105, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartLeft, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      // Piano key on left edge
      ctx.fillStyle = isBlackKey ? '#1e293b' : '#334155';
      ctx.fillRect(0, y - 9, pianoKeyWidth, 18);
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(0, y - 9, pianoKeyWidth, 18);

      // Note label
      ctx.fillStyle = isBlackKey ? '#94a3b8' : '#f8fafc';
      ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(fullName, pianoKeyWidth - 6, y);
    }

    // Draw vertical time beat markers
    const beatInterval = 60 / exercise.bpm;
    for (let t = 0; t <= totalDuration; t += beatInterval) {
      const x = timeToX(t);
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw Target Note Bars (Exercise targets)
    noteLayouts.forEach((note) => {
      const x = timeToX(note.startTime);
      const w = Math.max(14, timeToX(note.endTime) - x);
      const y = midiToY(note.midi) - 10;
      const h = 20;

      // Glow effect for active note
      const isCurrent = currentTime >= note.startTime && currentTime <= note.endTime;

      if (isCurrent) {
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowBlur = 0;
      }

      // Note bar gradient
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      if (isCurrent) {
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(1, '#38bdf8');
      } else {
        grad.addColorStop(0, '#1e3a8a');
        grad.addColorStop(1, '#2563eb');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill();

      // Border
      ctx.strokeStyle = isCurrent ? '#bae6fd' : '#60a5fa';
      ctx.lineWidth = isCurrent ? 2 : 1;
      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;

      // Note text (pitch and lyrics)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = note.lyric ? `${note.pitch} (${note.lyric})` : note.pitch;
      ctx.fillText(label, x + w / 2, y + h / 2);
    });

    // Draw Sung Pitch Trail (User's real-time voice line)
    if (pitchFrames.length > 1) {
      for (let i = 1; i < pitchFrames.length; i++) {
        const prev = pitchFrames[i - 1];
        const curr = pitchFrames[i];

        if (!prev.isVoiced || !curr.isVoiced || prev.midi === null || curr.midi === null) {
          continue;
        }

        // Avoid connecting across large pauses
        if (curr.time - prev.time > 0.12) {
          continue;
        }

        const x1 = timeToX(prev.time);
        const y1 = midiToY(prev.midi);
        const x2 = timeToX(curr.time);
        const y2 = midiToY(curr.midi);

        // Determine color based on cents deviation from target
        const cents = curr.centsOffset !== null ? Math.abs(curr.centsOffset) : 50;
        let strokeColor = '#f43f5e'; // Rose red for off pitch
        if (cents <= 25) {
          strokeColor = '#10b981'; // Emerald green: In tune!
        } else if (cents <= 50) {
          strokeColor = '#f59e0b'; // Amber: Slightly flat/sharp
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // Draw Current Playhead Cursor
    const cursorX = timeToX(currentTime);
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Playhead arrow indicator
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(cursorX - 5, 0);
    ctx.lineTo(cursorX + 5, 0);
    ctx.lineTo(cursorX, 8);
    ctx.closePath();
    ctx.fill();

    // If singing right now, draw glowing dot at exact sung pitch
    if (isRecording && currentPitch && currentPitch.midi !== null) {
      const sungY = midiToY(currentPitch.midi);
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cursorX, sungY, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cursorX, sungY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }, [exercise, currentTime, totalDuration, pitchFrames, currentPitch, isRecording, noteLayouts, maxMidi, minMidi, noteRange, tempoMultiplier]);

  // Pitch needle calculation
  const cents = currentPitch?.centsOffset ?? 0;
  const clampedCents = Math.max(-50, Math.min(50, cents));
  const needleRotation = (clampedCents / 50) * 45; // -45 deg to +45 deg

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Top Real-Time Pitch Tuner & Control Hud */}
      <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Tuner Needle & Note Display */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium">Pitch:</span>
            <span className="font-mono text-base font-bold text-white tracking-wider">
              {currentPitch?.noteName || '—'}
            </span>
            <span className="text-slate-400 text-[11px] font-mono">
              {currentPitch?.freq ? `${Math.round(currentPitch.freq)} Hz` : ''}
            </span>
          </div>

          {/* Tuner Gauge */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono">FLAT (-50)</span>
            <div className="relative w-28 h-4 bg-slate-900 rounded-full overflow-hidden flex items-center justify-center border border-slate-700">
              {/* Center in-tune tick */}
              <div className="absolute top-0 bottom-0 w-1 bg-emerald-500 z-10" />
              {/* Tolerances */}
              <div className="absolute top-0 bottom-0 w-7 bg-emerald-500/20" />
              {/* Needle indicator */}
              {currentPitch?.midi !== null && (
                <div
                  className={`absolute top-0 bottom-0 w-2.5 rounded-full transition-all duration-75 ${
                    Math.abs(cents) <= 20
                      ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                      : Math.abs(cents) <= 40
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                  style={{
                    left: `calc(50% + ${(clampedCents / 50) * 44}% - 5px)`,
                  }}
                />
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono">SHARP (+50)</span>
            <span
              className={`font-mono font-bold w-12 text-right ${
                Math.abs(cents) <= 20
                  ? 'text-emerald-400'
                  : Math.abs(cents) <= 40
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {currentPitch?.midi !== null ? `${cents > 0 ? '+' : ''}${cents}¢` : '0¢'}
            </span>
          </div>
        </div>

        {/* Live Note Control & Vibrato Readout */}
        <div className="flex items-center gap-3">
          {/* Vibrato Meter */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Vibrato:</span>
            {currentPitch?.vibratoRateHz && currentPitch.vibratoRateHz > 0 ? (
              <span className="font-mono text-cyan-400 font-semibold flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                {currentPitch.vibratoRateHz} Hz (±{currentPitch.vibratoDepthCents}¢)
              </span>
            ) : (
              <span className="text-slate-500 font-mono">Straight Tone</span>
            )}
          </div>

          {/* Pitch Drift Indicator */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Stability:</span>
            <span
              className={`font-mono font-semibold ${
                (currentPitch?.driftCents || 0) < 6
                  ? 'text-emerald-400'
                  : (currentPitch?.driftCents || 0) < 14
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {currentPitch?.driftCents !== undefined
                ? `${Math.abs(currentPitch.driftCents)}¢/s drift`
                : 'Steady'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="w-full h-72 sm:h-80 relative">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Legend Overlay at bottom right */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2 px-2.5 py-1 bg-slate-950/80 backdrop-blur rounded text-[10px] text-slate-300 border border-slate-800">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Perfect (±20¢)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Off (±40¢)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Sharp/Flat
          </span>
        </div>
      </div>
    </div>
  );
};
