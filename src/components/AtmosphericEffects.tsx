import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface AtmosphericEffectsProps {
  genre: string | null;
  mood?: string | null | undefined;
  reducedMotion?: boolean;
}

export const AtmosphericEffects: React.FC<AtmosphericEffectsProps> = ({
  genre,
  mood,
  reducedMotion = false,
}) => {
  if (!genre) return null;

  const normalizedMood = mood?.toLowerCase() || '';

  // 1. DYNAMIC COLOR PROFILE RESOLVER
  const theme = useMemo(() => {
    switch (genre) {
      case 'romance':
        if (normalizedMood.includes('passion') || normalizedMood.includes('intense') || normalizedMood.includes('danger')) {
          // Intense romantic color palette (deep crimson, rich rose, golden amber)
          return {
            gradient: 'from-rose-950/15 via-rose-900/10 to-amber-950/5',
            orbs: [
              'rgba(244, 63, 94, 0.25)', // rose-500
              'rgba(225, 29, 72, 0.15)',  // rose-600
              'rgba(245, 158, 11, 0.15)', // amber-500
              'rgba(159, 18, 57, 0.2)',   // rose-900
            ],
            particles: ['#fda4af', '#f43f5e', '#fb7185', '#ec4899', '#fbbf24']
          };
        } else if (normalizedMood.includes('sad') || normalizedMood.includes('melancholy') || normalizedMood.includes('grief')) {
          // Melancholy / Blue romance
          return {
            gradient: 'from-slate-900/10 via-rose-950/5 to-indigo-950/10',
            orbs: [
              'rgba(168, 85, 247, 0.12)', // purple-500
              'rgba(244, 114, 182, 0.08)', // pink-400
              'rgba(129, 140, 248, 0.12)', // indigo-400
              'rgba(74, 222, 128, 0.05)',  // emerald green highlight
            ],
            particles: ['#c084fc', '#f472b6', '#818cf8', '#fed7aa']
          };
        }
        // Cute / Cozy romance
        return {
          gradient: 'from-pink-50/10 via-rose-50/5 to-amber-50/10',
          orbs: [
            'rgba(251, 207, 232, 0.3)', // pink-200
            'rgba(254, 243, 199, 0.25)', // amber-100
            'rgba(253, 244, 245, 0.4)', // clean warm-white
            'rgba(244, 114, 182, 0.15)', // pink-400
          ],
          particles: ['#fbcfe8', '#fef3c7', '#fda4af', '#fae8ff', '#ffe4e6']
        };

      case 'crime':
        if (normalizedMood.includes('intense') || normalizedMood.includes('chase') || normalizedMood.includes('action')) {
          // Action-packed thriller
          return {
            gradient: 'from-[#0b0c10] via-red-950/20 to-sky-950/30',
            orbs: [
              'rgba(239, 68, 68, 0.15)',   // red-500
              'rgba(30, 41, 59, 0.4)',    // slate-800
              'rgba(2, 132, 199, 0.15)',   // sky-600
              'rgba(15, 23, 42, 0.5)',     // slate-900
            ],
            particles: ['#ef4444', '#38bdf8', '#64748b', '#0284c7']
          };
        } else if (normalizedMood.includes('mystery') || normalizedMood.includes('detective') || normalizedMood.includes('investigate')) {
          // Warm neon noir lantern glow
          return {
            gradient: 'from-[#08090d] via-amber-950/15 to-[#0b0c12]',
            orbs: [
              'rgba(245, 158, 11, 0.12)',  // amber lantern
              'rgba(14, 116, 144, 0.12)',  // cyan/ocean
              'rgba(30, 41, 59, 0.35)',   // slate grid
              'rgba(251, 191, 36, 0.08)',  // warm gold highlight
            ],
            particles: ['#f59e0b', '#0e7490', '#94a3b8', '#fbbf24']
          };
        }
        // Baseline Gritty Crime scene (blue, gray, charcoal)
        return {
          gradient: 'from-[#030712] via-[#0f172a] to-[#020617]',
          orbs: [
            'rgba(30, 41, 59, 0.35)',
            'rgba(15, 23, 42, 0.45)',
            'rgba(51, 65, 85, 0.25)',
            'rgba(71, 85, 105, 0.15)'
          ],
          particles: ['#cbd5e1', '#94a3b8', '#64748b', '#475569']
        };

      case 'paranormal':
        if (normalizedMood.includes('scary') || normalizedMood.includes('horror') || normalizedMood.includes('fear') || normalizedMood.includes('terror')) {
          // Haunting scary / horror (decaying green, deep violet shadow)
          return {
            gradient: 'from-[#06040a] via-emerald-950/20 to-purple-950/30',
            orbs: [
              'rgba(16, 185, 129, 0.12)',  // ghost green
              'rgba(88, 28, 135, 0.2)',    // deep purple
              'rgba(5, 150, 105, 0.1)',    // toxic emerald
              'rgba(0, 0, 0, 0.6)',        // shadow
            ],
            particles: ['#10b981', '#8b5cf6', '#34d399', '#7c3aed']
          };
        }
        // Spiritual swirling paranormal (ether violet, cosmic cyan)
        return {
          gradient: 'from-[#0d0714] via-[#1c0e35] to-[#0a0518]',
          orbs: [
            'rgba(168, 85, 247, 0.18)',  // purple-500
            'rgba(6, 182, 212, 0.15)',   // cyan-500
            'rgba(79, 70, 229, 0.15)',   // indigo-600
            'rgba(236, 72, 153, 0.1)',   // pink glow
          ],
          particles: ['#c084fc', '#22d3ee', '#818cf8', '#f472b6', '#a5b4fc']
        };

      default:
        return {
          gradient: 'from-[#0a0a0a] to-[#121212]',
          orbs: ['rgba(255,255,255,0.05)'],
          particles: ['#fff']
        };
    }
  }, [genre, normalizedMood]);

  return (
    <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden bg-gradient-to-b ${theme.gradient} transition-colors duration-[1.5s]`}>
      
      {/* ========================================== */}
      {/* 2. MAIN GENRE SPECIFIC BACKGROUND SYSTEMS */}
      {/* ========================================== */}

      {/* ROMANCE: SOFT GLOWING LIGHT SHARKS & FLUIDITY */}
      {genre === 'romance' && (
        <div className="absolute inset-0 w-full h-full">
          {/* Heart / Rose silhouette layout or massive breathing pulse lights */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(251,113,133,0.06)_0%,transparent_50%)]" />
          
          {/* Gentle Breathing Orbs */}
          {!reducedMotion && theme.orbs.map((color, i) => (
            <motion.div
              key={`rom-orb-${i}`}
              className="absolute rounded-full blur-[140px] opacity-70"
              style={{
                backgroundColor: color,
                width: `${350 + i * 120}px`,
                height: `${350 + i * 120}px`,
                left: `${15 + (i * 25) % 70}%`,
                top: `${10 + (i * 20) % 70}%`,
              }}
              animate={{
                x: [0, (i % 2 === 0 ? 60 : -60), 0],
                y: [0, (i % 2 === 0 ? -40 : 40), 0],
                scale: [1, 1.15, 0.95, 1],
              }}
              transition={{
                duration: 15 + i * 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          {/* Falling Floating Rose Flower Dust */}
          {theme.particles.map((color, i) => (
            <motion.div
              key={`rom-part-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${Math.random() * 8 + 4}px`,
                height: `${Math.random() * 8 + 4}px`,
                backgroundColor: color,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={reducedMotion ? {} : {
                y: [0, -250, 0],
                x: [0, Math.random() * 40 - 20, 0],
                opacity: [0.1, 0.5, 0.1],
              }}
              transition={{
                duration: 12 + (i % 4) * 3,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            />
          ))}
        </div>
      )}

      {/* CRIME: NOIR-INSPIRED TEXTURED FILM GRAIN & SLATE RAIN / drifting fog */}
      {genre === 'crime' && (
        <div className="absolute inset-0 w-full h-full">
          {/* Subtle noise grid pattern overlay for gritty vibe */}
          <div className="absolute inset-0 bg-[#000] opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 z-10" />

          {/* Drifting Streetlight Orbs */}
          {!reducedMotion && theme.orbs.map((color, i) => (
            <motion.div
              key={`crime-orb-${i}`}
              className="absolute rounded-full blur-[110px]"
              style={{
                backgroundColor: color,
                width: `${250 + i * 150}px`,
                height: `${250 + i * 150}px`,
                left: `${(i * 30) % 90}%`,
                bottom: `${(i * 20) % 65}%`,
              }}
              animate={{
                x: [0, (i % 2 === 0 ? 30 : -30), 0],
                opacity: [0.3, 0.55, 0.3],
              }}
              transition={{
                duration: 18 + i * 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}

          {/* Textured Drifting Midnight Fog clouds */}
          {!reducedMotion && (
            <>
              <motion.div
                className="absolute -left-64 bottom-0 w-[600px] h-96 rounded-full bg-slate-900/15 blur-[120px] mix-blend-screen pointer-events-none"
                animate={{ x: ['-20%', '120%'] }}
                transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute -right-64 top-1/4 w-[500px] h-[300px] rounded-full bg-zinc-900/10 blur-[100px] mix-blend-screen pointer-events-none"
                animate={{ x: ['120%', '-20%'] }}
                transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
              />
            </>
          )}

          {/* Dynamic Rain falling streaks overlay */}
          {!reducedMotion && (
            <div className="absolute inset-0 opacity-[0.25]">
              {Array.from({ length: 30 }).map((_, i) => (
                <motion.div
                  key={`rain-${i}`}
                  className="absolute w-[1px] h-[50px] bg-slate-400/60"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * -20}%`,
                  }}
                  animate={{
                    y: ['0vh', '120vh'],
                    x: ['0px', '-40px'],
                  }}
                  transition={{
                    duration: 1.0 + Math.random() * 0.7,
                    repeat: Infinity,
                    ease: "linear",
                    delay: Math.random() * 2,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* PARANORMAL: SWIRLING SWALLOWING CODES & SPIRAL NEONS */}
      {genre === 'paranormal' && (
        <div className="absolute inset-0 w-full h-full">
          {/* Magical radial void background */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(88,28,135,0.08)_0%,transparent_75%)]" />

          {/* Giant Swirling Cosmic Ethereal Orbs */}
          {!reducedMotion && theme.orbs.map((color, i) => (
            <motion.div
              key={`para-orb-${i}`}
              className="absolute rounded-full blur-[150px] opacity-60"
              style={{
                backgroundColor: color,
                width: `${400 + i * 180}px`,
                height: `${400 + i * 180}px`,
                left: `${10 + (i * 30) % 80}%`,
                top: `${10 + (i * 25) % 70}%`,
              }}
              animate={{
                rotate: [0, 360],
                scale: [1, 1.25, 1],
                x: [0, Math.sin(i) * 50, 0],
                y: [0, Math.cos(i) * 50, 0],
              }}
              transition={{
                duration: 25 + i * 8,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          ))}

          {/* Upwards drifting spirit particle souls */}
          {theme.particles.map((color, i) => (
            <motion.div
              key={`para-part-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${Math.random() * 6 + 2}px`,
                height: `${Math.random() * 6 + 2}px`,
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}`,
                left: `${Math.random() * 100}%`,
                bottom: `${Math.random() * -10}%`,
              }}
              animate={reducedMotion ? {} : {
                y: [0, -1100],
                x: [0, Math.sin(i * 1.5) * 60, 0],
                opacity: [0, 0.7, 0],
              }}
              transition={{
                duration: 15 + (i % 6) * 4,
                repeat: Infinity,
                ease: "easeOut",
                delay: i * 0.4,
              }}
            />
          ))}

          {/* Swirling space wisps lines */}
          {!reducedMotion && (
            <div className="absolute inset-0 mix-blend-screen opacity-15">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={`wisp-${i}`}
                  className="absolute w-[200px] h-[200px] rounded-[40%] border border-cyan-400/40 border-dashed"
                  style={{
                    left: `${25 + i * 12}%`,
                    top: `${20 + i * 15}%`,
                  }}
                  animate={{
                    rotate: 360,
                    scale: [0.9, 1.25, 0.9],
                  }}
                  transition={{
                    duration: 30 + i * 10,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DEFAULT GRID FALLBACK */}
      {genre !== 'romance' && genre !== 'crime' && genre !== 'paranormal' && (
        <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] [background-size:24px_24px]" />
      )}

    </div>
  );
};
