import React, { useState, useEffect, useRef } from 'react';
import { PitchDetector, freqToMidi, midiToNoteName, midiToFreq, getCentsDeviation, computeRms } from '../utils/pitchDetector';
import { synth } from '../utils/audioSynth';
import { VoiceRange } from '../types/vocal';
import { Mic, MicOff, Music, Activity, Flame, Volume2, Sparkles, Check } from 'lucide-react';

interface PitchGymProps {
  currentVoiceRange: VoiceRange;
  onSetVoiceRange: (range: VoiceRange) => void;
}

export const PitchGym: React.FC<PitchGymProps> = ({ currentVoiceRange, onSetVoiceRange }) => {
  const [isListening, setIsListening] = useState(false);
  const [liveFreq, setLiveFreq] = useState<number | null>(null);
  const [liveMidi, setLiveMidi] = useState<number | null>(null);
  const [liveNoteName, setLiveNoteName] = useState<string | null>(null);
  const [liveCents, setLiveCents] = useState<number>(0);
  const [liveVibrato, setLiveVibrato] = useState<{ rate: number; depth: number } | null>(null);

  // Range Finder state
  const [isRangeTesting, setIsRangeTesting] = useState(false);
  const [rangeStep, setRangeStep] = useState<'idle' | 'lowest' | 'highest' | 'done'>('idle');
  const [detectedLowMidi, setDetectedLowMidi] = useState<number | null>(null);
  const [detectedHighMidi, setDetectedHighMidi] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<PitchDetector | null>(null);

  // Sliding buffer for vibrato detection in free gym
  const pitchHistoryRef = useRef<{ time: number; cents: number }[]>([]);

  const startListening = async () => {
    stopListening();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const detector = new PitchDetector(2048, audioCtx.sampleRate, 0.15);
      detectorRef.current = detector;

      setIsListening(true);
      runPitchLoop();
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const stopListening = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
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
    setIsListening(false);
    setLiveFreq(null);
    setLiveMidi(null);
    setLiveNoteName(null);
    setLiveCents(0);
    setLiveVibrato(null);
  };

  const runPitchLoop = () => {
    const analyser = analyserRef.current;
    const detector = detectorRef.current;
    if (!analyser || !detector) return;

    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);

    const result = detector.detect(buffer, 0.015);
    const now = performance.now() / 1000;

    if (result && result.freq > 65 && result.freq < 1200) {
      const midi = freqToMidi(result.freq);
      const roundedMidi = Math.round(midi);
      const targetFreq = midiToFreq(roundedMidi);
      const cents = getCentsDeviation(result.freq, targetFreq);
      const { fullName } = midiToNoteName(midi);

      setLiveFreq(result.freq);
      setLiveMidi(midi);
      setLiveNoteName(fullName);
      setLiveCents(cents);

      // Track range test
      if (isRangeTesting) {
        if (rangeStep === 'lowest') {
          setDetectedLowMidi((prev) => (prev === null ? roundedMidi : Math.min(prev, roundedMidi)));
        } else if (rangeStep === 'highest') {
          setDetectedHighMidi((prev) => (prev === null ? roundedMidi : Math.max(prev, roundedMidi)));
        }
      }

      // Track pitch history for live vibrato
      pitchHistoryRef.current.push({ time: now, cents });
      if (pitchHistoryRef.current.length > 50) {
        pitchHistoryRef.current.shift();
      }

      // Check vibrato if sustained for > 0.4s
      const history = pitchHistoryRef.current;
      if (history.length >= 20) {
        let peaks = 0;
        let totalAmp = 0;
        for (let i = 1; i < history.length - 1; i++) {
          if (history[i].cents > history[i - 1].cents && history[i].cents > history[i + 1].cents) {
            peaks++;
            totalAmp += Math.abs(history[i].cents);
          }
        }
        const span = history[history.length - 1].time - history[0].time;
        if (span > 0.4 && peaks >= 2) {
          const rate = Math.round((peaks / span) * 10) / 10;
          const depth = Math.round(totalAmp / peaks);
          if (rate >= 4.0 && rate <= 7.5 && depth >= 15) {
            setLiveVibrato({ rate, depth });
          } else {
            setLiveVibrato(null);
          }
        }
      }
    } else {
      setLiveFreq(null);
      setLiveMidi(null);
      setLiveNoteName(null);
      setLiveVibrato(null);
    }

    animFrameRef.current = requestAnimationFrame(runPitchLoop);
  };

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  const clampedCents = Math.max(-50, Math.min(50, liveCents));

  // Virtual piano notes to click
  const virtualKeys = [
    { name: 'C3', midi: 48 },
    { name: 'E3', midi: 52 },
    { name: 'G3', midi: 55 },
    { name: 'C4', midi: 60 },
    { name: 'E4', midi: 64 },
    { name: 'G4', midi: 67 },
    { name: 'C5', midi: 72 },
    { name: 'E5', midi: 76 },
    { name: 'G5', midi: 79 },
    { name: 'C6', midi: 84 },
  ];

  // Classify vocal range from detected low/high
  const classifyVoice = (low: number, high: number): VoiceRange => {
    const mid = (low + high) / 2;
    if (mid >= 67) return 'soprano'; // High female
    if (mid >= 62) return 'alto';    // Low female / High male
    if (mid >= 58) return 'tenor';   // High male
    if (mid >= 52) return 'baritone';// Mid male
    return 'bass';                  // Low male
  };

  const handleFinishRangeTest = () => {
    if (detectedLowMidi && detectedHighMidi) {
      const classified = classifyVoice(detectedLowMidi, detectedHighMidi);
      onSetVoiceRange(classified);
      setRangeStep('done');
      setIsRangeTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mic Tuner & Pitch Needle Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-white text-lg">Free-Sing Pitch Tuner & Voice Gym</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Sing freely without exercise constraints to test pitch locks, resonance, and vibrato speed.
            </p>
          </div>

          <button
            onClick={isListening ? stopListening : startListening}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-lg ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isListening ? 'Stop Listening' : 'Start Mic Tuner'}</span>
          </button>
        </div>

        {/* Live Tuner Gauge Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Note & Frequency Box */}
          <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 text-center space-y-2">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Detected Pitch</span>
            <div className="font-black text-5xl font-mono text-white tracking-widest min-h-[50px] flex items-center justify-center">
              {liveNoteName || <span className="text-slate-600 text-3xl font-normal">—</span>}
            </div>
            <div className="text-xs font-mono text-slate-400">
              {liveFreq ? `${Math.round(liveFreq * 10) / 10} Hz` : 'Sing into microphone'}
            </div>
          </div>

          {/* Cent Meter Needle */}
          <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-rose-400">-50¢ Flat</span>
              <span className="text-emerald-400 font-bold">Center (0¢)</span>
              <span className="text-rose-400">+50¢ Sharp</span>
            </div>

            {/* Gauge bar */}
            <div className="relative w-full h-6 bg-slate-900 rounded-full overflow-hidden border border-slate-700 flex items-center justify-center">
              {/* Sweet spot green zone */}
              <div className="absolute top-0 bottom-0 w-12 bg-emerald-500/25 border-x border-emerald-500/50" />
              <div className="absolute top-0 bottom-0 w-1 bg-emerald-400 z-10" />

              {/* Needle */}
              {liveMidi !== null && (
                <div
                  className={`absolute top-0 bottom-0 w-3 rounded-full transition-all duration-75 shadow-lg ${
                    Math.abs(liveCents) <= 15
                      ? 'bg-emerald-400 shadow-emerald-500/50'
                      : Math.abs(liveCents) <= 35
                      ? 'bg-amber-400 shadow-amber-500/50'
                      : 'bg-rose-500 shadow-rose-500/50'
                  }`}
                  style={{
                    left: `calc(50% + ${(clampedCents / 50) * 45}% - 6px)`,
                  }}
                />
              )}
            </div>

            <div className="text-center font-mono text-xs">
              {liveMidi !== null ? (
                <span
                  className={
                    Math.abs(liveCents) <= 15
                      ? 'text-emerald-400 font-bold'
                      : Math.abs(liveCents) <= 35
                      ? 'text-amber-400 font-bold'
                      : 'text-rose-400 font-bold'
                  }
                >
                  {liveCents > 0 ? `+${liveCents}¢ Sharp` : `${liveCents}¢ Flat`}
                </span>
              ) : (
                <span className="text-slate-500">Ready</span>
              )}
            </div>
          </div>

          {/* Vibrato & Note Control Gauge */}
          <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 text-center space-y-3">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Vibrato Engine</span>
            {liveVibrato ? (
              <div className="space-y-1 animate-fadeIn">
                <div className="flex items-center justify-center gap-1.5 text-cyan-400 font-bold text-xl font-mono">
                  <Flame className="w-5 h-5 text-cyan-400 animate-bounce" />
                  <span>{liveVibrato.rate} Hz</span>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  Depth: ±{liveVibrato.depth} cents
                </div>
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Healthy Vocal Oscillation
                </span>
              </div>
            ) : (
              <div className="text-slate-500 text-xs py-2">
                Hold a sustained vowel (3+ sec) to measure vibrato rate and oscillation depth.
              </div>
            )}
          </div>
        </div>

        {/* Reference Tone Piano Keys */}
        <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Music className="w-4 h-4 text-cyan-400" />
            <span>Interactive Pitch References (Click key to hear acoustic pitch guide)</span>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {virtualKeys.map((k) => (
              <button
                key={k.name}
                onClick={() => synth.playPianoNote(midiToFreq(k.midi), 1.2)}
                className="py-3 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold border border-slate-700/80 hover:border-cyan-500 active:scale-95 transition-all text-center flex flex-col items-center justify-center gap-0.5"
              >
                <span>{k.name}</span>
                <span className="text-[10px] text-slate-500 font-normal">{Math.round(midiToFreq(k.midi))}Hz</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vocal Range Finder (Diagnostic Tool) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h4 className="font-bold text-white text-base">Vocal Range Finder & Classification</h4>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase">
            Current: {currentVoiceRange}
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Find your comfortable vocal tessitura by singing your lowest sustained note, followed by your highest clear note. VocalSensei will automatically transpose all exercises to your natural voice range!
        </p>

        {rangeStep === 'idle' ? (
          <button
            onClick={() => {
              setIsRangeTesting(true);
              setRangeStep('lowest');
              setDetectedLowMidi(null);
              setDetectedHighMidi(null);
              if (!isListening) startListening();
            }}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-950"
          >
            Start Vocal Range Test
          </button>
        ) : rangeStep === 'lowest' ? (
          <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-900/60 space-y-3">
            <div className="text-xs font-bold text-indigo-300">
              Step 1: Sing your LOWEST comfortable note into your mic now...
            </div>
            <div className="text-lg font-mono text-white">
              Lowest detected:{' '}
              <strong className="text-cyan-400">
                {detectedLowMidi ? midiToNoteName(detectedLowMidi).fullName : 'Listening...'}
              </strong>
            </div>
            <button
              onClick={() => setRangeStep('highest')}
              disabled={!detectedLowMidi}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs disabled:opacity-40"
            >
              Next: Test Highest Note
            </button>
          </div>
        ) : rangeStep === 'highest' ? (
          <div className="bg-slate-950 p-4 rounded-2xl border border-indigo-900/60 space-y-3">
            <div className="text-xs font-bold text-indigo-300">
              Step 2: Sing your HIGHEST clear note (head or chest voice) into your mic now...
            </div>
            <div className="text-lg font-mono text-white">
              Highest detected:{' '}
              <strong className="text-pink-400">
                {detectedHighMidi ? midiToNoteName(detectedHighMidi).fullName : 'Listening...'}
              </strong>
            </div>
            <button
              onClick={handleFinishRangeTest}
              disabled={!detectedHighMidi}
              className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-bold text-xs disabled:opacity-40"
            >
              Complete Test & Apply Range
            </button>
          </div>
        ) : (
          <div className="bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800 text-xs text-emerald-300 flex items-center justify-between">
            <span>
              Voice classified! Your range is set to <strong className="uppercase">{currentVoiceRange}</strong> (
              {detectedLowMidi && midiToNoteName(detectedLowMidi).fullName} to{' '}
              {detectedHighMidi && midiToNoteName(detectedHighMidi).fullName}). All exercises are now transposed!
            </span>
            <button
              onClick={() => setRangeStep('idle')}
              className="px-3 py-1 bg-emerald-800 text-white rounded-lg text-xs font-bold ml-2 shrink-0"
            >
              Test Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
