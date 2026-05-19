import { motion } from 'motion/react';
import { useMemo } from 'react';

interface AtmosphericEffectsProps {
  genre: 'romance' | 'crime' | 'paranormal' | null;
  mood?: string;
}

export const AtmosphericEffects = ({ genre, mood }: AtmosphericEffectsProps) => {
  const particles = useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => ({
      left: Math.random() * 100,
      size: Math.random() * 10 + 5,
      delay: Math.random() * 10,
      duration: Math.random() * 8 + 7,
      opacity: Math.random() * 0.3 + 0.1,
    }));
  }, [genre]);

  if (!genre) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Genre Specific Base Overlays */}
      {genre === 'romance' && (
        <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/5 to-transparent mix-blend-overlay" />
      )}
      {genre === 'crime' && (
        <>
          <div className="absolute inset-0 noise-overlay opacity-[0.03] mix-blend-overlay" />
          <div className="absolute inset-0 scanline opacity-[0.05]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
        </>
      )}
      {genre === 'paranormal' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.08)_0%,transparent_80%)] animate-pulse-soft" />
      )}

      {/* Particle Systems */}
      {(genre === 'romance' || genre === 'paranormal') && particles.map((p, i) => (
        <div
          key={i}
          className={`absolute animate-float rounded-full blur-[2px] ${
            genre === 'romance' 
              ? mood?.toLowerCase().includes('dark') ? 'bg-rose-900/10' : 'bg-rose-200/30'
              : mood?.toLowerCase().includes('ominous') ? 'bg-purple-900/30' : 'bg-purple-300/20'
          }`}
          style={{
            left: `${p.left}%`,
            bottom: '-10vh',
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Specialty Mood Effects */}
      {mood?.toLowerCase().includes('mystery') && genre === 'crime' && (
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-white/5 blur-xl rounded-full animate-drift"
              style={{
                width: '300px',
                height: '100px',
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
