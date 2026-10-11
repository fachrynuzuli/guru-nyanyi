/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  VocalExercise,
  VoiceRange,
  PitchFrame,
  PerformanceMetrics,
  AICoachEvaluation,
  RecordedSessionAttempt,
  UserJourneyState,
  JourneyNode,
  PlacementAssessmentResult,
} from './types/vocal';
import { RAW_EXERCISES, getExerciseForVoiceRange, VOICE_RANGE_OFFSETS } from './data/exercises';
import { ALL_JOURNEY_NODES } from './data/journeyNodes';
import { PitchDetector, freqToMidi, midiToFreq, midiToNoteName, getCentsDeviation } from './utils/pitchDetector';
import { analyzeVocalPerformance } from './utils/vocalAnalysis';
import { synth } from './utils/audioSynth';
import { PianoRollVisualizer } from './components/PianoRollVisualizer';
import { AudioControls } from './components/AudioControls';
import { VocalCoachFeedback } from './components/VocalCoachFeedback';
import { ProgressCompare } from './components/ProgressCompare';
import { PitchGym } from './components/PitchGym';
import { VocalJourneyMap } from './components/VocalJourneyMap';
import { VocalPlacementModal } from './components/VocalPlacementModal';
import {
  Music,
  Mic,
  Activity,
  History,
  Sparkles,
  Award,
  Layers,
  MapPin,
  Flame,
  Zap,
  Star,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Compass,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const SESSIONS_STORAGE_KEY = 'vocalsensei_sessions_v1';
const JOURNEY_STORAGE_KEY = 'vocalsensei_journey_v1';

const DEFAULT_JOURNEY_STATE: UserJourneyState = {
  tier: 'tier-1-novice',
  tierName: 'Novice Pitchfinder',
  tierDescription: 'Building foundational pitch accuracy and tone centering',
  level: 1,
  xp: 0,
  streak: 1,
  lastActiveDate: new Date().toISOString().split('T')[0],
  currentNodeId: 'node-1-1',
  completedNodeIds: [],
  nodeStars: {},
  assessmentCompleted: false,
  openedChestIds: [],
};

type AppTab = 'journey' | 'training' | 'gym' | 'progress';

export default function App() {
  // Voice Range & Active Tab
  const [voiceRange, setVoiceRange] = useState<VoiceRange>('tenor');
  const [activeTab, setActiveTab] = useState<AppTab>('journey');

  // Duolingo Journey State
  const [journeyState, setJourneyState] = useState<UserJourneyState>(DEFAULT_JOURNEY_STATE);
  const [showPlacementModal, setShowPlacementModal] = useState<boolean>(false);
  const [activeJourneyNode, setActiveJourneyNode] = useState<JourneyNode | null>(null);
  const [journeyNodeSuccess, setJourneyNodeSuccess] = useState<{
    stars: number;
    xpEarned: number;
    unlockedNextNodeId?: string;
  } | null>(null);

  // Exercise selection
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('sustained-c4');
  const [tempoMultiplier, setTempoMultiplier] = useState<number>(1.0);
  const [masterVolume, setMasterVolume] = useState<number>(0.8);

  // Active transposed exercise
  const currentExercise = React.useMemo(() => {
    return getExerciseForVoiceRange(selectedExerciseId, voiceRange);
  }, [selectedExerciseId, voiceRange]);

  // Playback / Recording States
  const [isPlayingGuide, setIsPlayingGuide] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);

  // Real-time Pitch & Frame Recording
  const [pitchFrames, setPitchFrames] = useState<PitchFrame[]>([]);
  const [currentPitch, setCurrentPitch] = useState<{
    freq: number | null;
    midi: number | null;
    centsOffset: number | null;
    noteName: string | null;
    vibratoRateHz?: number;
    vibratoDepthCents?: number;
    driftCents?: number;
  } | null>(null);

  // Performance evaluation & AI Coach response
  const [latestMetrics, setLatestMetrics] = useState<PerformanceMetrics | null>(null);
  const [latestEvaluation, setLatestEvaluation] = useState<AICoachEvaluation | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);

  // Session History (stored in localStorage)
  const [sessions, setSessions] = useState<RecordedSessionAttempt[]>([]);

  // Custom drill modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customGoal, setCustomGoal] = useState('');
  const [isGeneratingCustom, setIsGeneratingCustom] = useState(false);

  // Audio Context & Mic references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<PitchDetector | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Total exercise duration calculated
  const totalDuration = React.useMemo(() => {
    return currentExercise.notes.reduce(
      (sum, n) => sum + n.duration * tempoMultiplier + (n.restAfter || 0) * tempoMultiplier,
      0
    );
  }, [currentExercise, tempoMultiplier]);

  // Load Sessions and Journey state from localStorage
  useEffect(() => {
    try {
      const savedJourney = localStorage.getItem(JOURNEY_STORAGE_KEY);
      if (savedJourney) {
        const parsed = JSON.parse(savedJourney);
        // Check daily streak
        const today = new Date().toISOString().split('T')[0];
        const lastDate = parsed.lastActiveDate;
        let streak = parsed.streak || 1;

        if (lastDate && lastDate !== today) {
          const diffMs = new Date(today).getTime() - new Date(lastDate).getTime();
          const diffDays = Math.round(diffMs / (1000 * 3600 * 24));
          if (diffDays === 1) {
            streak += 1;
          } else if (diffDays > 1) {
            streak = 1; // streak reset
          }
        }
        parsed.streak = streak;
        parsed.lastActiveDate = today;
        setJourneyState(parsed);

        // If assessment not yet completed, prompt placement
        if (!parsed.assessmentCompleted) {
          setShowPlacementModal(true);
        }
      } else {
        // First time user: show placement modal!
        setShowPlacementModal(true);
      }

      // Load sessions
      const savedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (savedSessions) {
        setSessions(JSON.parse(savedSessions));
      } else {
        // Seed initial reference sessions
        const sampleSessions: RecordedSessionAttempt[] = [
          {
            id: 'sample-session-1',
            timestamp: Date.now() - 86400000 * 2,
            exerciseId: 'sustained-c4',
            exerciseTitle: 'Sustained Pitch Lock',
            category: 'pitch',
            voiceRange: 'tenor',
            metrics: {
              pitchScore: 72,
              rhythmScore: 68,
              stabilityScore: 65,
              vibratoScore: 50,
              overallScore: 68,
              avgPitchDeviationCents: 38,
              inTunePercentage: 62,
              avgOnsetOffsetMs: 140,
              durationAccuracy: 80,
              pitchDriftCentsPerSec: 14.5,
              vibratoDetected: false,
              vibratoRateHz: 0,
              vibratoDepthCents: 0,
              vibratoConsistency: 0,
              totalSungSeconds: 3.2,
              notesEvaluated: [],
            },
            coachEvaluation: {
              grade: 'B',
              coachHeadline: 'Good breath energy! Focus on steadying the larynx to prevent pitch drift.',
              strengths: ['Confident sound initiation', 'Good volume consistency'],
              areasToImprove: ['Subglottic pressure sagged in the last second', 'Larynx rose slightly causing sharp drift'],
              techniqueTip: 'Maintain abdominal engagement throughout the full duration of the note.',
              drillRecommendation: {
                drillName: 'Major Triad Arpeggio',
                nextExerciseId: 'major-triad',
                reason: 'Moving through chord intervals helps train muscle memory for pitch centers.',
                warmupExercise: 'Lip trills on 5-tone scale',
              },
            },
            frames: [],
          },
          {
            id: 'sample-session-2',
            timestamp: Date.now() - 86400000 * 1,
            exerciseId: 'sustained-c4',
            exerciseTitle: 'Sustained Pitch Lock',
            category: 'pitch',
            voiceRange: 'tenor',
            metrics: {
              pitchScore: 88,
              rhythmScore: 84,
              stabilityScore: 82,
              vibratoScore: 78,
              overallScore: 85,
              avgPitchDeviationCents: 16,
              inTunePercentage: 86,
              avgOnsetOffsetMs: 65,
              durationAccuracy: 94,
              pitchDriftCentsPerSec: 4.2,
              vibratoDetected: true,
              vibratoRateHz: 5.6,
              vibratoDepthCents: 42,
              vibratoConsistency: 85,
              totalSungSeconds: 3.5,
              notesEvaluated: [],
            },
            coachEvaluation: {
              grade: 'A',
              coachHeadline: 'Superb improvement! Clean pitch lock with natural 5.6Hz vibrato release.',
              strengths: ['Pitch stayed well within ±20 cents', 'Natural vocal cord release into smooth vibrato'],
              areasToImprove: ['Minor tension on vowel tail'],
              techniqueTip: 'Keep the soft palate lifted like an inner smile for radiant tone resonance.',
              drillRecommendation: {
                drillName: 'Straight Tone into Vibrato Blossom',
                nextExerciseId: 'vibrato-mastery',
                reason: 'Refine deliberate transition between straight tone and resonant vibrato.',
                warmupExercise: 'Straw phonation into water',
              },
            },
            frames: [],
          },
        ];
        setSessions(sampleSessions);
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sampleSessions));
      }
    } catch (e) {
      console.error('Failed to load session history:', e);
    }

    return () => {
      handleStopAll();
    };
  }, []);

  const saveJourneyState = (updated: UserJourneyState) => {
    setJourneyState(updated);
    try {
      localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save journey state:', e);
    }
  };

  const saveSessions = (newSessions: RecordedSessionAttempt[]) => {
    setSessions(newSessions);
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(newSessions));
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }
  };

  const handleDeleteSession = (id: string) => {
    const filtered = sessions.filter((s) => s.id !== id);
    saveSessions(filtered);
  };

  // Handle Placement Census completion
  const handleCompletePlacement = (result: PlacementAssessmentResult) => {
    // Unlock nodes based on placed unit
    const completedNodeIds: string[] = [];
    const nodeStars: Record<string, number> = {};

    // Auto-complete earlier units if placed higher
    if (result.unlockedUpToUnit >= 2) {
      ALL_JOURNEY_NODES.filter((n) => n.unitIndex === 1).forEach((n) => {
        completedNodeIds.push(n.id);
        nodeStars[n.id] = 3;
      });
    }
    if (result.unlockedUpToUnit >= 3) {
      ALL_JOURNEY_NODES.filter((n) => n.unitIndex === 2).forEach((n) => {
        completedNodeIds.push(n.id);
        nodeStars[n.id] = 3;
      });
    }
    if (result.unlockedUpToUnit >= 4) {
      ALL_JOURNEY_NODES.filter((n) => n.unitIndex === 3).forEach((n) => {
        completedNodeIds.push(n.id);
        nodeStars[n.id] = 3;
      });
    }

    // First unlocked active node
    const firstActive = ALL_JOURNEY_NODES.find(
      (n) => n.unitIndex === result.unlockedUpToUnit && !completedNodeIds.includes(n.id)
    ) || ALL_JOURNEY_NODES[0];

    const updated: UserJourneyState = {
      ...journeyState,
      tier: result.tier,
      tierName: result.tierName,
      tierDescription: result.initialFocus,
      xp: result.startingXp,
      level: Math.floor(result.startingXp / 200) + 1,
      currentNodeId: firstActive.id,
      completedNodeIds,
      nodeStars,
      assessmentCompleted: true,
      lastActiveDate: new Date().toISOString().split('T')[0],
    };

    saveJourneyState(updated);
    setShowPlacementModal(false);
    setActiveTab('journey');
  };

  // Select Journey Node from roadmap
  const handleSelectJourneyNode = (node: JourneyNode) => {
    setActiveJourneyNode(node);
    setSelectedExerciseId(node.exerciseId);
    setJourneyNodeSuccess(null);
    handleReset();
    setActiveTab('training'); // switch to Training Ground studio to practice
  };

  // Open mystery chest
  const handleOpenChest = (chestNodeId: string, xpReward: number) => {
    const newXp = journeyState.xp + xpReward;
    const newLevel = Math.floor(newXp / 200) + 1;
    const updated: UserJourneyState = {
      ...journeyState,
      xp: newXp,
      level: newLevel,
      openedChestIds: [...journeyState.openedChestIds, chestNodeId],
      completedNodeIds: journeyState.completedNodeIds.includes(chestNodeId)
        ? journeyState.completedNodeIds
        : [...journeyState.completedNodeIds, chestNodeId],
    };
    saveJourneyState(updated);
  };

  // Play Guide (synthesized accompaniment)
  const handlePlayGuide = () => {
    handleStopAll();
    setIsPlayingGuide(true);
    setCurrentTime(0);

    const startTime = performance.now();
    const interval = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      setCurrentTime(elapsed);
      if (elapsed >= totalDuration) {
        clearInterval(interval);
        setIsPlayingGuide(false);
      }
    }, 40);
    timerIntervalRef.current = interval;

    synth.playExerciseNotes(
      currentExercise.notes,
      tempoMultiplier,
      true,
      undefined,
      () => {
        setIsPlayingGuide(false);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      }
    );
  };

  // Start Practice Attempt (Singing with real-time mic tracking)
  const handleStartSinging = async () => {
    handleStopAll();
    setRecordedAudioUrl(null);
    setPitchFrames([]);
    setLatestMetrics(null);
    setLatestEvaluation(null);
    setJourneyNodeSuccess(null);

    // 1. Play count-in (3, 2, 1)
    let count = 3;
    setCountdown(count);
    synth.playCountIn(count);

    const countInterval = setInterval(async () => {
      count--;
      if (count > 0) {
        setCountdown(count);
        synth.playCountIn(count);
      } else {
        clearInterval(countInterval);
        setCountdown(null);
        await beginMicRecording();
      }
    }, 900);
  };

  const beginMicRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      micStreamRef.current = stream;

      if (audioCtxRef.current) {
        if (audioCtxRef.current.state !== 'closed') {
          audioCtxRef.current.close().catch(() => {});
        }
        audioCtxRef.current = null;
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const detector = new PitchDetector(2048, audioCtx.sampleRate, 0.15);
      detectorRef.current = detector;

      // Setup MediaRecorder to preserve actual singing audio take
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      mediaRecorder.start();

      setIsRecording(true);
      recordingStartTimeRef.current = performance.now();
      setCurrentTime(0);

      // Play soft backing piano chords without guide vocal to support student's pitch reference
      synth.playExerciseNotes(
        currentExercise.notes,
        tempoMultiplier,
        false, // no guide vocal, only accompaniment
        undefined,
        () => {
          // Finished exercise timeline
          setTimeout(() => {
            handleStopRecording();
          }, 300);
        }
      );

      // Pitch tracking loop
      const framesCollector: PitchFrame[] = [];
      const sampleBuffer = new Float32Array(analyser.fftSize);

      const loop = () => {
        if (!analyser || !detector) return;

        const now = (performance.now() - recordingStartTimeRef.current) / 1000;
        setCurrentTime(now);

        analyser.getFloatTimeDomainData(sampleBuffer);
        const result = detector.detect(sampleBuffer, 0.015);

        // Find active target note at current time
        let targetMidi: number | null = null;
        let targetNoteName: string | null = null;
        let targetFreq: number | null = null;

        let accumulated = 0;
        for (const n of currentExercise.notes) {
          const start = accumulated;
          const dur = n.duration * tempoMultiplier;
          const end = start + dur;
          accumulated += dur + (n.restAfter || 0) * tempoMultiplier;

          if (now >= start && now <= end) {
            targetMidi = n.midi;
            targetNoteName = n.pitch;
            targetFreq = n.freq;
            break;
          }
        }

        if (result && result.freq > 65 && result.freq < 1250) {
          const midi = freqToMidi(result.freq);
          const centsOffset = targetFreq
            ? getCentsDeviation(result.freq, targetFreq)
            : getCentsDeviation(result.freq, midiToFreq(Math.round(midi)));

          const { fullName } = midiToNoteName(midi);

          const frame: PitchFrame = {
            time: now,
            freq: result.freq,
            midi,
            centsOffset,
            targetMidi,
            targetNoteName,
            volumeRms: 0.5,
            isVoiced: true,
          };
          framesCollector.push(frame);

          setCurrentPitch({
            freq: result.freq,
            midi,
            centsOffset,
            noteName: fullName,
            driftCents: 0,
          });
        } else {
          const frame: PitchFrame = {
            time: now,
            freq: null,
            midi: null,
            centsOffset: null,
            targetMidi,
            targetNoteName,
            volumeRms: 0,
            isVoiced: false,
          };
          framesCollector.push(frame);
          setCurrentPitch(null);
        }

        setPitchFrames([...framesCollector]);
        animFrameRef.current = requestAnimationFrame(loop);
      };

      animFrameRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.error('Error starting mic recording:', err);
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    synth.stopAll();

    setIsRecording(false);
    setCurrentPitch(null);

    // Stop recorder and create audio blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(audioUrl);

        // Run vocal performance analysis
        runPerformanceEvaluation(audioUrl);
      };
      mediaRecorderRef.current.stop();
    } else {
      runPerformanceEvaluation();
    }

    // Stop mic stream
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
  };

  const handleStopAll = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    synth.stopAll();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
      mediaRecorderRef.current = null;
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
    setIsPlayingGuide(false);
    setIsRecording(false);
    setCountdown(null);
    setCurrentPitch(null);
  };

  const runPerformanceEvaluation = async (audioUrl?: string) => {
    // 1. Calculate physical metrics via vocal analysis engine
    const metrics = analyzeVocalPerformance(currentExercise, pitchFrames, tempoMultiplier);
    setLatestMetrics(metrics);

    // 2. Query Gemini 3.8 Flash AI Singing Teacher via server endpoint
    setIsLoadingAI(true);
    try {
      const res = await fetch('/api/coach/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise: currentExercise,
          metrics,
          voiceRange,
        }),
      });
      const data = await res.json();
      const evalResult: AICoachEvaluation = data.evaluation;
      setLatestEvaluation(evalResult);

      // Save to sessions history for cross-session progress tracking
      const newSession: RecordedSessionAttempt = {
        id: `sess-${Date.now()}`,
        timestamp: Date.now(),
        exerciseId: currentExercise.id,
        exerciseTitle: currentExercise.title,
        category: currentExercise.category,
        voiceRange,
        audioBlobUrl: audioUrl,
        metrics,
        coachEvaluation: evalResult,
        frames: pitchFrames,
      };

      saveSessions([newSession, ...sessions]);

      // 3. Handle Gamification & Journey Node Advancement
      if (activeJourneyNode) {
        const isPassed = metrics.overallScore >= activeJourneyNode.targetScore;
        if (isPassed) {
          // Calculate stars
          const stars = metrics.overallScore >= 88 ? 3 : metrics.overallScore >= 75 ? 2 : 1;
          const bonusXp = evalResult.grade === 'S' ? 25 : evalResult.grade === 'A' ? 15 : 0;
          const totalEarned = activeJourneyNode.xpReward + bonusXp;

          // Find next node in sequence
          const currentIndex = ALL_JOURNEY_NODES.findIndex((n) => n.id === activeJourneyNode.id);
          const nextNode = ALL_JOURNEY_NODES[currentIndex + 1];

          const newCompleted = journeyState.completedNodeIds.includes(activeJourneyNode.id)
            ? journeyState.completedNodeIds
            : [...journeyState.completedNodeIds, activeJourneyNode.id];

          const newStars = {
            ...journeyState.nodeStars,
            [activeJourneyNode.id]: Math.max(journeyState.nodeStars[activeJourneyNode.id] || 0, stars),
          };

          const newXp = journeyState.xp + totalEarned;
          const newLevel = Math.floor(newXp / 200) + 1;

          const updatedJourney: UserJourneyState = {
            ...journeyState,
            xp: newXp,
            level: newLevel,
            completedNodeIds: newCompleted,
            nodeStars: newStars,
            currentNodeId: nextNode ? nextNode.id : activeJourneyNode.id,
          };

          saveJourneyState(updatedJourney);

          setJourneyNodeSuccess({
            stars,
            xpEarned: totalEarned,
            unlockedNextNodeId: nextNode?.id,
          });

          try {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.5 },
            });
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      console.error('Error fetching AI coach evaluation:', e);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleReset = () => {
    handleStopAll();
    setCurrentTime(0);
    setPitchFrames([]);
    setCurrentPitch(null);
    setLatestMetrics(null);
    setLatestEvaluation(null);
    setRecordedAudioUrl(null);
    setJourneyNodeSuccess(null);
  };

  const handleSelectNextExercise = (exerciseId: string) => {
    handleStopAll();
    setSelectedExerciseId(exerciseId);
    handleReset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleVolumeChange = (vol: number) => {
    setMasterVolume(vol);
    synth.setVolume(vol);
  };

  // AI Custom Drill Generation
  const handleGenerateCustomDrill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoal.trim() || isGeneratingCustom) return;
    setIsGeneratingCustom(true);

    try {
      const res = await fetch('/api/coach/generate-drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: customGoal,
          voiceRange,
          difficulty: 'intermediate',
        }),
      });
      const data = await res.json();
      if (data.drill) {
        const newDrill: VocalExercise = {
          id: `custom-${Date.now()}`,
          title: data.drill.title || 'AI Custom Vocal Drill',
          category: 'control',
          level: 'Intermediate',
          description: data.drill.description || `Targeted exercise for: ${customGoal}`,
          focusSkill: customGoal,
          bpm: 80,
          vocalTips: ['Focus on breath balance', 'Keep larynx neutral and tone resonant'],
          notes: data.drill.notes,
        };

        RAW_EXERCISES.unshift(newDrill);
        setSelectedExerciseId(newDrill.id);
        setShowCustomModal(false);
        setCustomGoal('');
      }
    } catch (err) {
      console.error('Failed to generate custom drill:', err);
    } finally {
      setIsGeneratingCustom(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
              <Mic className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-lg tracking-tight text-white">VocalSensei</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Duolingo for Singing
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">
                Skill Bracket • Adaptive Journey • Real-Time Pitch Engine
              </p>
            </div>
          </div>

          {/* Center Tabs: Vocal Journey / Training Ground / Pitch Gym / Progress */}
          <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('journey')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'journey'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Vocal Journey</span>
            </button>

            <button
              onClick={() => setActiveTab('training')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'training'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Training Ground</span>
            </button>

            <button
              onClick={() => setActiveTab('gym')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'gym'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Pitch Gym</span>
            </button>

            <button
              onClick={() => setActiveTab('progress')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'progress'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Progress & History</span>
              {sessions.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-slate-800 text-[10px] text-slate-300 flex items-center justify-center font-mono">
                  {sessions.length}
                </span>
              )}
            </button>
          </nav>

          {/* Right Gamification Pills & Voice Range */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Streak & XP Badges in Header */}
            <div className="hidden lg:flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs font-mono">
              <span className="flex items-center gap-1 text-orange-400 font-bold">
                <Flame className="w-3.5 h-3.5 fill-orange-400" /> {journeyState.streak}d
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Zap className="w-3.5 h-3.5 fill-amber-400" /> {journeyState.xp} XP
              </span>
            </div>

            {/* Voice Type Selector */}
            <select
              value={voiceRange}
              onChange={(e) => setVoiceRange(e.target.value as VoiceRange)}
              className="bg-slate-900 border border-slate-700 hover:border-slate-600 text-white text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="soprano">Soprano (High F)</option>
              <option value="alto">Alto (Mid F)</option>
              <option value="tenor">Tenor (High M)</option>
              <option value="baritone">Baritone (Mid M)</option>
              <option value="bass">Bass (Low M)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        {/* 1. DUOLINGO VOCAL JOURNEY TAB */}
        {activeTab === 'journey' && (
          <VocalJourneyMap
            journeyState={journeyState}
            onSelectJourneyNode={handleSelectJourneyNode}
            onOpenChest={handleOpenChest}
            onRetakePlacement={() => setShowPlacementModal(true)}
          />
        )}

        {/* 2. TRAINING GROUND (PRACTICE STUDIO) TAB */}
        {activeTab === 'training' && (
          <div className="space-y-6">
            {/* Active Journey Lesson Banner (if navigating from a roadmap node) */}
            {activeJourneyNode && (
              <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-cyan-950 border border-cyan-800/80 rounded-3xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('journey')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Return to Journey Map"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                        Active Journey Milestone
                      </span>
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1 font-mono">
                        <Zap className="w-3.5 h-3.5 fill-amber-400" /> +{activeJourneyNode.xpReward} XP
                      </span>
                    </div>
                    <h3 className="text-base font-black text-white">{activeJourneyNode.title}</h3>
                    <p className="text-xs text-slate-300">{activeJourneyNode.focusSkill}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right text-xs">
                    <span className="text-slate-400 text-[10px] block">Target Score to Pass:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {activeJourneyNode.targetScore}%
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('journey')}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
                  >
                    View Map
                  </button>
                </div>
              </div>
            )}

            {/* Journey Milestone Cleared Banner */}
            {journeyNodeSuccess && (
              <div className="bg-gradient-to-r from-emerald-950 to-teal-950 border border-emerald-600 p-5 rounded-3xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${
                            s <= journeyNodeSuccess.stars
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-600'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-emerald-300 ml-1.5 uppercase tracking-wider">
                        Milestone Cleared!
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-white">
                      +{journeyNodeSuccess.xpEarned} Vocal XP Earned!
                    </h4>
                    <p className="text-xs text-emerald-200">
                      Great execution! Your vocal mechanics have advanced on the journey roadmap.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('journey')}
                    className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition-all transform hover:scale-102"
                  >
                    <span>Continue Journey Map</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>
                </div>
              </div>
            )}

            {/* Curriculum Exercises Selector Ribbon */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Curriculum Exercises & Custom Drills
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCustomModal(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-950 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>AI Custom Drill</span>
                  </button>
                </div>
              </div>

              {/* Categorized Exercise Pills */}
              <div className="flex flex-wrap gap-2">
                {RAW_EXERCISES.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => {
                      handleStopAll();
                      setSelectedExerciseId(ex.id);
                      setActiveJourneyNode(null); // free training mode
                      handleReset();
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                      selectedExerciseId === ex.id
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-950/40 scale-102'
                        : 'bg-slate-950 hover:bg-slate-800/80 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        ex.category === 'pitch'
                          ? 'bg-emerald-400'
                          : ex.category === 'rhythm'
                          ? 'bg-blue-400'
                          : ex.category === 'control'
                          ? 'bg-purple-400'
                          : 'bg-pink-400'
                      }`}
                    />
                    <span>{ex.title}</span>
                    <span className="text-[10px] opacity-70 uppercase font-mono">[{ex.level}]</span>
                  </button>
                ))}
              </div>

              {/* Active Exercise Header Description & Teacher Tips */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{currentExercise.title}</span>
                    <span className="text-slate-400 font-mono">BPM: {currentExercise.bpm}</span>
                    <span className="text-slate-400 font-mono">
                      Key Transposition: {VOICE_RANGE_OFFSETS[voiceRange] > 0 ? `+${VOICE_RANGE_OFFSETS[voiceRange]}` : VOICE_RANGE_OFFSETS[voiceRange]} st
                    </span>
                  </div>
                  <p className="text-slate-300">{currentExercise.description}</p>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 max-w-sm shrink-0">
                  <span className="font-bold text-cyan-400 block mb-0.5">Teacher Tip:</span>
                  <span>{currentExercise.vocalTips[0]}</span>
                </div>
              </div>
            </div>

            {/* Real-Time Piano Roll Canvas & Tuner needle */}
            <PianoRollVisualizer
              exercise={currentExercise}
              currentTime={currentTime}
              totalDuration={totalDuration}
              pitchFrames={pitchFrames}
              currentPitch={currentPitch}
              isPlayingGuide={isPlayingGuide}
              isRecording={isRecording}
              tempoMultiplier={tempoMultiplier}
            />

            {/* Audio Recording & Playback Control Bar */}
            <AudioControls
              isRecording={isRecording}
              isPlayingGuide={isPlayingGuide}
              countdown={countdown}
              recordedAudioUrl={recordedAudioUrl}
              onPlayGuide={handlePlayGuide}
              onStartSinging={handleStartSinging}
              onStop={handleStopRecording}
              onReset={handleReset}
              tempoMultiplier={tempoMultiplier}
              onTempoChange={setTempoMultiplier}
              masterVolume={masterVolume}
              onVolumeChange={handleVolumeChange}
            />

            {/* Post-Attempt Vocal Coach Evaluation Card */}
            {(latestMetrics || isLoadingAI) && (
              <VocalCoachFeedback
                metrics={
                  latestMetrics || {
                    pitchScore: 0,
                    rhythmScore: 0,
                    stabilityScore: 0,
                    vibratoScore: 0,
                    overallScore: 0,
                    avgPitchDeviationCents: 0,
                    inTunePercentage: 0,
                    avgOnsetOffsetMs: 0,
                    durationAccuracy: 0,
                    pitchDriftCentsPerSec: 0,
                    vibratoDetected: false,
                    vibratoRateHz: 0,
                    vibratoDepthCents: 0,
                    vibratoConsistency: 0,
                    totalSungSeconds: 0,
                    notesEvaluated: [],
                  }
                }
                evaluation={latestEvaluation}
                isLoadingAI={isLoadingAI}
                onSelectNextExercise={handleSelectNextExercise}
                currentExerciseTitle={currentExercise.title}
              />
            )}
          </div>
        )}

        {/* 3. FREE TUNER & VOCAL GYM TAB */}
        {activeTab === 'gym' && (
          <PitchGym currentVoiceRange={voiceRange} onSetVoiceRange={setVoiceRange} />
        )}

        {/* 4. CROSS-SESSION PROGRESS & COMPARISON TAB */}
        {activeTab === 'progress' && (
          <ProgressCompare
            sessions={sessions}
            onDeleteSession={handleDeleteSession}
            onSelectExercise={(id) => {
              setSelectedExerciseId(id);
              setActiveTab('training');
            }}
          />
        )}
      </main>

      {/* Vocal Census & Placement Audition Modal */}
      {showPlacementModal && (
        <VocalPlacementModal
          currentVoiceRange={voiceRange}
          onSetVoiceRange={setVoiceRange}
          onCompletePlacement={handleCompletePlacement}
          canDismiss={journeyState.assessmentCompleted}
          onClose={() => setShowPlacementModal(false)}
        />
      )}

      {/* Custom AI Drill Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Generate Custom AI Singing Drill</h3>
              </div>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Describe what vocal challenge you want to train (e.g. "rapid pitch agility on 3rds", "mixed voice transition", "holding high belt pitch steady", "smooth vibrato"). Gemini will compose tailored notes for your voice range.
            </p>

            <form onSubmit={handleGenerateCustomDrill} className="space-y-4">
              <input
                type="text"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="e.g. Pitch agility and breath stability on high notes"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingCustom || !customGoal.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md disabled:opacity-40"
                >
                  {isGeneratingCustom ? (
                    <>
                      <Activity className="w-3.5 h-3.5 animate-spin" />
                      <span>Composing Notes...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Exercise</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/80 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VocalSensei — Duolingo-Style AI Singing Teacher</span>
          <span>Vocal Placement Census • Skill Tier Climbing • Real-Time Pitch Engine</span>
        </div>
      </footer>
    </div>
  );
}
