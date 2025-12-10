import React, { useEffect, useRef } from 'react';

// Define colors as RGB objects
const PALETTE = [
  { r: 88, g: 28, b: 135 },   // Deep Purple
  { r: 14, g: 165, b: 233 },  // Sky Blue
  { r: 79, g: 70, b: 229 },   // Indigo
  { r: 236, g: 72, b: 153 },  // Pink
  { r: 16, g: 185, b: 129 },  // Emerald (Accent)
  { r: 59, g: 130, b: 246 },  // Blue
];

interface SubBlob {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  opacity: number;
}

interface MainBlob {
  anchorX: number; // 0-1 relative to screen width
  anchorY: number; // 0-1 relative to screen height
  phaseX: number;  // Random starting phase for sine wave
  phaseY: number;
  speedX: number;
  speedY: number;
  range: number;   // How far it wanders from anchor
  color: { r: number, g: number, b: number };
  parts: SubBlob[];
}

const Background: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrameId: number;
    let time = 0;

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    // --- CONFIGURATION ---
    // Manually position anchors to ensure EVERY side has coverage
    const anchors = [
      { x: 0.0, y: 0.0, c: 0 }, // Top Left
      { x: 1.0, y: 1.0, c: 1 }, // Bottom Right
      { x: 1.0, y: 0.0, c: 2 }, // Top Right
      { x: 0.0, y: 1.0, c: 3 }, // Bottom Left
      { x: 0.5, y: 0.2, c: 5 }, // Top Center
      { x: 0.5, y: 0.8, c: 4 }, // Bottom Center
    ];

    const blobs: MainBlob[] = anchors.map((anchor) => {
      const parts: SubBlob[] = [];
      const numParts = 4; // Complexity of shape

      for (let j = 0; j < numParts; j++) {
        parts.push({
          offsetX: random(-150, 150),
          offsetY: random(-150, 150),
          scaleX: random(1.2, 2.0), // Elongated shapes
          scaleY: random(0.8, 1.5),
          rotation: random(0, Math.PI * 2),
          rotationSpeed: random(-0.001, 0.001),
          // Massive radius to cover the screen edges
          radius: random(400, 700), 
          opacity: random(0.3, 0.5)
        });
      }

      return {
        anchorX: anchor.x,
        anchorY: anchor.y,
        phaseX: random(0, Math.PI * 2),
        phaseY: random(0, Math.PI * 2),
        speedX: random(0.0002, 0.0005),
        speedY: random(0.0002, 0.0005),
        range: 200, // Wandering range
        color: PALETTE[anchor.c % PALETTE.length],
        parts: parts
      };
    });

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const animate = () => {
      time += 1;

      // 1. Dark Base
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#020617'); 
      bgGradient.addColorStop(1, '#0f172a'); 
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Blobs using Sine Waves for organic floating
      ctx.globalCompositeOperation = 'screen'; 

      blobs.forEach((blob) => {
        // Calculate current position based on Anchor + Sine Wave
        // This keeps them in their "zone" but moving smoothly
        const currentX = (blob.anchorX * width) + Math.sin(time * blob.speedX + blob.phaseX) * blob.range;
        const currentY = (blob.anchorY * height) + Math.cos(time * blob.speedY + blob.phaseY) * blob.range;

        blob.parts.forEach((part) => {
          part.rotation += part.rotationSpeed;
          
          // Subtle breathing effect on radius
          const breathingRadius = part.radius + Math.sin(time * 0.001) * 20;

          ctx.save();
          ctx.translate(currentX + part.offsetX, currentY + part.offsetY);
          ctx.rotate(part.rotation);
          ctx.scale(part.scaleX, part.scaleY);

          const { r, g, b } = blob.color;
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, breathingRadius);
          
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${part.opacity})`);
          gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${part.opacity * 0.3})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, breathingRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      });

      // 3. Mouse Spotlight (Subtle)
      ctx.globalCompositeOperation = 'overlay';
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      
      // Slight lag for smoother feel
      // (Optional simple lerp could go here, but raw pos is fine for spotlight)

      const mouseGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 500);
      mouseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      mouseGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = mouseGrad;
      ctx.beginPath();
      ctx.arc(mx, my, 500, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    
    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 z-0 w-full h-full pointer-events-none"
      />
      {/* Cinematic Noise */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
        }}
      />
    </>
  );
};

export default Background;