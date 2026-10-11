import React from 'react';
import { Play, Square, Mic, Volume2, VolumeX, RotateCcw, FastForward } from 'lucide-react';

interface AudioControlsProps {
  isRecording: boolean;
  isPlayingGuide: boolean;
  countdown: number | null;
  recordedAudioUrl: string | null;
  onPlayGuide: () => void;
  onStartSinging: () => void;
  onStop: () => void;
  onReset: () => void;
  tempoMultiplier: number;
  onTempoChange: (tempo: number) => void;
  masterVolume: number;
  onVolumeChange: (vol: number) => void;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isRecording,
  isPlayingGuide,
  countdown,
  recordedAudioUrl,
  onPlayGuide,
  onStartSinging,
  onStop,
  onReset,
  tempoMultiplier,
  onTempoChange,
  masterVolume,
  onVolumeChange,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
      {/* Primary Action Buttons */}
      <div className="flex items-center gap-3 w-full md:w-auto justify-center">
        {/* Play Guide Reference Note/Chords */}
        <button
          onClick={isPlayingGuide ? onStop : onPlayGuide}
          disabled={isRecording || countdown !== null}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all shadow-md ${
            isPlayingGuide
              ? 'bg-amber-600 hover:bg-amber-500 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isPlayingGuide ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4 text-cyan-400" />}
          <span>{isPlayingGuide ? 'Stop Guide' : 'Listen Guide'}</span>
        </button>

        {/* Start Singing Attempt (Records & Measures Pitch) */}
        {!isRecording && countdown === null ? (
          <button
            onClick={onStartSinging}
            disabled={isPlayingGuide}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white shadow-lg shadow-rose-900/30 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            <Mic className="w-4 h-4 animate-pulse" />
            <span>Sing Attempt</span>
          </button>
        ) : countdown !== null ? (
          <div className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-base bg-amber-500 text-slate-950 animate-bounce">
            <span>Get Ready: {countdown}...</span>
          </div>
        ) : (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg animate-pulse"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>Stop Recording</span>
          </button>
        )}

        {/* Reset / Clear */}
        <button
          onClick={onReset}
          disabled={isRecording || isPlayingGuide || countdown !== null}
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all border border-slate-700 disabled:opacity-40"
          title="Reset attempt"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Playback of Recorded Take */}
      {recordedAudioUrl && !isRecording && (
        <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-1.5 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Your Take:</span>
          <audio controls src={recordedAudioUrl} className="h-8 max-w-[200px] sm:max-w-[260px]" />
        </div>
      )}

      {/* Secondary Controls (Tempo & Volume) */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-end text-xs">
        {/* Tempo Multiplier */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
          <FastForward className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Speed:</span>
          {[0.8, 1.0, 1.2].map((spd) => (
            <button
              key={spd}
              onClick={() => onTempoChange(spd)}
              className={`px-2 py-0.5 rounded font-mono text-xs transition-colors ${
                tempoMultiplier === spd
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Master Volume */}
        <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
          {masterVolume === 0 ? (
            <VolumeX className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
          )}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={masterVolume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-16 accent-cyan-500 h-1 bg-slate-700 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
