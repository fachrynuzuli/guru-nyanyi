export type VoiceRange = 'soprano' | 'alto' | 'tenor' | 'baritone' | 'bass';

export interface ExerciseNote {
  pitch: string;      // e.g. "C4", "E4", "G4"
  midi: number;       // e.g. 60, 64, 67
  freq: number;       // e.g. 261.63
  duration: number;   // seconds
  lyric?: string;     // e.g. "Do", "Mi", "Sol" or "Ah"
  restAfter?: number; // seconds of rest after this note
}

export type ExerciseCategory = 'pitch' | 'rhythm' | 'control' | 'song';

export interface VocalExercise {
  id: string;
  title: string;
  category: ExerciseCategory;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  focusSkill: string;
  bpm: number;
  notes: ExerciseNote[];
  defaultKeyTransposition?: number; // semitones relative to C
  vocalTips: string[];
}

export interface PitchFrame {
  time: number;          // seconds from start of recording
  freq: number | null;   // detected frequency in Hz, null if silence
  midi: number | null;   // detected fractional or integer MIDI
  centsOffset: number | null; // cents off from closest or target note
  targetMidi: number | null;  // target MIDI note at this time
  targetNoteName: string | null;
  volumeRms: number;     // audio volume level 0 - 1
  isVoiced: boolean;
}

export interface NoteEvaluationDetail {
  noteIndex: number;
  pitch: string;
  targetMidi: number;
  targetFreq: number;
  expectedStartTime: number;
  expectedDuration: number;
  actualStartTime: number | null;
  actualDuration: number;
  onsetOffsetMs: number | null; // positive = late, negative = early
  centsDeviationAvg: number | null;
  accuracyScore: number; // 0 - 100
  pitchDrift: number;    // cents per sec
  vibratoRateHz?: number;
  vibratoDepthCents?: number;
  status: 'perfect' | 'good' | 'flat' | 'sharp' | 'missed';
}

export interface PerformanceMetrics {
  pitchScore: number;              // 0 - 100
  rhythmScore: number;             // 0 - 100
  stabilityScore: number;          // 0 - 100 (pitch steadiness & drift control)
  vibratoScore: number;            // 0 - 100
  overallScore: number;            // 0 - 100
  avgPitchDeviationCents: number;  // average cents off
  inTunePercentage: number;        // percentage within ±25 cents
  avgOnsetOffsetMs: number;        // timing onset offset
  durationAccuracy: number;        // % of target note lengths maintained
  pitchDriftCentsPerSec: number;   // pitch sag or creep
  vibratoDetected: boolean;
  vibratoRateHz: number;           // cycles per sec (ideal 4.5-6.5 Hz)
  vibratoDepthCents: number;        // pitch excursion amplitude
  vibratoConsistency: number;      // 0 - 100
  totalSungSeconds: number;
  notesEvaluated: NoteEvaluationDetail[];
}

export interface AICoachEvaluation {
  grade: 'S' | 'A' | 'B' | 'C' | 'Needs Work';
  coachHeadline: string;
  strengths: string[];
  areasToImprove: string[];
  techniqueTip: string;
  drillRecommendation: {
    drillName: string;
    nextExerciseId: string;
    reason: string;
    warmupExercise: string;
  };
}

export interface RecordedSessionAttempt {
  id: string;
  timestamp: number;
  exerciseId: string;
  exerciseTitle: string;
  category: ExerciseCategory;
  voiceRange: VoiceRange;
  audioBlobUrl?: string;
  metrics: PerformanceMetrics;
  coachEvaluation: AICoachEvaluation;
  frames: PitchFrame[];
}

export type SkillTier = 'tier-1-novice' | 'tier-2-developing' | 'tier-3-resonant' | 'tier-4-virtuoso';

export interface JourneyNode {
  id: string;
  title: string;
  unitIndex: number; // 1 to 4
  type: 'lesson' | 'drill' | 'chest' | 'boss';
  exerciseId: string;
  description: string;
  focusSkill: string;
  targetScore: number;
  xpReward: number;
  icon: 'target' | 'music' | 'zap' | 'gift' | 'crown' | 'mic';
}

export interface UserJourneyState {
  tier: SkillTier;
  tierName: string;
  tierDescription: string;
  level: number;
  xp: number;
  streak: number;
  lastActiveDate: string;
  currentNodeId: string;
  completedNodeIds: string[];
  nodeStars: Record<string, number>; // nodeId -> 1, 2, or 3
  assessmentCompleted: boolean;
  openedChestIds: string[];
}

export interface PlacementAssessmentResult {
  tier: SkillTier;
  tierName: string;
  coachWelcomeMessage: string;
  initialFocus: string;
  unlockedUpToUnit: number;
  startingXp: number;
}

