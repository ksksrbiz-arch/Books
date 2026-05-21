import React from "react";
import { motion } from "motion/react";
import { AlertCircle, Sliders, RefreshCw, Sparkles, Image as ImageIcon } from "lucide-react";

interface ImageFallbackContainerProps {
  genre: "romance" | "crime" | "paranormal" | null;
  sceneTitle: string;
  onRetry: () => void;
  imagePrompt?: string;
}

export function ImageFallbackContainer({
  genre,
  sceneTitle,
  onRetry,
  imagePrompt,
}: ImageFallbackContainerProps) {
  // Determine gorgeous ambient fallback Unsplash image matching genre
  const getFallbackUrl = () => {
    switch (genre) {
      case "romance":
        return "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1200&auto=format&fit=crop";
      case "crime":
        return "https://images.unsplash.com/photo-1505635339396-764047be6680?q=80&w=1200&auto=format&fit=crop";
      case "paranormal":
        return "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=1200&auto=format&fit=crop";
      default:
        return "https://images.unsplash.com/photo-1464802686167-b939a6910659?q=80&w=1200&auto=format&fit=crop";
    }
  };

  const getThemeStyles = () => {
    switch (genre) {
      case "romance":
        return {
          bg: "bg-rose-950/45 border-rose-400/20",
          text: "text-rose-200",
          accentText: "text-rose-100",
          btn: "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-950/50",
          borderColor: "border-rose-500/20",
          ambientGlow: "bg-rose-500/10",
          statusLabel: "Reality Mirror",
          msg: "A ripple swept through the romance timeline, preventing the scene illustration from being painted.",
        };
      case "crime":
        return {
          bg: "bg-zinc-950/80 border-white/10",
          text: "text-slate-300",
          accentText: "text-white",
          btn: "bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-black/80",
          borderColor: "border-white/10",
          ambientGlow: "bg-sky-500/5",
          statusLabel: "Evidence Ledger Fault",
          msg: "Atmospheric interference in the noir network delayed this scene's visual signal stream.",
        };
      case "paranormal":
        return {
          bg: "bg-[#0c0516]/90 border-purple-500/20",
          text: "text-purple-300",
          accentText: "text-purple-100",
          btn: "bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-950/60",
          borderColor: "border-purple-500/20",
          ambientGlow: "bg-purple-500/10",
          statusLabel: "Spirit Mirage Intercept",
          msg: "Ethereal vortex activity caused a displacement. The visual projection remains inside the veil.",
        };
      default:
        return {
          bg: "bg-zinc-900/90 border-white/5",
          text: "text-zinc-300",
          accentText: "text-white",
          btn: "bg-zinc-700 hover:bg-zinc-600 text-white",
          borderColor: "border-white/5",
          ambientGlow: "bg-white/5",
          statusLabel: "Neural System Offline",
          msg: "The narrative projection engine was unable to synthesize high-fidelity image data.",
        };
    }
  };

  const styles = getThemeStyles();

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* 2. Panoramic background with strong filter elements */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center filter saturate-[0.6] brightness-[0.25] blur-md scale-105 select-none pointer-events-none"
        style={{ backgroundImage: `url(${getFallbackUrl()})` }}
      />
      
      {/* Dramatic themed glow container */}
      <div className={`absolute inset-0 pointer-events-none ${styles.ambientGlow} blur-3xl`} />

      {/* 3. Glossy fallback card element */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`relative z-20 w-full max-w-md mx-4 p-6 rounded-3xl border backdrop-blur-2xl ${styles.bg} text-center space-y-4`}
      >
        <div className="flex justify-center">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 relative">
            <ImageIcon className="w-6 h-6 text-amber-400 animate-pulse" />
            <AlertCircle className="w-3.5 h-3.5 text-rose-500 absolute -bottom-1 -right-1" />
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[9px] uppercase font-mono tracking-[0.25em] text-amber-400 font-extrabold">
            {styles.statusLabel}
          </span>
          <h4 className={`text-base font-bold tracking-tight uppercase ${styles.accentText} leading-snug`}>
            {sceneTitle || "Visual Projection Halted"}
          </h4>
          <p className={`text-[11px] leading-relaxed opacity-75 ${styles.text}`}>
            {styles.msg}
          </p>
        </div>

        {/* Hidden detail about the prompt we attempted to load */}
        {imagePrompt && (
          <div className="py-2 px-3 rounded-xl bg-black/25 border border-white/5 text-left">
            <p className="text-[7.5px] uppercase font-mono tracking-wider opacity-40">Failed Manifest Signature</p>
            <p className="text-[9px] font-mono opacity-65 truncate text-white">{imagePrompt}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <button
            onClick={onRetry}
            className={`px-5 py-2.5 rounded-xl text-[10px] uppercase tracking-widest font-black transition-all flex items-center justify-center gap-2 ${styles.btn}`}
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin duration-[4s]" />
            Re-Project Reality
          </button>
        </div>
      </motion.div>
    </div>
  );
}
