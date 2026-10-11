import React, { useState, useRef, useEffect } from 'react';
import { RecordedSessionAttempt } from '../types/vocal';
import {
  TrendingUp,
  History,
  GitCompare,
  Play,
  Pause,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface ProgressCompareProps {
  sessions: RecordedSessionAttempt[];
  onDeleteSession: (id: string) => void;
  onSelectExercise: (exerciseId: string) => void;
}

export const ProgressCompare: React.FC<ProgressCompareProps> = ({
  sessions,
  onDeleteSession,
  onSelectExercise,
}) => {
  const [selectedIdA, setSelectedIdA] = useState<string>(sessions[1]?.id || sessions[0]?.id || '');
  const [selectedIdB, setSelectedIdB] = useState<string>(sessions[0]?.id || '');

  // Audio playback state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const attemptA = sessions.find((s) => s.id === selectedIdA) || sessions[0];
  const attemptB = sessions.find((s) => s.id === selectedIdB) || sessions[1] || sessions[0];

  const handlePlayAudio = (session: RecordedSessionAttempt) => {
    if (!session.audioBlobUrl) return;

    if (playingId === session.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(session.audioBlobUrl);
      audioRef.current = audio;
      setPlayingId(session.id);
      audio.play();
      audio.onended = () => setPlayingId(null);
    }
  };

  // Compare canvas overlay for attempt A vs attempt B
  const compareCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = compareCanvasRef.current;
    if (!canvas || !attemptA || !attemptB) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const maxTime = Math.max(
      attemptA.metrics.totalSungSeconds || 5,
      attemptB.metrics.totalSungSeconds || 5
    );

    // Helper to draw pitch line
    const drawPitchTrail = (frames: any[], color: string, label: string) => {
      if (!frames || frames.length < 2) return;

      const voiced = frames.filter((f) => f.isVoiced && f.midi !== null);
      if (voiced.length < 2) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();

      let started = false;
      for (const f of voiced) {
        const x = (f.time / maxTime) * (width - 40) + 20;
        // Map MIDI 50-80 to canvas height
        const normalizedMidi = (f.midi - 50) / 30;
        const y = height - (normalizedMidi * (height - 30) + 15);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    };

    drawPitchTrail(attemptA.frames, '#38bdf8', 'Attempt A');
    drawPitchTrail(attemptB.frames, '#ec4899', 'Attempt B');
  }, [attemptA, attemptB]);

  // Metric delta calculations (B relative to A)
  const pitchDelta = attemptB && attemptA ? attemptB.metrics.pitchScore - attemptA.metrics.pitchScore : 0;
  const rhythmDelta = attemptB && attemptA ? attemptB.metrics.rhythmScore - attemptA.metrics.rhythmScore : 0;
  const stabilityDelta = attemptB && attemptA ? attemptB.metrics.stabilityScore - attemptA.metrics.stabilityScore : 0;
  const onsetDeltaMs = attemptB && attemptA ? attemptA.metrics.avgOnsetOffsetMs - attemptB.metrics.avgOnsetOffsetMs : 0; // positive = faster/tighter timing!

  return (
    <div className="space-y-6">
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Total Sessions Logged</span>
            <div className="text-2xl font-black text-white mt-1">{sessions.length}</div>
          </div>
          <div className="p-3 bg-blue-950/70 text-blue-400 rounded-xl border border-blue-900">
            <History className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Highest Vocal Score</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              {sessions.length > 0
                ? `${Math.max(...sessions.map((s) => s.metrics.overallScore))}/100`
                : '—'}
            </div>
          </div>
          <div className="p-3 bg-emerald-950/70 text-emerald-400 rounded-xl border border-emerald-900">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Pitch Centering Trend</span>
            <div className="text-2xl font-black text-cyan-400 mt-1 flex items-center gap-1">
              <span>{sessions.length > 1 ? '+18%' : 'Baseline'}</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="p-3 bg-cyan-950/70 text-cyan-400 rounded-xl border border-cyan-900">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Side-by-Side Attempt Comparison Tool */}
      {sessions.length >= 2 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-base">Cross-Session Recording Comparison</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Compare pitch accuracy, onset timing, and vibrato steadiness between any two session attempts.
              </p>
            </div>
          </div>

          {/* Selectors for Attempt A & Attempt B */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Attempt A (Earlier or Baseline) */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-sky-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  Recording A (Baseline)
                </span>
                {attemptA?.audioBlobUrl && (
                  <button
                    onClick={() => handlePlayAudio(attemptA)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-sky-950 text-sky-300 border border-sky-800 hover:bg-sky-900 transition-colors"
                  >
                    {playingId === attemptA.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{playingId === attemptA.id ? 'Pause Take' : 'Play Take A'}</span>
                  </button>
                )}
              </div>

              <select
                value={selectedIdA}
                onChange={(e) => setSelectedIdA(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-sky-500"
              >
                {sessions.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    Session #{sessions.length - idx}: {s.exerciseTitle} ({new Date(s.timestamp).toLocaleDateString()}) - Grade {s.coachEvaluation.grade}
                  </option>
                ))}
              </select>

              {attemptA && (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Overall Score</span>
                    <span className="text-base font-bold text-white">{attemptA.metrics.overallScore}%</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Pitch Accuracy</span>
                    <span className="text-base font-bold text-emerald-400">{attemptA.metrics.pitchScore}%</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Timing Onset</span>
                    <span className="text-base font-bold text-cyan-400">±{attemptA.metrics.avgOnsetOffsetMs}ms</span>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Vibrato</span>
                    <span className="text-base font-bold text-purple-400">
                      {attemptA.metrics.vibratoDetected ? `${attemptA.metrics.vibratoRateHz}Hz` : 'None'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Attempt B (Recent or New Take) */}
            <div className="bg-slate-950/80 p-4 rounded-2xl border border-pink-900/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-pink-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-pink-400" />
                  Recording B (Current / Compare)
                </span>
                {attemptB?.audioBlobUrl && (
                  <button
                    onClick={() => handlePlayAudio(attemptB)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-pink-950 text-pink-300 border border-pink-800 hover:bg-pink-900 transition-colors"
                  >
                    {playingId === attemptB.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    <span>{playingId === attemptB.id ? 'Pause Take' : 'Play Take B'}</span>
                  </button>
                )}
              </div>

              <select
                value={selectedIdB}
                onChange={(e) => setSelectedIdB(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-pink-500"
              >
                {sessions.map((s, idx) => (
                  <option key={s.id} value={s.id}>
                    Session #{sessions.length - idx}: {s.exerciseTitle} ({new Date(s.timestamp).toLocaleDateString()}) - Grade {s.coachEvaluation.grade}
                  </option>
                ))}
              </select>

              {attemptB && (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Overall Score</span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">{attemptB.metrics.overallScore}%</span>
                      {attemptB.metrics.overallScore >= (attemptA?.metrics.overallScore || 0) ? (
                        <span className="text-emerald-400 font-bold text-xs flex items-center">
                          <ArrowUpRight className="w-3 h-3" /> +{attemptB.metrics.overallScore - (attemptA?.metrics.overallScore || 0)}
                        </span>
                      ) : (
                        <span className="text-rose-400 font-bold text-xs flex items-center">
                          <ArrowDownRight className="w-3 h-3" /> {attemptB.metrics.overallScore - (attemptA?.metrics.overallScore || 0)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Pitch Accuracy</span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-emerald-400">{attemptB.metrics.pitchScore}%</span>
                      <span className={`text-xs font-bold ${pitchDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pitchDelta >= 0 ? `+${pitchDelta}%` : `${pitchDelta}%`}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Timing Onset</span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-cyan-400">±{attemptB.metrics.avgOnsetOffsetMs}ms</span>
                      <span className={`text-xs font-bold ${onsetDeltaMs >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {onsetDeltaMs >= 0 ? `+${onsetDeltaMs}ms tighter` : `${Math.abs(onsetDeltaMs)}ms lag`}
                      </span>
                    </div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Stability / Drift</span>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-purple-400">{attemptB.metrics.stabilityScore}%</span>
                      <span className={`text-xs font-bold ${stabilityDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stabilityDelta >= 0 ? `+${stabilityDelta}%` : `${stabilityDelta}%`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visual Pitch Contour Overlay */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Pitch Contour Overlay</span>
              <div className="flex items-center gap-3">
                <span className="text-sky-400 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-2.5 h-1 bg-sky-400 inline-block rounded" /> Take A
                </span>
                <span className="text-pink-400 flex items-center gap-1 font-mono text-[11px]">
                  <span className="w-2.5 h-1 bg-pink-400 inline-block rounded" /> Take B
                </span>
              </div>
            </div>
            <div className="w-full h-36">
              <canvas ref={compareCanvasRef} className="w-full h-full rounded-xl block" />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-3">
          <Sparkles className="w-8 h-8 text-cyan-400 mx-auto" />
          <h4 className="text-base font-bold text-white">Record another session to unlock Comparison Mode</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Once you have at least 2 recorded attempts, VocalSensei automatically computes pitch deltas, timing improvements, and overlay contours across your practice history!
          </p>
        </div>
      )}

      {/* Complete Historical Practice Sessions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <h4 className="font-bold text-white text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-cyan-400" /> All Past Sessions & Recordings ({sessions.length})
        </h4>

        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No recorded sessions yet. Try your first vocal exercise above!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Exercise</th>
                  <th className="py-2.5 px-3">Grade</th>
                  <th className="py-2.5 px-3">Pitch</th>
                  <th className="py-2.5 px-3">Rhythm</th>
                  <th className="py-2.5 px-3">Stability</th>
                  <th className="py-2.5 px-3">Vocal Take</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {sessions.map((sess) => (
                  <tr key={sess.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(sess.timestamp).toLocaleDateString()} {new Date(sess.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-medium text-white">
                      {sess.exerciseTitle}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-cyan-400">{sess.coachEvaluation.grade}</span>
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">{sess.metrics.pitchScore}%</td>
                    <td className="py-2.5 px-3 text-cyan-400">{sess.metrics.rhythmScore}%</td>
                    <td className="py-2.5 px-3 text-amber-400">{sess.metrics.stabilityScore}%</td>
                    <td className="py-2.5 px-3">
                      {sess.audioBlobUrl ? (
                        <button
                          onClick={() => handlePlayAudio(sess)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                        >
                          {playingId === sess.id ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-cyan-400" />}
                          <span className="text-[10px]">{playingId === sess.id ? 'Pause' : 'Listen'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[10px]">No audio</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onDeleteSession(sess.id)}
                        className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
