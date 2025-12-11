import React, { useEffect, useRef } from 'react';

// Define colors as RGB objects
const PALETTE = [
  { r: 88, g: 28, b: 135 },   // Deep Purple
  { r: 14, g: 165, b: 233 },  // Sky Blue
  { r: 79, g: 70, b: 229 },   // Indigo
  { r: 236, g: 72, b: 153 },  // Pink
];

// Base64 Noise Image (Tiny texture, repeating) - Zero GPU cost compared to SVG filters
const NOISE_BG = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAGFBMVEUAAAA5OTkAAAAAAAAAAABMTExERERmZmUZhwwHAAAACHRSTlMAMwA1MzMzM7O0s14AAAB4SURBVDjLxZFJDgAhCemx5P7HRheDO5jygF+qzL4tMwmZjL8IOg/g5HnE/b6I826E+3OIV1fEpQtifSzi2hRxXhF3z4h0M8S9KeLJFfHkini8I9LNEPcmiHdXRHovIu2FSPtCpL0Q6W6Ie1fEuyni3hRx74pId0P8F0SURBws2m9N2wAAAABJRU5ErkJggg==')";

interface SubBlob {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  rotationSpeed: number;
  radius: number;
  opacity: number;
  driftSpeed: number;
  driftPhase: number;
}

interface MainBlob {
  anchorX: number;
  anchorY: number;
  phaseX: number;
  phaseY: number;
  speedX: number;
  speedY: number;
  range: number;
  color: { r: number, g: number, b: number };
  parts: SubBlob[];
}

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  speed: number;
}

const Background: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const ripplesRef = useRef<Ripple[]>([]); 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize: Disable alpha channel for main canvas
    if (!ctx) return;

    // PERFORMANCE SETTINGS
    const RENDER_SCALE = 0.5; // Render at 50% resolution (Huge performance boost for blur effects)
    const TARGET_FPS = 30;    // Cap at 30 FPS
    const FRAME_INTERVAL = 1000 / TARGET_FPS;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrameId: number;
    let time = 0;
    let lastTime = 0;

    mouseRef.current = { x: width / 2, y: height / 2 };

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    // --- 1. SIMPLIFIED AURORA BLOBS ---
    // Reduced count and complexity
    const anchors = [
      { x: 0.1, y: 0.1, c: 0 },
      { x: 0.9, y: 0.9, c: 1 },
      { x: 0.5, y: 0.5, c: 2 },
      { x: 0.2, y: 0.8, c: 3 },
    ];

    const blobs: MainBlob[] = anchors.map((anchor) => {
      // Reduced parts per blob from 3 to 2
      const parts: SubBlob[] = [];
      for (let j = 0; j < 2; j++) {
        parts.push({
          offsetX: random(-50, 50),
          offsetY: random(-50, 50),
          scaleX: random(1.0, 2.0),
          scaleY: random(0.8, 1.2),
          rotation: random(0, Math.PI * 2),
          rotationSpeed: random(-0.002, 0.002), // Slower rotation
          radius: random(400, 700),
          opacity: random(0.3, 0.5),
          driftSpeed: random(0.001, 0.003),
          driftPhase: random(0, Math.PI * 2),
        });
      }

      return {
        anchorX: anchor.x,
        anchorY: anchor.y,
        phaseX: random(0, Math.PI * 2),
        phaseY: random(0, Math.PI * 2),
        speedX: random(0.0005, 0.0015),
        speedY: random(0.0005, 0.0015),
        range: 200, // Reduced range
        color: PALETTE[anchor.c % PALETTE.length],
        parts: parts
      };
    });

    // --- 2. REDUCED STARS ---
    const stars: Star[] = [];
    const starCount = 60; // Reduced from 200 to 60

    const initStars = () => {
      stars.length = 0;
      for (let i = 0; i < starCount; i++) {
        const z = Math.random(); 
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: z, 
          size: (1 - z) * 1.5 + 0.5, 
          baseAlpha: Math.random() * 0.5 + 0.1,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinklePhase: Math.random() * Math.PI * 2
        });
      }
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      
      // Low-res backing store, High-res CSS display
      canvas.width = width * RENDER_SCALE;
      canvas.height = height * RENDER_SCALE;
      
      // Scale context once so we can draw using logical coordinates
      ctx.scale(RENDER_SCALE, RENDER_SCALE);
      
      initStars();
    };

    const animate = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(animate);

      // Throttling FPS
      const elapsed = timestamp - lastTime;
      if (elapsed < FRAME_INTERVAL) return;
      lastTime = timestamp - (elapsed % FRAME_INTERVAL);

      time += 1;

      // Clear & Base Background
      // Using fillRect is faster than clearRect + fillRect
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#020617'); 
      bgGradient.addColorStop(1, '#172554'); // Dark Blue
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 1: AURORA BLOBS ---
      // Use 'screen' for additive blending that doesn't darken
      ctx.globalCompositeOperation = 'screen'; 

      blobs.forEach((blob) => {
        const currentX = (blob.anchorX * width) + Math.sin(time * blob.speedX + blob.phaseX) * blob.range;
        const currentY = (blob.anchorY * height) + Math.cos(time * blob.speedY + blob.phaseY) * blob.range;

        blob.parts.forEach((part) => {
          part.rotation += part.rotationSpeed * 3;
          
          ctx.save();
          ctx.translate(
            currentX + part.offsetX, 
            currentY + part.offsetY
          );
          ctx.rotate(part.rotation);
          ctx.scale(part.scaleX, part.scaleY);

          const { r, g, b } = blob.color;
          // Optimize: Reduce gradient stops
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, part.radius);
          gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${part.opacity})`);
          gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, part.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      });

      // --- LAYER 2: MOUSE LIGHT ---
      ctx.globalCompositeOperation = 'overlay';
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      
      // Smaller, simpler gradient for mouse
      const mouseGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 400);
      mouseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      mouseGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = mouseGrad;
      ctx.beginPath();
      ctx.arc(mx, my, 400, 0, Math.PI * 2);
      ctx.fill();

      // --- LAYER 3: STARS ---
      ctx.globalCompositeOperation = 'source-over';
      const offsetX = (mx - width / 2) * 0.03; 
      const offsetY = (my - height / 2) * 0.03;

      ctx.fillStyle = 'white'; // Batch fill style
      stars.forEach(star => {
        const x = star.x - (offsetX * star.z);
        const y = star.y - (offsetY * star.z);
        
        // Simple alpha calculation
        const alpha = star.baseAlpha + Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.2;
        if (alpha <= 0) return;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        // Optimize: Draw small rectangles instead of arcs for stars (faster rasterization)
        // ctx.rect(x, y, star.size, star.size); 
        ctx.arc(x, y, star.size, 0, Math.PI * 2); // Arcs look better, keeping them for now as count is low
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // --- LAYER 4: RIPPLES ---
      // Clean up array
      if (ripplesRef.current.length > 0) {
        ripplesRef.current = ripplesRef.current.filter(r => r.alpha > 0.01 && r.radius < r.maxRadius);
        ctx.lineWidth = 2;
        ripplesRef.current.forEach(r => {
          r.radius += r.speed;
          r.alpha -= 0.02; // Fade faster
          
          ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha * 0.3})`;
          ctx.beginPath();
          ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
          ctx.stroke();
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Throttle mouse updates? Not strictly necessary but good practice
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseDown = (e: MouseEvent) => {
       if (ripplesRef.current.length < 5) { // Limit max ripples
         ripplesRef.current.push({
           x: e.clientX,
           y: e.clientY,
           radius: 10,
           maxRadius: 300,
           alpha: 1,
           speed: 8
         });
       }
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    
    resize();
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 z-0 w-full h-full pointer-events-none"
        style={{ width: '100%', height: '100%' }} // Ensure CSS stretches the low-res canvas
      />
      {/* Static Noise Image Overlay - Very cheap performance cost */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: NOISE_BG,
          backgroundRepeat: 'repeat',
        }}
      />
    </>
  );
};

export default Background;