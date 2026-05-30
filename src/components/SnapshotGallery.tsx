import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  Image as ImageIcon, 
  Download, 
  Copy, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Compass, 
  Calendar,
  Grid,
  Info,
  Maximize2
} from "lucide-react";

interface Snapshot {
  id: string;
  sceneTitle: string;
  sceneDescription: string;
  imageUrl: string;
  imagePrompt?: string;
  mood?: string;
  intensity?: number;
}

interface SnapshotGalleryProps {
  currentStoryId: string;
  storyTitle: string;
  genre: string | null;
  snapshots: Snapshot[];
  onClose: () => void;
  triggerNotification?: (msg: string, title?: string, type?: "success" | "error" | "info") => void;
  onJumpToScene?: (sceneTitle: string) => void;
}

export function SnapshotGallery({
  currentStoryId,
  storyTitle,
  genre,
  snapshots,
  onClose,
  triggerNotification,
  onJumpToScene
}: SnapshotGalleryProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMoodFilter, setActiveMoodFilter] = useState<string | null>(null);

  // Extract all unique moods from snapshots
  const moods = Array.from(new Set(snapshots.map((s) => s.mood).filter(Boolean))) as string[];

  // Filter snapshots based on search query and active mood filter
  const filteredSnapshots = snapshots.filter((s, idx) => {
    const titleMatch = s.sceneTitle.toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = s.sceneDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const promptMatch = (s.imagePrompt || "").toLowerCase().includes(searchQuery.toLowerCase());
    const indexMatch = `chronicle #${idx + 1}`.includes(searchQuery.toLowerCase());
    
    const matchesSearch = titleMatch || descMatch || promptMatch || indexMatch;
    const matchesMood = !activeMoodFilter || s.mood === activeMoodFilter;
    
    return matchesSearch && matchesMood;
  });

  const handleCopyLink = async (e: React.MouseEvent, url: string, idx: number) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIdx(idx);
      if (triggerNotification) {
        triggerNotification("Direct snapshot URL copied to clipboard!", "Link Copied", "success");
      }
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch (err) {
      console.error("Failed to copy image link:", err);
    }
  };

  const handleDownload = async (e: React.MouseEvent, url: string, filename: string) => {
    e.stopPropagation();
    try {
      // In web app, we can fetch public image or trigger a blank target download
      const target = window.open(url, "_blank");
      if (target) {
        if (triggerNotification) {
          triggerNotification("Snapshot opened in new tab for high-res save.", "Image Export", "success");
        }
      } else {
        // Fallback copy url
        await navigator.clipboard.writeText(url);
        if (triggerNotification) {
          triggerNotification("Popup blocker active. Image link copied to clipboard instead!", "Blocked / Copied", "info");
        }
      }
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleNext = () => {
    if (selectedIdx === null || filteredSnapshots.length === 0) return;
    setSelectedIdx((selectedIdx + 1) % filteredSnapshots.length);
  };

  const handlePrev = () => {
    if (selectedIdx === null || filteredSnapshots.length === 0) return;
    setSelectedIdx((selectedIdx - 1 + filteredSnapshots.length) % filteredSnapshots.length);
  };

  // Keyboard Navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIdx === null) return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") setSelectedIdx(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIdx, filteredSnapshots]);

  const isRomance = genre === "romance";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8 backdrop-blur-2xl bg-black/85">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", duration: 0.5 }}
        className={`w-full max-w-6xl h-[85vh] md:h-[90vh] flex flex-col rounded-[2.5rem] border shadow-2xl overflow-hidden relative ${
          isRomance 
            ? "bg-[#FAF5F5] text-rose-950 border-rose-200" 
            : "bg-[#090C16] text-white border-white/10"
        }`}
      >
        {/* Header bar */}
        <div className={`p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b shrink-0 ${
          isRomance ? "border-rose-100/50 bg-[#FFF9F9]" : "border-white/5 bg-black/20"
        }`}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`px-2.5 py-0.5 text-[9px] font-mono font-black uppercase rounded-full ${
                isRomance ? "bg-rose-100 text-rose-700" : "bg-amber-500/10 text-amber-400"
              }`}>
                Memory Vault
              </span>
              <span className="text-[10px] font-mono opacity-40">
                {snapshots.length} Snapshot{snapshots.length !== 1 ? "s" : ""} Woven
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              {storyTitle || "Uncharted Narrative"}
            </h3>
            <p className="text-xs opacity-60">
              Visual snapshots and scene realities compiled across this timeline.
            </p>
          </div>

          <button
            onClick={onClose}
            className={`absolute top-6 right-6 p-2 rounded-full border transition-all cursor-pointer flex items-center justify-center ${
              isRomance 
                ? "border-rose-200 text-rose-800 hover:bg-rose-50" 
                : "border-white/10 text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
            title="Return to Library"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Filter Panel */}
        <div className={`px-6 md:px-8 py-4 border-b flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0 ${
          isRomance ? "border-rose-100/50" : "border-white/5"
        }`}>
          {/* Search bar inside snapshots */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none opacity-40">
              <Compass className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Filter by title, keywords, index (e.g. chronicle #3)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-8 py-2 text-xs rounded-xl transition-all outline-none border ${
                isRomance
                  ? "bg-white border-rose-200 focus:border-rose-400 text-rose-900"
                  : "bg-white/5 border-white/10 focus:border-white/20 text-white"
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>

          {/* Mood Filters */}
          {moods.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
              <span className="text-[9px] uppercase font-mono font-black tracking-wider opacity-40 mr-1.5 shrink-0">
                Moods:
              </span>
              <button
                onClick={() => setActiveMoodFilter(null)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider font-extrabold transition-all border shrink-0 ${
                  activeMoodFilter === null
                    ? isRomance
                      ? "bg-rose-100 border-rose-200 text-rose-800"
                      : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : `bg-transparent border-transparent opacity-50 hover:opacity-100 ${isRomance ? "text-rose-950" : "text-white"}`
                }`}
              >
                All
              </button>
              {moods.map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveMoodFilter(m === activeMoodFilter ? null : m)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-mono uppercase tracking-wider font-extrabold transition-all border shrink-0 ${
                    activeMoodFilter === m
                      ? isRomance
                        ? "bg-rose-100 border-rose-200 text-rose-800"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      : `bg-transparent border-transparent opacity-50 hover:opacity-100 ${isRomance ? "text-rose-950" : "text-white"}`
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Core Gallery View */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          {snapshots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4 py-16 text-center">
              <ImageIcon className="w-16 h-16 animate-pulse text-gray-400" />
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-[0.2em]">
                  No Image Snapshots Generated Yet
                </p>
                <p className="text-xs max-w-sm leading-relaxed mx-auto text-gray-400 font-light">
                  Continue weaving the story in the primary pane to invoke AI landscape illustrations of decisions.
                </p>
              </div>
            </div>
          ) : filteredSnapshots.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40 gap-4 py-16 text-center">
              <Grid className="w-12 h-12 text-gray-500" />
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-[0.3em]">
                  No Match Found
                </p>
                <p className="text-[10px] text-gray-400">
                  Try clearing search tags or resetting mood filters
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              {filteredSnapshots.map((snap, fIdx) => {
                // Find actual global index in full snapshots array
                const globalIdx = snapshots.findIndex((s) => s.id === snap.id);
                const displayIndex = globalIdx !== -1 ? globalIdx + 1 : fIdx + 1;

                return (
                  <motion.div
                    key={snap.id}
                    layoutId={`snap-card-${snap.id}`}
                    className={`group relative rounded-3xl border overflow-hidden flex flex-col transition-all cursor-pointer ${
                      isRomance
                        ? "bg-white border-rose-100 hover:shadow-rose-100/40 hover:shadow-lg"
                        : "bg-black/40 border-white/5 hover:border-white/10 hover:shadow-black hover:shadow-2xl"
                    }`}
                    onClick={() => setSelectedIdx(fIdx)}
                  >
                    {/* Aspects visual container */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-900 border-b border-black">
                      <img
                        src={snap.imageUrl}
                        alt={snap.sceneTitle}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />

                      {/* Top floating tags */}
                      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
                        <span className="px-2.5 py-1 text-[8px] font-mono font-black uppercase bg-black/60 backdrop-blur-md rounded-full text-white/90">
                          Chronicle #{displayIndex}
                        </span>
                        {snap.mood && (
                          <span className={`px-2 py-0.5 text-[8px] font-mono font-black uppercase rounded-full text-white ${
                            snap.mood === "mystery" || snap.mood === "dark" 
                              ? "bg-purple-950/80 border border-purple-500/30" 
                              : snap.mood === "romance" || snap.mood === "warm" 
                                ? "bg-rose-950/80 border border-rose-500/30" 
                                : "bg-slate-900/80 border border-amber-500/30"
                          }`}>
                            {snap.mood}
                          </span>
                        )}
                      </div>

                      {/* Hover action bar overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIdx(fIdx);
                          }}
                          className="p-3 bg-white text-slate-950 rounded-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
                          title="Zoom Insight"
                        >
                          <Maximize2 className="w-4 h-4 text-black font-bold" />
                        </button>
                        <button
                          onClick={(e) => handleCopyLink(e, snap.imageUrl, fIdx)}
                          className={`p-3 rounded-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center bg-zinc-900/90 text-white hover:text-amber-400 border border-white/10`}
                          title="Copy Link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDownload(e, snap.imageUrl, `snapshot-${displayIndex}`)}
                          className={`p-3 rounded-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center bg-zinc-900/90 text-white hover:text-emerald-400 border border-white/10`}
                          title="Export High-Res Image"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Brief description footer */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-black uppercase tracking-wider truncate">
                          {snap.sceneTitle}
                        </h4>
                        <p className={`text-[11px] leading-relaxed line-clamp-2 ${isRomance ? "text-rose-900/60" : "text-zinc-400"}`}>
                          {snap.sceneDescription}
                        </p>
                      </div>

                      {snap.imagePrompt && (
                        <div className="mt-4 pt-3 border-t border-current/5">
                          <p className={`text-[9px] font-mono font-medium line-clamp-1 italic ${isRomance ? "text-rose-900/40" : "text-zinc-500"}`}>
                            🧪 Pro: {snap.imagePrompt}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Interactive Lightbox Layer (AnimatePresence) */}
        <AnimatePresence>
          {selectedIdx !== null && filteredSnapshots[selectedIdx] && (() => {
            const currentImg = filteredSnapshots[selectedIdx];
            const globalIndexRef = snapshots.findIndex((s) => s.id === currentImg.id);
            const globalDisplayIndex = globalIndexRef !== -1 ? globalIndexRef + 1 : selectedIdx + 1;

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[300] bg-black/95 flex flex-col justify-between p-4 sm:p-6"
              >
                {/* Lightbox header bar */}
                <div className="flex justify-between items-center px-4 py-2 z-10">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-mono tracking-widest uppercase text-white font-bold">
                      Chronicle Snapshot #{globalDisplayIndex}
                    </span>
                    {currentImg.mood && (
                      <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/20 rounded text-[9px] font-mono uppercase tracking-wider">
                        {currentImg.mood}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleCopyLink(e, currentImg.imageUrl, selectedIdx)}
                      className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-white transition-all cursor-pointer flex items-center justify-center text-xs gap-1.5 font-bold"
                    >
                      <Copy className="w-4 h-4" /> <span className="hidden sm:inline">Copy Link</span>
                    </button>

                    <button
                      onClick={(e) => handleDownload(e, currentImg.imageUrl, `snapshot-${globalDisplayIndex}`)}
                      className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-white transition-all cursor-pointer flex items-center justify-center text-xs gap-1.5 font-bold"
                    >
                      <Download className="w-4 h-4" /> <span className="hidden sm:inline">Open Frame</span>
                    </button>

                    <button
                      onClick={() => setSelectedIdx(null)}
                      className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-all cursor-pointer flex items-center justify-center"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Lightbox responsive main viewport */}
                <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 max-h-[75vh] sm:max-h-[80vh] px-4">
                  {/* Left arrow trigger */}
                  <div className="hidden lg:block shrink-0">
                    <button
                      onClick={handlePrev}
                      className="p-4 bg-white/5 hover:bg-white/10 text-white rounded-full transition cursor-pointer flex items-center justify-center border border-white/10"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Image Display Frame */}
                  <div className="relative max-w-full max-h-[40vh] sm:max-h-[50vh] lg:max-h-full flex-1 flex items-center justify-center">
                    <img
                      src={currentImg.imageUrl}
                      alt={currentImg.sceneTitle}
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-[35vh] sm:max-h-[45vh] lg:max-h-[70vh] rounded-3xl object-contain shadow-2xl border border-white/5"
                    />
                  </div>

                  {/* Narrative details frame */}
                  <div className="w-full lg:w-[400px] flex flex-col p-6 rounded-3xl bg-zinc-900 border border-white/5 text-left max-h-[35vh] sm:max-h-[40vh] lg:max-h-[70vh] overflow-y-auto">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[10px] font-mono uppercase tracking-[0.15em] text-amber-500">
                          Scene Link Title
                        </h4>
                        <h3 className="text-lg font-black leading-tight tracking-tight text-white uppercase sm:text-xl">
                          {currentImg.sceneTitle}
                        </h3>
                      </div>

                      <div className="text-xs leading-relaxed text-zinc-300 font-serif italic whitespace-pre-wrap">
                        {currentImg.sceneDescription}
                      </div>

                      {currentImg.imagePrompt && (
                        <div className="p-3.5 bg-white/[0.02] rounded-2xl border border-white/5 text-[10px] font-mono leading-relaxed text-zinc-400">
                          <span className="text-amber-500 font-bold block mb-1">
                            🎨 AI Generator Prompt:
                          </span>
                          {currentImg.imagePrompt}
                        </div>
                      )}

                      {onJumpToScene && (
                        <button
                          onClick={() => {
                            onJumpToScene(currentImg.sceneTitle);
                            setSelectedIdx(null);
                            onClose();
                            if (triggerNotification) {
                              triggerNotification(`Shifted focus back to Scene: ${currentImg.sceneTitle}!`, "Timeline Warp", "success");
                            }
                          }}
                          className="w-full py-3.5 bg-amber-500 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-slate-950 animate-bounce" /> Focus/Warp to Scene
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right arrow trigger */}
                  <div className="hidden lg:block shrink-0">
                    <button
                      onClick={handleNext}
                      className="p-4 bg-white/5 hover:bg-white/10 text-white rounded-full transition cursor-pointer flex items-center justify-center border border-white/10"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Lightbox footer & mobile pagination row */}
                <div className="py-2 flex flex-col items-center justify-center gap-4 z-10 shrink-0">
                  <div className="flex lg:hidden items-center justify-center gap-6">
                    <button
                      onClick={handlePrev}
                      className="p-3 bg-white/5 border border-white/10 text-white rounded-full transition cursor-pointer flex items-center justify-center"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-xs font-mono text-zinc-400 selection:bg-transparent">
                      {selectedIdx + 1} / {filteredSnapshots.length}
                    </span>
                    <button
                      onClick={handleNext}
                      className="p-3 bg-white/5 border border-white/10 text-white rounded-full transition cursor-pointer flex items-center justify-center"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500 text-center select-none hidden lg:block">
                    Use LEFT and RIGHT arrow keys to navigate snapshots • ESC to exit
                  </p>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
