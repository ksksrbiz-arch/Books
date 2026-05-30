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
  category?: string;
  tags?: string[];
  playerComment?: string;
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

  // --- Map Modes & Custom Diagnostics states ---
  const [mapMode, setMapMode] = useState<"tree" | "comparison" | "convergence">("tree");

  // Custom Zoom Scale state for mobile-responsive canvas mapping
  const [timelineScale, setTimelineScale] = useState(1.0);
  
  // Custom interactive click-and-drag panning container state
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [canvasStartX, setCanvasStartX] = useState(0);
  const [canvasScrollLeft, setCanvasScrollLeft] = useState(0);

  // Custom premium interactive confirmation modal overlay state (replaces native window.confirm)
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Initialize scale responsively on small screens
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.innerWidth < 640) {
        setTimelineScale(0.75);
      } else if (window.innerWidth < 1024) {
        setTimelineScale(0.9);
      }
    }
  }, []);

  // Mouse pan handlers for enhanced accessibility grid
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (!canvasContainerRef.current) return;
    // Don't drag if clicking buttons maps or interactive nodes
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest(".cursor-pointer")) return;
    
    setIsDraggingCanvas(true);
    setCanvasStartX(e.pageX - canvasContainerRef.current.offsetLeft);
    setCanvasScrollLeft(canvasContainerRef.current.scrollLeft);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas || !canvasContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - canvasContainerRef.current.offsetLeft;
    const walk = (x - canvasStartX) * 1.5; // speed factor
    canvasContainerRef.current.scrollLeft = canvasScrollLeft - walk;
  };

  const handleCanvasMouseUpOrLeave = () => {
    setIsDraggingCanvas(false);
  };

  // Comparison workbench tracking state slots (stores node index numbers)
  const [compareIdxA, setCompareIdxA] = useState<number | null>(null);
  const [compareIdxB, setCompareIdxB] = useState<number | null>(null);

  // Expanded Bookmark creation modal helper attributes
  const [namingBookmarkCategory, setNamingBookmarkCategory] = useState<string>("Major Pivot");
  const [namingBookmarkTags, setNamingBookmarkTags] = useState<string>("");
  const [namingBookmarkComment, setNamingBookmarkComment] = useState<string>("");

  // Bookmark edit state descriptors
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editCategory, setEditCategory] = useState("Major Pivot");
  const [editTags, setEditTags] = useState("");
  const [editComment, setEditComment] = useState("");

  // Filtering and Searching inside Custom Bookmark panel
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [bookmarkFilterCategory, setBookmarkFilterCategory] = useState<string>("all");

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

    // Compute tags array
    const tagsArray = namingBookmarkTags
      ? namingBookmarkTags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];

    const newBookmark: IndividualBookmark = {
      id: `bookmark_${Date.now()}`,
      stepIndex: bookmarkingNodeIndex,
      sceneTitle: targetStep.sceneTitle,
      playerNote: note,
      timestamp: Date.now(),
      stepsSnapshot,
      relationshipsSnapshot: { ...relationships }, // snapshot state
      consequencesSnapshot: { ...consequences },
      storyMilestonesSnapshot: [...storyMilestones],
      category: namingBookmarkCategory || "Major Pivot",
      tags: tagsArray,
      playerComment: namingBookmarkComment.trim() || undefined
    };

    const updated = [newBookmark, ...bookmarks];
    saveBookmarksToStorage(updated);
    
    // Reset creators
    setNamingBookmarkNote("");
    setNamingBookmarkCategory("Major Pivot");
    setNamingBookmarkTags("");
    setNamingBookmarkComment("");
    setBookmarkingNodeIndex(null);
    setShowBookmarkModal(false);
    triggerToast("🔖 Custom save point bookmarked successfully!");
  };

  // Master Restore Trigger Warp (works for any snapshot reality) 
  const handleRestoreState = (snapshot: { name?: string; playerNote?: string; steps: StepNode[] | any[]; relationships: any; consequences: Record<string, string>; storyMilestones: string[] }) => {
    const titleLabel = snapshot.name || snapshot.playerNote || "Alternate Reality";
    setConfirmAction({
      title: "Warp Reality Stream",
      message: `Travel to alternate reality stream: "${titleLabel}"?\n\nThis will restore this exact path snapshot into the universe. Subsequent steps are safely stored inside this save file, but your present view will reload.`,
      onConfirm: () => {
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
    });
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

  const handleSaveEditBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = bookmarks.map((b) => {
      if (b.id === id) {
        return {
          ...b,
          playerNote: editNote.trim(),
          category: editCategory,
          tags: editTags.split(",").map(t => t.trim()).filter(t => t.length > 0),
          playerComment: editComment.trim() || undefined
        };
      }
      return b;
    });
    saveBookmarksToStorage(updated);
    setEditingBookmarkId(null);
    triggerToast("🔖 Bookmark details updated!");
  };

  const handleStartEditBookmark = (bookmark: IndividualBookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBookmarkId(bookmark.id);
    setEditNote(bookmark.playerNote);
    setEditCategory(bookmark.category || "Major Pivot");
    setEditTags((bookmark.tags || []).join(", "));
    setEditComment(bookmark.playerComment || "");
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

  // Search & Filter Memo for Bookmarks Panel
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((b) => {
      // search query match
      const query = bookmarkSearch.trim().toLowerCase();
      if (query) {
        const titleMatch = b.sceneTitle.toLowerCase().includes(query);
        const noteMatch = b.playerNote.toLowerCase().includes(query);
        const commentMatch = b.playerComment?.toLowerCase().includes(query);
        const tagsMatch = b.tags?.some((t) => t.toLowerCase().includes(query));
        if (!titleMatch && !noteMatch && !commentMatch && !tagsMatch) return false;
      }
      
      // category match
      if (bookmarkFilterCategory !== "all") {
        if ((b.category || "Major Pivot") !== bookmarkFilterCategory) return false;
      }
      
      return true;
    });
  }, [bookmarks, bookmarkSearch, bookmarkFilterCategory]);

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
            {activeTab === "map" && (
        <div id="interactive-timeline-graph" className="space-y-6">
          
          {/* Submode Selector for Map Suite */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-3xl bg-black/35 border border-white/5">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-amber-400 animate-pulse animate-duration-[4s]" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-white leading-tight">Timeline Mapping Suite</h4>
                <p className="text-[9px] font-mono opacity-50 uppercase tracking-wider mt-0.5">Explore alternate branch lines, converge links, and compare states</p>
              </div>
            </div>

            <div className="flex gap-1.5 p-1 bg-black/30 border border-white/5 rounded-2xl w-full sm:w-auto overflow-x-auto shrink-0">
              <button
                onClick={() => setMapMode("tree")}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${
                  mapMode === "tree" ? "bg-amber-400 text-black font-extrabold" : "text-white/60 hover:text-white"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" /> Flow Tree
              </button>
              
              <button
                onClick={() => {
                  setMapMode("comparison");
                  // Auto seed default compare selections if empty
                  if (compareIdxA === null && allSteps.length > 0) setCompareIdxA(0);
                  if (compareIdxB === null && allSteps.length > 0) setCompareIdxB(allSteps.length - 1);
                }}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${
                  mapMode === "comparison" ? "bg-amber-400 text-black font-extrabold" : "text-white/60 hover:text-white"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Comparison Workbench
              </button>

              <button
                onClick={() => setMapMode("convergence")}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 ${
                  mapMode === "convergence" ? "bg-amber-400 text-black font-extrabold" : "text-white/60 hover:text-white"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Convergence Compass
              </button>
            </div>
          </div>

          {/* ========================================== */}
          {/* SUBTAB VIEW 1: FLOW TREE TIMELINE (WITH RADIANTS PATH HIGHLIGHTS) */}
          {/* ========================================== */}
          {mapMode === "tree" && (
            <div className="space-y-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 rounded-2xl bg-black/20 border border-white/5 gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">
                    A panoramic timeline. Click any node to open the inspector. Precedence path highlights in <span className="text-cyan-400 font-extrabold">animated cyan</span>.
                  </p>
                </div>
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="w-full md:w-auto px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10 text-white hover:bg-white/5 transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Anchor Stream State
                </button>
              </div>

              {/* Premium Neural Canvas Control Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-black/30 border border-white/5 rounded-2xl gap-3 text-xs">
                <div className="flex items-center gap-2 text-zinc-400 select-none">
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Timeline Zoom Scale: <strong className="text-white font-mono">{Math.round(timelineScale * 100)}%</strong></span>
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto select-none">
                  {[0.7, 0.85, 1.0, 1.15].map((level) => (
                    <button
                      key={level}
                      onClick={() => setTimelineScale(level)}
                      className={`px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold transition duration-200 cursor-pointer ${
                        timelineScale === level
                          ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/10"
                          : "bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5"
                      }`}
                      style={{ minWidth: "46px" }}
                    >
                      {level * 100}%
                    </button>
                  ))}
                  <div className="h-4 w-[1px] bg-white/10 mx-1 hidden sm:block" />
                  <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">Drag canvas or swipe to pan timeline</span>
                </div>
              </div>

              {/* Interactive Graph Drawing Canvas Grid */}
              <div
                ref={canvasContainerRef}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUpOrLeave}
                onMouseLeave={handleCanvasMouseUpOrLeave}
                className="relative w-full overflow-x-auto overflow-y-visible border border-white/5 rounded-3xl bg-black/40 p-4 sm:p-12 min-h-[500px] select-none cursor-grab active:cursor-grabbing touch-pan-x"
              >
                {/* Main scroll wrapper sizing container */}
                <div 
                  className="flex flex-col items-center gap-16 min-w-[700px] relative transition-transform duration-300 origin-top"
                  style={{ transform: `scale(${timelineScale})`, transformOrigin: "top center" }}
                >
                  
                  {/* Dynamic Connecting SVG curves overlay in background with path tracing neon lights */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                    {allSteps.map((step, idx) => {
                      if (idx >= allSteps.length - 1) return null;
                      
                      // Identify if this curve link line is on the preview/highlight path of selected node
                      const isPrecursorLink = selectedGraphNode && idx < selectedGraphNode.idx && selectedGraphNode.type === "traversed";
                      
                      return (
                        <g key={`flow-svg-${idx}`}>
                          {/* Selected precursor path trace logic (pulsing line) */}
                          {isPrecursorLink ? (
                            <>
                              {/* Background Glow */}
                              <line
                                x1="50%"
                                y1={`${60 + idx * 105}px`}
                                x2="50%"
                                y2={`${60 + (idx + 1) * 105}px`}
                                className="stroke-cyan-500 blur-sm opacity-80"
                                strokeWidth="8"
                              />
                              {/* Glowing Dash Tracker */}
                              <motion.line
                                x1="50%"
                                y1={`${60 + idx * 105}px`}
                                x2="50%"
                                y2={`${60 + (idx + 1) * 105}px`}
                                className="stroke-cyan-400"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray="10 5"
                                animate={{ strokeDashoffset: [-20, 0] }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                              />
                            </>
                          ) : (
                            <>
                              {/* Normal Traversed thread line */}
                              <motion.line
                                x1="50%"
                                y1={`${60 + idx * 105}px`}
                                x2="50%"
                                y2={`${60 + (idx + 1) * 105}px`}
                                className={`${config.threadLine}`}
                                strokeWidth="3"
                                strokeLinecap="round"
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
                                className={`${config.threadLine} blur-sm opacity-45`}
                                strokeWidth="6"
                              />
                            </>
                          )}

                          {/* If step has multiple parallel choices, draw branching options */}
                          {step.choices && step.choices.length > 1 && (
                            step.choices.map((ch, cIdx) => {
                              if (ch.text === step.choiceTaken) return null; // skip traversed ones
                              
                              // Parallel fated timeline split routes
                              const sideX = cIdx % 2 === 0 ? "25%" : "75%";
                              
                              return (
                                <path
                                  key={`divergent-${idx}-${cIdx}`}
                                  d={`M 50% ${60 + idx * 105} C 50% ${60 + idx * 105 + 50}, ${sideX} ${60 + idx * 105 + 40}, ${sideX} ${60 + (idx + 1) * 105}`}
                                  fill="none"
                                  stroke="rgba(245, 158, 11, 0.3)" // soft gold indicators
                                  strokeWidth="2.5"
                                  strokeDasharray="4 6"
                                  className="animate-pulse"
                                />
                              );
                            })
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {/* Nodes vertical timeline generator */}
                  {allSteps.map((step, idx) => {
                    const isCurrent = idx === allSteps.length - 1;
                    const hasAlternates = step.choices && step.choices.length > 1;
                    
                    // Highlights circle if current, or if it is a precursor to a highlit inspector view
                    const isHighlightedNode = selectedGraphNode && idx <= selectedGraphNode.idx && selectedGraphNode.type === "traversed";

                    return (
                      <div key={idx} className="relative w-full flex justify-center items-center h-[40px] z-10">
                        
                        {/* LEFT FORKS (Unexplored alternatives) */}
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
                                className="bg-zinc-950/90 border border-amber-500/10 hover:border-amber-500/50 p-3 rounded-2xl text-left max-w-[170px] shadow-2xl text-[10px] space-y-1 block transition-colors group"
                              >
                                <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[8px] font-black tracking-widest leading-none">
                                  <GitBranch className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" /> ALTERNATIVE OUTCOME
                                </div>
                                <div className="opacity-75 line-clamp-2 text-white/90">"{ch.text}"</div>
                              </motion.button>
                            ))}
                          </div>
                        )}

                        {/* HIGHLY INTERACTIVE TRAVERSED CIRCLE NODE */}
                        <motion.div
                          whileHover={{ scale: 1.15 }}
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
                          {/* Circle glowing core container representing step */}
                          <div
                            className={`w-11 h-11 rounded-full border-4 flex items-center justify-center transition-all ${
                              isCurrent
                                ? config.highlightNode
                                : isHighlightedNode
                                ? "bg-black border-cyan-400 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-pulse"
                                : "bg-black border-white/20 text-white/70"
                            }`}
                          >
                            <span className="font-mono text-[10px] font-black">{idx + 1}</span>
                          </div>

                          {/* Float visual side badge */}
                          <div className="absolute left-14 whitespace-nowrap hidden sm:block pointer-events-none">
                            <p className={`text-[10px] font-black uppercase tracking-wider ${isCurrent ? "text-amber-400 font-extrabold animate-pulse" : isHighlightedNode ? "text-cyan-400" : "opacity-45 text-white"}`}>
                              {step.sceneTitle}
                            </p>
                            {step.choiceTaken && (
                              <p className="text-[7.5px] font-mono tracking-wider opacity-40 max-w-[150px] truncate">
                                👉 {step.choiceTaken}
                              </p>
                            )}
                          </div>
                        </motion.div>

                        {/* RIGHT FORKS (Unexplored alternatives) */}
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
                                className="bg-zinc-950/90 border border-amber-500/10 hover:border-amber-500/50 p-3 rounded-2xl text-left max-w-[170px] shadow-2xl text-[10px] space-y-1 block transition-colors group"
                              >
                                <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[8px] font-black tracking-widest leading-none">
                                  <GitBranch className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" /> ALTERNATIVE OUTCOME
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

              {/* Node Inspector Drawer Detail overlay inline */}
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
                            setConfirmAction({
                              title: "Rewrite History",
                              message: `Warp back and rewrite history here? All decisions from step ${idx + 2} will be pruned from this timeline.`,
                              onConfirm: () => {
                                onBranchToStep(idx);
                                setSelectedGraphNode(null);
                                triggerToast("⌛ Fate timeline adjusted back! Parallel path ready.");
                              }
                            });
                          }}
                          className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition flex items-center justify-center gap-2 ${config.accentBg}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" strokeWidth="3" /> Rewind & Replay Step Here
                        </button>
                      ) : selectedGraphNode.isUnchosenFork && (
                        <button
                          onClick={() => {
                            const rootParentIdx = selectedGraphNode.parentIndex!;
                            setConfirmAction({
                              title: "Travel Back to Splitting Junction",
                              message: `Warp back to the decision split in Scene ${rootParentIdx + 1}?\n\nThis will load that exact moment, allowing you to instantly select "${selectedGraphNode.choiceText}" and watch alternative outcomes unfold.`,
                              onConfirm: () => {
                                onBranchToStep(rootParentIdx);
                                setSelectedGraphNode(null);
                                triggerToast(`Warped! Make the split choice: "${selectedGraphNode.choiceText}"`);
                              }
                            });
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
          {/* SUBTAB VIEW 2: STATE COMPARISON WORKBENCH */}
          {/* ========================================== */}
          {mapMode === "comparison" && (
            <div className="space-y-6 text-left">
              <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[#B5F1D3]">
                  ⚖️ Path State Comparison Workbench: Contrast NPC Standing, choice-taken and story consequences between any two scenes side-by-side!
                </p>
              </div>

              {/* Selector Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/45 p-5 rounded-3xl border border-white/5">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-mono tracking-widest text-white/50 block">Anchor State A Moment</label>
                  <select
                    value={compareIdxA || 0}
                    onChange={(e) => setCompareIdxA(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white uppercase font-mono"
                  >
                    {allSteps.map((s, idx) => (
                      <option key={idx} value={idx}>
                        Scene {idx + 1}: {s.sceneTitle.slice(0, 35)}...
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase font-mono tracking-widest text-white/50 block">Anchor State B Moment</label>
                  <select
                    value={compareIdxB !== null ? compareIdxB : allSteps.length - 1}
                    onChange={(e) => setCompareIdxB(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white uppercase font-mono"
                  >
                    {allSteps.map((s, idx) => (
                      <option key={idx} value={idx}>
                        Scene {idx + 1}: {s.sceneTitle.slice(0, 35)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Side-by-Side Deck */}
              {allSteps.length > 0 && compareIdxA !== null && compareIdxB !== null && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  
                  {/* Moment A Panel */}
                  {[
                    { idx: compareIdxA, letter: "A", label: "State A" },
                    { idx: compareIdxB, letter: "B", label: "State B" },
                  ].map(({ idx, letter, label }) => {
                    const step = allSteps[idx];
                    if (!step) return null;

                    return (
                      <div key={letter} className="p-6 rounded-[2.5rem] bg-black/30 border border-white/10 space-y-4 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center pb-2.5 border-b border-white/5 mb-4">
                            <span className="text-[9px] font-mono uppercase tracking-widest px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-full font-black">
                              ⚓ Snapshot {label} (Node {idx + 1})
                            </span>
                            <span className="text-[8.5px] font-mono opacity-40">DEPTH: {idx + 1} SCENES</span>
                          </div>

                          <h5 className="font-serif font-extrabold text-[#FEE2E2] text-lg mb-1 leading-snug">{step.sceneTitle}</h5>
                          <p className="text-xs opacity-60 italic font-serif leading-relaxed line-clamp-3 mb-4">"{step.sceneDescription}"</p>

                          <div className="space-y-3.5 text-xs">
                            {/* Decision Path Taken in this node */}
                            <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                              <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block mb-0.5">Pivot Choice Registered:</span>
                              <p className="font-semibold text-white/95 leading-normal">👉 "{step.choiceTaken || "No choice taken (Introductory Scene)"}"</p>
                            </div>

                            {/* Consequences Added */}
                            <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                              <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">Impact Echoes Triggered:</span>
                              {step.newConsequences && Object.keys(step.newConsequences).length > 0 ? (
                                <ul className="space-y-1.5 pl-1.5 list-disc list-inside">
                                  {Object.entries(step.newConsequences).map(([k, d], sIdx) => (
                                    <li key={sIdx} className="text-[10px] text-zinc-300">
                                      <strong className="text-amber-400 font-mono uppercase text-[9px]">{k.replace(/_/g, " ")}: </strong>
                                      {String(d)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-[9.5px] italic opacity-40">No localized consequences logged at this specific scene node.</span>
                              )}
                            </div>

                            {/* NPC standings changed on this node */}
                            <div className="p-3 rounded-2xl bg-black/40 border border-white/5">
                              <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-widest block mb-1">Char Standings Changed:</span>
                              {step.npcUpdates && step.npcUpdates.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {step.npcUpdates.map((npc, sIdx) => {
                                    const value = typeof npc.update === "number" ? npc.update : parseInt(String(npc.update)) || 0;
                                    const isPositive = value >= 0;
                                    return (
                                      <span
                                        key={sIdx}
                                        className={`px-2 py-0.5 rounded text-[9.5px] font-mono ${
                                          isPositive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15" : "bg-red-500/10 text-red-500 border border-red-500/15"
                                        }`}
                                      >
                                        👤 {npc.name}: {isPositive ? `+${value}` : value}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[9.5px] italic opacity-40">No NPC Relationship Standing shifts inside this scene.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Teleport trigger inside comparison */}
                        <div className="pt-6">
                          <button
                            onClick={() => {
                              setConfirmAction({
                                title: "Instant Teleport Warp",
                                message: `Instant teleport step warp: teleport back to Scenario Index ${idx + 1}? Alternate branches from this moment will unfold.`,
                                onConfirm: () => {
                                  onBranchToStep(idx);
                                  triggerToast(`Fate timeline adjusted to Scene Match Index ${idx + 1}!`);
                                }
                              });
                            }}
                            className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 ${config.accentBg}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Warp Back To This Scene Index {idx + 1}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* SUBTAB VIEW 3: CROSS-CONVERGENCE COMPASS */}
          {/* ========================================== */}
          {mapMode === "convergence" && (
            <div className="space-y-6 text-left">
              <div className="p-4 rounded-2xl bg-black/20 border border-white/5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400 animate-pulse">
                  🕸️ Narrative Convergence Compass: Scan converging timelines, milestone bottleneck paths, setting overlaps, and interconnections.
                </p>
              </div>

              {/* Grid of Dynamic Portals */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* 1. Dynamic Milestone Bottlenecks Card */}
                <div className="p-5 rounded-[2rem] bg-black/30 border border-white/5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 pb-2 border-b border-white/5 mb-3">
                      <Award className="w-4 h-4 text-emerald-400" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#B5F1D3] font-black">checkpoints & locks</span>
                    </div>
                    <p className="text-[10.5px] text-zinc-400 leading-relaxed mb-4">
                      Major milestones act as narrative filters. Multiple alternative paths merge into these key unlocks:
                    </p>

                    <div className="space-y-2.5">
                      {storyMilestones.length === 0 ? (
                        <div className="text-[9.5px] italic opacity-40 py-4 text-center">No major milestones unlocked in this stream.</div>
                      ) : (
                        storyMilestones.map((mil, mI) => {
                          // Find which scene unlocked this milestone
                          const unlockingSceneIdx = allSteps.findIndex((s) => s.milestonesAchieved && s.milestonesAchieved.includes(mil));
                          
                          return (
                            <div key={mI} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex justify-between items-center text-xs">
                              <div>
                                <span className="font-mono text-[9px] uppercase font-black text-amber-400 leading-tight block">
                                  🏆 {mil.replace(/_/g, " ")}
                                </span>
                                <span className="text-[8px] opacity-40 font-mono">
                                  Merged bottleneck at Node {unlockingSceneIdx !== -1 ? unlockingSceneIdx + 1 : "???"}
                                </span>
                              </div>
                              {unlockingSceneIdx !== -1 && (
                                <button
                                  onClick={() => onBranchToStep(unlockingSceneIdx)}
                                  className="text-[8px] py-1 px-2.5 bg-zinc-900 leading-none hover:bg-zinc-800 border border-white/10 rounded font-bold uppercase"
                                >
                                  Jump
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="text-[7.5px] font-mono text-zinc-500 pt-3 border-t border-white/5 leading-normal">
                    These milestones serve as convergence bottlenecks required to trigger final epilogues.
                  </div>
                </div>

                {/* 2. Character Crossing Trails Portal */}
                <div className="p-5 rounded-[2rem] bg-black/30 border border-white/5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 pb-2 border-b border-white/5 mb-3">
                      <User className="w-4 h-4 text-sky-400" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-sky-400 font-black">Character Intersects</span>
                    </div>
                    <p className="text-[10.5px] text-zinc-400 leading-relaxed mb-4">
                      Explore convergent nodes where same characters emerge. Hover to track influence on relationships:
                    </p>

                    <div className="space-y-2.5">
                      {uniqueNpcs.length === 0 ? (
                        <div className="text-[9.5px] italic opacity-40 py-4 text-center">No active character intersection records in active session.</div>
                      ) : (
                        uniqueNpcs.map((npcName, npI) => {
                          // Collect scene indices where this NPC receives standing updates
                          const encounterNodes: number[] = [];
                          allSteps.forEach((s, sI) => {
                            if (s.npcUpdates && s.npcUpdates.some((n) => n.name === npcName)) {
                              encounterNodes.push(sI);
                            }
                          });

                          return (
                            <div key={npI} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs text-left">
                              <span className="font-black text-[9.5px] uppercase font-mono text-[#FFF2B2] block leading-none">👤 {npcName} Alliance Path</span>
                              <div className="flex flex-wrap gap-1">
                                {encounterNodes.map((sceneI) => (
                                  <button
                                    key={sceneI}
                                    onClick={() => onBranchToStep(sceneI)}
                                    className="text-[8px] py-1 px-2 rounded bg-[#0b0c10]/80 h-5 leading-none hover:bg-zinc-805 border border-white/5 font-mono text-white/80 hover:text-white"
                                  >
                                    Node {sceneI + 1}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="text-[7.5px] font-mono text-zinc-500 pt-3 border-t border-white/5 leading-normal">
                    Alliance choices at earlier intersections rewrite dialogue filters in convergence hubs.
                  </div>
                </div>

                {/* 3. Core Setting Clues Bridges */}
                <div className="p-5 rounded-[2rem] bg-black/30 border border-white/5 space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 pb-2 border-b border-white/5 mb-3">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFF2B2] font-black">cross-reference anchors</span>
                    </div>
                    <p className="text-[10.5px] text-zinc-400 leading-relaxed mb-4">
                      Settings or clues that emerge repeatedly, generating parallel references across active history paths:
                    </p>

                    <div className="space-y-2.5">
                      {[
                        { keyword: "book", title: "📜 Clackamas Ledger Archive" },
                        { keyword: "evidence", title: "💼 Criminal Case Clues" },
                        { keyword: "portal", title: "🌀 paranormal anomalies" },
                        { keyword: "romance", title: "❤️ Affection Key junctions" }
                      ].map((item, keyI) => {
                        // Find steps where description or title matches keyword
                        const matchingNodes: number[] = [];
                        allSteps.forEach((s, sI) => {
                          const containsWord = s.sceneTitle.toLowerCase().includes(item.keyword) || s.sceneDescription.toLowerCase().includes(item.keyword);
                          if (containsWord) {
                            matchingNodes.push(sI);
                          }
                        });

                        if (matchingNodes.length === 0) return null;

                        return (
                          <div key={keyI} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs text-left">
                            <span className="font-extrabold text-[9px] uppercase font-mono text-amber-400 block leading-tight">{item.title}</span>
                            <div className="flex flex-wrap gap-1">
                              {matchingNodes.map((sI) => (
                                <button
                                  key={sI}
                                  onClick={() => onBranchToStep(sI)}
                                  className="text-[8px] py-1 px-1.5 bg-[#0b0c10]/40 rounded border border-white/5 text-zinc-400 hover:text-white"
                                >
                                  Node {sI + 1}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-[7.5px] font-mono text-zinc-500 pt-3 border-t border-white/5 leading-normal">
                    Hover nodes to track shared relics, items, and settings cross-references.
                  </div>
                </div>

              </div>
            </div>
          )}

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
                              setConfirmAction({
                                title: "Warp and Branch Timeline",
                                message: `Warp Back and branch timeline here?\n\nThis will return you back to step ${originalIndex + 1}. Future steps up to step ${allSteps.length} will be pruned in your active universe, letting you decide differently.`,
                                onConfirm: () => {
                                  onBranchToStep(originalIndex);
                                  triggerToast("⌛ Warp complete! Timeline adjusted back.");
                                }
                              });
                            }}
                            className={`py-1.5 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition ${config.accentBg}`}
                          >
                            <RotateCcw className="w-3 h-3" strokeWidth="2.5" /> Warp Fate Here
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
                  <Bookmark className="w-4 h-4 text-amber-400 animate-pulse" /> Micro Save Bookmarks ({filteredBookmarks.length})
                </h4>
                <p className="text-[9px] font-mono text-zinc-500">Refine, tag & commentary logs</p>
              </div>

              {/* Bookmark search and filtering controls */}
              <div className="space-y-2 bg-black/10 p-3.5 rounded-2xl border border-white/5">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search bookmarks, tags, or comments..."
                    value={bookmarkSearch}
                    onChange={(e) => setBookmarkSearch(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-xl py-2 pl-8 pr-3 text-[10px] text-white placeholder:text-white/30 outline-none focus:border-white/15 transition-colors"
                  />
                  {bookmarkSearch && (
                    <button onClick={() => setBookmarkSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-[9px] font-mono">
                      clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {["all", "Major Pivot", "Romantic Encounter", "Critical Danger", "Lore Discovery", "Reflection"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setBookmarkFilterCategory(cat)}
                      className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-wider transition ${
                        bookmarkFilterCategory === cat
                          ? "bg-amber-400 text-black font-extrabold"
                          : "bg-white/5 text-zinc-400 hover:bg-white/10"
                      }`}
                    >
                      {cat === "all" ? "All" : cat.replace(" Encounter", "").replace(" Discovery", "")}
                    </button>
                  ))}
                </div>
              </div>

              {filteredBookmarks.length === 0 ? (
                <div className="py-12 text-center bg-black/10 border border-dashed border-white/5 rounded-2xl opacity-40">
                  <Bookmark className="w-8 h-8 mx-auto opacity-30 mb-2 animate-bounce" />
                  <p className="text-[9.5px] font-mono uppercase tracking-widest">No matching bookmarks</p>
                  <p className="text-[8px] opacity-70 leading-normal max-w-[180px] mx-auto mt-1">Adjust filters or visit "Chrono Chronicles" tab to bookmark a new step.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {filteredBookmarks.map((bookmark) => {
                    const isEditing = editingBookmarkId === bookmark.id;
                    
                    // Categorization styling resolver
                    let catColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    if (bookmark.category === "Romantic Encounter") catColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                    if (bookmark.category === "Critical Danger") catColor = "bg-red-500/10 text-red-400 border-red-500/20";
                    if (bookmark.category === "Lore Discovery") catColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                    if (bookmark.category === "Reflection") catColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";

                    if (isEditing) {
                      return (
                        <div
                          key={bookmark.id}
                          className="p-5 rounded-2xl border border-amber-500/30 bg-black/50 space-y-3.5 text-left"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-mono uppercase tracking-widest text-amber-400">Editing Bookmark</span>
                            <span className="text-[8px] font-mono opacity-40">Node {bookmark.stepIndex + 1}</span>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8.5px] uppercase font-mono block opacity-60">Bookmark Name</label>
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8.5px] uppercase font-mono block opacity-60">Category</label>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                            >
                              <option value="Major Pivot">Major Pivot ⚡</option>
                              <option value="Romantic Encounter">Romantic Encounter ❤️</option>
                              <option value="Critical Danger">Critical Danger ⚠️</option>
                              <option value="Lore Discovery">Lore Discovery 📖</option>
                              <option value="Reflection">Reflection 💭</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8.5px] uppercase font-mono block opacity-60">Tags (comma-separated)</label>
                            <input
                              type="text"
                              value={editTags}
                              onChange={(e) => setEditTags(e.target.value)}
                              placeholder="e.g. clue, evidence"
                              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[8.5px] uppercase font-mono block opacity-60">Comments & Commentary</label>
                            <textarea
                              value={editComment}
                              onChange={(e) => setEditComment(e.target.value)}
                              rows={2}
                              className="w-full bg-zinc-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                            />
                          </div>

                          <div className="flex gap-2 pt-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingBookmarkId(null); }}
                              className="flex-1 py-2 text-[9px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white mr-1"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={(e) => handleSaveEditBookmark(bookmark.id, e)}
                              className="flex-1 py-2 text-[9px] font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 rounded-xl text-black"
                            >
                              Save Details
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={bookmark.id}
                        onClick={() => handleRestoreState(bookmark as any)}
                        className={`p-5 rounded-3xl border bg-black/45 hover:-translate-y-1 transition duration-300 cursor-pointer text-left relative overflow-hidden group ${
                          genre === "romance" ? "border-rose-100 hover:border-rose-400" : "border-white/5 hover:border-amber-400/20"
                        }`}
                      >
                        {/* Shimmer overlay on hover */}
                        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex justify-between items-start gap-4 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[8px] uppercase font-mono tracking-widest text-zinc-400 py-0.5 px-2 bg-white/5 rounded-full border border-white/5">
                              Node {bookmark.stepIndex + 1}
                            </span>
                            <span className={`text-[8px] uppercase font-mono tracking-widest py-0.5 px-2 rounded-full border ${catColor}`}>
                              {bookmark.category || "Major Pivot"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleStartEditBookmark(bookmark, e)}
                              className="text-zinc-400 hover:text-white text-[9.5px] font-mono tracking-wider"
                              title="Edit metadata & commentaries"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => handleDeleteBookmark(bookmark.id, e)}
                              className="text-red-400/80 hover:text-red-400 text-[9.5px] font-mono tracking-wider font-bold"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Title Quote */}
                        <div className="space-y-1 mt-3">
                          <h5 className="font-serif font-extrabold text-[#FEE2E2] italic text-base leading-tight">
                            "{bookmark.playerNote}"
                          </h5>
                          <p className="text-[9.5px] opacity-50 block leading-tight">
                            At scene: <strong className="text-white/80">{bookmark.sceneTitle}</strong>
                          </p>
                        </div>

                        {/* Custom Comments Quote Block if set */}
                        {bookmark.playerComment && (
                          <div className="mt-3 p-3 rounded-2xl bg-black/55 border border-white/5 text-left text-xs text-zinc-300 font-sans italic relative">
                            <span className="text-[8px] font-mono text-amber-400/70 uppercase tracking-widest block mb-0.5">Player Commentary:</span>
                            "{bookmark.playerComment}"
                          </div>
                        )}

                        {/* Tags list display inline if defined */}
                        {bookmark.tags && bookmark.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {bookmark.tags.map((tg, idx) => (
                              <span key={idx} className="text-[8.5px] font-mono text-amber-500/80 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                                #{tg}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-between items-center py-2 mt-4 border-t border-white/5 text-[9px] font-mono text-white/40">
                          <span>Timeline Depth: {bookmark.stepsSnapshot?.length || 0} Steps</span>
                          <span className={`font-black uppercase flex items-center gap-1 group-hover:text-amber-400 transition-colors ${config.accentText}`}>
                            Travel Here <Download className="w-3 h-3 group-hover:animate-bounce" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
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
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/80 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`w-full max-w-lg p-6 md:p-8 rounded-[2.5rem] border shadow-2xl space-y-4 my-8 ${
                genre === "romance" ? "bg-[#FAF5F5] text-rose-950 border-rose-200" : "bg-zinc-950 text-white border-white/10"
              }`}
            >
              <h4 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-yellow-500 animate-bounce" /> Bookmark Story Moment
              </h4>
              <p className="text-xs opacity-60 leading-relaxed font-serif">
                Anchor this specific moment in details with custom classification. You will be able to search, organize, and edit comments on this entry.
              </p>

              {/* Bookmark Title / Note Input */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-mono uppercase tracking-wider block opacity-75">Bookmark Name / Quick Note</label>
                <input
                  type="text"
                  placeholder="e.g. My Favorite Romantic Twist / Critical Clue Spotted"
                  value={namingBookmarkNote}
                  onChange={(e) => setNamingBookmarkNote(e.target.value)}
                  className={`w-full p-3 rounded-xl border bg-transparent text-xs outline-none focus:ring-2 ${
                    genre === "romance"
                      ? "border-rose-200 text-rose-950 focus:border-rose-400 focus:ring-rose-200"
                      : "border-white/10 text-white focus:border-sky-400 focus:ring-sky-500/10"
                  }`}
                />
              </div>

              {/* Category Selector Grid */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-mono uppercase tracking-wider block opacity-75">Category Tag</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Major Pivot", "Romantic Encounter", "Critical Danger", "Lore Discovery", "Reflection"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNamingBookmarkCategory(cat)}
                      className={`py-2 px-3 rounded-xl text-[10px] font-bold border transition ${
                        namingBookmarkCategory === cat
                          ? "bg-amber-500 border-amber-400 text-black fill-black"
                          : genre === "romance"
                          ? "border-rose-100 text-rose-900 bg-rose-50/50 hover:bg-rose-50"
                          : "border-white/5 text-zinc-400 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      {cat === "Major Pivot" && "⚡ "}
                      {cat === "Romantic Encounter" && "❤️ "}
                      {cat === "Critical Danger" && "⚠️ "}
                      {cat === "Lore Discovery" && "📖 "}
                      {cat === "Reflection" && "💭 "}
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Classifying Tags Input */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-mono uppercase tracking-wider block opacity-75">Classification Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. key-clue, eve-choice, clackamas, secret"
                  value={namingBookmarkTags}
                  onChange={(e) => setNamingBookmarkTags(e.target.value)}
                  className={`w-full p-3 rounded-xl border bg-transparent text-xs outline-none focus:ring-2 ${
                    genre === "romance"
                      ? "border-rose-200 text-rose-950 focus:border-rose-400 focus:ring-rose-200"
                      : "border-white/10 text-white focus:border-sky-400 focus:ring-sky-500/10"
                  }`}
                />
              </div>

              {/* Detailed Player Comments Textarea */}
              <div className="space-y-1 text-left">
                <label className="text-[10px] font-mono uppercase tracking-wider block opacity-75">Player Commentary / Extra Analysis</label>
                <textarea
                  placeholder="Write a private markdown thought or log detail. This can be edited and refined anytime..."
                  value={namingBookmarkComment}
                  onChange={(e) => setNamingBookmarkComment(e.target.value)}
                  rows={3}
                  className={`w-full p-3 rounded-xl border bg-transparent text-xs outline-none focus:ring-2 ${
                    genre === "romance"
                      ? "border-rose-200 text-rose-950 focus:border-rose-400 focus:ring-rose-200"
                      : "border-white/10 text-white focus:border-sky-400 focus:ring-sky-500/10"
                  }`}
                />
              </div>

              <div className="flex gap-3 pt-2">
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

      {/* ========================================== */}
      {/* DIALOG 3: CUSTOM CONFIRMATION OVERLAY (IMMERSIVE MULTI-STAGE) */}
      {/* ========================================== */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/85">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className={`w-full max-w-md p-6 md:p-8 rounded-[2.5rem] border shadow-2xl relative ${
                genre === "romance" ? "bg-[#FAF5F5] text-rose-950 border-rose-200" : "bg-zinc-950 text-white border-white/10"
              }`}
            >
              <button
                onClick={() => setConfirmAction(null)}
                className="absolute top-6 right-6 p-2 rounded-full border border-current/10 hover:bg-current/10 transition flex items-center justify-center cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-4 mt-2">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                  <AlertCircle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-[9px] font-mono uppercase tracking-[0.1em] text-zinc-500">Timeline Decision Link</h4>
                  <h3 className="text-md font-black leading-tight uppercase tracking-wider">{confirmAction.title}</h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 mb-6 text-xs leading-relaxed text-zinc-300">
                <p className="font-serif italic whitespace-pre-wrap">{confirmAction.message}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className={`flex-1 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    genre === "romance" ? "border-rose-100 text-rose-800 hover:bg-rose-50" : "border-white/10 text-zinc-300 hover:text-white"
                  }`}
                >
                  Abort Warp
                </button>
                <button
                  onClick={() => {
                    confirmAction.onConfirm();
                    setConfirmAction(null);
                  }}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${config.accentBg} flex items-center justify-center gap-1.5`}
                >
                  <Zap className="w-3.5 h-3.5 text-black" /> Confirm Decision
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
