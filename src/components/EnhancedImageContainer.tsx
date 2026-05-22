import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  Sliders,
  Zap,
  Eye,
  Check,
  ShieldAlert,
  Wifi,
  Info,
  Camera,
  Film,
  Music,
  Activity,
  Maximize2,
  Clock,
  BatteryCharging,
  SlidersHorizontal,
  Layers
} from "lucide-react";

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
  // --- CINEMATIC HOLLYWOOD CUSTOM STATES & PREFERENCES ---
  
  // 1. Aspect Ratio: 'anamorphic_239' | 'panavision_276' | 'widescreen_169' | 'flat_185' | 'academy_43'
  const [aspectRatioSetting, setAspectRatioSetting] = useState<
    "anamorphic_239" | "panavision_276" | "widescreen_169" | "flat_185" | "academy_43"
  >(() => {
    try {
      const saved = localStorage.getItem("setting_img_aspect");
      if (saved) return saved as any;
    } catch (e) {}
    return "anamorphic_239";
  });

  // 2. Transition Style: 'cross_dissolve' | 'fade_to_black' | 'exposure_leak' | 'hyper_zoom' | 'diagonal_shutter'
  const [transitionStyleSetting, setTransitionStyleSetting] = useState<
    "cross_dissolve" | "fade_to_black" | "exposure_leak" | "hyper_zoom" | "diagonal_shutter"
  >(() => {
    try {
      const saved = localStorage.getItem("setting_img_transition");
      if (saved) return saved as any;
    } catch (e) {}
    return "exposure_leak";
  });

  // 3. Ken Burns Camera Movement: 'dolly_in' | 'dolly_out' | 'pan_left_right' | 'tilting_crawl' | 'handheld_shiver' | 'static_view'
  const [cameraMovementSetting, setCameraMovementSetting] = useState<
    "dolly_in" | "dolly_out" | "pan_left_right" | "tilting_crawl" | "handheld_shiver" | "static_view"
  >(() => {
    try {
      const saved = localStorage.getItem("setting_img_camera");
      if (saved) return saved as any;
    } catch (e) {}
    return "dolly_in";
  });

  // 4. Temporal Effects: 'none' | 'projector_flicker' | 'motion_ghosting' | 'slow_motion'
  const [temporalModeSetting, setTemporalModeSetting] = useState<
    "none" | "projector_flicker" | "motion_ghosting" | "slow_motion"
  >(() => {
    try {
      const saved = localStorage.getItem("setting_img_temporal");
      if (saved) return saved as any;
    } catch (e) {}
    return "projector_flicker";
  });

  // 5. Color Grades: 'raw' | 'cinematic_teal_orange' | 'gothic_noir' | 'gold_vintage' | 'cyan_haunting' | 'chroma_vivid'
  const [colorGradeSetting, setColorGradeSetting] = useState<
    "raw" | "cinematic_teal_orange" | "gothic_noir" | "gold_vintage" | "cyan_haunting" | "chroma_vivid"
  >(() => {
    try {
      const saved = localStorage.getItem("setting_img_grade");
      if (saved) return saved as any;
    } catch (e) {}
    // Default based on genre
    if (genre === "romance") return "gold_vintage";
    if (genre === "crime") return "gothic_noir";
    if (genre === "paranormal") return "cyan_haunting";
    return "cinematic_teal_orange";
  });

  // 6. Realistic Lighting and Vignette: 'cinematic_vignette' | 'dramatic_key_lamp' | 'neon_ambient_backlight' | 'none'
  const [lightingSetting, setLightingSetting] = useState<
    "cinematic_vignette" | "dramatic_key_lamp" | "neon_ambient_backlight" | "none"
  >(() => {
    try {
      const saved = localStorage.getItem("setting_img_lighting");
      if (saved) return saved as any;
    } catch (e) {}
    return "dramatic_key_lamp";
  });

  // 7. Frame Rate Lock: 'fps_24' | 'fps_30' | 'fps_60'
  const [targetFramerateSetting, setTargetFramerateSetting] = useState<"fps_24" | "fps_30" | "fps_60">(() => {
    try {
      const saved = localStorage.getItem("setting_img_fps");
      if (saved === "fps_24" || saved === "fps_30" || saved === "fps_60") return saved;
    } catch (e) {}
    return "fps_24"; // authentic cinema feel by default
  });

  // 8. Performance and Energy Tier: 'ultra' | 'balanced' | 'eco_mode'
  const [performanceSetting, setPerformanceSetting] = useState<"ultra" | "balanced" | "eco_mode">(() => {
    try {
      const saved = localStorage.getItem("setting_img_performance");
      if (saved === "ultra" || saved === "balanced" || saved === "eco_mode") return saved;
    } catch (e) {}
    return "ultra";
  });

  // Adaptive and cache HUD states
  const [imgLoaded, setImgLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [displayedSrc, setDisplayedSrc] = useState<string | null>(null);
  const [loadDuration, setLoadDuration] = useState<number | null>(null);
  const [cacheStatus, setCacheStatus] = useState<"MISS" | "HIT">("MISS");
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<"aspect" | "grade" | "sync">("aspect");
  const [autoAdapted, setAutoAdapted] = useState(false);

  // Transition stage timing states
  const [transitionOverlay, setTransitionOverlay] = useState<"idle" | "faded" | "revealing">("idle");
  const [triggerPulseSync, setTriggerPulseSync] = useState(false);

  // Resolution setting state
  const [resolutionSetting, setResolutionSetting] = useState<"2k" | "1k" | "lite">(() => {
    try {
      const saved = localStorage.getItem("setting_img_res");
      if (saved === "2k" || saved === "1k" || saved === "lite") return saved;
    } catch (e) {}
    return "1k";
  });

  const loadStartTime = useRef<number>(0);
  const prevImageUrl = useRef<string | null>(null);

  // Save utility helpers
  const persistChoice = (key: string, value: string, setter: (val: any) => void) => {
    setter(value);
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  };

  // Low latency bandwidth adapter
  const benchmarkLatency = (duration: number) => {
    if (performanceSetting === "eco_mode") return; // Keep low res optimized if in eco
    if (duration > 2200 && resolutionSetting !== "lite") {
      setResolutionSetting("lite");
      setAutoAdapted(true);
      try {
        localStorage.setItem("setting_img_res", "lite");
      } catch (e) {}
    } else if (duration < 500 && autoAdapted && resolutionSetting === "lite") {
      setResolutionSetting("1k");
      setAutoAdapted(false);
      try {
        localStorage.setItem("setting_img_res", "1k");
      } catch (e) {}
    }
  };

  // Dynamic Camera Motion variants configuration
  const cameraMotionVariants = {
    static_view: {
      scale: 1.05,
      x: 0,
      y: 0,
    },
    dolly_in: {
      scale: [1.02, 1.16],
    },
    dolly_out: {
      scale: [1.16, 1.02],
    },
    pan_left_right: {
      x: ["-3%", "3%"],
      scale: 1.12,
    },
    tilting_crawl: {
      x: ["-2%", "2%"],
      y: ["-3%", "3%"],
      scale: 1.15,
    },
    handheld_shiver: {
      x: [0, 0.7, -0.6, 1.1, -0.8, 0.5, -0.4, 0],
      y: [0, -0.6, 0.8, -0.5, 0.7, -0.8, 0.9, 0],
      rotate: [0, 0.3, -0.25, 0.4, -0.3, 0.2, -0.1, 0],
      scale: 1.07,
    },
  };

  // Animate dynamic transitions on Image URL updates
  useEffect(() => {
    if (!imageUrl) {
      setCurrentSrc(null);
      setDisplayedSrc(null);
      setImgLoaded(false);
      return;
    }

    // Unsplash parameters reconstruction based on selected quality
    let finalUrl = imageUrl;
    if (imageUrl.includes("unsplash.com")) {
      const sizeParam =
        resolutionSetting === "2k"
          ? "&w=1920&q=88"
          : resolutionSetting === "lite"
            ? "&w=640&q=45"
            : "&w=1280&q=70";
      finalUrl = imageUrl.split("?")[0] + "?auto=format&fit=crop" + sizeParam;
    }

    const swapSourceWithTransitions = (readyUrl: string, cacheHit: boolean) => {
      // If eco mode is enabled, skip complicated transition timeouts to prevent pipeline overhead
      if (performanceSetting === "eco_mode" || transitionStyleSetting === "cross_dissolve") {
        setDisplayedSrc(readyUrl);
        setTransitionOverlay("idle");
        // brief flash on active sync
        setTriggerPulseSync(true);
        setTimeout(() => setTriggerPulseSync(false), 600);
        return;
      }

      setTransitionOverlay("faded");
      const midpointDuration =
        transitionStyleSetting === "fade_to_black"
          ? 250
          : transitionStyleSetting === "exposure_leak"
            ? 180
            : transitionStyleSetting === "diagonal_shutter"
              ? 200
              : 220; // hyper_zoom

      setTimeout(() => {
        setDisplayedSrc(readyUrl);
        setTransitionOverlay("revealing");
        
        // Trigger a heartbeat pulse to align simulated soundtrack/narrator tracks with visual changes
        setTriggerPulseSync(true);
        setTimeout(() => setTriggerPulseSync(false), 800);

        setTimeout(() => {
          setTransitionOverlay("idle");
        }, midpointDuration + 150);
      }, midpointDuration);
    };

    // Check pre-loaded memory cache of the browser
    if (globalImageMemoryCache.has(finalUrl)) {
      setCacheStatus("HIT");
      setLoadDuration(0);
      const urlResolved = globalImageMemoryCache.get(finalUrl)!;
      setCurrentSrc(urlResolved);
      setImgLoaded(true);

      swapSourceWithTransitions(urlResolved, true);
      prevImageUrl.current = imageUrl;
      return;
    }

    setCacheStatus("MISS");
    setImgLoaded(false);
    loadStartTime.current = performance.now();

    const img = new Image();
    img.src = finalUrl;
    img.referrerPolicy = "no-referrer";

    img.onload = () => {
      const elapsed = Math.round(performance.now() - loadStartTime.current);
      setLoadDuration(elapsed);
      benchmarkLatency(elapsed);

      globalImageMemoryCache.set(finalUrl, finalUrl);
      setCurrentSrc(finalUrl);
      setImgLoaded(true);

      swapSourceWithTransitions(finalUrl, false);
      prevImageUrl.current = imageUrl;
    };

    img.onerror = () => {
      // Fallback strategies on CDN blockage
      if (resolutionSetting !== "lite") {
        const fallbackUrl = imageUrl.includes("unsplash.com")
          ? imageUrl.split("?")[0] + "?auto=format&fit=crop&w=800&q=55"
          : imageUrl;
        setCurrentSrc(fallbackUrl);
        setImgLoaded(true);
        swapSourceWithTransitions(fallbackUrl, false);
      } else {
        setCurrentSrc(imageUrl);
        setImgLoaded(true);
        swapSourceWithTransitions(imageUrl, false);
      }
    };
  }, [imageUrl, resolutionSetting, transitionStyleSetting, performanceSetting]);

  // CSS Color Grading matrices matching cinematic palettes
  const getFilterCSS = () => {
    switch (colorGradeSetting) {
      case "cinematic_teal_orange":
        // Teal shadows & Warm gold/orange lighting contrast
        return "contrast-[112%] saturate-[118%] brightness-[96%] [filter:hue-rotate(-2deg)_sepia(4%)_contrast(1.08)] shadow-[inset_0_0_120px_rgba(4,38,57,0.45)]";
      case "gothic_noir":
        // Desaturated, heavy shadows, high exposure dramatic monochrome
        return "contrast-[142%] saturate-[28%] brightness-[84%] sepia-[15%] hue-rotate-[18deg] shadow-[inset_0_0_140px_rgba(0,0,0,0.96)]";
      case "gold_vintage":
        // Warm romantic sepia nostalgic atmosphere for romance genre
        return "sepia-[32%] contrast-[92%] saturate-[94%] brightness-[102%] blur-[0.15px] hue-rotate-[4deg]";
      case "cyan_haunting":
        // Spiritual turquoise, pale highlights, cold shadows for paranormal vibes
        return "contrast-[118%] saturate-[72%] brightness-[88%] sepia-[12%] hue-rotate-[145deg] shadow-[inset_0_0_100px_rgba(20,80,60,0.5)]";
      case "chroma_vivid":
        // High saturation, high contrast vivid presentation
        return "contrast-[112%] saturate-[148%] brightness-[104%] drop-shadow-md";
      case "raw":
      default:
        return "contrast-100 saturate-100 brightness-100";
    }
  };

  // Aesthetic backdrop theme resolver
  const getThematicPlaceholder = () => {
    switch (genre) {
      case "romance":
        return "bg-gradient-to-tr from-rose-900/40 via-pink-950/20 to-amber-950/10 animate-pulse duration-[5s]";
      case "crime":
        return "bg-gradient-to-br from-zinc-950 via-slate-900 to-zinc-900 animate-pulse duration-[5s]";
      case "paranormal":
        return "bg-gradient-to-tr from-[#0F0419] via-[#2F114D] to-[#0A0518] animate-pulse duration-[5s]";
      default:
        return "bg-gradient-to-r from-zinc-900 to-stone-900 animate-pulse duration-[4s]";
    }
  };

  // Custom keyframe timings derived from simulated Framerate Lock choices
  const getFpsDelay = () => {
    switch (targetFramerateSetting) {
      case "fps_24":
        return 20; // slow stepped update cycle duration
      case "fps_30":
        return 14;
      case "fps_60":
      default:
        return 8;
    }
  };

  // Interactive menu tab structures inside the custom Hollywood Deck
  const handleTabChange = (tabId: "aspect" | "grade" | "sync") => {
    persistChoice("setting_config_tab", tabId, setActiveConfigTab as any);
  };

  if (!showImages) return null;

  return (
    <div
      id="cinematic-rendering-viewport"
      className="relative w-full h-full select-none overflow-hidden group/img-panel transition-all duration-700 bg-black flex items-center justify-center cursor-default"
    >
      {/* 1. THEATRICAL COLOR GRADED BACKGROUND PLACEHOLDER */}
      <div className={`absolute inset-0 w-full h-full ${getThematicPlaceholder()}`} />

      {/* 2. MAIN ASPECT RATIO BLACK MATTE BAR OVERLAYS (LETTERBOX / PILLARBOX ENGINE) */}
      <div className="absolute inset-0 z-30 pointer-events-none w-full h-full">
        {/* Top Black Cinematic Letterbox Bar */}
        <motion.div
          id="matte-letterbox-top"
          className="absolute top-0 left-0 right-0 bg-neutral-950/95 border-b border-white/[0.04] z-30 shadow-md"
          animate={{
            height:
              aspectRatioSetting === "anamorphic_239"
                ? "11%"
                : aspectRatioSetting === "panavision_276"
                  ? "17%"
                  : aspectRatioSetting === "flat_185"
                    ? "4%"
                    : "0%",
          }}
          transition={{ duration: 0.65, ease: [0.25, 1, 0.5, 1] }}
        />

        {/* Bottom Black Cinematic Letterbox Bar */}
        <motion.div
          id="matte-letterbox-bottom"
          className="absolute bottom-0 left-0 right-0 bg-neutral-950/95 border-t border-white/[0.04] z-30 shadow-md"
          animate={{
            height:
              aspectRatioSetting === "anamorphic_239"
                ? "11%"
                : aspectRatioSetting === "panavision_276"
                  ? "17%"
                  : aspectRatioSetting === "flat_185"
                    ? "4%"
                    : "0%",
          }}
          transition={{ duration: 0.65, ease: [0.25, 1, 0.5, 1] }}
        />

        {/* Left Side Pillarbox Bar */}
        <motion.div
          id="matte-pillarbox-left"
          className="absolute top-0 bottom-0 left-0 bg-neutral-950/95 border-r border-white/[0.04] z-30"
          animate={{
            width: aspectRatioSetting === "academy_43" ? "14.5%" : "0%",
          }}
          transition={{ duration: 0.65, ease: [0.25, 1, 0.5, 1] }}
        />

        {/* Right Side Pillarbox Bar */}
        <motion.div
          id="matte-pillarbox-right"
          className="absolute top-0 bottom-0 right-0 bg-neutral-950/95 border-l border-white/[0.04] z-30"
          animate={{
            width: aspectRatioSetting === "academy_43" ? "14.5%" : "0%",
          }}
          transition={{ duration: 0.65, ease: [0.25, 1, 0.5, 1] }}
        />
      </div>

      {/* 3. LIGHTING STAGE & CHIAROSCURO SHADOW PROFILERS */}
      {lightingSetting !== "none" && (
        <div className="absolute inset-0 w-full h-full z-20 pointer-events-none">
          {/* Default Dark Cinema Vignette */}
          {lightingSetting === "cinematic_vignette" && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,0.85)_95%)] pointer-events-none" />
          )}

          {/* Dynamic Moving Spotlight Chiaroscuro key frame */}
          {lightingSetting === "dramatic_key_lamp" && (
            <motion.div
              id="theatrical-radial-spotlight"
              className="absolute inset-0 mix-blend-multiply opacity-90 transition-all duration-1000"
              style={{
                background:
                  "radial-gradient(circle at var(--spotlight-x, 50%) var(--spotlight-y, 45%), transparent 25%, rgba(0,0,0,0.92) 80%)",
              }}
              animate={
                performanceSetting === "eco_mode"
                  ? {}
                  : ({
                      "--spotlight-x": ["38%", "58%", "44%", "54%", "38%"],
                      "--spotlight-y": ["34%", "52%", "48%", "38%", "34%"],
                    } as any)
              }
              transition={{
                duration: 18,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          {/* Ambient mood colored backlight glow overlays inside frame */}
          {lightingSetting === "neon_ambient_backlight" && (
            <div
              className={`absolute inset-0 pointer-events-none transition-all duration-1000 opacity-30 ${
                genre === "romance"
                  ? "bg-[radial-gradient(circle_at_10%_20%,rgba(244,63,94,0.45)_0%,transparent_50%),radial-gradient(circle_at_90%_80%,rgba(251,191,36,0.3)_0%,transparent_50%)]"
                  : genre === "paranormal"
                    ? "bg-[radial-gradient(circle_at_10%_20%,rgba(168,85,247,0.5)_0%,transparent_50%),radial-gradient(circle_at_90%_80%,rgba(6,182,212,0.4)_0%,transparent_50%)]"
                    : "bg-[radial-gradient(circle_at_10%_20%,rgba(245,158,11,0.35)_0%,transparent_50%),radial-gradient(circle_at_90%_80%,rgba(14,116,144,0.4)_0%,transparent_50%)]"
              }`}
            />
          )}
        </div>
      )}

      {/* PROJECTOR SHUTTER FILM FLICKER SIMULATION */}
      {temporalModeSetting === "projector_flicker" && performanceSetting !== "eco_mode" && (
        <motion.div
          id="projector-shutter-flicker"
          className="absolute inset-0 bg-white bg-opacity-[0.015] z-10 pointer-events-none"
          animate={{
            opacity: [0.0, 0.45, 0.1, 0.6, 0.05, 0.35, 0.0],
          }}
          transition={{
            duration: 0.12,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}

      {/* MOTION GHOSTING TRAILING LAYER OPTION */}
      {temporalModeSetting === "motion_ghosting" && displayedSrc && performanceSetting !== "eco_mode" && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-20 mix-blend-screen blur-[2px] scale-105 select-none overflow-hidden">
          <img src={displayedSrc} className="w-full h-full object-cover" alt="ghosting layer" />
        </div>
      )}

      {/* TIME DILATION SCANNERS */}
      {temporalModeSetting === "slow_motion" && performanceSetting !== "eco_mode" && (
        <motion.div
          id="temporal-dilation-scanline"
          className="absolute inset-x-0 h-[2px] bg-sky-400/25 z-20 pointer-events-none"
          animate={{
            top: ["0%", "100%"],
          }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* 4. MAIN SCIENTIFIC ARTISTIC LENS & RENDER PLATFORM */}
      <AnimatePresence mode="popLayout">
        {imgLoaded && displayedSrc ? (
          <motion.div
            key={displayedSrc}
            initial={
              transitionStyleSetting === "hyper_zoom"
                ? { opacity: 0, scale: 0.85, filter: "brightness(25%) blur(12px)" }
                : { opacity: 0, scale: 1.01, filter: "blur(2px)" }
            }
            animate={{
              opacity: 1,
              scale: 1.0,
              filter: "blur(0px)",
            }}
            exit={
              transitionStyleSetting === "hyper_zoom"
                ? { opacity: 0, scale: 1.15, filter: "brightness(140%) blur(8px)" }
                : { opacity: 0, scale: 0.99 }
            }
            transition={{
              duration: performanceSetting === "eco_mode" ? 0.2 : 0.72,
              ease: [0.16, 1, 0.3, 1], // cinematic smooth expo ease
            }}
            className="absolute inset-0 w-full h-full z-0"
          >
            {/* Dynamic Camerawork layer using variants */}
            <motion.div
              id="camerawork-movement-axis"
              className="w-full h-full origin-center select-none"
              animate={cameraMovementSetting}
              variants={cameraMotionVariants}
              transition={
                cameraMovementSetting === "static_view"
                  ? { duration: 0.5 }
                  : cameraMovementSetting === "handheld_shiver"
                    ? { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
                    : {
                        duration: performanceSetting === "eco_mode" ? 45 : 30, // even slower pacing in eco
                        repeat: Infinity,
                        repeatType: "reverse",
                        ease: "linear",
                      }
              }
            >
              <img
                src={displayedSrc}
                className={`w-full h-full object-cover transition-all ${getFilterCSS()}`}
                alt={alt}
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            id="rendering-standby-screen"
            key="image-stream-processor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-10"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-full border border-sky-500/20 border-t-sky-400 animate-spin" />
              <Layers className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-sky-400 animate-pulse" />
            </div>
            <div className="text-center mt-3 font-mono text-[9px] uppercase tracking-widest text-sky-300 flex items-center gap-2">
              <Sparkles className="w-3 h-3 animate-pulse" /> Resolving High Fidelity Cine-Frames...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. PHYSICAL TRANSITION OVERLAYS */}
      <AnimatePresence>
        {transitionOverlay !== "idle" && (
          <>
            {/* SOLID FADE TO BLACK OVERLAY */}
            {transitionStyleSetting === "fade_to_black" && (
              <motion.div
                id="transition-overlay-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: transitionOverlay === "faded" ? 1 : 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="absolute inset-0 bg-neutral-950 z-40 pointer-events-none"
              />
            )}

            {/* HIGH RADIATION EXPOSURE LEAK OVERLAY */}
            {transitionStyleSetting === "exposure_leak" && (
              <motion.div
                id="transition-overlay-leak"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                  opacity: transitionOverlay === "faded" ? [0, 0.95, 0.4] : 0,
                  scale: transitionOverlay === "faded" ? 1.05 : 1,
                  filter: "blur(15px)",
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="absolute inset-0 bg-gradient-to-tr from-amber-600 via-rose-500 to-yellow-300 mix-blend-screen z-40 pointer-events-none opacity-85"
              />
            )}

            {/* DYNAMIC SHUTTER SPLIT WIPE */}
            {transitionStyleSetting === "diagonal_shutter" && (
              <motion.div
                id="transition-overlay-shutter"
                initial={{ x: "-105%", skewX: -20 }}
                animate={{
                  x: transitionOverlay === "faded" ? "0%" : "105%",
                  skewX: -20,
                }}
                exit={{ x: "105%" }}
                transition={{ duration: 0.38, ease: "easeInOut" }}
                className="absolute inset-y-0 -left-[20%] w-[140%] bg-neutral-900 border-x-4 border-amber-400/25 z-40 pointer-events-none shadow-[0_0_100px_rgba(0,0,0,0.85)]"
              />
            )}
          </>
        )}
      </AnimatePresence>

      {/* QUOTA FALLBACK INFORMER */}
      {imageUrl?.includes("picsum.photos") && (
        <div className="absolute bottom-16 right-4 z-40 max-w-[280px] bg-black/75 backdrop-blur-md border border-amber-500/30 text-amber-200 p-2 text-[9px] rounded-xl flex items-start gap-1.5 shadow-xl font-sans">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-0.5">
            <span className="font-bold uppercase tracking-wider block text-amber-300">GPU Stream Wait</span>
            <span className="opacity-80 leading-normal block">
              Gemini free-tier request limit standby. Rendering stable atmospheric backup frames safely.
            </span>
          </div>
        </div>
      )}

      {/* 6. AESTHETIC DIRECTORS INTERACTIVE CONSOLE TRIGGERS */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {/* Toggle Telemetry HUD Button */}
        <button
          id="btn-hud-toggle"
          onClick={() => setShowTelemetry(!showTelemetry)}
          className={`p-1.5 rounded-xl backdrop-blur-md border text-[9px] uppercase font-bold tracking-wider transition-all flex items-center gap-1 shadow-md cursor-pointer ${
            showTelemetry
              ? "bg-sky-500/25 border-sky-400 text-sky-200"
              : "bg-neutral-950/60 border-white/10 text-white/70 hover:bg-neutral-950/80 hover:text-white"
          }`}
          title="Toggle Display Telemetry HUD"
        >
          <Wifi className={`w-3.5 h-3.5 ${imgLoaded ? "text-emerald-400" : "text-sky-400"}`} />
          <span className="hidden sm:inline">Telemetry</span>
        </button>

        {/* Hollywood Styling Dock Button */}
        <button
          id="btn-hollywood-dock-toggle"
          onClick={() => setShowStylePanel(!showStylePanel)}
          className={`p-1.5 rounded-xl backdrop-blur-md border text-[9px] uppercase font-bold tracking-wider transition-all flex items-center gap-1 shadow-md cursor-pointer ${
            showStylePanel
              ? "bg-amber-500/25 border-amber-400 text-amber-200 animate-pulse"
              : "bg-neutral-950/60 border-white/10 text-white/70 hover:bg-neutral-950/80 hover:text-white"
          }`}
          title="Creative Options & Lens Console"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Director Panel</span>
        </button>
      </div>

      {/* 7. HOLLYWOOD MULTI-TAB DIRECTIONAL CONSOLE BOARD */}
      <AnimatePresence>
        {showStylePanel && (
          <motion.div
            id="hollywood-director-deck"
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className={`absolute top-16 right-4 z-45 w-[310px] rounded-2xl backdrop-blur-2xl border shadow-2xl flex flex-col overflow-hidden max-h-[380px] ${
              genre === "romance"
                ? "bg-[#FEFAFA] border-rose-200/50 text-rose-950"
                : "bg-[#0b0d12]/95 border-white/10 text-slate-100"
            }`}
          >
            {/* Header Deck Tabs Selector */}
            <div className="flex border-b border-white/[0.08] bg-black/25 text-[9px] uppercase font-black tracking-wider">
              <button
                id="tab-aspect-link"
                onClick={() => handleTabChange("aspect")}
                className={`flex-1 py-2.5 px-1 flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeConfigTab === "aspect"
                    ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-500"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                }`}
              >
                <Camera className="w-3 h-3" />
                Aspect
              </button>
              <button
                id="tab-grade-link"
                onClick={() => handleTabChange("grade")}
                className={`flex-1 py-2.5 px-1 flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeConfigTab === "grade"
                    ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-500"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                }`}
              >
                <Film className="w-3 h-3" />
                Lenses
              </button>
              <button
                id="tab-sync-link"
                onClick={() => handleTabChange("sync")}
                className={`flex-1 py-2.5 px-1 flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  activeConfigTab === "sync"
                    ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-500"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                }`}
              >
                <Activity className="w-3 h-3" />
                Sync Mode
              </button>
            </div>

            {/* TAB PANELS ELEMENT CONTAINER */}
            <div className="p-4 flex-1 overflow-y-auto space-y-3.5 max-h-[300px]">
              {/* TAB 1: ASPECT & CAMERA CAMERA WORK */}
              {activeConfigTab === "aspect" && (
                <div className="space-y-3">
                  {/* Cinematic Matte Layout Menu */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                      <Maximize2 className="w-2.5 h-2.5 text-amber-400" />
                      Aspect Matte Box Ratios
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "anamorphic_239", label: "2.39:1 Anamorphic Scope" },
                        { id: "panavision_276", label: "2.76:1 Panavision Ultra" },
                        { id: "widescreen_169", label: "16:9 HD Broadcast" },
                        { id: "flat_185", label: "1.85:1 Academy Flat" },
                        { id: "academy_43", label: "4:3 Vintage Square" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          id={`setting-aspect-${item.id}`}
                          onClick={() => persistChoice("setting_img_aspect", item.id, setAspectRatioSetting as any)}
                          className={`py-1 px-1.5 rounded-lg text-[8.5px] text-left uppercase font-bold border truncate transition-all cursor-pointer ${
                            aspectRatioSetting === item.id
                              ? "bg-amber-500/15 border-amber-400 text-amber-300"
                              : "border-transparent bg-white/5 hover:bg-white/10 text-slate-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Ken Burns camera sweep modes */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                      <Camera className="w-2.5 h-2.5 text-emerald-400" />
                      Ken Burns Camera Sweep Mode
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: "dolly_in", label: "Theatrical Dolly Focus" },
                        { id: "dolly_out", label: "Dolly Out Pullback" },
                        { id: "pan_left_right", label: "Scenic Horizon Pan" },
                        { id: "tilting_crawl", label: "Diagonal Tilt Crawl" },
                        { id: "handheld_shiver", label: "Handheld Stabilizer" },
                        { id: "static_view", label: "Fixed Camera Lock" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          id={`setting-camera-${item.id}`}
                          onClick={() => persistChoice("setting_img_camera", item.id, setCameraMovementSetting as any)}
                          className={`py-1 px-1.5 rounded-lg text-[8px] text-left uppercase font-extrabold border truncate transition-all cursor-pointer ${
                            cameraMovementSetting === item.id
                              ? "bg-emerald-500/15 border-emerald-400 text-emerald-300"
                              : "border-transparent bg-white/5 hover:bg-white/10 text-slate-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: LENSES & LIGHTING CHROME */}
              {activeConfigTab === "grade" && (
                <div className="space-y-3">
                  {/* Color Correction Grading option */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                      <Film className="w-2.5 h-2.5 text-pink-400" />
                      Aesthetic Color Grade Correction
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "cinematic_teal_orange", label: "Hollywood Orange Teal" },
                        { id: "gothic_noir", label: "Gothic Desaturated Noir" },
                        { id: "gold_vintage", label: "Amber Nostalgic Gold" },
                        { id: "cyan_haunting", label: "Turquoise Spiritual Fade" },
                        { id: "chroma_vivid", label: "Saturated Chroma Tint" },
                        { id: "raw", label: "Untouched Raw Feed" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          id={`setting-grade-${item.id}`}
                          onClick={() => persistChoice("setting_img_grade", item.id, setColorGradeSetting as any)}
                          className={`py-1 px-1.5 rounded-lg text-[8px] text-left uppercase font-bold border truncate transition-all cursor-pointer ${
                            colorGradeSetting === item.id
                              ? "bg-pink-500/15 border-pink-400 text-pink-300"
                              : "border-transparent bg-white/5 hover:bg-white/10 text-slate-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chiaroscuro studio light layout */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                      Theatrical Studio Light Casting
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "dramatic_key_lamp", label: "Moving Key Light Cone" },
                        { id: "cinematic_vignette", label: "Corner Corner Shadows" },
                        { id: "neon_ambient_backlight", label: "Cyber Sideglow Reflections" },
                        { id: "none", label: "No Extra Light Source" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          id={`setting-lighting-${item.id}`}
                          onClick={() => persistChoice("setting_img_lighting", item.id, setLightingSetting as any)}
                          className={`py-1 px-1.5 rounded-lg text-[8.5px] text-left uppercase font-bold border truncate transition-all cursor-pointer ${
                            lightingSetting === item.id
                              ? "bg-sky-500/15 border-sky-400 text-sky-200"
                              : "border-transparent bg-white/5 hover:bg-white/10 text-slate-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TIMING, STABLE SYNC & HARDWARE SAVER */}
              {activeConfigTab === "sync" && (
                <div className="space-y-3">
                  {/* Transitions option */}
                  <div className="space-y-1.5 text-left">
                    <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      Scene Dissolve & Wipe Transition
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "exposure_leak", label: "Warm Exposure Flare" },
                        { id: "fade_to_black" , label: "Theatrical Fade-to-Black" },
                        { id: "diagonal_shutter", label: "Camera Shutter Wipe" },
                        { id: "hyper_zoom", label: "Focus Lens Zoom Warp" },
                        { id: "cross_dissolve", label: "Soft Cross Fade" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          id={`setting-transition-${item.id}`}
                          onClick={() => persistChoice("setting_img_transition", item.id, setTransitionStyleSetting as any)}
                          className={`py-1 px-1.5 rounded-lg text-[8px] text-left uppercase font-bold border truncate transition-all cursor-pointer ${
                            transitionStyleSetting === item.id
                              ? "bg-amber-500/15 border-amber-400 text-amber-300"
                              : "border-transparent bg-white/5 hover:bg-white/10 text-slate-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shutter Speed Rate limiters */}
                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-slate-400" />
                        Target Framerate
                      </span>
                      <div className="flex flex-col gap-1">
                        {[
                          { id: "fps_24", label: "24 FPS - Cine Lock" },
                          { id: "fps_30", label: "30 FPS - Standard" },
                          { id: "fps_60", label: "60 FPS - High Speed" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            id={`setting-fps-${item.id}`}
                            onClick={() => persistChoice("setting_img_fps", item.id, setTargetFramerateSetting as any)}
                            className={`py-1 px-1.5 rounded-lg text-[8px] text-left uppercase font-bold border truncate transition-all cursor-pointer ${
                              targetFramerateSetting === item.id
                                ? "bg-amber-500/15 border-amber-400 text-amber-300"
                                : "border-transparent bg-white/5 hover:bg-white/10 text-slate-300"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                        <BatteryCharging className="w-2.5 h-2.5 text-emerald-400" />
                        Rendering Tier
                      </span>
                      <div className="flex flex-col gap-1">
                        {[
                          { id: "ultra", label: "Ultra High Res" },
                          { id: "balanced", label: "Balanced Power" },
                          { id: "eco_mode", label: "ECO battery saver" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            id={`setting-performance-${item.id}`}
                            onClick={() => persistChoice("setting_img_performance", item.id, setPerformanceSetting as any)}
                            className={`py-1 px-1.5 rounded-lg text-[8px] text-left uppercase font-bold border truncate transition-all cursor-pointer ${
                              performanceSetting === item.id
                                ? "bg-emerald-500/15 border-emerald-400 text-emerald-300"
                                : "border-transparent bg-white/5 hover:bg-white/10 text-slate-300"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Temporal filters toggle */}
                  <div className="space-y-1 text-left">
                    <span className="text-[9px] uppercase font-semibold text-slate-400 tracking-wider flex items-center gap-1">
                      <Layers className="w-2.5 h-2.5 text-purple-400" />
                      Temporal Noise Shutter
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { id: "projector_flicker", label: "Projector Shutter" },
                        { id: "motion_ghosting", label: "Motion Ghost Trails" },
                        { id: "slow_motion", label: "Slow Motion Dilator" },
                        { id: "none", label: "Standard Locked Flow" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          id={`setting-temporal-${item.id}`}
                          onClick={() => persistChoice("setting_img_temporal", item.id, setTemporalModeSetting as any)}
                          className={`py-1 px-1.5 rounded-lg text-[8px] text-left uppercase font-bold border truncate transition-all cursor-pointer ${
                            temporalModeSetting === item.id
                              ? "bg-purple-500/15 border-purple-400 text-purple-300"
                              : "border-transparent bg-white/5 hover:bg-white/10 text-slate-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. SOUND SYNC MONITOR & LIVE METRICS HUD */}
      <AnimatePresence>
        {showTelemetry && (
          <motion.div
            id="rendering-telemetry-hud"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute bottom-4 left-4 z-40 p-4 rounded-xl bg-neutral-950/90 border border-white/10 backdrop-blur-md shadow-2xl text-[9px] font-mono text-slate-300 max-w-[290px] text-left"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5 mb-1.5">
              <span className="font-black uppercase tracking-wider text-slate-100 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                Render Engine Telemetry
              </span>
              <span className="text-[7.5px] bg-sky-500/20 text-sky-300 px-1 rounded animate-pulse">LIVE</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between">
                <span>BUFFER DELAY:</span>
                <span className="font-bold text-sky-400">
                  {loadDuration !== null ? `${loadDuration}ms` : "0ms"} (HIT)
                </span>
              </div>
              <div className="flex justify-between">
                <span>TARGET FRAMERATE:</span>
                <span className="font-bold text-slate-100 uppercase">
                  {targetFramerateSetting === "fps_24" ? "24.00 FPS" : targetFramerateSetting === "fps_30" ? "30.00 FPS" : "60.00 FPS"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>ASPECT ASPECT:</span>
                <span className="font-bold text-slate-100 uppercase">
                  {aspectRatioSetting === "anamorphic_239" ? "2.39:1 (ANAMORPHIC SCOPE)" : aspectRatioSetting === "panavision_276" ? "2.76:1 (ULTRA PANAVISION)" : "16:9 (WIDESCREEN)"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>CAMERA VECTOR:</span>
                <span className="font-bold text-emerald-400 uppercase">
                  {cameraMovementSetting.replace("_", " ")} ACTIVE
                </span>
              </div>
              <div className="flex justify-between">
                <span>COLOR PROFILE:</span>
                <span className="font-bold text-pink-400 uppercase">
                  {colorGradeSetting.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span>POWER SAVER:</span>
                <span className={`font-bold ${performanceSetting === "eco_mode" ? "text-amber-400" : "text-emerald-400"}`}>
                  {performanceSetting === "ultra" ? "ULTRA RECONSTRUCTION ACTIVE" : performanceSetting === "balanced" ? "BALANCED FLUIDITY" : "ECO SAVING STRAW"}
                </span>
              </div>

              {/* Real-time Audio-Visual Equalizer Sync Bars */}
              <div className="border-t border-white/[0.08] mt-2 pt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[8px] text-amber-300 font-extrabold uppercase tracking-widest">
                  <span className="flex items-center gap-1">
                    <Music className="w-2.5 h-2.5 animate-pulse" /> Audio-Visual Channel
                  </span>
                  <span className={`${triggerPulseSync ? "text-emerald-400 animate-bounce" : "text-amber-400"}`}>
                    {triggerPulseSync ? "ACTION SYNC TRIGGERED" : "SOUNDTRACK LINKED"}
                  </span>
                </div>

                <div className="flex items-center gap-0.5 justify-center h-4 w-full bg-neutral-900/50 rounded-lg p-1">
                  {[...Array(14)].map((_, i) => (
                    <motion.div
                      key={`telemetry-eq-${i}`}
                      className={`w-1 rounded-full ${
                        triggerPulseSync
                          ? "bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                          : i % 2 === 0
                            ? "bg-amber-400"
                            : "bg-sky-400"
                      }`}
                      animate={
                        performanceSetting === "eco_mode"
                          ? { height: "50%" }
                          : {
                              height: triggerPulseSync
                                ? [4, 18, 4]
                                : [
                                    4,
                                    Math.random() * (i % 3 === 0 ? 12 : 8) + 4,
                                    4,
                                  ],
                            }
                      }
                      transition={
                        performanceSetting === "eco_mode"
                          ? {}
                          : {
                              duration: triggerPulseSync ? 0.3 + i * 0.05 : 0.6 + i * 0.1,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
