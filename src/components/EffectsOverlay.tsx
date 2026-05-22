import React, { useRef, useEffect } from 'react';

interface EffectsOverlayProps {
  genre: 'romance' | 'crime' | 'paranormal' | null;
  intensity: number;
  isEnding?: boolean;
}

export function EffectsOverlay({ genre, intensity, isEnding }: EffectsOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: any[] = [];
    let animationFrameId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    
    // Listen for resize
    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(canvas);
    resize();

    // Initialize particles based on genre
    const initParticles = () => {
      particles = [];
      const count = genre === 'romance' ? 40 : genre === 'paranormal' ? 60 : genre === 'crime' ? 100 : 0;
      const effectiveCount = isEnding ? count * 2 : count * intensity;
      
      for (let i = 0; i < effectiveCount; i++) {
        if (genre === 'romance') {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * (isEnding ? 6 : 3) + 1,
            speedY: -Math.random() * (isEnding ? 2 : 1) - 0.5,
            speedX: Math.random() * 1 - 0.5,
            opacity: Math.random() * (isEnding ? 0.8 : 0.5) + 0.1
          });
        } else if (genre === 'paranormal') {
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * (isEnding ? 12 : 8) + 2,
            speedY: Math.random() * 0.5 - 0.25,
            speedX: Math.random() * 0.5 - 0.25,
            opacity: Math.random() * 0.3 + 0.05
          });
        } else if (genre === 'crime') {
          // Rain
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            length: Math.random() * 15 + 10,
            speedY: isEnding ? (Math.random() * 5 + 5) : (Math.random() * 10 + 10), // slower rain if ending
            speedX: Math.random() * 2 - 1,
            opacity: Math.random() * 0.4 + 0.1
          });
        }
      }
    };

    initParticles();

    let lastTime = 0;
    const render = (time: number) => {
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Genre specific background tint/filters
      if (genre === 'crime') {
        const fillAlpha = isEnding ? 0.3 : 0.1 * intensity;
        ctx.fillStyle = `rgba(0, 0, 0, ${fillAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (genre === 'romance') {
        const fillAlpha = isEnding ? 0.2 : 0.05 * intensity;
        ctx.fillStyle = `rgba(255, 180, 200, ${fillAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (genre === 'paranormal' && isEnding) {
        ctx.fillStyle = `rgba(70, 0, 100, 0.2)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      particles.forEach(p => {
        if (genre === 'romance') {
          p.y += p.speedY;
          p.x += p.speedX;
          if (p.y < 0) {
            p.y = canvas.height;
            p.x = Math.random() * canvas.width;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 100, 150, ${p.opacity})`;
          ctx.fill();
        } else if (genre === 'paranormal') {
          p.y += p.speedY;
          p.x += p.speedX;
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;

          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          gradient.addColorStop(0, `rgba(150, 50, 255, ${p.opacity})`);
          gradient.addColorStop(1, 'rgba(150, 50, 255, 0)');
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        } else if (genre === 'crime') {
          p.y += p.speedY;
          p.x += p.speedX;
          if (p.y > canvas.height) {
            p.y = -p.length;
            p.x = Math.random() * canvas.width;
          }
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.speedX, p.y + p.length);
          ctx.strokeStyle = `rgba(150, 150, 150, ${p.opacity})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Add film grain if crime
      if (genre === 'crime' && canvas.width > 0 && canvas.height > 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        // if ending, less intense noise, maybe more desaturated
        const noiseIntensity = isEnding ? 15 : 30 * intensity;
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * noiseIntensity;
          data[i] += noise;
          data[i+1] += noise;
          data[i+2] += noise;
          if (isEnding) {
            // Desaturate slightly
            const gray = (data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11);
            data[i] = data[i] * 0.5 + gray * 0.5;
            data[i+1] = data[i+1] * 0.5 + gray * 0.5;
            data[i+2] = data[i+2] * 0.5 + gray * 0.5;
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [genre, intensity, isEnding]);

  if (!genre) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none transition-all duration-1000 ${isEnding ? 'opacity-80' : 'opacity-100'}`}
      style={{
        zIndex: 10,
        mixBlendMode: genre === 'crime' ? 'multiply' : 'screen' // rain looks better without screen, grain too
      }}
    />
  );
}
