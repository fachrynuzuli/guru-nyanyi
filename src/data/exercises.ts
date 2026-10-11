import { VocalExercise, VoiceRange } from '../types/vocal';
import { midiToFreq, midiToNoteName } from '../utils/pitchDetector';

// Standard range transpositions relative to Tenor/C4 default
export const VOICE_RANGE_OFFSETS: Record<VoiceRange, number> = {
  soprano: +12, // 1 octave higher (C5)
  alto: +5,     // 5 semitones higher (F4)
  tenor: 0,     // base (C4)
  baritone: -4, // 4 semitones lower (Ab3)
  bass: -12,    // 1 octave lower (C3)
};

export const RAW_EXERCISES: VocalExercise[] = [
  // --- 1. PITCH SKILL EXERCISES ---
  {
    id: 'sustained-c4',
    title: 'Sustained Pitch Lock',
    category: 'pitch',
    level: 'Beginner',
    focusSkill: 'Pitch centering & steady vocal cord engagement',
    description: 'Sustain a single clear note for 3 full seconds. Aim to keep your pitch needle dead center inside ±15 cents.',
    bpm: 70,
    vocalTips: [
      'Engage your lower abdomen before producing sound to avoid flat onset.',
      'Imagine the sound buzzing right behind your front teeth (mask resonance).',
      'Keep your larynx neutral and jaw relaxed.',
    ],
    notes: [
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 3.5, lyric: 'Ahhh' },
    ],
  },
  {
    id: 'major-triad',
    title: 'Major Triad Arpeggio',
    category: 'pitch',
    level: 'Beginner',
    focusSkill: 'Pitch accuracy across major chord intervals (Do - Mi - Sol - Do)',
    description: 'Jump through the harmonic notes of the major triad. Lock each interval cleanly without sliding or scooping.',
    bpm: 90,
    vocalTips: [
      'Think "down" mentally when jumping up in pitch to avoid larynx strain.',
      'Keep the soft palate lifted like the beginning of an inner yawn.',
      'Do not scoop into notes; strike each pitch directly from above.',
    ],
    notes: [
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 1.0, lyric: 'Do' },
      { pitch: 'E4', midi: 64, freq: 329.63, duration: 1.0, lyric: 'Mi' },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 1.0, lyric: 'Sol' },
      { pitch: 'C5', midi: 72, freq: 523.25, duration: 1.8, lyric: 'Do!' },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 1.0, lyric: 'Sol' },
      { pitch: 'E4', midi: 64, freq: 329.63, duration: 1.0, lyric: 'Mi' },
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 2.0, lyric: 'Do' },
    ],
  },
  {
    id: 'five-tone-scale',
    title: '5-Tone Stepwise Scale',
    category: 'pitch',
    level: 'Intermediate',
    focusSkill: 'Semitone and whole-step pitch precision in succession',
    description: 'Sing up and down the first 5 notes of the major scale smoothly with consistent vowel shape.',
    bpm: 100,
    vocalTips: [
      'Sing on "Mee" or "Zzz" first to balance vocal fold closure.',
      'Listen closely to the 3rd and 4th scale degrees (half-step tension).',
      'Keep your breath moving forward like a steady stream of air.',
    ],
    notes: [
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 0.8, lyric: 'Do' },
      { pitch: 'D4', midi: 62, freq: 293.66, duration: 0.8, lyric: 'Re' },
      { pitch: 'E4', midi: 64, freq: 329.63, duration: 0.8, lyric: 'Mi' },
      { pitch: 'F4', midi: 65, freq: 349.23, duration: 0.8, lyric: 'Fa' },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 1.4, lyric: 'Sol' },
      { pitch: 'F4', midi: 65, freq: 349.23, duration: 0.8, lyric: 'Fa' },
      { pitch: 'E4', midi: 64, freq: 329.63, duration: 0.8, lyric: 'Mi' },
      { pitch: 'D4', midi: 62, freq: 293.66, duration: 0.8, lyric: 'Re' },
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 2.0, lyric: 'Do' },
    ],
  },
  {
    id: 'octave-leap',
    title: 'Octave Leap & Pitch Center',
    category: 'pitch',
    level: 'Advanced',
    focusSkill: 'Dynamic register coordination across an 8-note leap',
    description: 'Jump an entire octave without cracking or forcing throat tension. Seamless blend into head/mix voice.',
    bpm: 80,
    vocalTips: [
      'Tilt the thyroid cartilage slightly forward as you reach the upper octave.',
      'Do not push more breath volume on the top note; focus the resonance narrower.',
      'Check if your upper note is landing sharp or flat on the visual pitch needle.',
    ],
    notes: [
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 1.5, lyric: 'Low' },
      { pitch: 'C5', midi: 72, freq: 523.25, duration: 2.2, lyric: 'High!' },
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 2.0, lyric: 'Home' },
    ],
  },

  // --- 2. RHYTHM SKILL EXERCISES ---
  {
    id: 'staccato-legato',
    title: 'Staccato Onset & Legato Finish',
    category: 'rhythm',
    level: 'Beginner',
    focusSkill: 'Crisp rhythmic note onsets followed by sustained duration hold',
    description: 'Sing 4 sharp, punchy staccato notes right on the beat, then hold the final note to its full duration.',
    bpm: 96,
    vocalTips: [
      'Use the diaphragm to pulse the "Ha" sounds without squeezing the throat.',
      'Keep the silence between staccato beats completely silent.',
      'On the final note, engage instant legato connection without hesitation.',
    ],
    notes: [
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 0.5, lyric: 'Ha!', restAfter: 0.3 },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 0.5, lyric: 'Ha!', restAfter: 0.3 },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 0.5, lyric: 'Ha!', restAfter: 0.3 },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 0.5, lyric: 'Ha!', restAfter: 0.3 },
      { pitch: 'C5', midi: 72, freq: 523.25, duration: 2.5, lyric: 'Haaaa' },
    ],
  },
  {
    id: 'syncopated-riff',
    title: 'Syncopated Groove & Timing',
    category: 'rhythm',
    level: 'Intermediate',
    focusSkill: 'Off-beat rhythmic accuracy and duration control',
    description: 'Master tricky syncopated rhythms with precise onset timing. Don’t rush the upbeat rests.',
    bpm: 104,
    vocalTips: [
      'Tap your foot or nod gently on the beat to stay grounded.',
      'Listen to the metronome click in the accompaniment.',
      'The AI coach will penalize onset delays greater than 70ms.',
    ],
    notes: [
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 0.5, lyric: 'Hey', restAfter: 0.25 },
      { pitch: 'E4', midi: 64, freq: 329.63, duration: 0.75, lyric: 'Yeah', restAfter: 0.25 },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 0.5, lyric: 'Now', restAfter: 0.25 },
      { pitch: 'A4', midi: 69, freq: 440.00, duration: 1.0, lyric: 'Sing' },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 1.8, lyric: 'Out' },
    ],
  },

  // --- 3. NOTE CONTROL & VIBRATO EXERCISES ---
  {
    id: 'vibrato-mastery',
    title: 'Straight Tone into Vibrato Blossom',
    category: 'control',
    level: 'Intermediate',
    focusSkill: 'Vibrato rate (5-6 Hz), depth oscillation, and zero pitch drift',
    description: 'Hold the first 1.5 seconds in laser-straight tone, then gently release vocal tension to let natural vibrato blossom.',
    bpm: 72,
    vocalTips: [
      'Vibrato is not forced shaking; it is the natural oscillatory release of laryngeal tension.',
      'Healthy vibrato pulses between 4.5 and 6.5 times per second with ±30-60 cents depth.',
      'Watch the live Vibrato Meter on your screen to verify your oscillation rate in real time!',
    ],
    notes: [
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 4.2, lyric: 'Aahh~' },
    ],
  },
  {
    id: 'crescendo-hold',
    title: 'Messa di Voce (Dynamic Stability)',
    category: 'control',
    level: 'Advanced',
    focusSkill: 'Preventing pitch sag or pitch sharpening during dynamic shifts',
    description: 'Sustain an extended tone while maintaining steady pitch as your breath pressure and volume shift.',
    bpm: 64,
    vocalTips: [
      'Singers naturally go sharp as they get louder and flat as they get softer.',
      'Counteract volume changes by adjusting pharyngeal space.',
      'Keep your pitch drift score under 5 cents/second for an S-Tier rating.',
    ],
    notes: [
      { pitch: 'E4', midi: 64, freq: 329.63, duration: 2.0, lyric: 'Soft' },
      { pitch: 'A4', midi: 69, freq: 440.00, duration: 3.5, lyric: 'Swell~' },
    ],
  },

  // --- 4. SONGS & REPERTOIRE ---
  {
    id: 'amazing-grace',
    title: 'Amazing Grace (Phrasing & Pitch)',
    category: 'song',
    level: 'Beginner',
    focusSkill: 'Expressive legato phrasing, pitch leaps, and breath support',
    description: 'Sing the classic opening phrase: "A-ma-zing Grace, how sweet the sound".',
    bpm: 78,
    vocalTips: [
      'Connect every vowel seamlessly like beads on a string.',
      'Don’t drop support on "sweet"; it sits on the highest note of the phrase.',
      'Let vibrato settle naturally on the word "sound".',
    ],
    notes: [
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 0.9, lyric: 'A-' },
      { pitch: 'F4', midi: 65, freq: 349.23, duration: 1.8, lyric: 'ma-' },
      { pitch: 'A4', midi: 69, freq: 440.00, duration: 0.9, lyric: 'zing' },
      { pitch: 'F4', midi: 65, freq: 349.23, duration: 1.8, lyric: 'Grace' },
      { pitch: 'A4', midi: 69, freq: 440.00, duration: 0.9, lyric: 'how' },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 2.2, lyric: 'sweet' },
      { pitch: 'F4', midi: 65, freq: 349.23, duration: 2.6, lyric: 'sound~' },
    ],
  },
  {
    id: 'over-the-rainbow',
    title: 'Over The Rainbow (Octave & Soul)',
    category: 'song',
    level: 'Intermediate',
    focusSkill: 'The legendary octave jump: "Some-where o-ver the rain-bow"',
    description: 'Test your pitch accuracy on one of the most famous octave intervals in vocal literature.',
    bpm: 80,
    vocalTips: [
      'The leap on "Some-where" is an exact 12-semitone octave.',
      'Anchor your lower body on "Some" so "where" floats effortlessly into head resonance.',
      'Hold the final note "bow" with a gentle, controlled vibrato.',
    ],
    notes: [
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 1.2, lyric: 'Some-' },
      { pitch: 'C5', midi: 72, freq: 523.25, duration: 2.2, lyric: 'where' },
      { pitch: 'B4', midi: 71, freq: 493.88, duration: 1.0, lyric: 'o-' },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 0.8, lyric: 'ver' },
      { pitch: 'A4', midi: 69, freq: 440.00, duration: 0.8, lyric: 'the' },
      { pitch: 'B4', midi: 71, freq: 493.88, duration: 1.2, lyric: 'rain-' },
      { pitch: 'C5', midi: 72, freq: 523.25, duration: 2.4, lyric: 'bow~' },
    ],
  },
  {
    id: 'blues-riff',
    title: 'Soul & Blues Pentatonic Run',
    category: 'song',
    level: 'Advanced',
    focusSkill: 'Agile melismatic pitch flexibility and rhythmic swing',
    description: 'Execute a fast blues vocal riff with micro-tonal bends and confident groove.',
    bpm: 92,
    vocalTips: [
      'Keep your jaw loose and vocal folds flexible.',
      'Articulate each note clearly without slurring into a blurry pitch slide.',
      'Listen for the blue note inflection on the minor third.',
    ],
    notes: [
      { pitch: 'C4', midi: 60, freq: 261.63, duration: 0.6, lyric: 'Oh' },
      { pitch: 'Eb4', midi: 63, freq: 311.13, duration: 0.6, lyric: 'yeah' },
      { pitch: 'F4', midi: 65, freq: 349.23, duration: 0.6, lyric: 'I' },
      { pitch: 'Gb4', midi: 66, freq: 369.99, duration: 0.5, lyric: 'feel' },
      { pitch: 'G4', midi: 67, freq: 392.00, duration: 1.0, lyric: 'it' },
      { pitch: 'Bb4', midi: 70, freq: 466.16, duration: 1.2, lyric: 'now' },
      { pitch: 'C5', midi: 72, freq: 523.25, duration: 2.2, lyric: 'babe~' },
    ],
  },
];

/**
 * Returns an exercise transposed to the user's specific vocal range.
 */
export function getExerciseForVoiceRange(exerciseId: string, voiceRange: VoiceRange): VocalExercise {
  const base = RAW_EXERCISES.find((e) => e.id === exerciseId) || RAW_EXERCISES[0];
  const offset = VOICE_RANGE_OFFSETS[voiceRange] || 0;

  if (offset === 0) {
    return base;
  }

  const transposedNotes = base.notes.map((note) => {
    const newMidi = note.midi + offset;
    const newFreq = midiToFreq(newMidi);
    const { fullName } = midiToNoteName(newMidi);

    return {
      ...note,
      midi: newMidi,
      freq: Math.round(newFreq * 100) / 100,
      pitch: fullName,
    };
  });

  return {
    ...base,
    notes: transposedNotes,
  };
}
