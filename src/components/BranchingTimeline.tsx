import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  GitBranch,
  Clock,
  Heart,
  Eye,
  Bookmark,
  CheckCircle,
  TrendingUp,
  History,
  RotateCcw,
  Zap,
  Tag,
  Download,
  AlertCircle,
  Search,
  Filter,
  Volume2,
  BookOpen,
  PlusCircle,
  User,
  ShieldCheck,
  Compass,
  Sparkles,
  Award,
  Maximize2,
  Minimize2,
  X,
  MapPin
} from "lucide-react";

interface Choice {
  text: string;
  nextContext: string;
}

interface StepNode {
  id?: string;
  sceneTitle: string;
  sceneDescription: string;
  imageUrl?: string;
  videoUrl?: string;
  choiceTaken?: string | null;
  choices?: Choice[];
  imagePrompt?: string;
  mediaType?: "image" | "video";
  mood?: string;
  intensity?: number;
  milestonesAchieved?: string[];
  newConsequences?: Record<string, string>;
  npcUpdates?: any[];
}

interface BranchingTimelineProps {
  allSteps: StepNode[];
  currentStoryId: string | null;
  genre: string | null;
  onBranchToStep: (stepIndex: number) => void;
  relationships: any;
  consequences: Record<string, string>;
  storyMilestones: string[];
}

interface SavedReality {
  id: string;
  name: string;
  steps: StepNode[];
  relationships: any;
  consequences: Record<string, string>;
  storyMilestones: string[];
  timestamp: number;
}

interface IndividualBookmark {
  id: string;
  stepIndex: number;
  sceneTitle: string;
  playerNote: string;
  timestamp: number;
  stepsSnapshot: StepNode[];
  relationshipsSnapshot: any;
  consequencesSnapshot: Record<string, string>;
  storyMilestonesSnapshot: string[];
}

export function BranchingTimeline({
  allSteps,
  currentStoryId,
  genre,
  onBranchToStep,
  relationships,
  consequences,
  storyMilestones
}: BranchingTimelineProps) {
  // Tabs for our comprehensive Timeline Hub
  const [activeTab, setActiveTab] = useState<"map" | "chronicles" | "saves" | "matrix">("map");
  const [savedRealities, setSavedRealities] = useState<SavedReality[]>([]);
  const [bookmarks, setBookmarks] = useState<IndividualBookmark[]>([]);
  
  // Interface triggers
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<{
    idx: number;
    type: "traversed" | "unexplored";
    title: string;
    description: string;
    choiceText?: string;
    choices?: Choice[];
    isUnchosenFork?: boolean;
    parentIndex?: number;
  } | null>(null);

  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "consequences" | "milestones" | "npcs">("all");
  const [filterNpc, setFilterNpc] = useState<string | null>(null);

  // Naming & saving realities
  const [namingRealityName, setNamingRealityName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [bookmarkingNodeIndex, setBookmarkingNodeIndex] = useState<number | null>(null);
  const [namingBookmarkNote, setNamingBookmarkNote] = useState("");
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  
  // Cinematic narrative Replay System State
  const [replayNode, setReplayNode] = useState<StepNode | null>(null);
  const [replayTextIndex, setReplayTextIndex] = useState(0);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Load saved realities and individual bookmarks from localStorage
  useEffect(() => {
    if (currentStoryId) {
      // Load Custom Saved Realities
      const storedRealities = localStorage.getItem(`echoes_realities_${currentStoryId}`);
      if (storedRealities) {
        try {
          setSavedRealities(JSON.parse(storedRealities));
        } catch (e) {
          console.error("Failed to parse saved realities", e);
        }
      } else {
        setSavedRealities([]);
      }

      // Load Individual Bookmarks
      const storedBookmarks = localStorage.getItem(`echoes_bookmarks_${currentStoryId}`);
      if (storedBookmarks) {
        try {
          setBookmarks(JSON.parse(storedBookmarks));
        } catch (e) {
          console.error("Failed to parse saved bookmarks", e);
        }
      } else {
        setBookmarks([]);
      }
    }
  }, [currentStoryId]);

  const saveRealitiesToStorage = (updatedList: SavedReality[]) => {
    if (currentStoryId) {
      localStorage.setItem(`echoes_realities_${currentStoryId}`, JSON.stringify(updatedList));
      setSavedRealities(updatedList);
    }
  };

  const saveBookmarksToStorage = (updatedList: IndividualBookmark[]) => {
    if (currentStoryId) {
      localStorage.setItem(`echoes_bookmarks_${currentStoryId}`, JSON.stringify(updatedList));
      setBookmarks(updatedList);
    }
  };

  // Toast trigger
  const triggerToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Custom Full-Scale Save Reality point
  const handleSaveCurrentReality = () => {
    if (!currentStoryId || !allSteps.length) return;
    
    const name = namingRealityName.trim() || `Timeline Reality #${savedRealities.length + 1} (${allSteps[allSteps.length - 1]?.sceneTitle || "Uncharted"})`;
    
    const newReality: SavedReality = {
      id: `reality_${Date.now()}`,
      name,
      steps: [...allSteps],
      relationships: { ...relationships },
      consequences: { ...consequences },
      storyMilestones: [...storyMilestones],
      timestamp: Date.now()
    };

    const updated = [newReality, ...savedRealities];
    saveRealitiesToStorage(updated);
    setNamingRealityName("");
    setShowSaveModal(false);
    triggerToast("✨ Complete timeline state anchored to saved realities!");
  };

  // Add individual bookmark to a specific step
  const handleAddBookmark = () => {
    if (bookmarkingNodeIndex === null || !currentStoryId) return;
    
    const targetStep = allSteps[bookmarkingNodeIndex];
    if (!targetStep) return;

    const note = namingBookmarkNote.trim() || `Bookmark at Node ${bookmarkingNodeIndex + 1}: ${targetStep.sceneTitle}`;
    
    // Slice steps list up to the bookmarked index so returning back only loads up to that exact step!
    const stepsSnapshot = allSteps.slice(0, bookmarkingNodeIndex + 1);

    const newBookmark: IndividualBookmark = {
      id: `bookmark_${Date.now()}`,
      stepIndex: bookmarkingNodeIndex,
      sceneTitle: targetStep.sceneTitle,
      playerNote: note,
      timestamp: Date.now(),
      stepsSnapshot,
      relationshipsSnapshot: { ...relationships }, // snapshot state
      consequencesSnapshot: { ...consequences },
      storyMilestonesSnapshot: [...storyMilestones]
    };

    const updated = [newBookmark, ...bookmarks];
    saveBookmarksToStorage(updated);
    setNamingBookmarkNote("");
    setBookmarkingNodeIndex(null);
    setShowBookmarkModal(false);
    triggerToast("🔖 Custom save point bookmarked successfully!");
  };

  // Master Restore Trigger Warp (works for any snapshot reality) 
  const handleRestoreState = (snapshot: { name?: string; playerNote?: string; steps: StepNode[] | any[]; relationships: any; consequences: Record<string, string>; storyMilestones: string[] }) => {
    const titleLabel = snapshot.name || snapshot.playerNote || "Alternate Reality";
    const confirmWarp = window.confirm(
      `Travel to alternate reality stream: "${titleLabel}"?\n\nThis will restore this exact path snapshot into the universe. Subsequent steps are safely stored inside this save file, but your present view will reload.`
    );
    if (confirmWarp) {
      // Re-pack state into standard SavedReality framework structure and store for restoration
      const payload = {
        id: `warp_${Date.now()}`,
        name: titleLabel,
        steps: snapshot.steps || (snapshot as any).stepsSnapshot,
        relationships: snapshot.relationships || (snapshot as any).relationshipsSnapshot,
        consequences: snapshot.consequences || (snapshot as any).consequencesSnapshot,
        storyMilestones: snapshot.storyMilestones || (snapshot as any).storyMilestonesSnapshot,
        timestamp: Date.now()
      };
      
      localStorage.setItem(`echoes_restore_trigger_${currentStoryId}`, JSON.stringify(payload));
      window.location.reload(); 
    }
  };

  const handleDeleteReality = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedRealities.filter((r) => r.id !== id);
    saveRealitiesToStorage(updated);
    triggerToast("Reality anchor cleared from archives.");
  };

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = bookmarks.filter((b) => b.id !== id);
    saveBookmarksToStorage(updated);
    triggerToast("Bookmark removed from registry.");
  };

  // Get list of unique NPCs mentioned across the historical log steps
  const uniqueNpcs = useMemo(() => {
    const list: string[] = [];
    allSteps.forEach((step) => {
      if (step.npcUpdates && Array.isArray(step.npcUpdates)) {
        step.npcUpdates.forEach((upd) => {
          if (upd && upd.name && !list.includes(upd.name)) {
            list.push(upd.name);
          }
        });
      }
    });
    return list;
  }, [allSteps]);

  // Comprehensive Search & Filter log calculations
  const filteredSteps = useMemo(() => {
    return allSteps.map((step, originalIndex) => ({ step, originalIndex })).filter(({ step }) => {
      // Keyword query match
      const query = searchQuery.toLowerCase().trim();
      if (query) {
        const titleMatch = step.sceneTitle.toLowerCase().includes(query);
        const descMatch = step.sceneDescription.toLowerCase().includes(query);
        const choiceMatch = step.choiceTaken?.toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !choiceMatch) return false;
      }

      // Quick filter type matches
      if (filterType === "consequences") {
        return step.newConsequences && Object.keys(step.newConsequences).length > 0;
      }
      if (filterType === "milestones") {
        return step.milestonesAchieved && step.milestonesAchieved.length > 0;
      }
      if (filterType === "npcs") {
        if (filterNpc) {
          // Check for matching npc name in updates
          return step.npcUpdates && step.npcUpdates.some((npc) => npc.name === filterNpc);
        }
        return step.npcUpdates && step.npcUpdates.length > 0;
      }

      return true;
    });
  }, [allSteps, searchQuery, filterType, filterNpc]);

  // Dramatic genre styling configs
  const config = useMemo(() => {
    switch (genre) {
      case "romance":
        return {
          cardBg: "bg-rose-50/50 border-rose-100 text-rose-950",
          accentText: "text-rose-600",
          accentBg: "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-900/10",
          glow: "from-rose-500/10 to-transparent",
          highlightNode: "bg-rose-500 border-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.6)]",
          threadLine: "stroke-rose-400"
        };
      case "paranormal":
        return {
          cardBg: "bg-purple-950/20 border-purple-500/20 text-purple-100",
          accentText: "text-purple-400",
          accentBg: "bg-purple-600 text-white hover:bg-purple-700 shadow-purple-900/20",
          glow: "from-purple-500/10 to-transparent",
          highlightNode: "bg-purple-500 border-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.6)]",
          threadLine: "stroke-purple-400"
        };
      case "crime":
        return {
          cardBg: "bg-[#0b0c10]/80 border-white/5 text-slate-100",
          accentText: "text-sky-400",
          accentBg: "bg-sky-600 text-white hover:bg-sky-700 shadow-sky-900/20",
          glow: "from-sky-500/5 to-transparent",
          highlightNode: "bg-sky-500 border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.6)]",
          threadLine: "stroke-sky-400"
        };
      default:
        return {
          cardBg: "bg-zinc-900/60 border-white/5 text-zinc-100",
          accentText: "text-indigo-400",
          accentBg: "bg-indigo-600 text-white hover:bg-indigo-700",
          glow: "from-indigo-500/5 to-transparent",
          highlightNode: "bg-indigo-500 border-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.5)]",
          threadLine: "stroke-indigo-400"
        };
    }
  }, [genre]);

  return (
    <div
      id="fate-tapestry-matrix"
      className={`relative p-6 md:p-8 rounded-[3rem] border backdrop-blur-3xl shadow-2xl space-y-6 mt-8 transition-colors duration-[1.5s] ${config.cardBg}`}
    >
      {/* Toast Alert pop */}
      <AnimatePresence>
        {saveToast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -15 }}
            className="fixed bottom-12 left-1/2 transform -translate-x-1/2 bg-black border border-white/10 text-[10px] px-6 py-4 rounded-full text-white tracking-widest uppercase font-mono z-[250] shadow-2xl flex items-center gap-2.5"
          >
            <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
            {saveToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cinematic Speaker Overlay (Narrative Replay text reader) */}
      <AnimatePresence>
        {replayNode && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 backdrop-blur-3xl bg-black/90">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-2xl p-8 md:p-12 text-center relative space-y-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setReplayNode(null)}
                  className="rounded-full bg-white/5 border border-white/10 p-2.5 text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.3em] text-amber-500/80">
                <BookOpen className="w-5 h-5 animate-bounce mb-1" />
                Scenario Chronicle Playback
              </div>

              <h2 className={`text-2xl md:text-4xl font-serif tracking-tight font-extrabold ${genre === "romance" ? "text-rose-100 italic" : "text-white"}`}>
                {replayNode.sceneTitle}
              </h2>

              <div className="max-h-[50vh] overflow-y-auto px-4 py-2 border-y border-white/5 space-y-6">
                <p className={`text-lg sm:text-xl font-light leading-relaxed font-serif text-white/80 select-text ${genre === "romance" ? "text-rose-50/90" : ""}`}>
                  "{replayNode.sceneDescription}"
                </p>

                {replayNode.choiceTaken && (
                  <div className="py-4 px-6 rounded-2xl bg-white/5 border border-white/5 font-mono text-xs max-w-lg mx-auto">
                    <span className="opacity-40 uppercase tracking-widest text-[9px] block mb-1">Divergent Pivot Chosen:</span>
                    <span className={`font-bold ${config.accentText}`}>{replayNode.choiceTaken}</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] uppercase font-mono tracking-wider opacity-35">
                "Weaving fates is an exploration of multiple reflections. Close to resume."
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Primary Header Segment */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-white/5">
        <div id="narrative-tapestry-header" className="flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl bg-white/5 border border-white/10 ${config.accentText}`}>
            <GitBranch className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-serif font-extrabold tracking-tight uppercase">Tapestry of Fate</h3>
              <span className="text-[8px] font-mono font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">
                v2.1 Stream Map
              </span>
            </div>
            <p className="text-[10px] font-mono tracking-widest opacity-50 uppercase mt-0.5">
              Explore complex decision trees, bookmarks, and cross-converges
            </p>
          </div>
        </div>

        {/* Dynamic Category Navigation Nodes */}
        <div id="matrix-toggles" className="flex flex-wrap gap-1 bg-black/30 p-1.5 rounded-2xl border border-white/5 w-full lg:w-auto">
          <button
            onClick={() => setActiveTab("map")}
            className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "map" ? config.accentBg : "opacity-45 hover:opacity-85 text-white"
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> Interactive Map
          </button>
          
          <button
            onClick={() => setActiveTab("chronicles")}
            className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "chronicles" ? config.accentBg : "opacity-45 hover:opacity-85 text-white"
            }`}
          >
            <History className="w-3.5 h-3.5" /> Chrono Chronicles
          </button>

          <button
            onClick={() => setActiveTab("saves")}
            className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "saves" ? config.accentBg : "opacity-45 hover:opacity-85 text-white"
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" /> Save Anchors ({savedRealities.length + bookmarks.length})
          </button>

          <button
            onClick={() => setActiveTab("matrix")}
            className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "matrix" ? config.accentBg : "opacity-45 hover:opacity-85 text-white"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Matrix Records
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB COMPONENT 1: INTERACTIVE BRANCHING GRAPH */}
      {/* ========================================== */}
      {activeTab === "map" && (
        <div id="interactive-timeline-graph" className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-2xl bg-black/20 border border-white/5 gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin duration-[5s]" />
              <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">
                A birds-eye view of your narrative streams. Traversed steps highlighted in <span className={`font-black ${config.accentText}`}>{genre} lines</span>.
              </p>
            </div>
            <button
              onClick={() => setShowSaveModal(true)}
              className="w-full md:w-auto px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 text-white hover:bg-white/5 transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Save Active Stream
            </button>
          </div>

          {/* Interactive Graph Drawing Canvas Grid */}
          <div className="relative w-full overflow-x-auto overflow-y-visible border border-white/5 rounded-3xl bg-black/40 p-12 min-h-[500px]">
            {/* Main scroll wrapper sizing container */}
            <div className="flex flex-col items-center gap-16 min-w-[700px] relative">
              
              {/* Dynamic Connecting SVG curves overlay in background */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                {allSteps.map((step, idx) => {
                  if (idx >= allSteps.length - 1) return null;
                  
                  // Parent node center is at X=50% width.
                  // Connection calculation handles direct lines flowing down vertically
                  return (
                    <g key={`flow-svg-${idx}`}>
                      {/* Main selected timeline stream line (radiant glow) */}
                      <motion.line
                        x1="50%"
                        y1={`${60 + idx * 105}px`}
                        x2="50%"
                        y2={`${60 + (idx + 1) * 105}px`}
                        className={`${config.threadLine}`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, delay: idx * 0.1 }}
                      />
                      
                      {/* Highlight path with glow filter trace */}
                      <line
                        x1="50%"
                        y1={`${60 + idx * 105}px`}
                        x2="50%"
                        y2={`${60 + (idx + 1) * 105}px`}
                        className={`${config.threadLine} blur-sm opacity-55`}
                        strokeWidth="8"
                      />

                      {/* If step has multiple parallel choices (paths), draw divergent side branch threads! */}
                      {step.choices && step.choices.length > 1 && (
                        step.choices.map((ch, cIdx) => {
                          if (ch.text === step.choiceTaken) return null; // skip traversed ones
                          
                          // Unchosen pathways fork left or right! Even index to left (25%), odd to right (75%)
                          const sideX = cIdx % 2 === 0 ? "25%" : "75%";
                          
                          return (
                            <path
                              key={`divergent-${idx}-${cIdx}`}
                              d={`M 50% ${60 + idx * 105} C 50% ${60 + idx * 105 + 50}, ${sideX} ${60 + idx * 105 + 40}, ${sideX} ${60 + (idx + 1) * 105}`}
                              fill="none"
                              stroke="rgba(156, 163, 175, 0.4)"
                              strokeWidth="2"
                              strokeDasharray="4 4"
                              className="animate-pulse"
                            />
                          );
                        })
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Loop rendering Node Stack visually */}
              {allSteps.map((step, idx) => {
                const isCurrent = idx === allSteps.length - 1;
                const hasAlternates = step.choices && step.choices.length > 1;

                return (
                  <div key={idx} className="relative w-full flex justify-center items-center h-[40px] z-10">
                    
                    {/* LEFT-WARD BRANCH (Parallel Option Fork) */}
                    {hasAlternates && step.choices!.some((ch, cI) => ch.text !== step.choiceTaken && cI % 2 === 0) && (
                      <div className="absolute left-[8%] md:left-[15%] flex flex-col items-end">
                        {step.choices!.filter((ch, cI) => ch.text !== step.choiceTaken && cI % 2 === 0).map((ch, forkIndex) => (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            onClick={() => setSelectedGraphNode({
                              idx,
                              type: "unexplored",
                              title: `Parallel Fork: ${step.sceneTitle}`,
                              description: `At Scene ${idx + 1}, if you chose differently:`,
                              choiceText: ch.text,
                              isUnchosenFork: true,
                              parentIndex: idx
                            })}
                            key={`fork-L-${forkIndex}`}
                            className="bg-black/80 border border-white/10 hover:border-orange-500/40 p-3.5 rounded-2xl text-left max-w-[180px] shadow-xl text-[10px] space-y-1 block transition-colors group"
                          >
                            <div className="flex items-center gap-1.5 text-orange-400 font-mono text-[8px] font-black tracking-widest">
                              <GitBranch className="w-3 h-3 group-hover:rotate-18 rotated" /> FATE SLOW FORK
                            </div>
                            <div className="opacity-75 line-clamp-2 text-white/90">"{ch.text}"</div>
                          </motion.button>
                        ))}
                      </div>
                    )}

                    {/* CORE TRAVERSED CENTER PATH NODE */}
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="relative flex items-center justify-center cursor-pointer"
                      onClick={() => setSelectedGraphNode({
                        idx,
                        type: "traversed",
                        title: step.sceneTitle,
                        description: step.sceneDescription,
                        choiceText: step.choiceTaken || undefined,
                        choices: step.choices
                      })}
                    >
                      {/* Circle glowing core shape representing step */}
                      <div
                        className={`w-10 h-10 rounded-full border-4 flex items-center justify-center transition-all ${
                          isCurrent ? config.highlightNode : "bg-black border-white/20 text-white/50"
                        }`}
                      >
                        <span className="font-mono text-[9px] font-black">{idx + 1}</span>
                      </div>

                      {/* Floating title tag */}
                      <div className="absolute left-14 whitespace-nowrap hidden sm:block">
                        <p className={`text-[10px] font-bold ${isCurrent ? "text-amber-400" : "opacity-40"}`}>
                          {step.sceneTitle}
                        </p>
                        {step.choiceTaken && (
                          <p className="text-[7.5px] font-mono tracking-wider opacity-35 max-w-[140px] truncate">
                            👉 {step.choiceTaken}
                          </p>
                        )}
                      </div>
                    </motion.div>

                    {/* RIGHT-WARD BRANCH (Parallel Option Fork) */}
                    {hasAlternates && step.choices!.some((ch, cI) => ch.text !== step.choiceTaken && cI % 2 !== 0) && (
                      <div className="absolute right-[8%] md:right-[15%] flex flex-col items-start">
                        {step.choices!.filter((ch, cI) => ch.text !== step.choiceTaken && cI % 2 !== 0).map((ch, forkIndex) => (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            onClick={() => setSelectedGraphNode({
                              idx,
                              type: "unexplored",
                              title: `Parallel Fork: ${step.sceneTitle}`,
                              description: `At Scene ${idx + 1}, if you chose differently:`,
                              choiceText: ch.text,
                              isUnchosenFork: true,
                              parentIndex: idx
                            })}
                            key={`fork-R-${forkIndex}`}
                            className="bg-black/80 border border-white/10 hover:border-orange-500/40 p-3.5 rounded-2xl text-left max-w-[180px] shadow-xl text-[10px] space-y-1 block transition-colors group"
                          >
                            <div className="flex items-center gap-1.5 text-orange-400 font-mono text-[8px] font-black tracking-widest">
                              <GitBranch className="w-3 h-3 group-hover:rotate-18" /> FATE SLOW FORK
                            </div>
                            <div className="opacity-75 line-clamp-2 text-white/90">"{ch.text}"</div>
                          </motion.button>
                        ))}
                      </div>
                    )}

                  </div>
                );
              })}

            </div>
          </div>

          {/* Interactive Graph Node Inspector Drawer Overlay */}
          <AnimatePresence>
            {selectedGraphNode && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="p-6 rounded-2xl border border-white/10 bg-black/50 backdrop-blur-2xl space-y-4 text-left"
              >
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase font-mono tracking-widest px-2.5 py-0.5 rounded-full bg-white/5 border border-white/5 opacity-55">
                      Node {selectedGraphNode.idx + 1} Inspector
                    </span>
                    {selectedGraphNode.type === "unexplored" && (
                      <span className="text-[9px] font-mono tracking-wider font-extrabold bg-orange-500/10 text-orange-400 border border-orange-500/15 px-2 py-0.5 rounded-full">
                        ⚡ PARALLEL FATE
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedGraphNode(null)}
                    className="text-[9px] uppercase font-mono bg-white/10 hover:bg-white/15 text-white py-1 px-3 rounded-full transition"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">{selectedGraphNode.title}</h4>
                  <p className="text-xs text-white/60 leading-relaxed font-serif italic">"{selectedGraphNode.description}"</p>
                </div>

                {selectedGraphNode.choiceText && (
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-left">
                    <span className="text-[9px] uppercase font-mono tracking-wider opacity-40 block mb-0.5">
                      {selectedGraphNode.isUnchosenFork ? "Alternative Choice Offered:" : "Traversed Decision Path Taken:"}
                    </span>
                    <span className={`font-semibold ${selectedGraphNode.isUnchosenFork ? "text-orange-400" : config.accentText}`}>
                      {selectedGraphNode.isUnchosenFork ? "⚡ " : "👉 "} {selectedGraphNode.choiceText}
                    </span>
                  </div>
                )}

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  {selectedGraphNode.type === "traversed" && selectedGraphNode.idx < allSteps.length - 1 ? (
                    <button
                      onClick={() => {
                        const idx = selectedGraphNode.idx;
                        const confirmFork = window.confirm(
                          `Warp back and rewrite history here? All decisions from step ${idx + 2} will be pruned from this timeline.`
                        );
                        if (confirmFork) {
                          onBranchToStep(idx);
                          setSelectedGraphNode(null);
                          triggerToast("⌛ Fate timeline adjusted back! Parallel path ready.");
                        }
                      }}
                      className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition flex items-center justify-center gap-2 ${config.accentBg}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" strokeWidth="3" /> Rewind & Replay Step Here
                    </button>
                  ) : selectedGraphNode.isUnchosenFork && (
                    <button
                      onClick={() => {
                        const rootParentIdx = selectedGraphNode.parentIndex!;
                        const confirmAlternate = window.confirm(
                          `Warp back to the decision split in Scene ${rootParentIdx + 1}?\n\nThis will load that exact moment, allowing you to instantly select "${selectedGraphNode.choiceText}" and watch alternative outcomes unfold.`
                        );
                        if (confirmAlternate) {
                          onBranchToStep(rootParentIdx);
                          setSelectedGraphNode(null);
                          triggerToast(`Warped! Make the split choice: "${selectedGraphNode.choiceText}"`);
                        }
                      }}
                      className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-orange-600 hover:bg-orange-700 text-white transition flex items-center justify-center gap-2"
                    >
                      <GitBranch className="w-3.5 h-3.5 animate-pulse" /> Travel Back to Splitting Junction
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setReplayNode(allSteps[selectedGraphNode.idx]);
                      setSelectedGraphNode(null);
                    }}
                    className="py-2.5 px-5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 text-white hover:bg-white/5 transition flex items-center justify-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> Launch Reader Cinema
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB COMPONENT 2: CHRONOLOGICAL LOGS & ANALYSIS */}
      {/* ========================================== */}
      {activeTab === "chronicles" && (
        <div id="chronicles-historical-log" className="space-y-6">
          {/* Dynamic Search & Category Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/20 p-5 rounded-2xl border border-white/5">
            {/* Keyword Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search events, choices, NPCs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex gap-1 bg-black/30 p-1 rounded-xl border border-white/5 col-span-1 md:col-span-2 overflow-x-auto">
              <button
                onClick={() => { setFilterType("all"); setFilterNpc(null); }}
                className={`flex-1 min-w-[70px] text-center py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  filterType === "all" ? "bg-white/10 text-white font-extrabold" : "opacity-45 hover:opacity-100 text-white"
                }`}
              >
                All Moments
              </button>
              <button
                onClick={() => { setFilterType("consequences"); setFilterNpc(null); }}
                className={`flex-1 min-w-[100px] text-center py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  filterType === "consequences" ? "bg-white/10 text-white font-extrabold" : "opacity-45 hover:opacity-100 text-white"
                }`}
              >
                ⚠️ Consequences
              </button>
              <button
                onClick={() => { setFilterType("milestones"); setFilterNpc(null); }}
                className={`flex-1 min-w-[90px] text-center py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  filterType === "milestones" ? "bg-white/10 text-white font-extrabold" : "opacity-45 hover:opacity-100 text-white"
                }`}
              >
                ✦ Achievements
              </button>
              <button
                onClick={() => setFilterType("npcs")}
                className={`flex-1 min-w-[70px] text-center py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  filterType === "npcs" ? "bg-white/10 text-white font-extrabold" : "opacity-45 hover:opacity-100 text-white"
                }`}
              >
                👤 Characters
              </button>
            </div>
          </div>

          {/* NPC Character filter sub-bar */}
          {filterType === "npcs" && uniqueNpcs.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="flex flex-wrap gap-1.5 pb-2"
            >
              <span className="text-[8.5px] uppercase font-mono tracking-widest opacity-40 py-1.5 pr-2">Filter Character:</span>
              <button
                onClick={() => setFilterNpc(null)}
                className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border transition ${
                  filterNpc === null ? "bg-white/10 border-white/20 text-white" : "border-white/5 text-white/50 hover:bg-white/5"
                }`}
              >
                Any Mentioned
              </button>
              {uniqueNpcs.map((npc) => (
                <button
                  key={npc}
                  onClick={() => setFilterNpc(npc)}
                  className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border transition ${
                    filterNpc === npc ? "bg-white/10 border-white/20 text-white" : "border-white/5 text-white/50 hover:bg-white/5"
                  }`}
                >
                  👤 {npc}
                </button>
              ))}
            </motion.div>
          )}

          {/* Chrono Scroll stream loop */}
          {filteredSteps.length === 0 ? (
            <div className="py-24 text-center border border-dashed border-white/5 rounded-3xl opacity-40">
              <Search className="w-8 h-8 mx-auto opacity-30 mb-2" />
              <p className="text-xs font-mono uppercase tracking-widest">No matching chronicles found</p>
              <p className="text-[10px] mt-1 normal-case leading-relaxed max-w-xs mx-auto">
                No scenes fit your keyword search or category filter. Try clearing filters or text strings.
              </p>
            </div>
          ) : (
            <div className="space-y-6 relative pl-6 border-l-2 border-slate-500/10 ml-3 py-2">
              {filteredSteps.map(({ step, originalIndex }, idx) => {
                const isCurrent = originalIndex === allSteps.length - 1;
                const indexInMap = originalIndex;

                return (
                  <div key={idx} className="relative group/chrono" id={`chrono-card-${originalIndex}`}>
                    
                    {/* Node Dot Ring Indicator */}
                    <div
                      className={`absolute -left-[31px] top-4 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        isCurrent ? config.highlightNode : "bg-black border-white/20"
                      }`}
                    >
                      <div className={`w-1 h-1 rounded-full ${isCurrent ? "bg-white animate-ping" : "bg-transparent"}`} />
                    </div>

                    <div className="p-6 rounded-2xl border border-white/5 bg-black/25 space-y-4 text-left transition-colors duration-300">
                      
                      {/* Top metadata tags bar */}
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] uppercase font-mono tracking-widest opacity-40">
                            Scene Chronicle {originalIndex + 1}
                          </span>
                          {step.mood && (
                            <span className="text-[8px] uppercase tracking-wider font-mono text-amber-400 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded">
                              🎭 {step.mood}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Bookmark this moment shortcut */}
                          <button
                            onClick={() => {
                              setBookmarkingNodeIndex(indexInMap);
                              setShowBookmarkModal(true);
                            }}
                            className="bg-white/5 hover:bg-white/10 p-1.5 rounded-lg border border-white/5 text-white/50 hover:text-white transition"
                            title="Bookmark this specific step"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => setReplayNode(step)}
                            className="bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg border border-white/5 text-[9px] font-bold uppercase tracking-widest text-[#F59E0B] flex items-center gap-1 transition"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Cinema Relive
                          </button>
                        </div>
                      </div>

                      {/* Header Title */}
                      <h4 className={`text-lg font-serif font-bold ${genre === "romance" ? "text-rose-950 font-serif italic" : "text-white"}`}>
                        {step.sceneTitle}
                      </h4>

                      {/* Scenario scene descriptive context */}
                      <p className="text-xs opacity-75 leading-relaxed font-serif italic select-text">
                        "{step.sceneDescription}"
                      </p>

                      {/* Decision pivot tracking line */}
                      {step.choiceTaken ? (
                        <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-left">
                          <span className="text-[8.5px] uppercase font-mono tracking-wider opacity-40 block mb-0.5">
                            Decisive Path Traversed:
                          </span>
                          <span className={`font-semibold ${config.accentText}`}>
                            👉 {step.choiceTaken}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[8.5px] font-mono tracking-widest opacity-35 uppercase flex items-center gap-1 pb-1">
                          🪐 Genesis Anchor Starting Scene
                        </span>
                      )}

                      {/* Impact consequence analytics and NPC elements */}
                      {(step.newConsequences && Object.keys(step.newConsequences).length > 0) || (step.milestonesAchieved && step.milestonesAchieved.length > 0) || (step.npcUpdates && step.npcUpdates.length > 0) ? (
                        <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2">
                          
                          {/* Checked consequences warnings */}
                          {step.newConsequences && Object.entries(step.newConsequences).map(([key, desc]) => (
                            <div key={key} className="flex items-start gap-1.5 text-[9.5px] text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-1">
                              <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                              <div className="leading-normal">
                                <span className="font-extrabold uppercase font-mono text-[8px] tracking-wider block opacity-70">
                                  CONSEQUENCE: {key.replace(/_/g, " ")}
                                </span>
                                {String(desc)}
                              </div>
                            </div>
                          ))}

                          {/* Achievements list */}
                          {step.milestonesAchieved?.map((mil) => (
                            <div key={mil} className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-2.5 py-0.5">
                              <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="font-mono tracking-wider font-extrabold">{String(mil).replace(/_/g, " ")}</span>
                            </div>
                          ))}

                          {/* NPCs affinity feedback */}
                          {step.npcUpdates?.map((npc, nI) => (
                            <div key={nI} className="flex items-center gap-1.5 text-[9px] text-rose-300 bg-rose-500/5 border border-rose-500/10 rounded-lg px-2.5 py-0.5">
                              <User className="w-3 h-3 text-rose-400 shrink-0" />
                              <span className="font-mono font-bold">
                                {npc.name}: {npc.affinityChange > 0 ? "+" : ""}{npc.affinityChange} {npc.relationshipType || "suspicion"}
                              </span>
                            </div>
                          ))}

                        </div>
                      ) : null}

                      {/* Interlinking alternative path navigation */}
                      {originalIndex < allSteps.length - 1 && (
                        <div className="pt-1 select-none">
                          <button
                            onClick={() => {
                              const confirmWarp = window.confirm(
                                `Warp Back and branch timeline here?\n\nThis will return you back to step ${originalIndex + 1}. Future steps up to step ${allSteps.length} will be pruned in your active universe, letting you decide differently.`
                              );
                              if (confirmWarp) {
                                onBranchToStep(originalIndex);
                                triggerToast("⌛ Warp complete! Timeline adjusted back.");
                              }
                            }}
                            className={`py-1.5 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition ${config.accentBg}`}
                          >
                            <RotateCcw className="w-3 h-3" /> Warp Fate Here
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================== */}
      {/* TAB COMPONENT 3: REALITY ANCHORS & SAVES */}
      {/* ========================================== */}
      {activeTab === "saves" && (
        <div id="reality-save-anchors" className="space-y-8">
          
          {/* Quick instructions panel */}
          <div className="bg-black/20 p-5 rounded-2xl border border-white/5 space-y-2">
            <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Space-Time Teleport Center
            </h4>
            <p className="opacity-60 text-[11px] leading-relaxed select-text font-serif">
              "Weaving separate universe lines is delicate work." You can anchoring two types of saves:
              <strong> Complete Timelines</strong> (stores your entire path history block) or 
              <strong> Individual Bookmarks</strong> (quick save points on unique nodes with customized notes).
            </p>
          </div>

          {/* Grid splits into Realities vs Bookmarks */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* COLUMN 1: WHOLE REALITY ANCHORS */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h4 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-sky-400 animate-spin duration-[6s]" /> Alternate Reality Streams
                </h4>
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  Anchor Stream
                </button>
              </div>

              {savedRealities.length === 0 ? (
                <div className="py-12 text-center bg-black/10 border border-dashed border-white/5 rounded-2xl opacity-40">
                  <History className="w-8 h-8 mx-auto opacity-30 mb-2 animate-pulse" />
                  <p className="text-[9.5px] font-mono uppercase tracking-widest">No active stream archives</p>
                  <p className="text-[8px] opacity-70 leading-normal max-w-[180px] mx-auto mt-1">Press Anchor Stream to record your full timeline state.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedRealities.map((reality) => (
                    <div
                      key={reality.id}
                      onClick={() => handleRestoreState(reality)}
                      className={`p-5 rounded-2xl border bg-black/35 hover:-translate-y-0.5 transition cursor-pointer text-left ${
                        genre === "romance" ? "border-rose-100 hover:border-rose-300" : "border-white/5 hover:border-purple-500/20"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4 mb-2.5">
                        <span className="text-[8px] uppercase font-mono tracking-widest text-[#B5F1D3] py-0.5 px-2 bg-emerald-500/10 rounded">
                          ⏱️ {new Date(reality.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                          onClick={(e) => handleDeleteReality(reality.id, e)}
                          className="text-red-400 hover:text-red-500 text-[9px] font-black uppercase tracking-widest"
                        >
                          Erase
                        </button>
                      </div>

                      <h5 className="font-bold text-sm text-white mb-2 line-clamp-1">{reality.name}</h5>

                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-white/5 text-[9px] font-mono opacity-80 mb-3 text-white/50">
                        <div>📏 depth: <strong className="text-white">{reality.steps.length} Nodes</strong></div>
                        <div>🎖️ milestones: <strong className="text-white">{reality.storyMilestones?.length || 0}</strong></div>
                        <div>⚠️ effects: <strong className="text-white">{Object.keys(reality.consequences || {}).length || 0}</strong></div>
                      </div>

                      <div className={`w-full py-1.5 rounded-xl text-[9.5px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 border border-white/10 ${config.accentText}`}>
                        <Download className="w-3.5 h-3.5" /> Teleport To This Universe
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COLUMN 2: INDIVIDUAL KEY BOOKMARKS */}
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h4 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-yellow-400" /> Micro Save Bookmarks
                </h4>
                <p className="text-[9px] font-mono text-zinc-500">Add from timeline logs</p>
              </div>

              {bookmarks.length === 0 ? (
                <div className="py-12 text-center bg-black/10 border border-dashed border-white/5 rounded-2xl opacity-40">
                  <Bookmark className="w-8 h-8 mx-auto opacity-30 mb-2 animate-bounce" />
                  <p className="text-[9.5px] font-mono uppercase tracking-widest">No individual bookmarks</p>
                  <p className="text-[8px] opacity-70 leading-normal max-w-[180px] mx-auto mt-1">Visit "Chrono Chronicles" tab to save discrete nodes with custom notes.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookmarks.map((bookmark) => (
                    <div
                      key={bookmark.id}
                      onClick={() => handleRestoreState(bookmark as any)}
                      className={`p-5 rounded-2xl border bg-black/35 hover:-translate-y-0.5 transition cursor-pointer text-left ${
                        genre === "romance" ? "border-rose-100 hover:border-rose-300" : "border-white/5 hover:border-yellow-500/20"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-4 mb-2.5">
                        <span className="text-[8px] uppercase font-mono tracking-widest text-[#FFF2B2] py-0.5 px-2 bg-yellow-500/10 rounded">
                          🔖 Node {bookmark.stepIndex + 1}
                        </span>
                        <button
                          onClick={(e) => handleDeleteBookmark(bookmark.id, e)}
                          className="text-red-400 hover:text-red-500 text-[9px] font-black uppercase tracking-widest"
                        >
                          Clear
                        </button>
                      </div>

                      <h5 className="font-bold text-sm text-yellow-400/90 mb-1 line-clamp-1">"{bookmark.playerNote}"</h5>
                      <span className="text-[10px] opacity-60 text-white/70 block mb-3 leading-relaxed font-serif">Original scene Title: <strong>{bookmark.sceneTitle}</strong></span>

                      <div className="flex justify-between items-center py-1.5 border-t border-white/5 text-[9px] font-mono opacity-80 text-white/50">
                        <span>Warp Length: {bookmark.stepsSnapshot?.length || 0} Steps</span>
                        <span className={`font-black uppercase flex items-center gap-1 ${config.accentText}`}>
                          ⚡ TELEPORT INDEX <Download className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB COMPONENT 4: THE FATE MATRIX RECORD */}
      {/* ========================================== */}
      {activeTab === "matrix" && (
        <div id="fate-matrix-scores" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Active Consequences Card */}
            <div className="p-6 rounded-2xl border border-white/5 bg-black/25">
              <h4 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-500" /> Long-Term Echoes & Consequences
              </h4>
              {Object.keys(consequences).length === 0 ? (
                <div className="text-xs opacity-40 font-mono text-center py-8">Your decisions have not triggered long-term echoes yet. Keep playing!</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(consequences).map(([key, desc], idx) => (
                    <div key={key} className="flex gap-3 leading-relaxed text-xs text-left">
                      <span className={`font-black mt-1 ${config.accentText}`}>◦</span>
                      <div>
                        <strong className="uppercase font-mono text-[10px] tracking-widest opacity-50 block">{key.replace(/_/g, " ")}</strong>
                        <span className="opacity-80 text-white/90">{String(desc)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Achievement Milestones Card */}
            <div className="p-6 rounded-2xl border border-white/5 bg-black/25">
              <h4 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-500 animate-spin duration-[10s]" /> Acquired Achievement Cards
              </h4>
              {storyMilestones.length === 0 ? (
                <div className="text-xs opacity-40 font-mono text-center py-8">Your actions have not crossed major key narrative milestone checkpoints.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {storyMilestones.map((mil, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/30 border border-white/10 text-xs text-left">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                        <Award className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-mono uppercase font-black tracking-widest text-[10px] leading-tight text-white/90">
                        {mil.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Personality Index assessment */}
          <div className="p-6 rounded-2xl border border-white/5 bg-black/25 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pink-400" /> Decision Profile Matrix Analytics
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-1">
                <span className="text-[7.5px] uppercase font-mono tracking-widest opacity-40">Narrative Intensity Gauge</span>
                <p className="text-base font-extrabold text-white">Scale Level {allSteps[allSteps.length - 1]?.intensity || 3}/5</p>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: `${((allSteps[allSteps.length - 1]?.intensity || 3) / 5) * 100}%` }} />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-1">
                <span className="text-[7.5px] uppercase font-mono tracking-widest opacity-40">Fate Path Splitting Ratio</span>
                <p className="text-base font-extrabold text-[#F59E0B]">
                  {allSteps.filter((s) => s.choices && s.choices.length > 1).length} / {allSteps.length} divergent forks
                </p>
                <span className="text-[8px] font-mono text-zinc-500">Unchosen junctions tracked inside timeline.</span>
              </div>

              <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-1">
                <span className="text-[7.5px] uppercase font-mono tracking-widest opacity-40">Timeline Stream Complexity</span>
                <p className="text-base font-extrabold text-emerald-400">
                  {Object.keys(consequences).length + storyMilestones.length} active echo elements
                </p>
                <span className="text-[8px] font-mono text-zinc-500">Continuous thread influence active.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* DIALOG 1: SAVE REALITY MODAL PANEL */}
      {/* ========================================== */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md p-8 rounded-[2.5rem] border shadow-2xl ${
                genre === "romance" ? "bg-[#FAF5F5] text-rose-950 border-rose-200" : "bg-zinc-950 text-white border-white/10"
              }`}
            >
              <h4 className="text-lg font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 animate-pulse" /> Anchor Timeline Reality
              </h4>
              <p className="text-xs opacity-60 leading-relaxed mb-6 font-serif">
                Anchor and freeze this exact path stream under a customized nickname. You can restore and warp back to this precise configuration anytime from the <strong>Save Anchors</strong> dashboard.
              </p>

              <input
                type="text"
                placeholder="e.g. Confront Miller / Kiss Room 402 Alternate / Paranormal Curse Split"
                value={namingRealityName}
                onChange={(e) => setNamingRealityName(e.target.value)}
                className={`w-full p-4 rounded-xl border bg-transparent text-xs mb-6 outline-none focus:ring-2 ${
                  genre === "romance"
                    ? "border-rose-200 text-rose-950 focus:border-rose-400 focus:ring-rose-200"
                    : "border-white/10 text-white focus:border-sky-400 focus:ring-sky-500/10"
                }`}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className={`flex-1 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    genre === "romance" ? "border-rose-100 text-rose-800 hover:bg-rose-50" : "border-white/10 text-white"
                  }`}
                >
                  Cancel
                </button>
                <button
                  id="action-btn-confirm-save-reality"
                  onClick={handleSaveCurrentReality}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${config.accentBg}`}
                >
                  Commit Anchor Point
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================== */}
      {/* DIALOG 2: NODE BOOKMARK CUSTOM NOTE MODAL */}
      {/* ========================================== */}
      <AnimatePresence>
        {showBookmarkModal && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/80">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-md p-8 rounded-[2.5rem] border shadow-2xl ${
                genre === "romance" ? "bg-[#FAF5F5] text-rose-950 border-rose-200" : "bg-zinc-950 text-white border-white/10"
              }`}
            >
              <h4 className="text-lg font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-yellow-400 animate-bounce" /> Bookmark Story Moment
              </h4>
              <p className="text-xs opacity-60 leading-relaxed mb-6 font-serif">
                Enter a custom footnote detailing what makes this scene node memorable. Returning here allows you to start over and write dynamic branching destinies from step {bookmarkingNodeIndex! + 1}.
              </p>

              <input
                type="text"
                placeholder="e.g. My Favorite Romantic Twist / Critical Clue Spotted"
                value={namingBookmarkNote}
                onChange={(e) => setNamingBookmarkNote(e.target.value)}
                className={`w-full p-4 rounded-xl border bg-transparent text-xs mb-6 outline-none focus:ring-2 ${
                  genre === "romance"
                    ? "border-rose-200 text-rose-950 focus:border-rose-400 focus:ring-rose-200"
                    : "border-white/10 text-white focus:border-sky-400 focus:ring-sky-500/10"
                }`}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowBookmarkModal(false);
                    setBookmarkingNodeIndex(null);
                  }}
                  className={`flex-1 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    genre === "romance" ? "border-rose-100 text-rose-800 hover:bg-rose-50" : "border-white/10 text-white"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddBookmark}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${config.accentBg}`}
                >
                  Confirm Bookmark
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
