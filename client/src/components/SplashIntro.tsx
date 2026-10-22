import React, { useState, useEffect } from 'react';

interface SplashIntroProps {
  onComplete: () => void;
  restaurantName?: string;
}

export const SplashIntro: React.FC<SplashIntroProps> = ({
  onComplete,
  restaurantName = 'Loaf n Leaf',
}) => {
  // Stages: 'enter' -> 'visible' -> 'swiping' -> done
  const [stage, setStage] = useState<'enter' | 'visible' | 'swiping'>('enter');

  useEffect(() => {
    // 1. Entrance animation starts immediately
    const enterTimer = setTimeout(() => {
      setStage('visible');
    }, 80);

    // 2. Hold on Logo & Name, then trigger diagonal swipe
    const swipeTimer = setTimeout(() => {
      setStage('swiping');
    }, 1800);

    // 3. Complete and unmount after diagonal swipe finishes
    const finishTimer = setTimeout(() => {
      onComplete();
    }, 2650);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(swipeTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden select-none">
      {/* Diagonal Swipe Screen Sheet */}
      <div
        className={`w-[140vw] h-[140vh] -left-[20vw] -top-[20vh] absolute bg-[#061A10] flex flex-col items-center justify-center text-white will-change-transform shadow-[40px_40px_80px_rgba(0,0,0,0.9)] border-b-4 border-r-4 border-emerald-500/50 transition-all duration-800 ease-[cubic-bezier(0.77,0,0.175,1)] ${
          stage === 'swiping'
            ? '-translate-x-[160%] -translate-y-[160%] -rotate-12 opacity-95'
            : 'translate-x-0 translate-y-0 rotate-0 opacity-100'
        }`}
      >
        {/* Ambient Botanical Radial Highlights */}
        <div className="absolute w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Diagonal Sheen Cut Accent Line */}
        <div className="absolute bottom-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-emerald-400 opacity-70" />

        {/* Center: ONLY Logo & Restaurant Name */}
        <div
          className={`relative z-10 flex flex-col items-center justify-center text-center px-4 transition-all duration-700 ease-out ${
            stage === 'enter'
              ? 'scale-85 opacity-0'
              : 'scale-100 opacity-100'
          }`}
        >
          {/* Logo Emblem */}
          <div className="relative mb-5">
            {/* Outer subtle glow ring */}
            <div className="absolute -inset-2.5 rounded-3xl bg-gradient-to-br from-emerald-400 to-amber-500 opacity-40 blur-md animate-pulse" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-[#0F3C24] via-[#0A2A1A] to-[#061B11] border-2 border-emerald-400/60 flex items-center justify-center shadow-2xl">
              <span className="text-5xl filter drop-shadow-md">🌿</span>
            </div>
          </div>

          {/* Restaurant Name */}
          <h1 className="text-4xl sm:text-5xl font-black text-emerald-50 tracking-tight font-serif drop-shadow-lg">
            {restaurantName}
          </h1>
        </div>
      </div>
    </div>
  );
};
