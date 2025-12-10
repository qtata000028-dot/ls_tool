import React, { useEffect, useState } from 'react';

const Background: React.FC = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePos({
        x: event.clientX,
        y: event.clientY,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#050510]">
      {/* 
        Interactive Fluid Background 
        Strategy: Use a parallax wrapper (reacting to mouse) containing an animated blob (floating automatically).
      */}

      <div className="absolute inset-0 w-full h-full">
        
        {/* Blob 1: Purple (Moves opposite to mouse, slow) */}
        <div 
          className="absolute top-[-10%] left-[-10%] transition-transform duration-[1500ms] ease-out will-change-transform"
          style={{ transform: `translate(${mousePos.x * -0.02}px, ${mousePos.y * -0.02}px)` }}
        >
           <div className="w-[50vw] h-[50vw] bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob" />
        </div>
        
        {/* Blob 2: Cyan (Moves with mouse, medium speed) */}
        <div 
          className="absolute top-[10%] right-[-20%] transition-transform duration-[1500ms] ease-out will-change-transform"
          style={{ transform: `translate(${mousePos.x * 0.03}px, ${mousePos.y * 0.03}px)` }}
        >
          <div className="w-[45vw] h-[45vw] bg-cyan-500 rounded-full mix-blend-screen filter blur-[120px] opacity-40 animate-blob-slow animation-delay-2000" />
        </div>
        
        {/* Blob 3: Pink/Red (Moves with mouse, fast, vertical bias) */}
        <div 
          className="absolute -bottom-[20%] left-[20%] transition-transform duration-[1500ms] ease-out will-change-transform"
          style={{ transform: `translate(${mousePos.x * 0.02}px, ${mousePos.y * 0.05}px)` }}
        >
          <div className="w-[50vw] h-[50vw] bg-rose-600 rounded-full mix-blend-screen filter blur-[100px] opacity-30 animate-blob-reverse animation-delay-4000" />
        </div>

        {/* Blob 4: Indigo (Moves opposite, horizontal bias) */}
        <div 
          className="absolute bottom-[-10%] -right-[10%] transition-transform duration-[1500ms] ease-out will-change-transform"
          style={{ transform: `translate(${mousePos.x * -0.04}px, ${mousePos.y * 0.01}px)` }}
        >
          <div className="w-[40vw] h-[40vw] bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-6000" />
        </div>

        {/* INTERACTIVE CURSOR GLOW: Follows mouse directly */}
        <div 
          className="pointer-events-none absolute w-[600px] h-[600px] rounded-full mix-blend-screen filter blur-[100px] opacity-20 transition-transform duration-75 will-change-transform"
          style={{ 
            background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(100,200,255,0) 70%)',
            left: -300, 
            top: -300,
            transform: `translate(${mousePos.x}px, ${mousePos.y}px)`
          }}
        />

      </div>

      {/* Noise Texture (Adds cinematic grain) */}
      <div className="absolute inset-0 opacity-[0.15] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none mix-blend-overlay" />
    </div>
  );
};

export default Background;