import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Sparkles, Orbit, Compass, Hourglass, Scroll } from "lucide-react";

interface AtmosphericFateLoaderProps {
  genre: string | null;
}

const STAGES = [
  {
    title: "Analyzing decision matrices",
    subtitle: "Tracing the divergent feedback of your chosen actions..."
  },
  {
    title: "Weaving consequences",
    subtitle: "Weighting the direct reactions across entities..."
  },
  {
    title: "Engraving world state",
    subtitle: "Updating the chronological blueprint of this universe..."
  },
  {
    title: "Rendering cinematic echoes",
    subtitle: "Synthesizing the atmospheric imagery and sensory data..."
  },
  {
    title: "Unfolding your destiny",
    subtitle: "Preparing the physical manifestation of the next scene..."
  }
];

const ROMANCE_QUOTES = [
  "True love is like ghosts, which everyone talks about and few have seen.",
  "Even in the darkest paths, a lingering warmth refuses to fade.",
  "Every hesitation before speaking writes a story of its own."
];

const NOIR_QUOTES = [
  "In this town, justice is just another neon light that flickered out years ago.",
  "Some secrets are written in ink; others are buried under wet asphalt.",
  "A guilty conscience has a funny way of making footsteps sound closer."
];

const PARANORMAL_QUOTES = [
  "The veil is not a solid wall; it is a fabric waiting to be torn.",
  "They do not speak with voices, but through the temperature of the air.",
  "If you look directly into the glass, the reflection might choose its own name."
];

export function AtmosphericFateLoader({ genre }: AtmosphericFateLoaderProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [ambientQuote, setAmbientQuote] = useState("");

  // Select random atmospheric lore quote on initial render
  useEffect(() => {
    let list = PARANORMAL_QUOTES;
    if (genre === "romance") list = ROMANCE_QUOTES;
    if (genre === "crime") list = NOIR_QUOTES;
    
    const randomQuote = list[Math.floor(Math.random() * list.length)];
    setAmbientQuote(randomQuote);
  }, [genre]);

  // Handle stage index rotation
  useEffect(() => {
    const stageInterval = setInterval(() => {
      setStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 2200);

    return () => clearInterval(stageInterval);
  }, []);

  // Handle fine-grained simulated progress indicator
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        // Slower progress as it nears 95% to maintain anticipation till network completes
        const increment = prev < 60 ? 3 : prev < 85 ? 1.5 : 0.4;
        return Math.min(99, prev + increment);
      });
    }, 100);

    return () => clearInterval(progressInterval);
  }, []);

  const getStyle = () => {
    switch (genre) {
      case "romance":
        return {
          bg: "bg-rose-950/20",
          border: "border-rose-500/20",
          glow: "shadow-rose-500/10",
          accentColor: "text-rose-400",
          barColor: "bg-rose-500",
          icon: Compass,
          label: "SENSORY COHERENCE"
        };
      case "crime":
        return {
          bg: "bg-yellow-500/5",
          border: "border-yellow-500/10",
          glow: "shadow-yellow-500/5",
          accentColor: "text-yellow-400",
          barColor: "bg-yellow-500",
          icon: Hourglass,
          label: "CHRONOLOGY LOGS"
        };
      case "paranormal":
      default:
        return {
          bg: "bg-purple-950/20",
          border: "border-purple-500/20",
          glow: "shadow-purple-500/10",
          accentColor: "text-purple-400",
          barColor: "bg-purple-600",
          icon: Orbit,
          label: "VEIL DISSOLUTION"
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;

  return (
    <div className={`p-6 md:p-8 rounded-[2rem] border min-h-[300px] flex flex-col justify-between items-center text-center transition-all ${style.bg} ${style.border} ${style.glow} shadow-2xl space-y-6 relative overflow-hidden`}>
      {/* Absolute faint animated background glows */}
      <div className="absolute inset-0 bg-radial-gradient from-current/5 to-transparent blur-2xl -z-10 pointer-events-none" />

      {/* Header Banner */}
      <div className="space-y-1.5">
        <span className="text-[9px] font-mono font-bold tracking-[0.4em] opacity-40 uppercase block">
          {style.label}
        </span>
        <div className="flex items-center justify-center gap-2">
          <Loader2 className={`w-4.5 h-4.5 animate-spin ${style.accentColor}`} />
          <h4 className="text-sm font-sans font-bold uppercase tracking-wider">
            Calculating Fate
          </h4>
        </div>
      </div>

      {/* Progressive Narrative disclosure center */}
      <div className="space-y-4 max-w-sm w-full py-4">
        {/* Stages Animation */}
        <div className="h-16 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={stageIndex}
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              className="space-y-1.5"
            >
              <div className={`text-sm font-serif font-black tracking-tight ${style.accentColor}`}>
                {STAGES[stageIndex].title}...
              </div>
              <p className="text-[11px] opacity-50 tracking-wide font-sans leading-relaxed">
                {STAGES[stageIndex].subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar container */}
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-300 ${style.barColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono opacity-40 px-1">
          <span>PROGRESS</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Flavor Lore / Atmospheric Quote Card */}
      {ambientQuote && (
        <div className="p-4 rounded-xl bg-black/25 border border-white/5 max-w-md w-full relative">
          <div className="absolute top-2 left-2 opacity-15">
            <Scroll className="w-4 h-4" />
          </div>
          <p className="text-[10px] font-serif italic leading-relaxed opacity-70 px-4">
            &quot;{ambientQuote}&quot;
          </p>
        </div>
      )}

      {/* Estimated wait time block */}
      <div className="space-y-1">
        <span className="text-[9px] font-mono opacity-30 uppercase tracking-widest block">
          Estimated Generation: ~8-12 seconds
        </span>
        <span className="text-[9px] font-mono opacity-20 block">
          This may take a moment for Gemini to weave richer atmospheric consequences.
        </span>
      </div>
    </div>
  );
}
