import { useEffect, useRef } from 'react';
import { useMusicStore } from '../store/musicStore';

export const useVisualizer = (canvasRef, mode, isVisualizerOpen) => {
  const analyserNode = useMusicStore((state) => state.analyserNode);
  const currentMood = useMusicStore((state) => state.currentMood);
  const animationFrameRef = useRef(null);

  // Keep track of rotation and physics state for mesmerizing effects
  const physicsRef = useRef({ 
    rotation: 0, 
    particles: [], 
    vortexAngle: 0,
    phase: 0 // For liquid ring movement
  });

  // Mood Color Mapping
  const getMoodColors = (mood) => {
    switch (mood) {
      case 'Chill': return { primary: '#00f0ff', secondary: '#7000ff' };
      case 'Energetic': return { primary: '#ff007f', secondary: '#ff4d00' };
      case 'Melancholy': return { primary: '#4b0082', secondary: '#00008b' };
      case 'Euphoric': return { primary: '#c8a44e', secondary: '#fff700' };
      case 'Focus': return { primary: '#00ff88', secondary: '#0088ff' };
      case 'Romantic': return { primary: '#ff69b4', secondary: '#8b0000' };
      default: return { primary: '#c8a44e', secondary: '#fff700' };
    }
  };

  useEffect(() => {
    if (!analyserNode || !isVisualizerOpen) return;

    const analyser = analyserNode;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Initial clear
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    const drawWaveform = (ctx, width, height) => {
      analyser.getByteTimeDomainData(dataArray);
      ctx.fillStyle = 'rgba(10, 10, 10, 0.2)';
      ctx.fillRect(0, 0, width, height);

      const centerY = height / 2;
      const colors = getMoodColors(currentMood);
      
      const layers = [
        { color: `${colors.primary}66`, blur: 20, width: 2 },
        { color: `${colors.secondary}66`, blur: 20, width: 2 },
        { color: colors.primary, blur: 15, width: 4 }
      ];

      layers.forEach((layer, idx) => {
        ctx.beginPath();
        ctx.lineWidth = layer.width;
        ctx.strokeStyle = layer.color;
        ctx.shadowBlur = layer.blur;
        ctx.shadowColor = layer.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const sliceWidth = width / bufferLength;
        let x = 0;
        const offset = idx * 10;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height / 2) + (Math.sin(i * 0.05 + offset) * 5);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
    };

    const drawBars = (ctx, width, height) => {
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
      ctx.fillRect(0, 0, width, height);

      const barCount = 64; 
      const barSpacing = 4;
      const totalSpacing = barSpacing * (barCount - 1);
      const barWidth = Math.max(1, (width - totalSpacing) / barCount);
      const barRadius = Math.max(0, barWidth / 2);
      
      const centerY = height / 2;
      const colors = getMoodColors(currentMood);
      
      const isMobile = width < 600;

      const activeRange = Math.floor(bufferLength * 0.6);
      const groupSize = Math.floor(activeRange / barCount);

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < groupSize; j++) {
          const index = i * groupSize + j;
          if (index < dataArray.length) sum += dataArray[index];
        }
        const avg = sum / groupSize;
        
        // Scale down on mobile to avoid touching edges
        const maxHeight = isMobile ? height / 4 : height / 2.2;
        const barHeight = Math.max(4, (avg / 255) * maxHeight);
        
        const x = i * (barWidth + barSpacing);
        
        // Only draw if width is sufficient
        if (barWidth > 0 && isFinite(x) && isFinite(barHeight)) {
          const barGrad = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);
          barGrad.addColorStop(0, colors.primary);
          barGrad.addColorStop(0.5, colors.secondary);
          barGrad.addColorStop(1, colors.primary);
          
          ctx.fillStyle = barGrad;
          ctx.shadowBlur = 15;
          ctx.shadowColor = `${colors.primary}66`;

          ctx.beginPath();
          ctx.roundRect(x, centerY - barHeight, barWidth, barHeight * 2, barRadius);
          ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
      physicsRef.current.rotation += 0.5;
    };

    const drawCircle = (ctx, width, height) => {
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = 'rgba(10, 10, 10, 0.4)';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      
      // Responsive radius: larger on mobile to fill the tall screen
      const isMobile = width < 600;
      const radius = Math.min(centerX, centerY) * (isMobile ? 0.6 : 0.38);
      
      const colors = getMoodColors(currentMood);

      physicsRef.current.rotation += 0.005; // Constant rotation
      const rot = physicsRef.current.rotation;

      // Draw dense radial bars
      const barCount = 180;
      const activeRange = Math.floor(bufferLength * 0.7);
      // Use at least 1 as divisor
      const groupSize = Math.max(1, Math.floor(activeRange / barCount));

      for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < groupSize; j++) {
          const index = i * groupSize + j;
          if (index < dataArray.length) sum += dataArray[index];
        }
        const val = sum / groupSize;
        
        // Dynamic bar height - slightly shorter on mobile to avoid touching edges
        const barHeight = Math.max(2, (val / 255) * (radius * (isMobile ? 0.8 : 1.2)));
        
        const rads = ((Math.PI * 2) / barCount) * i + rot;
        const xStart = centerX + Math.cos(rads) * radius;
        const yStart = centerY + Math.sin(rads) * radius;
        const xEnd = centerX + Math.cos(rads) * (radius + barHeight);
        const yEnd = centerY + Math.sin(rads) * (radius + barHeight);

        // SAFETY: Only draw if coordinates are valid numbers
        if (isFinite(xStart) && isFinite(yStart) && isFinite(xEnd) && isFinite(yEnd)) {
          // Gradient along the bar
          const grad = ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
          grad.addColorStop(0, colors.primary);
          grad.addColorStop(1, colors.secondary);
          
          ctx.strokeStyle = grad;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          
          // Glow effect
          ctx.shadowBlur = 10;
          ctx.shadowColor = colors.primary;

          ctx.beginPath();
          ctx.moveTo(xStart, yStart);
          ctx.lineTo(xEnd, yEnd);
          ctx.stroke();

          // Subtle inner accent
          if (i % 2 === 0) {
            const innerH = barHeight * 0.2;
            const xInEnd = centerX + Math.cos(rads) * (radius - innerH);
            const yInEnd = centerY + Math.sin(rads) * (radius - innerH);
            if (isFinite(xInEnd) && isFinite(yInEnd)) {
              ctx.strokeStyle = `${colors.secondary}88`;
              ctx.beginPath();
              ctx.moveTo(xStart, yStart);
              ctx.lineTo(xInEnd, yInEnd);
              ctx.stroke();
            }
          }
        }
      }
      ctx.shadowBlur = 0;
    };

    const drawParticles = (ctx, width, height) => {
      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = 'rgba(10, 10, 10, 0.4)'; 
      ctx.fillRect(0, 0, width, height);

      const average = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
      const particles = physicsRef.current.particles;
      const centerX = width / 2;
      const centerY = height / 2;
      const colors = getMoodColors(currentMood);

      physicsRef.current.vortexAngle += 0.01;
      const vAngle = physicsRef.current.vortexAngle;
      const isBeat = average > 60;
      
      if (isBeat && particles.length < 600) {
        for (let i = 0; i < 10; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * (average / 8) + 2;
          particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1,
            size: Math.random() * 4 + 2,
            color: Math.random() > 0.5 ? colors.primary : colors.secondary,
            angle: angle
          });
        }
      }

      if (particles.length < 150) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 0.5 + Math.random() * 0.5,
          size: Math.random() * 2 + 1,
          color: colors.primary
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.angle !== undefined) {
           p.vx += Math.cos(p.angle + vAngle) * 0.1;
           p.vy += Math.sin(p.angle + vAngle) * 0.1;
        }
        p.x += p.vx; p.y += p.vy;
        if (isBeat) { p.vx *= 1.02; p.vy *= 1.02; } else { p.vx *= 0.99; p.vy *= 0.99; }
        p.life -= 0.006;
        if (p.life <= 0 || p.x < -100 || p.x > width + 100 || p.y < -100 || p.y > height + 100) {
          particles.splice(i, 1);
        } else {
          ctx.shadowBlur = isBeat ? 20 : 8;
          ctx.shadowColor = p.color;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + average/100), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
    };

    const renderFrame = () => {
      if (!isVisualizerOpen) return;
      animationFrameRef.current = requestAnimationFrame(renderFrame);
      const canvas = canvasRef.current;
      if (!canvas) return; 
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      if (width === 0 || height === 0) return;
      const ctx = canvas.getContext('2d');
      
      // Ensure context is scaled correctly for DPR on every frame,
      // preventing duplicate offset rendering when canvas buffer resets.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      switch (mode) {
        case 'waveform': drawWaveform(ctx, width, height); break;
        case 'bars': drawBars(ctx, width, height); break;
        case 'circle': drawCircle(ctx, width, height); break;
        case 'particles': drawParticles(ctx, width, height); break;
        default: drawBars(ctx, width, height);
      }
    };

    renderFrame();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      physicsRef.current.particles = [];
    };
  }, [analyserNode, isVisualizerOpen, mode, canvasRef, currentMood]);
};
