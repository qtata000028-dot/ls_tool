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

// NEW: Star Interface for "Sea of Stars"
interface Star {
  x: number;
  y: number;
  z: number; // Depth factor (0.1 = far, 1.0 = near)
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

// NEW: Shooting Star
interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  life: number; // 0 to 1
  active: boolean;
}

// Ripple Interface
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
  const mouseRef = useRef({ x: 0, y: 0 }); // Center init
  const ripplesRef = useRef<Ripple[]>([]); 
  const shootingStarRef = useRef<ShootingStar | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrameId: number;
    let time = 0;

    // Center mouse initially to prevent sudden jump
    mouseRef.current = { x: width / 2, y: height / 2 };

    const random = (min: number, max: number) => Math.random() * (max - min) + min;

    // --- 1. SETUP AURORA BLOBS (Flowing Background) ---
    const anchors = [
      { x: 0.0, y: 0.0, c: 0 },
      { x: 1.0, y: 1.0, c: 1 },
      { x: 1.0, y: 0.0, c: 2 },
      { x: 0.0, y: 1.0, c: 3 },
      { x: 0.5, y: 0.2, c: 5 },
      { x: 0.5, y: 0.8, c: 4 },
    ];

    const blobs: MainBlob[] = anchors.map((anchor) => {
      const parts: SubBlob[] = [];
      const numParts = 3;

      for (let j = 0; j < numParts; j++) {
        parts.push({
          offsetX: random(-100, 100),
          offsetY: random(-100, 100),
          scaleX: random(1.0, 2.5),
          scaleY: random(0.8, 1.2),
          rotation: random(0, Math.PI * 2),
          rotationSpeed: random(-0.005, 0.005),
          radius: random(500, 800),
          opacity: random(0.4, 0.6),
          driftSpeed: random(0.002, 0.005),
          driftPhase: random(0, Math.PI * 2),
        });
      }

      return {
        anchorX: anchor.x,
        anchorY: anchor.y,
        phaseX: random(0, Math.PI * 2),
        phaseY: random(0, Math.PI * 2),
        speedX: random(0.001, 0.0025),
        speedY: random(0.001, 0.0025),
        range: 350,
        color: PALETTE[anchor.c % PALETTE.length],
        parts: parts
      };
    });

    // --- 2. SETUP STARS (Starfield) ---
    const stars: Star[] = [];
    const starCount = 200; // Dense star field

    const initStars = () => {
      stars.length = 0;
      for (let i = 0; i < starCount; i++) {
        // Z determines depth: smaller Z = further away, moves slower, smaller size
        const z = Math.random(); 
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          z: z, 
          size: (1 - z) * 1.5 + 0.5, // Far stars are smaller
          baseAlpha: Math.random() * 0.6 + 0.2,
          twinkleSpeed: Math.random() * 0.03 + 0.005,
          twinklePhase: Math.random() * Math.PI * 2
        });
      }
    };
    initStars();

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      initStars();
    };

    const animate = () => {
      time += 1;

      // Clear
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
      bgGradient.addColorStop(0, '#020617'); 
      bgGradient.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 1: AURORA BLOBS ---
      ctx.globalCompositeOperation = 'screen'; 

      blobs.forEach((blob) => {
        const currentX = (blob.anchorX * width) + Math.sin(time * blob.speedX + blob.phaseX) * blob.range;
        const currentY = (blob.anchorY * height) + Math.cos(time * blob.speedY + blob.phaseY) * blob.range;

        blob.parts.forEach((part) => {
          part.rotation += part.rotationSpeed * 3;
          
          const internalDriftX = Math.sin(time * part.driftSpeed + part.driftPhase) * 80;
          const internalDriftY = Math.cos(time * part.driftSpeed + part.driftPhase) * 80;
          const breathingRadius = part.radius + Math.sin(time * 0.005) * 60;

          ctx.save();
          ctx.translate(
            currentX + part.offsetX + internalDriftX, 
            currentY + part.offsetY + internalDriftY
          );
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

      // --- LAYER 2: MOUSE SPOTLIGHT (Subtle fog) ---
      ctx.globalCompositeOperation = 'overlay';
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      
      const mouseGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 600);
      mouseGrad.addColorStop(0, 'rgba(200, 230, 255, 0.15)');
      mouseGrad.addColorStop(1, 'rgba(200, 230, 255, 0)');
      
      ctx.fillStyle = mouseGrad;
      ctx.beginPath();
      ctx.arc(mx, my, 600, 0, Math.PI * 2);
      ctx.fill();

      // --- LAYER 3: STARS (Parallax Starfield) ---
      ctx.globalCompositeOperation = 'source-over';
      
      // Calculate parallax offset based on mouse position relative to center
      const offsetX = (mx - width / 2) * 0.05; 
      const offsetY = (my - height / 2) * 0.05;

      stars.forEach(star => {
        // Parallax movement: Closer stars (high Z) move more than far stars
        // We move stars OPPOSITE to mouse to create depth
        const x = star.x - (offsetX * star.z);
        const y = star.y - (offsetY * star.z);

        // Twinkle calculation
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase);
        const alpha = star.baseAlpha + (twinkle * 0.3);
        const clampedAlpha = Math.max(0, Math.min(1, alpha));

        ctx.fillStyle = `rgba(255, 255, 255, ${clampedAlpha})`;
        
        // Draw star
        ctx.beginPath();
        ctx.arc(x, y, star.size, 0, Math.PI * 2);
        ctx.fill();

        // Occasional faint glow for bright stars
        if (clampedAlpha > 0.8) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = "white";
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // --- LAYER 4: SHOOTING STAR ---
      // Random spawn logic (approx every few seconds)
      if (!shootingStarRef.current && Math.random() < 0.005) {
        shootingStarRef.current = {
          x: Math.random() * width,
          y: Math.random() * height * 0.5, // Start in top half
          length: Math.random() * 80 + 50,
          speed: Math.random() * 10 + 10,
          angle: Math.PI / 4 + (Math.random() - 0.5) * 0.5, // roughly 45 degrees
          life: 1,
          active: true
        };
      }

      if (shootingStarRef.current && shootingStarRef.current.active) {
        const s = shootingStarRef.current;
        
        // Update position
        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life -= 0.02;

        if (s.life <= 0 || s.x > width || s.y > height) {
          s.active = false;
          shootingStarRef.current = null;
        } else {
          // Draw trail
          const grad = ctx.createLinearGradient(
            s.x, s.y, 
            s.x - Math.cos(s.angle) * s.length, 
            s.y - Math.sin(s.angle) * s.length
          );
          grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - Math.cos(s.angle) * s.length, s.y - Math.sin(s.angle) * s.length);
          ctx.stroke();

          // Draw head
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
          ctx.fill();
          
          // Cross flare
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, 8, 0.5, s.angle, 0, Math.PI*2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, 0.5, 8, s.angle, 0, Math.PI*2);
          ctx.fill();
        }
      }

      // --- LAYER 5: RIPPLES (ON CLICK) ---
      ripplesRef.current = ripplesRef.current.filter(r => r.alpha > 0.01 && r.radius < r.maxRadius);
      ctx.lineWidth = 2;
      ripplesRef.current.forEach(r => {
        r.radius += r.speed;
        r.alpha -= 0.015;
        
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${r.alpha * 0.4})`;
        ctx.stroke();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    
    const handleMouseDown = (e: MouseEvent) => {
       ripplesRef.current.push({
         x: e.clientX,
         y: e.clientY,
         radius: 10,
         maxRadius: 400,
         alpha: 1,
         speed: 6
       });
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    
    resize();
    animate();

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
      />
      {/* Cinematic Noise Overlay - Keeps texture */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`
        }}
      />
    </>
  );
};

export default Background;