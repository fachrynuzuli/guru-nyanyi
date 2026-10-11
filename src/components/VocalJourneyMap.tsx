import React, { useState } from 'react';
import { UserJourneyState, JourneyNode } from '../types/vocal';
import { JOURNEY_UNITS, JourneyUnit } from '../data/journeyNodes';
import {
  Sparkles,
  Award,
  Flame,
  Zap,
  Lock,
  Check,
  Star,
  Gift,
  Crown,
  Target,
  Music,
  ArrowRight,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface VocalJourneyMapProps {
  journeyState: UserJourneyState;
  onSelectJourneyNode: (node: JourneyNode) => void;
  onOpenChest: (chestNodeId: string, xpReward: number) => void;
  onRetakePlacement: () => void;
}

export const VocalJourneyMap: React.FC<VocalJourneyMapProps> = ({
  journeyState,
  onSelectJourneyNode,
  onOpenChest,
  onRetakePlacement,
}) => {
  const [selectedPreviewNode, setSelectedPreviewNode] = useState<JourneyNode | null>(null);
  const [openedChestModal, setOpenedChestModal] = useState<{ node: JourneyNode; xp: number } | null>(null);

  // Chest technique tips bank
  const chestTips = [
    'Inner Smile Secret: Lifting the corners of your eyes and zygomatic muscles tilts the soft palate for brighter, effortless resonance.',
    'Diaphragmatic Breath Anchor: Inhale as if sipping through a straw. Expand your 360-degree lower ribcage rather than lifting your shoulders.',
    'Vocal Cord Release: Straw phonation in water balances back-pressure (inertance) across your vocal folds, instantly resetting tired vocal cords.',
    'The Larynx Tilt: Imagine drinking a warm sip of tea when reaching high notes. Keeping the thyroid cartilage tilted prevents throat squeezing.',
  ];

  const handleNodeClick = (node: JourneyNode, isUnlocked: boolean, isCompleted: boolean) => {
    if (!isUnlocked) return;

    if (node.type === 'chest') {
      const isAlreadyOpened = journeyState.openedChestIds.includes(node.id);
      if (!isAlreadyOpened) {
        try {
          confetti({
            particleCount: 60,
            spread: 55,
            origin: { y: 0.6 },
          });
        } catch (e) {
          // ignore
        }
        onOpenChest(node.id, node.xpReward);
      }
      setOpenedChestModal({ node, xp: node.xpReward });
    } else {
      setSelectedPreviewNode(node);
    }
  };

  const getNodeIcon = (type: JourneyNode['type'], iconName: JourneyNode['icon']) => {
    switch (type) {
      case 'boss':
        return <Crown className="w-7 h-7 text-amber-300 fill-amber-300" />;
      case 'chest':
        return <Gift className="w-6 h-6 text-yellow-300" />;
      case 'drill':
        return <Zap className="w-5 h-5 text-cyan-300 fill-cyan-300" />;
      default:
        return iconName === 'target' ? (
          <Target className="w-5 h-5 text-white" />
        ) : (
          <Music className="w-5 h-5 text-white" />
        );
    }
  };

  // Determine current node
  const activeNodeId = journeyState.currentNodeId;

  // Horizontal sinusoidal offset for Duolingo-like winding path
  const getHorizontalOffsetClass = (index: number) => {
    const pattern = [0, 48, -48, 64, -64, 32, -32];
    const offset = pattern[index % pattern.length];
    return offset;
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-12">
      {/* Duolingo Gamification Stats Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Skill Bracket Title */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center font-black text-slate-950 shadow-lg shadow-amber-950/40">
              <Award className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
                  Skill Bracket
                </span>
                <span className="text-xs font-mono text-slate-400">Level {journeyState.level}</span>
              </div>
              <h3 className="text-base font-black text-white">{journeyState.tierName}</h3>
            </div>
          </div>

          {/* Gamified counters: XP & Streak */}
          <div className="flex items-center gap-3">
            {/* Daily Streak */}
            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800 shadow-inner">
              <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-pulse" />
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">
                  Streak
                </span>
                <span className="text-sm font-black text-white font-mono leading-none">
                  {journeyState.streak} {journeyState.streak === 1 ? 'Day' : 'Days'}
                </span>
              </div>
            </div>

            {/* Total XP */}
            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800 shadow-inner">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block leading-none">
                  Total XP
                </span>
                <span className="text-sm font-black text-amber-400 font-mono leading-none">
                  {journeyState.xp}
                </span>
              </div>
            </div>

            {/* Retake Placement Census */}
            <button
              onClick={onRetakePlacement}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700"
              title="Retake Vocal Placement Assessment"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Level XP Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-3 text-xs">
          <span className="text-slate-400 text-[11px] font-medium">Lvl {journeyState.level}</span>
          <div className="flex-1 bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (journeyState.xp % 200) / 2)}%` }}
            />
          </div>
          <span className="text-slate-400 text-[11px] font-mono">
            {200 - (journeyState.xp % 200)} XP to Lvl {journeyState.level + 1}
          </span>
        </div>
      </div>

      {/* Duolingo Winding Road of Units */}
      <div className="space-y-12">
        {JOURNEY_UNITS.map((unit) => {
          const unitCompletedCount = unit.nodes.filter((n) =>
            journeyState.completedNodeIds.includes(n.id)
          ).length;
          const unitPercent = Math.round((unitCompletedCount / unit.nodes.length) * 100);

          return (
            <div key={unit.unitIndex} className="space-y-6">
              {/* Unit Header Card */}
              <div
                className={`p-5 rounded-3xl border ${unit.borderColor} ${unit.bgColor} shadow-xl relative overflow-hidden backdrop-blur-md`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                      Unit {unit.unitIndex} • {unit.theme}
                    </span>
                    <h3 className="text-lg font-black text-white mt-0.5">{unit.title}</h3>
                    <p className="text-xs text-slate-300 mt-1">{unit.description}</p>
                  </div>

                  {/* Progress Counter */}
                  <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-white font-mono">
                      {unitCompletedCount}/{unit.nodes.length} Done ({unitPercent}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Winding Nodes Road */}
              <div className="flex flex-col items-center py-4 relative space-y-7">
                {unit.nodes.map((node, nodeIdx) => {
                  const isCompleted = journeyState.completedNodeIds.includes(node.id);
                  const isChestOpened = journeyState.openedChestIds.includes(node.id);
                  const isUnlocked =
                    isCompleted ||
                    node.id === activeNodeId ||
                    nodeIdx === 0 ||
                    journeyState.completedNodeIds.includes(unit.nodes[nodeIdx - 1]?.id);

                  const isCurrent = node.id === activeNodeId;
                  const stars = journeyState.nodeStars[node.id] || 0;
                  const xOffset = getHorizontalOffsetClass(nodeIdx);

                  return (
                    <div
                      key={node.id}
                      className="relative flex flex-col items-center transition-transform duration-300"
                      style={{ transform: `translateX(${xOffset}px)` }}
                    >
                      {/* Active "START" Speech Bubble */}
                      {isCurrent && (
                        <div className="absolute -top-11 z-20 animate-bounce">
                          <div className="bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 text-[11px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full shadow-lg shadow-cyan-950/50 flex items-center gap-1">
                            <span>START HERE</span>
                          </div>
                          <div className="w-2 h-2 bg-cyan-400 transform rotate-45 mx-auto -mt-1" />
                        </div>
                      )}

                      {/* Circular Interactive Node Button */}
                      <button
                        onClick={() => handleNodeClick(node, isUnlocked, isCompleted)}
                        disabled={!isUnlocked}
                        className={`relative group rounded-full flex items-center justify-center transition-all duration-200 transform active:scale-95 ${
                          node.type === 'boss'
                            ? 'w-20 h-20'
                            : node.type === 'chest'
                            ? 'w-16 h-16'
                            : 'w-16 h-16'
                        } ${
                          isCompleted
                            ? 'bg-gradient-to-b from-emerald-500 to-teal-600 border-b-4 border-emerald-800 text-white shadow-lg shadow-emerald-950/40 hover:brightness-110'
                            : isCurrent
                            ? 'bg-gradient-to-b from-cyan-400 to-blue-600 border-b-4 border-blue-900 text-slate-950 shadow-xl shadow-cyan-500/40 ring-4 ring-cyan-400/50 animate-pulse'
                            : isUnlocked
                            ? 'bg-gradient-to-b from-slate-700 to-slate-800 border-b-4 border-slate-950 text-white shadow-md hover:bg-slate-700'
                            : 'bg-slate-900 border-b-4 border-slate-950 text-slate-600 cursor-not-allowed opacity-60'
                        }`}
                      >
                        {isUnlocked ? (
                          node.type === 'chest' && isChestOpened ? (
                            <Check className="w-6 h-6 text-emerald-300 stroke-[3]" />
                          ) : (
                            getNodeIcon(node.type, node.icon)
                          )
                        ) : (
                          <Lock className="w-5 h-5 text-slate-600" />
                        )}
                      </button>

                      {/* Stars Display under completed lessons */}
                      {isCompleted && node.type !== 'chest' && (
                        <div className="flex items-center gap-0.5 mt-1.5">
                          {[1, 2, 3].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${
                                s <= stars
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-700 fill-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Title label underneath */}
                      <span className="text-[11px] font-bold text-slate-300 mt-1 max-w-[130px] text-center line-clamp-1">
                        {node.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Lesson Preview Modal */}
      {selectedPreviewNode && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                  {selectedPreviewNode.type === 'boss'
                    ? '👑 Unit Recital Boss'
                    : selectedPreviewNode.type === 'drill'
                    ? '⚡ Quick Drill'
                    : '🎯 Lesson Milestone'}
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">{selectedPreviewNode.title}</h3>
              </div>
              <button
                onClick={() => setSelectedPreviewNode(null)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedPreviewNode.description}
            </p>

            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Technique Focus:</span>
                <span className="text-white font-medium">{selectedPreviewNode.focusSkill}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pass Score Target:</span>
                <span className="text-emerald-400 font-bold font-mono">
                  {selectedPreviewNode.targetScore}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Reward:</span>
                <span className="text-amber-400 font-bold font-mono flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 fill-amber-400" /> +{selectedPreviewNode.xpReward} XP
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                const nodeToStart = selectedPreviewNode;
                setSelectedPreviewNode(null);
                onSelectJourneyNode(nodeToStart);
              }}
              className="w-full py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 flex items-center justify-center gap-2 shadow-xl shadow-cyan-950/40 transform hover:scale-102 transition-all"
            >
              <span>Start Vocal Lesson</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      )}

      {/* Opened Mystery Chest Modal */}
      {openedChestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-400/40 mx-auto flex items-center justify-center text-amber-400">
              <Gift className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Treasure Unboxed!
              </span>
              <h3 className="text-xl font-black text-white">{openedChestModal.node.title}</h3>
              <div className="text-amber-400 font-mono font-bold text-sm">
                +{openedChestModal.xp} Vocal XP Earned
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-left text-xs text-slate-200 leading-relaxed italic space-y-1">
              <div className="font-bold text-cyan-400 not-italic flex items-center gap-1 text-[11px]">
                <Sparkles className="w-3.5 h-3.5" /> Maestro Clara's Secret Technique:
              </div>
              <p>"{chestTips[openedChestModal.node.unitIndex % chestTips.length]}"</p>
            </div>

            <button
              onClick={() => setOpenedChestModal(null)}
              className="w-full py-3 px-4 rounded-2xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-white transition-all border border-slate-700"
            >
              Collect & Continue Journey
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
