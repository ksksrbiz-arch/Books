import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Sparkles, Orbit, Compass, Hourglass, Scroll, Flame, HelpCircle } from "lucide-react";

interface AtmosphericFateLoaderProps {
  genre: string | null;
}

const STAGES = [
  {
    title: "Weighing consequences",
    subtitle: "Evaluating the gravity of your path..."
  },
  {
    title: "Tracing ripples through time",
    subtitle: "Projecting divergent outcomes and chronological shifts..."
  },
  {
    title: "Drafting reality blueprints",
    subtitle: "Mapping dynamic character relationships and motivations..."
  },
  {
    title: "Rendering cinematic memory",
    subtitle: "Weaving deep sensory details and ambient tones..."
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
    }, 2000);

    return () => clearInterval(stageInterval);
  }, []);

  // Handle fine-grained simulated progress indicator
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        // Slower progress as it nears 95% to maintain anticipation till network completes
        const increment = prev < 50 ? 4 : prev < 80 ? 2 : 0.5;
        return Math.min(99, prev + increment);
      });
    }, 120);

    return () => clearInterval(progressInterval);
  }, []);

  const getStyle = () => {
    switch (genre) {
      case "romance":
        return {
          bg: "bg-rose-950/25",
          border: "border-rose-500/35",
          glow: "shadow-rose-500/15",
          accentColor: "text-rose-400",
          barColor: "bg-gradient-to-r from-rose-600 to-rose-400",
          icon: Compass,
          label: "SENSORY COHERENCE CONNECTION"
        };
      case "crime":
        return {
          bg: "bg-zinc-950/40",
          border: "border-amber-500/25",
          glow: "shadow-amber-500/10",
          accentColor: "text-amber-400",
          barColor: "bg-gradient-to-r from-amber-600 to-amber-400",
          icon: Hourglass,
          label: "CHRONOLOGY ECHO SYSTEM"
        };
      case "paranormal":
      default:
        return {
          bg: "bg-purple-950/25",
          border: "border-purple-500/35",
          glow: "shadow-purple-500/15",
          accentColor: "text-purple-400",
          barColor: "bg-gradient-to-r from-purple-600 to-purple-400",
          icon: Orbit,
          label: "VEIL DISSOLUTION EMULATOR"
        };
    }
  };

  const style = getStyle();
  const Icon = style.icon;

  return (
    <div className={`p-8 md:p-10 rounded-[2.5rem] border min-h-[350px] flex flex-col justify-between items-center text-center transition-all ${style.bg} ${style.border} ${style.glow} shadow-2xl space-y-8 relative overflow-hidden backdrop-blur-md`}>
      {/* Absolute faint animated background glows */}
      <div className="absolute inset-0 bg-radial-gradient from-current/5 to-transparent blur-3xl -z-10 pointer-events-none" />

      {/* Header Banner */}
      <div className="space-y-2">
        <span className="text-[10px] font-mono font-bold tracking-[0.4em] opacity-40 uppercase block">
          {style.label}
        </span>
        <div className="flex items-center justify-center gap-2">
          <Loader2 className={`w-5 h-5 animate-spin ${style.accentColor}`} />
          <h4 className="text-sm font-sans font-extrabold uppercase tracking-widest text-white">
            Calculating Fate
          </h4>
        </div>
      </div>

      {/* Progressive Narrative disclosure center */}
      <div className="space-y-5 max-w-sm w-full py-4 relative z-10">
        {/* Stages Animation */}
        <div className="h-20 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={stageIndex}
              initial={{ y: 20, opacity: 0, filter: "blur(2px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -20, opacity: 0, filter: "blur(2px)" }}
              className="space-y-2"
            >
              <div className={`text-base font-serif font-black tracking-tight ${style.accentColor}`}>
                {STAGES[stageIndex].title}...
              </div>
              <p className="text-[11px] opacity-60 tracking-wide font-sans leading-relaxed max-w-xs mx-auto text-gray-300">
                {STAGES[stageIndex].subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress bar container */}
        <div className="space-y-2">
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-300 ${style.barColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono opacity-50 px-1 text-gray-300">
            <span>TEMPORAL INDEX</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Flavor Lore / Atmospheric Quote Card */}
      {ambientQuote && (
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 max-w-md w-full relative">
          <div className="absolute top-2 left-2 opacity-15">
            <Scroll className="w-4 h-4" />
          </div>
          <p className="text-[10px] sm:text-[11px] font-serif italic leading-relaxed opacity-75 px-4 text-gray-100">
            &quot;{ambientQuote}&quot;
          </p>
        </div>
      )}

      {/* Immersive Microcopy footer */}
      <div className="pt-4 border-t border-white/5 w-full flex flex-col items-center space-y-1">
        <span className={`text-[11px] font-serif italic font-bold tracking-wide ${style.accentColor}`}>
          “Actions carry weight… some echoes take longer to fully form.”
        </span>
        <span className="text-[9px] font-mono opacity-30 text-gray-400">
          Weaving a high-fidelity destiny with Gemini AI. Estimated generation: ~8-12 seconds
        </span>
      </div>
    </div>
  );
}
