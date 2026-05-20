import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Book, Wand2, ArrowRight, X, Compass, Cpu, Palette } from 'lucide-react';

interface OnboardingTutorialProps {
  onClose: () => void;
  genre: string | null;
}

const steps = [
  {
    title: "Welcome to Architect",
    icon: <Book className="w-8 h-8" />,
    content: "Prepare to woven stories where every choice alters the fabric of your journey. Architect uses AI to create unique narrative paths tailored to your decisions.",
    accent: "text-sky-500",
    bgAccent: "bg-sky-500/10 border-sky-500/20"
  },
  {
    title: "Choose Your Atmosphere",
    icon: <Palette className="w-8 h-8" />,
    content: "Begin by selecting a Genre. Each genre completely transforms the mood, visuals, and musical accompaniment of your adventure—from high-stakes Crime to ethereal Romance.",
    accent: "text-purple-500",
    bgAccent: "bg-purple-500/10 border-purple-500/20"
  },
  {
    title: "The Seed of a Story",
    icon: <Cpu className="w-8 h-8" />,
    content: "AI-generated premises act as the spark for your story. You can use these unique hooks to overcome writer's block, or write your own custom beginning to take full control.",
    accent: "text-green-500",
    bgAccent: "bg-green-500/10 border-green-500/20"
  },
  {
    title: "Forge Your Path",
    icon: <Compass className="w-8 h-8" />,
    content: "At every turn, you will face difficult choices. These decisions shape the narrative, influence relationships, and direct the generation of unique, cinematic visuals.",
    accent: "text-amber-500",
    bgAccent: "bg-amber-500/10 border-amber-500/20"
  }
];

export default function OnboardingTutorial({ onClose, genre }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      onClose();
    }
  };

  const isRomance = genre === 'romance';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        className={`w-full max-w-lg p-8 rounded-[2.5rem] border shadow-2xl overflow-hidden relative ${
          isRomance ? 'bg-white border-rose-100 text-rose-900' : 'bg-zinc-950 border-white/10 text-white'
        }`}
      >
        <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors z-20">
          <X className="w-5 h-5 opacity-50" />
        </button>

        <div className="relative z-10 pt-4 pb-8 min-h-[250px] flex flex-col justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center space-y-6"
            >
              <div className={`p-4 rounded-2xl border ${steps[currentStep].bgAccent} ${steps[currentStep].accent}`}>
                {steps[currentStep].icon}
              </div>
              <h2 className={`text-2xl md:text-3xl font-black uppercase tracking-tight`}>
                {steps[currentStep].title}
              </h2>
              <p className={`text-sm md:text-base leading-relaxed opacity-80 max-w-sm`}>
                {steps[currentStep].content}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-8 border-t pt-8 border-white/5">
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === currentStep 
                    ? (isRomance ? 'bg-rose-500 w-6' : 'bg-white w-6') 
                    : (isRomance ? 'bg-rose-200' : 'bg-white/20')
                }`} 
              />
            ))}
          </div>

          <button 
            onClick={handleNext}
            className={`px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
              isRomance 
                ? 'bg-rose-950 text-white hover:bg-rose-900' 
                : 'bg-white text-black hover:bg-gray-200'
            }`}
          >
            {currentStep === steps.length - 1 ? 'Start Journey' : 'Next'}
            {currentStep < steps.length - 1 && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
