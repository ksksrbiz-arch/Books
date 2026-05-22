import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Sliders, Zap, Eye, Check, ShieldAlert, Wifi, Info } from "lucide-react";

interface EnhancedImageContainerProps {
  imageUrl: string | null;
  genre: "romance" | "crime" | "paranormal" | null;
  mood: string | undefined;
  alt?: string;
  showImages?: boolean;
}

// Global in-memory image cache to avoid repeated network downloads during rewinds
const globalImageMemoryCache = new Map<string, string>();

export function EnhancedImageContainer({
  imageUrl,
  genre,
  mood,
  alt = "Scene Illustration",
  showImages = true,
}: EnhancedImageContainerProps) {
  // Quality state: '2k' | '1k' | 'lite'
  const [resolutionSetting, setResolutionSetting] = useState<"2k" | "1k" | "lite">(() => {
    try {
      const saved = localStorage.getItem("setting_img_res");
      if (saved === "2k" || saved === "1k" || saved === "lite") return saved;
    } catch (e) {}
    return "1k";
  });

  // Current selected creative filter: 'cinematic' | 'gothic' | 'vintage' | 'vivid' | 'raw'
  const [activeFilter, setActiveFilter] = useState<"cinematic" | "gothic" | "vintage" | "vivid" | "raw">(() => {
    try {
      const saved = localStorage.getItem("setting_img_filter");
      if (saved === "cinematic" || saved === "gothic" || saved === "vintage" || saved === "vivid" || saved === "raw") return saved;
    } catch (e) {}
    // default based on genre
    if (genre === "romance") return "vintage";
    if (genre === "crime") return "gothic";
    if (genre === "paranormal") return "cinematic";
    return "raw";
  });

  // HUD and state tracking
  const [imgLoaded, setImgLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [loadDuration, setLoadDuration] = useState<number | null>(null);
  const [cacheStatus, setCacheStatus] = useState<"MISS" | "HIT">("MISS");
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [autoAdapted, setAutoAdapted] = useState(false);
  
  const loadStartTime = useRef<number>(0);
  const prevImageUrl = useRef<string | null>(null);

  // Connection/Latency benchmark to support adaptive technology
  const benchmarkLatency = (duration: number) => {
    // If the image took > 2.5s to load and is on 2k or 1k, auto degrade for a more fluid experience
    if (duration > 2500 && resolutionSetting !== "lite") {
      setResolutionSetting("lite");
      setAutoAdapted(true);
      try {
        localStorage.setItem("setting_img_res", "lite");
      } catch (e) {}
    } else if (duration < 600 && autoAdapted && resolutionSetting === "lite") {
      // If it loaded extremely fast and we auto adapted earlier, upscale slightly
      setResolutionSetting("1k");
      setAutoAdapted(false);
      try {
        localStorage.setItem("setting_img_res", "1k");
      } catch (e) {}
    }
  };

  // Persist selections
  const changeResolution = (res: "2k" | "1k" | "lite") => {
    setResolutionSetting(res);
    setAutoAdapted(false);
    try {
      localStorage.setItem("setting_img_res", res);
    } catch (e) {}
  };

  const changeFilter = (f: "cinematic" | "gothic" | "vintage" | "vivid" | "raw") => {
    setActiveFilter(f);
    try {
      localStorage.setItem("setting_img_filter", f);
    } catch (e) {}
  };

  useEffect(() => {
    if (!imageUrl) {
      setCurrentSrc(null);
      setImgLoaded(false);
      return;
    }

    // Determine targeted resolution URL transformation
    // Note: If using unsplash or base64 data, we can apply size query parameters to unsplash images
    let finalUrl = imageUrl;
    if (imageUrl.includes("unsplash.com")) {
      const sizeParam = 
        resolutionSetting === "2k" 
          ? "&w=2000&q=90" 
          : resolutionSetting === "lite"
            ? "&w=600&q=50"
            : "&w=1200&q=75";
      // Clean previous parameters and append new ones
      finalUrl = imageUrl.split("?")[0] + "?auto=format&fit=crop" + sizeParam;
    }

    // Check memory cache
    if (globalImageMemoryCache.has(finalUrl)) {
      setCacheStatus("HIT");
      setLoadDuration(0);
      setCurrentSrc(globalImageMemoryCache.get(finalUrl)!);
      setImgLoaded(true);
      prevImageUrl.current = imageUrl;
      return;
    }

    // Start priority load tracking
    setCacheStatus("MISS");
    setImgLoaded(false);
    loadStartTime.current = performance.now();

    const img = new Image();
    img.src = finalUrl;
    img.referrerPolicy = "no-referrer";
    
    img.onload = () => {
      const endTime = performance.now();
      const elapsed = Math.round(endTime - loadStartTime.current);
      setLoadDuration(elapsed);
      benchmarkLatency(elapsed);
      
      // Store in global memory cache
      globalImageMemoryCache.set(finalUrl, finalUrl);
      
      setCurrentSrc(finalUrl);
      setImgLoaded(true);
      prevImageUrl.current = imageUrl;
    };

    img.onerror = () => {
      // If higher resolution fails, fallback to standard or lite
      if (resolutionSetting !== "lite") {
        console.warn("High fidelity fetch failed; adapting down and retrying");
        const fallbackUrl = imageUrl.includes("unsplash.com") 
          ? imageUrl.split("?")[0] + "?auto=format&fit=crop&w=800&q=60"
          : imageUrl;
        setCurrentSrc(fallbackUrl);
        setImgLoaded(true);
      } else {
        setCurrentSrc(imageUrl);
        setImgLoaded(true);
      }
    };
  }, [imageUrl, resolutionSetting]);

  // Abstract Canvas/CSS Backdrop matching Genre & Mood
  const getThematicPlaceholder = () => {
    switch (genre) {
      case "romance":
        return "bg-gradient-to-tr from-rose-200 via-pink-100 to-amber-100 animate-pulse duration-[4s]";
      case "crime":
        return "bg-gradient-to-br from-zinc-950 via-slate-900 to-zinc-900 animate-pulse duration-[4s]";
      case "paranormal":
        return "bg-gradient-to-tr from-[#11051c] via-[#240a3d] to-[#0A0518] animate-pulse duration-[4s]";
      default:
        return "bg-gradient-to-r from-zinc-900 to-stone-900 animate-pulse";
    }
  };

  // CSS Filter class matching filter preferences
  const getFilterCSS = () => {
    switch (activeFilter) {
      case "cinematic":
        return "contrast-[110%] saturate-[110%] brightness-[95%] shadow-[inset_0_0_100px_rgba(0,0,0,0.6)] sepia-[5%] hue-rotate-[-3deg]";
      case "gothic":
        return "contrast-[135%] saturate-[45%] brightness-[85%] sepia-[10%] hue-rotate-[15deg] shadow-[inset_0_0_130px_rgba(0,0,0,0.95)]";
      case "vintage":
        return "sepia-[25%] contrast-[95%] saturate-[95%] brightness-[100%] hue-rotate-[5deg] blur-[0.2px]";
      case "vivid":
        return "contrast-[115%] saturate-[140%] brightness-[105%] drop-shadow-md";
      case "raw":
      default:
        return "contrast-100 saturate-100 brightness-100";
    }
  };

  // Aesthetic overlay gradient
  const getVignetteOverlay = () => {
    switch (genre) {
      case "romance":
        return "bg-gradient-to-t from-rose-950/20 via-transparent to-rose-950/10 mix-blend-multiply";
      case "crime":
        return "bg-gradient-to-t from-black/80 via-black/20 to-black/30 mix-blend-multiply";
      case "paranormal":
        return "bg-gradient-to-t from-purple-950/40 via-transparent to-black/30 mix-blend-color-burn";
      default:
        return "bg-gradient-to-t from-black/50 via-transparent to-black/20";
    }
  };

  if (!showImages) return null;

  return (
    <div className="relative w-full h-full select-none overflow-hidden group/img-panel">
      {/* 1. Dynamic placeholder background loaded prior to high-res image resolution */}
      <div className={`absolute inset-0 w-full h-full ${getThematicPlaceholder()}`} />

      {/* 2. Visual Content Layer */}
      <AnimatePresence mode="wait">
        {imgLoaded && currentSrc ? (
          <motion.div
            key={currentSrc}
            initial={{ opacity: 0, scale: 1.02, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full"
          >
            <img
              src={currentSrc}
              className={`w-full h-full object-cover transition-all duration-700 ${getFilterCSS()}`}
              alt={alt}
              referrerPolicy="no-referrer"
            />
            {/* Ambient genre vignette filter */}
            <div className={`absolute inset-0 pointer-events-none ${getVignetteOverlay()}`} />
          </motion.div>
        ) : (
          <motion.div
            key="image-stream-processor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-sm"
          >
            <div className="text-center font-mono text-[9px] uppercase tracking-widest opacity-45 flex items-center gap-2">
              <Sparkles className="w-3 h-3 animate-spin duration-[4s]" /> Core Priority Stream Processing...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quota Fallback Informative Banner */}
      {imageUrl?.includes("picsum.photos") && (
        <div className="absolute bottom-4 right-4 z-40 max-w-[280px] bg-amber-500/10 bg-black/60 backdrop-blur-md border border-amber-500/20 text-amber-200 p-2.5 rounded-xl text-[9px] font-sans flex items-start gap-2 shadow-lg">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <span className="font-bold uppercase tracking-wider block text-amber-300">Image Quota Standby</span>
            <span className="opacity-80 leading-normal block text-xs">
              Gemini free-tier request limit reached. Displaying stable aesthetic placeholder art instead of failing. Use settings to update credentials for limitless imagery.
            </span>
          </div>
        </div>
      )}

      {/* 3. Aesthetic Interactive Control Buttons */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {/* Toggle Telemetry HUD */}
        <button
          onClick={() => setShowTelemetry(!showTelemetry)}
          className={`p-2 rounded-xl backdrop-blur-md border text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 ${
            showTelemetry
              ? "bg-sky-500/20 border-sky-400 text-sky-300"
              : "bg-black/40 border-white/10 text-white/75 hover:bg-black/60"
          }`}
          title="Toggle Display Telemetry HUD"
        >
          <Wifi className={`w-3.5 h-3.5 ${imgLoaded && cacheStatus === "HIT" ? "text-emerald-400 animate-pulse" : "text-sky-400"}`} />
          <span className="hidden sm:inline">HUD</span>
        </button>

        {/* Styling Panel Slider Toggle */}
        <button
          onClick={() => setShowStylePanel(!showStylePanel)}
          className={`p-2 rounded-xl backdrop-blur-md border text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 ${
            showStylePanel
              ? "bg-amber-500/20 border-amber-400 text-amber-300"
              : "bg-black/40 border-white/10 text-white/75 hover:bg-black/60"
          }`}
          title="Creative Filters & Resolution"
        >
          <Sliders className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Art Deco</span>
        </button>
      </div>

      {/* 4. REAL-TIME MULTI-DIMENSIONAL STYLE & RESOLUTION PANEL OVERLAY */}
      <AnimatePresence>
        {showStylePanel && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`absolute top-16 right-4 z-40 w-64 p-4 rounded-2xl backdrop-blur-xl border shadow-xl ${
              genre === "romance"
                ? "bg-[#FCF8F8]/95 border-rose-200/50 text-rose-950"
                : "bg-black/80 border-white/10 text-white"
            }`}
          >
            <div className="space-y-4">
              {/* RESOLUTION MODE SELECTOR */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] uppercase font-bold tracking-widest opacity-60">Adaptive Bandwidth</span>
                  {autoAdapted && (
                    <span className="text-[8px] bg-sky-500/15 py-0.5 px-2 rounded-full font-mono text-sky-400 animate-pulse border border-sky-400/20">Auto Adapted</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(["2k", "1k", "lite"] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => changeResolution(res)}
                      className={`py-1 rounded-lg text-[9px] font-mono font-bold uppercase border transition-all ${
                        resolutionSetting === res
                          ? "bg-sky-500/20 border-sky-400 text-sky-300"
                          : "border-transparent bg-white/5 hover:bg-white/10 text-white/60"
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              {/* BESPOKE FILTER SELECTOR */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase font-bold tracking-widest opacity-60">Creative Lens Overrides</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { key: "raw", label: "Raw Native" },
                    { key: "cinematic", label: "Cinema Dream" },
                    { key: "gothic", label: "Gothic Noir" },
                    { key: "vintage", label: "Rose Vintage" },
                    { key: "vivid", label: "Chroma Vivid" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => changeFilter(filter.key as any)}
                      className={`py-1 px-1.5 rounded-lg text-[8.5px] uppercase font-bold border text-left flex items-center justify-between truncate transition-all ${
                        activeFilter === filter.key
                          ? "bg-amber-500/20 border-amber-400 text-amber-300"
                          : "border-transparent bg-white/5 hover:bg-white/10 text-white/60"
                      }`}
                    >
                      <span>{filter.label}</span>
                      {activeFilter === filter.key && <Check className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. LIVE MATRIX SPEED & RELIABILITY TELEMETRY HUD OVERLAY */}
      <AnimatePresence>
        {showTelemetry && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute bottom-4 left-4 z-40 p-4 rounded-2xl bg-zinc-950/85 border border-white/10 backdrop-blur-md shadow-2xl text-[9px] font-mono text-white max-w-sm"
          >
            <div className="flex items-center gap-2 border-b border-white/10 pb-1.5 mb-1.5">
              <Wifi className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
              <span className="font-extrabold uppercase tracking-widest text-[#FFF]">Graphic Render Stream Telemetry</span>
            </div>
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 opacity-80 text-left">
              <div>RENDER DELAY:</div>
              <div className="font-bold text-sky-400 flex items-center gap-1">
                <span>{loadDuration !== null ? `${loadDuration}ms` : "0ms"}</span>
                {loadDuration !== null && loadDuration < 200 && (
                  <span className="text-[7.5px] bg-emerald-500/15 text-emerald-400 px-1 rounded">High Speed</span>
                )}
              </div>

              <div>CACHE DISPATCH:</div>
              <div className={`font-bold ${cacheStatus === "HIT" ? "text-emerald-400" : "text-amber-400"}`}>
                {cacheStatus === "HIT" ? "MEMORY_CACHE_RESOLVED [HIT]" : "NETWORK_RESOLVE [MISS]"}
              </div>

              <div>TARGET RESOLUTION:</div>
              <span className="font-bold text-[#FFF]">
                {resolutionSetting === "2k"
                  ? "2048 x 1152 (HD Cinematic 2K)"
                  : resolutionSetting === "lite"
                    ? "854 x 480 (Bandwidth Saver Lite)"
                    : "1280 x 720 (Balanced Standard 1K)"}
              </span>

              <div>NARRATIVE STYLE SIGNATURE:</div>
              <span className="font-bold text-amber-400 uppercase">{activeFilter}</span>

              <div>LATENCY COMPENSATOR:</div>
              <span className={`font-bold ${autoAdapted ? "text-amber-400" : "text-emerald-400 text-[8.5px]"}`}>
                {autoAdapted ? "ACTIVE (LOW LATENCY STRAW)" : "STABLE SYNC"}
              </span>
            </div>

            <p className="mt-2 text-[7.5px] leading-relaxed opacity-40 text-left uppercase tracking-tighter">
              Telemetry continuously measures bandwidth to dynamically balance visual authenticity with loading responsiveness.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
