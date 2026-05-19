import React from 'react';
import { motion } from 'motion/react';

interface AtmosphericEffectsProps {
  genre: string | null;
}

export const AtmosphericEffects: React.FC<AtmosphericEffectsProps> = ({ genre }) => {
  if (!genre) return null;

  const getColors = () => {
    switch (genre) {
      case 'romance':
        return ['rgba(255, 192, 203, 0.15)', 'rgba(251, 113, 133, 0.05)', 'rgba(254, 205, 211, 0.1)'];
      case 'crime':
        return ['rgba(15, 23, 42, 0.2)', 'rgba(30, 41, 59, 0.1)', 'rgba(2, 6, 23, 0.3)'];
      case 'paranormal':
        return ['rgba(88, 28, 135, 0.15)', 'rgba(59, 7, 100, 0.2)', 'rgba(30, 27, 75, 0.1)'];
      default:
        return ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'];
    }
  };

  const colors = getColors();

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Floating Orbs */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-[100px]"
          style={{
            background: colors[i % colors.length],
            width: Math.random() * 400 + 200,
            height: Math.random() * 400 + 200,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            x: [0, Math.random() * 100 - 50, 0],
            y: [0, Math.random() * 100 - 50, 0],
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: Math.random() * 20 + 10,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      ))}

      {/* Particle Rain / Dust */}
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={`p-${i}`}
          className="absolute w-1 h-1 bg-white/20 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: genre === 'romance' ? [-20, 20] : [0, -100],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: Math.random() * 10 + 5,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );
};
