import React from 'react';
import { motion } from 'motion/react';
import { Heart, User, Eye } from 'lucide-react';

interface RelationshipMeterProps {
  name: string;
  affinity: number;
  suspicion: number;
  genre: string | null;
}

export function RelationshipMeter({ name, affinity, suspicion, genre }: RelationshipMeterProps) {
  const renderBar = (value: number, type: 'affinity' | 'suspicion') => {
    let colorClass = '';
    let icon = null;
    let label = '';
    
    if (type === 'affinity') {
      label = 'Affinity';
      if (value > 0) {
        colorClass = genre === 'romance' ? 'bg-rose-500' : 'bg-green-500';
        icon = <Heart className={`w-3 h-3 ${genre === 'romance' ? 'text-rose-500' : 'text-green-500'}`} />;
      } else {
        colorClass = 'bg-gray-500';
        icon = <Heart className={`w-3 h-3 text-gray-500`} />;
      }
    } else {
      label = 'Suspicion';
      if (value > 0) {
        colorClass = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
        icon = <Eye className={`w-3 h-3 text-red-500`} />;
      } else {
        colorClass = 'bg-blue-400';
        icon = <Eye className={`w-3 h-3 text-blue-400`} />;
      }
    }

    const leftPercentage = value < 0 ? 50 + value / 2 : 50;
    const widthPercentage = Math.abs(value) / 2;

    return (
      <div className="flex flex-col gap-1.5 mt-3">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-60">
          <div className="flex items-center gap-1.5">
            {icon}
            <span className={type === 'suspicion' && value > 0 ? 'text-red-400' : ''}>{label}</span>
          </div>
          <motion.span 
            key={value}
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`font-mono ${type === 'suspicion' && value > 0 ? 'text-red-400' : ''}`}
          >
            {value > 0 ? `+${value}` : value}
          </motion.span>
        </div>
        <div className={`relative w-full h-1.5 rounded-full overflow-hidden border ${genre === 'romance' ? 'bg-black/10 border-black/5' : 'bg-black/40 border-white/5'}`}>
          <div className={`absolute top-0 bottom-0 left-[50%] w-[2px] z-10 ${genre === 'romance' ? 'bg-black/10' : 'bg-white/20'}`} />
          <motion.div 
            initial={{ width: 0, left: '50%' }}
            animate={{ left: `${leftPercentage}%`, width: `${widthPercentage}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 15 }}
            className={`absolute top-0 bottom-0 ${colorClass} rounded-full`}
          />
        </div>
        <div className={`flex justify-between text-[8px] font-mono uppercase tracking-widest mt-0.5 px-0.5 ${genre === 'romance' ? 'text-black/30' : 'text-white/30'}`}>
          <span>{type === 'affinity' ? 'Hated' : 'Trusted'}</span>
          <span>{type === 'affinity' ? 'Loved' : 'Hunted'}</span>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-[1.5rem] border backdrop-blur-md shadow-xl ${
        genre === 'romance' 
          ? 'border-rose-100/50 bg-rose-50/50 text-rose-900' 
          : genre === 'crime' 
          ? 'border-red-500/10 bg-black/40 text-white' 
          : 'border-white/5 bg-black/40 text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
           genre === 'romance' ? 'bg-white shadow-sm' : 'bg-white/5'
        }`}>
          <User className={`w-4 h-4 ${genre === 'romance' ? 'text-rose-500' : 'opacity-70 text-white'}`} />
        </div>
        <h4 className={`text-sm font-black uppercase tracking-widest ${genre === 'romance' ? 'text-rose-950' : 'text-white/90'}`}>{name}</h4>
      </div>
      
      {affinity !== 0 && renderBar(affinity, 'affinity')}
      {suspicion !== 0 && renderBar(suspicion, 'suspicion')}
      {affinity === 0 && suspicion === 0 && (
         <div className="text-[10px] uppercase tracking-widest opacity-40 font-mono mt-4 text-center">No strong impressions yet...</div>
      )}
    </motion.div>
  );
}
