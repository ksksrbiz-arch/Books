import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Particle {
  id: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  size: number;
  initialRotation?: number;
  speedY: number;
  speedX: number;
  opacity: number;
  color: string;
  char?: string; // used for digital streams in sci-fi/crime
}

interface IntroductionParticlesProps {
  activeGenre: "romance" | "crime" | "paranormal" | null;
  reducedMotion?: boolean;
}

export function IntroductionParticles({
  activeGenre,
  reducedMotion = false,
}: IntroductionParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  // Configure parameters based on the currently active genre
  const config = useMemo(() => {
    switch (activeGenre) {
      case "romance":
        return {
          count: reducedMotion ? 6 : 30,
          colors: ["#fda4af", "#f43f5e", "#ec4899", "#f472b6", "#fb7185"],
          minSize: 8,
          maxSize: 22,
          minSpeedY: -0.3,
          maxSpeedY: -1.2,
          minSpeedX: -0.4,
          maxSpeedX: 0.4,
        };
      case "paranormal":
        return {
          count: reducedMotion ? 4 : 20,
          colors: ["#a855f7", "#c084fc", "#c084fc", "#3b82f6", "#6366f1"],
          minSize: 30, // Large glowing wisps
          maxSize: 75,
          minSpeedY: -0.15,
          maxSpeedY: -0.4,
          minSpeedX: -0.2,
          maxSpeedX: 0.2,
        };
      case "crime":
        return {
          count: reducedMotion ? 8 : 45,
          colors: ["#22c55e", "#10b981", "#38bdf8", "#0284c7"],
          minSize: 10,
          maxSize: 15,
          minSpeedY: 0.8, // Flow downwards like terminal data streams
          maxSpeedY: 2.2,
          minSpeedX: 0,
          maxSpeedX: 0,
        };
      default:
        // Generic elegant floating particles
        return {
          count: reducedMotion ? 5 : 25,
          colors: ["rgba(255,255,255,0.15)", "rgba(255,255,255,0.08)", "rgba(56,189,248,0.15)"],
          minSize: 3,
          maxSize: 8,
          minSpeedY: -0.2,
          maxSpeedY: -0.6,
          minSpeedX: -0.15,
          maxSpeedX: 0.15,
        };
    }
  }, [activeGenre, reducedMotion]);

  // Handle particle initialization and tick updates
  useEffect(() => {
    // Generate initial set
    const initParticles: Particle[] = Array.from({ length: config.count }).map(
      (_, i) => {
        const isCrime = activeGenre === "crime";
        return {
          id: i,
          x: Math.random() * 100,
          y: Math.random() * 100,
          size: Math.random() * (config.maxSize - config.minSize) + config.minSize,
          initialRotation: Math.random() * 360,
          speedY: Math.random() * (config.maxSpeedY - config.minSpeedY) + config.minSpeedY,
          speedX: Math.random() * (config.maxSpeedX - config.minSpeedX) + config.minSpeedX,
          opacity: Math.random() * 0.4 + 0.1,
          color: config.colors[Math.floor(Math.random() * config.colors.length)],
          char: isCrime ? (Math.random() > 0.5 ? "1" : "0") : undefined,
        };
      }
    );
    setParticles(initParticles);

    if (reducedMotion) return; // Stop animation loop if user prefers accessibility static display

    let animationFrameId: number;
    const update = () => {
      setParticles((prev) =>
        prev.map((p) => {
          let nextY = p.y + p.speedY;
          let nextX = p.x + p.speedX;

          // Wrap around vertical constraints
          if (activeGenre === "crime") {
            // descend down, resets from top
            if (nextY > 100) {
              nextY = -5;
              nextX = Math.random() * 100;
            }
          } else {
            // ascend up, resets from bottom
            if (nextY < -10) {
              nextY = 105;
              nextX = Math.random() * 100;
            }
          }

          // Wrap horizontally
          if (nextX < -5) nextX = 105;
          if (nextX > 105) nextX = -5;

          return {
            ...p,
            y: nextY,
            x: nextX,
          };
        })
      );
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, [config, activeGenre, reducedMotion]);

  // Path SVG elements for romance rose petals
  const drawRosePetal = (size: number, color: string) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 2px 4px rgba(244,63,94,0.15))" }}
    >
      <path
        d="M12 21C16.5 18 19 14.5 19 11C19 6.5 15.5 5 12 9C8.5 5 5 6.5 5 11C5 14.5 7.5 18 12 21Z"
        fill={color}
        fillOpacity="0.45"
      />
    </svg>
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 w-full h-full">
      <AnimatePresence>
        {particles.map((p) => {
          // Render based on active genre type
          return (
            <div
              key={p.id}
              className="absolute pointer-events-none transition-all duration-[60ms] ease-linear"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: `translate(-50%, -50%) ${
                  p.initialRotation ? `rotate(${p.initialRotation}deg)` : ""
                }`,
              }}
            >
              {activeGenre === "romance" ? (
                // Rose petal simulation
                <motion.div
                  animate={reducedMotion ? {} : { rotate: [0, 360], scale: [1, 1.1, 1] }}
                  transition={{
                    duration: 10 + (p.id % 5) * 4,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  {drawRosePetal(p.size, p.color)}
                </motion.div>
              ) : activeGenre === "paranormal" ? (
                // Ethereal glowing smoke wisps
                <div
                  className="rounded-full blur-2xl opacity-20"
                  style={{
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    backgroundColor: p.color,
                    boxShadow: `0 0 ${p.size / 2}px ${p.color}`,
                  }}
                />
              ) : activeGenre === "crime" ? (
                // Terminal binary digit trace stream
                <span
                  className="font-mono text-[9px] font-bold select-none whitespace-nowrap"
                  style={{
                    color: p.color,
                    opacity: p.opacity,
                    textShadow: `0 0 4px ${p.color}`,
                  }}
                >
                  {p.char}
                </span>
              ) : (
                // Standard elegant soft stardust dots
                <div
                  className="rounded-full blur-[0.5px]"
                  style={{
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                    backgroundColor: p.color,
                    opacity: p.opacity,
                  }}
                />
              )}
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
