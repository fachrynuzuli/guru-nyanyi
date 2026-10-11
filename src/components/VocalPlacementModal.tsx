import React, { useState, useRef, useEffect } from 'react';
import { VoiceRange, SkillTier, PlacementAssessmentResult } from '../types/vocal';
import { PitchDetector, freqToMidi, midiToFreq, getCentsDeviation } from '../utils/pitchDetector';
import { synth } from '../utils/audioSynth';
import {
  Sparkles,
  Award,
  Mic,
  Activity,
  CheckCircle2,
  ArrowRight,
  Flame,
  Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface VocalPlacementModalProps {
  currentVoiceRange: VoiceRange;
  onSetVoiceRange: (range: VoiceRange) => void;
  onCompletePlacement: (result: PlacementAssessmentResult) => void;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const VocalPlacementModal: React.FC<VocalPlacementModalProps> = ({
  currentVoiceRange,
  onSetVoiceRange,
  onCompletePlacement,
  onClose,
  canDismiss = false,
}) => {
  const [step, setStep] = useState<'survey' | 'mic-audition' | 'analyzing' | 'reveal'>('survey');

  // Survey answers
  const [experience, setExperience] = useState<string>('Casual: Karaoke / Choir / Car singer');
  const [primaryGoal, setPrimaryGoal] = useState<string>('Sing on pitch without going flat or sharp');
  const [selectedRange, setSelectedRange] = useState<VoiceRange>(currentVoiceRange);

  // Mic Audition state
  const [isAuditioning, setIsAuditioning] = useState<boolean>(false);
  const [auditionCountdown, setAuditionCountdown] = useState<number | null>(null);
  const [auditionProgress, setAuditionProgress] = useState<number>(0);
  const [diagnosticMetrics, setDiagnosticMetrics] = useState<{
    pitchScore: number;
    rhythmScore: number;
    stabilityScore: number;
  } | null>(null);

  // Result
  const [placementResult, setPlacementResult] = useState<PlacementAssessmentResult | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const cleanupAudio = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
      audioCtxRef.current = null;
    }
    setIsAuditioning(false);
  };

  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  // Run the quick 3-second diagnostic mic test
  const handleStartAudition = async () => {
    cleanupAudio();

    // Play target pitch reference (e.g. C4 or A3 depending on range)
    const targetFreq = selectedRange === 'soprano' ? 523.25 : selectedRange === 'bass' ? 130.81 : 261.63; // C5, C3, or C4
    synth.playPianoNote(targetFreq, 1.8);

    let count = 2;
    setAuditionCountdown(count);

    const timer = setInterval(async () => {
      count--;
      if (count > 0) {
        setAuditionCountdown(count);
      } else {
        clearInterval(timer);
        setAuditionCountdown(null);
        await runAuditionRecording(targetFreq);
      }
    }, 800);
  };

  const runAuditionRecording = async (targetFreq: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false },
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const detector = new PitchDetector(2048, audioCtx.sampleRate, 0.15);
      setIsAuditioning(true);

      const buffer = new Float32Array(analyser.fftSize);
      let totalCentsDev = 0;
      let samplesCount = 0;
      let voicedCount = 0;
      const durationSeconds = 3.0;
      const startTime = performance.now();

      const loop = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        setAuditionProgress(Math.min(100, Math.round((elapsed / durationSeconds) * 100)));

        analyser.getFloatTimeDomainData(buffer);
        const res = detector.detect(buffer, 0.015);

        samplesCount++;
        if (res && res.freq > 65 && res.freq < 1200) {
          voicedCount++;
          const cents = Math.abs(getCentsDeviation(res.freq, targetFreq));
          totalCentsDev += Math.min(120, cents);
        }

        if (elapsed < durationSeconds) {
          animFrameRef.current = requestAnimationFrame(loop);
        } else {
          // Finished audition test
          cleanupAudio();

          const avgCents = voicedCount > 0 ? totalCentsDev / voicedCount : 60;
          const pitchScore = Math.max(30, Math.min(95, Math.round(100 - avgCents * 1.1)));
          const rhythmScore = voicedCount > (samplesCount * 0.4) ? 85 : 55;
          const stabilityScore = Math.max(40, Math.min(90, Math.round(100 - (avgCents * 0.8))));

          const metrics = { pitchScore, rhythmScore, stabilityScore };
          setDiagnosticMetrics(metrics);
          submitPlacement(metrics);
        }
      };

      animFrameRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.error('Mic access failed during audition:', err);
      // Fallback: continue without mic metrics
      submitPlacement(null);
    }
  };

  const submitPlacement = async (metrics: any) => {
    setStep('analyzing');
    onSetVoiceRange(selectedRange);

    try {
      const res = await fetch('/api/coach/placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience,
          primaryGoal,
          voiceRange: selectedRange,
          diagnosticMetrics: metrics,
        }),
      });

      const data = await res.json();
      setPlacementResult(data.placement);
      setStep('reveal');

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.5 },
        });
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Placement error:', err);
      const fallback: PlacementAssessmentResult = {
        tier: 'tier-2-developing',
        tierName: 'Developing Choralist',
        coachWelcomeMessage: 'Welcome to your vocal journey! I have placed you in the Developing Choralist bracket. We will build rock-solid pitch habits and effortless resonance.',
        initialFocus: 'Centering pitch accuracy on interval jumps and steady breath release.',
        unlockedUpToUnit: 2,
        startingXp: 250,
      };
      setPlacementResult(fallback);
      setStep('reveal');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative my-8 space-y-6 animate-fadeIn">
        {canDismiss && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg p-2"
          >
            ✕
          </button>
        )}

        {/* STEP 1: Survey & Background */}
        {step === 'survey' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
                <Sparkles className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Vocal Census & Skill Placement</h3>
                <p className="text-xs text-slate-400">
                  Maestro Clara will evaluate your background to place you into your optimal skill tier roadmap.
                </p>
              </div>
            </div>

            {/* Experience level */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                1. How would you describe your singing experience?
              </label>
              <div className="space-y-1.5">
                {[
                  'Beginner: Shower singer / never had lessons',
                  'Casual: Karaoke / Choir / Car singer',
                  'Intermediate: Band / gigging / sung for years',
                  'Advanced: Experienced vocalist polishing agility',
                ].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setExperience(opt)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                      experience === opt
                        ? 'bg-cyan-950/80 border-cyan-500 text-white font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                2. What is your #1 singing goal right now?
              </label>
              <div className="space-y-1.5">
                {[
                  'Sing on pitch without going flat or sharp',
                  'Hit high notes with power and no throat strain',
                  'Develop natural vibrato and sustained note control',
                  'Perform full songs with soul and confidence',
                ].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setPrimaryGoal(g)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                      primaryGoal === g
                        ? 'bg-cyan-950/80 border-cyan-500 text-white font-bold'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice range */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                3. Select your approximate voice type:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(['soprano', 'alto', 'tenor', 'baritone', 'bass'] as VoiceRange[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRange(r)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                      selectedRange === r
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => setStep('mic-audition')}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30"
              >
                <Mic className="w-4 h-4" />
                <span>Next: 3-Second Mic Audition</span>
              </button>
              <button
                onClick={() => submitPlacement(null)}
                className="py-3 px-4 rounded-xl font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Skip Mic Test
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Mic Audition Diagnostic */}
        {step === 'mic-audition' && (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-cyan-950/80 border border-cyan-800 mx-auto flex items-center justify-center text-cyan-400">
              <Mic className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Diagnostic Vocal Audition</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                We will play a reference note. When the countdown ends, hold an "Ahhh" sound for 3 seconds into your microphone!
              </p>
            </div>

            {auditionCountdown !== null ? (
              <div className="py-6">
                <div className="text-5xl font-black text-amber-400 animate-bounce">
                  {auditionCountdown}
                </div>
                <span className="text-xs text-slate-400 font-medium mt-1 block">Listen to tone...</span>
              </div>
            ) : isAuditioning ? (
              <div className="space-y-3 py-4">
                <div className="text-sm font-bold text-emerald-400 animate-pulse flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4 animate-spin" /> Sing "Ahhh" now!
                </div>
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden max-w-xs mx-auto border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-100"
                    style={{ width: `${auditionProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartAudition}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-rose-950/40 inline-flex items-center gap-2 transform hover:scale-105 active:scale-95 transition-all"
              >
                <Volume2 className="w-4 h-4" />
                <span>Play Reference & Start Mic Test</span>
              </button>
            )}

            <div className="pt-2">
              <button
                onClick={() => submitPlacement(null)}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Or place me without microphone test
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Analyzing */}
        {step === 'analyzing' && (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin mx-auto" />
            <h4 className="text-base font-bold text-white">Maestro Clara is reviewing your audition...</h4>
            <p className="text-xs text-slate-400">
              Measuring pitch deviations, breath stability, and configuring your custom skill path.
            </p>
          </div>
        )}

        {/* STEP 4: Reveal Placement */}
        {step === 'reveal' && placementResult && (
          <div className="space-y-5 text-center">
            <div className="inline-block p-4 rounded-3xl bg-gradient-to-tr from-amber-500/20 to-cyan-500/20 border border-amber-400/30">
              <Award className="w-12 h-12 text-amber-400 mx-auto" />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] uppercase font-bold tracking-widest text-cyan-400">
                Placement Bracket Unlocked
              </span>
              <h3 className="text-2xl font-black text-white">{placementResult.tierName}</h3>
              <div className="flex items-center justify-center gap-3 pt-1 text-xs">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Flame className="w-4 h-4" /> +{placementResult.startingXp} Starting XP
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400 font-bold">
                  Unlocked up to Unit {placementResult.unlockedUpToUnit}
                </span>
              </div>
            </div>

            {/* Coach letter */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs text-slate-200 leading-relaxed italic space-y-2">
              <div className="font-bold text-cyan-400 not-italic flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5" /> Letter from Maestro Clara:
              </div>
              <p>"{placementResult.coachWelcomeMessage}"</p>
              <div className="pt-1 text-[11px] text-slate-400 not-italic">
                <strong className="text-white">Primary Focus:</strong> {placementResult.initialFocus}
              </div>
            </div>

            <button
              onClick={() => onCompletePlacement(placementResult)}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-950/40 transform hover:scale-102 transition-all"
            >
              <span>Begin My Vocal Journey</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
