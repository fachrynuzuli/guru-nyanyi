import React, { useState } from 'react';
import { PerformanceMetrics, AICoachEvaluation } from '../types/vocal';
import {
  Sparkles,
  Award,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Send,
  MessageSquare,
  Activity,
  Flame,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface VocalCoachFeedbackProps {
  metrics: PerformanceMetrics;
  evaluation: AICoachEvaluation | null;
  isLoadingAI: boolean;
  onSelectNextExercise: (exerciseId: string) => void;
  currentExerciseTitle: string;
}

export const VocalCoachFeedback: React.FC<VocalCoachFeedbackProps> = ({
  metrics,
  evaluation,
  isLoadingAI,
  onSelectNextExercise,
  currentExerciseTitle,
}) => {
  const [showNotesDetail, setShowNotesDetail] = useState(false);
  const [askQuestion, setAskQuestion] = useState('');
  const [coachAnswer, setCoachAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  // Trigger celebration confetti for high grades
  React.useEffect(() => {
    if (evaluation?.grade === 'S' || evaluation?.grade === 'A' || metrics.overallScore >= 85) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }
    }
  }, [evaluation, metrics]);

  const handleAskCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuestion.trim() || isAsking) return;

    setIsAsking(true);
    try {
      const res = await fetch('/api/coach/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: askQuestion,
          currentExercise: currentExerciseTitle,
          recentMetrics: {
            pitchScore: metrics.pitchScore,
            rhythmScore: metrics.rhythmScore,
            stabilityScore: metrics.stabilityScore,
            vibratoRateHz: metrics.vibratoRateHz,
          },
        }),
      });
      const data = await res.json();
      setCoachAnswer(data.answer);
    } catch (err) {
      setCoachAnswer(
        'Focus on diaphragmatic expansion and vocal tract acoustic placement. Imagine the sound floating effortlessly!'
      );
    } finally {
      setIsAsking(false);
    }
  };

  const getGradeBadge = (grade?: string) => {
    const g = grade || (metrics.overallScore >= 90 ? 'S' : metrics.overallScore >= 80 ? 'A' : metrics.overallScore >= 65 ? 'B' : 'C');
    const colors: Record<string, string> = {
      S: 'from-amber-400 via-yellow-300 to-amber-500 text-slate-950 border-amber-300 shadow-amber-500/40',
      A: 'from-emerald-400 to-teal-500 text-slate-950 border-emerald-300 shadow-emerald-500/40',
      B: 'from-blue-400 to-indigo-500 text-white border-blue-300 shadow-blue-500/40',
      C: 'from-purple-400 to-pink-500 text-white border-purple-300 shadow-purple-500/40',
      'Needs Work': 'from-rose-500 to-red-600 text-white border-rose-400 shadow-rose-500/40',
    };
    return (
      <div
        className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${
          colors[g] || colors.B
        } flex flex-col items-center justify-center font-black text-3xl shadow-xl border-2 transform rotate-1`}
      >
        <span>{g}</span>
        <span className="text-[9px] uppercase font-bold tracking-wider -mt-1 opacity-80">Grade</span>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Top Header: Grade & AI Teacher Headline */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          {getGradeBadge(evaluation?.grade)}
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Maestro Clara
              </span>
              <span className="text-xs text-slate-400">
                Score: <strong className="text-white text-sm">{metrics.overallScore}/100</strong>
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {isLoadingAI ? (
                <span className="animate-pulse text-cyan-400 flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-spin" /> Evaluating vocal mechanics...
                </span>
              ) : (
                evaluation?.coachHeadline || 'Great take! Here is your technical breakdown.'
              )}
            </h3>
          </div>
        </div>

        {/* Skill Progress Mini-Badges */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {metrics.inTunePercentage >= 80 && (
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-medium flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Laser Pitch
            </span>
          )}
          {metrics.vibratoDetected && (
            <span className="px-2.5 py-1 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800 text-xs font-medium flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" /> Natural Vibrato
            </span>
          )}
        </div>
      </div>

      {/* 4 Core Skills Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Pitch Skill */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">1. Pitch Accuracy</span>
            <span className="text-emerald-400 font-bold font-mono">{metrics.pitchScore}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.pitchScore}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
            <div>Avg dev: {metrics.avgPitchDeviationCents}¢ ({metrics.avgPitchDeviationCents <= 20 ? 'Centering Excellent' : 'Needs Lock'})</div>
            <div>In-tune frames: {metrics.inTunePercentage}%</div>
          </div>
        </div>

        {/* 2. Rhythm & Timing */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">2. Rhythm & Timing</span>
            <span className="text-cyan-400 font-bold font-mono">{metrics.rhythmScore}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.rhythmScore}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
            <div>Onset timing: ±{metrics.avgOnsetOffsetMs}ms</div>
            <div>Hold duration: {metrics.durationAccuracy}%</div>
          </div>
        </div>

        {/* 3. Note Control (Stability & Drift) */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">3. Note Stability</span>
            <span className="text-amber-400 font-bold font-mono">{metrics.stabilityScore}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.stabilityScore}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
            <div>Drift: {metrics.pitchDriftCentsPerSec}¢/sec</div>
            <div>Subglottic support: {metrics.stabilityScore > 75 ? 'Firm' : 'Variable'}</div>
          </div>
        </div>

        {/* 4. Vibrato Control */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">4. Vibrato Control</span>
            <span className="text-purple-400 font-bold font-mono">{metrics.vibratoScore}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${metrics.vibratoScore}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
            {metrics.vibratoDetected ? (
              <>
                <div>Rate: {metrics.vibratoRateHz} Hz (ideal 5-6 Hz)</div>
                <div>Depth: ±{metrics.vibratoDepthCents}¢</div>
              </>
            ) : (
              <div>Straight tone / low modulation</div>
            )}
          </div>
        </div>
      </div>

      {/* Teacher Analysis & Actionable Advice */}
      {evaluation && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths & Things to adjust */}
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Technical Observations
            </h4>
            <div className="space-y-2">
              <div>
                <span className="text-xs font-semibold text-emerald-400 block mb-1">Strengths:</span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  {evaluation.strengths.map((str, i) => (
                    <li key={i}>{str}</li>
                  ))}
                </ul>
              </div>
              <div className="pt-2">
                <span className="text-xs font-semibold text-amber-400 block mb-1">Adjustments:</span>
                <ul className="text-xs text-slate-300 space-y-1 list-disc pl-4">
                  {evaluation.areasToImprove.map((area, i) => (
                    <li key={i}>{area}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Master Vocal Technique Tip */}
          <div className="bg-gradient-to-br from-indigo-950/60 to-slate-950 p-5 rounded-2xl border border-indigo-900/60 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Vocal Anatomy & Technique Tip
              </div>
              <p className="text-sm text-slate-200 leading-relaxed italic">
                "{evaluation.techniqueTip}"
              </p>
            </div>

            {/* Next Recommended Task Card */}
            {evaluation.drillRecommendation && (
              <div className="bg-slate-900/90 p-4 rounded-xl border border-cyan-800/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                    Next Recommended Task:
                  </span>
                  <div className="text-sm font-bold text-white">
                    {evaluation.drillRecommendation.drillName}
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-1">
                    {evaluation.drillRecommendation.reason}
                  </div>
                </div>

                <button
                  onClick={() => onSelectNextExercise(evaluation.drillRecommendation.nextExerciseId)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-950 shrink-0"
                >
                  <span>Start Task</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accordion: Note-by-Note Precision Audit */}
      <div className="border-t border-slate-800 pt-3">
        <button
          onClick={() => setShowNotesDetail(!showNotesDetail)}
          className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <Activity className="w-4 h-4 text-cyan-400" />
            Detailed Note-by-Note Breakdown ({metrics.notesEvaluated.length} notes)
          </span>
          {showNotesDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showNotesDetail && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2 px-3">Note</th>
                  <th className="py-2 px-3">Target Freq</th>
                  <th className="py-2 px-3">Onset Timing</th>
                  <th className="py-2 px-3">Duration</th>
                  <th className="py-2 px-3">Pitch Dev</th>
                  <th className="py-2 px-3">Drift</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {metrics.notesEvaluated.map((n, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-bold text-white">{n.pitch}</td>
                    <td className="py-2 px-3 text-slate-400">{Math.round(n.targetFreq)} Hz</td>
                    <td className="py-2 px-3">
                      {n.onsetOffsetMs !== null ? (
                        <span className={Math.abs(n.onsetOffsetMs) < 60 ? 'text-emerald-400' : 'text-amber-400'}>
                          {n.onsetOffsetMs > 0 ? `+${n.onsetOffsetMs}ms (late)` : `${n.onsetOffsetMs}ms (early)`}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      {n.actualDuration.toFixed(1)}s / {n.expectedDuration.toFixed(1)}s
                    </td>
                    <td className="py-2 px-3">
                      {n.centsDeviationAvg !== null ? (
                        <span
                          className={
                            Math.abs(n.centsDeviationAvg) <= 20
                              ? 'text-emerald-400 font-bold'
                              : Math.abs(n.centsDeviationAvg) <= 40
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }
                        >
                          {n.centsDeviationAvg}¢
                        </span>
                      ) : (
                        <span className="text-slate-500">No vocal onset</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{n.pitchDrift}¢/s</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          n.status === 'perfect'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : n.status === 'good'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : n.status === 'sharp'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : n.status === 'flat'
                            ? 'bg-purple-950 text-purple-400 border border-purple-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {n.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Q&A: Ask Coach Maestro Clara Anything */}
      <div className="bg-slate-950/90 rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span>Ask Your Singing Teacher (e.g., "How do I hit this note without throat strain?")</span>
        </div>

        <form onSubmit={handleAskCoach} className="flex gap-2">
          <input
            type="text"
            value={askQuestion}
            onChange={(e) => setAskQuestion(e.target.value)}
            placeholder="Ask Maestro Clara about breathing, mix voice, pitch locks..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={isAsking || !askQuestion.trim()}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-40"
          >
            {isAsking ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Ask</span>
          </button>
        </form>

        {coachAnswer && (
          <div className="bg-slate-900/90 border border-cyan-900/60 p-3.5 rounded-xl text-xs text-slate-200 leading-relaxed animate-fadeIn">
            <span className="font-bold text-cyan-400 block mb-1">Maestro Clara:</span>
            {coachAnswer}
          </div>
        )}
      </div>
    </div>
  );
};
