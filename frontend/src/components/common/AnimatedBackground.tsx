import React, { useEffect, useRef, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  z: number; // depth (0..1, closer=1)
  radius: number;
  baseRadius: number;
  speedX: number;
  speedY: number;
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
  pulseSpeed: number;
  pulsePhase: number;
}

interface FloatingVeggie {
  x: number;
  y: number;
  z: number;
  emoji: string;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  bobPhase: number;
  bobAmplitude: number;
}

interface GlowOrb {
  x: number;
  y: number;
  radius: number;
  hue: number;
  speed: number;
  angle: number;
  orbitRadius: number;
  alpha: number;
}

// ─── Config ─────────────────────────────────────────────────────────────────
const PARTICLE_COUNT = 80;
const VEGGIE_COUNT = 12;
const ORB_COUNT = 5;
const VEGGIE_EMOJIS = ['🥬', '🥕', '🍅', '🥦', '🌽', '🥒', '🌿', '🍃', '🥔', '🧄', '🫑', '🍆'];

export const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const veggiesRef = useRef<FloatingVeggie[]>([]);
  const orbsRef = useRef<GlowOrb[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.defaultMuted = true;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  // ─── Initialization ──────────────────────────────────────────────────────
  const initParticles = useCallback((w: number, h: number) => {
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const z = Math.random();
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z,
        baseRadius: 1.5 + Math.random() * 3,
        radius: 1.5 + Math.random() * 3,
        speedX: (Math.random() - 0.5) * 0.4 * (0.3 + z * 0.7),
        speedY: -0.15 - Math.random() * 0.35 * (0.3 + z * 0.7),
        hue: 110 + Math.random() * 60, // green-emerald range
        saturation: 40 + Math.random() * 40,
        lightness: 55 + Math.random() * 25,
        alpha: 0.15 + Math.random() * 0.35 * z,
        pulseSpeed: 0.01 + Math.random() * 0.02,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, []);

  const initVeggies = useCallback((w: number, h: number) => {
    const veggies: FloatingVeggie[] = [];
    for (let i = 0; i < VEGGIE_COUNT; i++) {
      const z = 0.2 + Math.random() * 0.8;
      veggies.push({
        x: Math.random() * w,
        y: Math.random() * h,
        z,
        emoji: VEGGIE_EMOJIS[i % VEGGIE_EMOJIS.length],
        size: 18 + Math.random() * 22 * z,
        speedX: (Math.random() - 0.5) * 0.25,
        speedY: -0.08 - Math.random() * 0.15,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 0.4,
        bobPhase: Math.random() * Math.PI * 2,
        bobAmplitude: 8 + Math.random() * 15,
      });
    }
    veggiesRef.current = veggies;
  }, []);

  const initOrbs = useCallback((w: number, h: number) => {
    const orbs: GlowOrb[] = [];
    for (let i = 0; i < ORB_COUNT; i++) {
      orbs.push({
        x: w * (0.2 + Math.random() * 0.6),
        y: h * (0.2 + Math.random() * 0.6),
        radius: 80 + Math.random() * 180,
        hue: 100 + Math.random() * 80,
        speed: 0.0005 + Math.random() * 0.001,
        angle: Math.random() * Math.PI * 2,
        orbitRadius: 50 + Math.random() * 150,
        alpha: 0.04 + Math.random() * 0.06,
      });
    }
    orbsRef.current = orbs;
  }, []);

  // ─── Render Loop ──────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const time = timeRef.current;
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    // ── Clear Canvas for transparent overlay above video ───────────────
    ctx.clearRect(0, 0, w, h);

    // ── Animated gradient mesh waves ────────────────────────────────────
    const waveCount = 3;
    for (let i = 0; i < waveCount; i++) {
      ctx.beginPath();
      const waveY = h * (0.3 + i * 0.2);
      const amplitude = 50 + i * 30;
      const frequency = 0.002 - i * 0.0003;
      const phase = time * (0.3 + i * 0.15);

      ctx.moveTo(0, waveY);
      for (let x = 0; x <= w; x += 4) {
        const y = waveY + Math.sin(x * frequency + phase) * amplitude +
                  Math.cos(x * frequency * 1.5 + phase * 0.7) * amplitude * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const waveGrad = ctx.createLinearGradient(0, waveY - amplitude, 0, h);
      const hueShift = Math.sin(time * 0.2 + i) * 15;
      waveGrad.addColorStop(0, `hsla(${135 + hueShift + i * 10}, 60%, 18%, 0.03)`);
      waveGrad.addColorStop(0.5, `hsla(${145 + hueShift + i * 10}, 55%, 14%, 0.05)`);
      waveGrad.addColorStop(1, `hsla(${140 + hueShift}, 50%, 10%, 0.02)`);
      ctx.fillStyle = waveGrad;
      ctx.fill();
    }

    // ── Glow Orbs (background layer) ────────────────────────────────────
    for (const orb of orbsRef.current) {
      orb.angle += orb.speed;
      const ox = orb.x + Math.cos(orb.angle) * orb.orbitRadius;
      const oy = orb.y + Math.sin(orb.angle * 0.7) * orb.orbitRadius * 0.6;

      const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, orb.radius);
      grad.addColorStop(0, `hsla(${orb.hue}, 70%, 45%, ${orb.alpha * 1.5})`);
      grad.addColorStop(0.4, `hsla(${orb.hue}, 60%, 30%, ${orb.alpha * 0.7})`);
      grad.addColorStop(1, `hsla(${orb.hue}, 50%, 20%, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(ox - orb.radius, oy - orb.radius, orb.radius * 2, orb.radius * 2);
    }

    // ── Particles ───────────────────────────────────────────────────────
    for (const p of particlesRef.current) {
      // Mouse parallax
      const parallaxFactor = p.z * 0.015;
      const px = p.x + (mx - w / 2) * parallaxFactor;
      const py = p.y + (my - h / 2) * parallaxFactor;

      // Pulse
      p.radius = p.baseRadius + Math.sin(time * p.pulseSpeed * 60 + p.pulsePhase) * p.baseRadius * 0.3;

      // Glow
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.radius * 3);
      grad.addColorStop(0, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha})`);
      grad.addColorStop(0.5, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, ${p.alpha * 0.3})`);
      grad.addColorStop(1, `hsla(${p.hue}, ${p.saturation}%, ${p.lightness}%, 0)`);
      ctx.beginPath();
      ctx.arc(px, py, p.radius * 3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(px, py, p.radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, ${p.saturation + 10}%, ${p.lightness + 15}%, ${p.alpha * 1.2})`;
      ctx.fill();

      // Movement
      p.x += p.speedX;
      p.y += p.speedY;

      // Wrap
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
    }

    // ── Connection lines (nearby particles) ─────────────────────────────
    const connectionDistance = 120;
    for (let i = 0; i < particlesRef.current.length; i++) {
      for (let j = i + 1; j < particlesRef.current.length; j++) {
        const a = particlesRef.current[i];
        const b = particlesRef.current[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connectionDistance) {
          const opacity = (1 - dist / connectionDistance) * 0.08 * Math.min(a.z, b.z);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `hsla(140, 50%, 50%, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // ── Floating Veggies ────────────────────────────────────────────────
    for (const v of veggiesRef.current) {
      const parallaxFactor = v.z * 0.02;
      const vx = v.x + (mx - w / 2) * parallaxFactor;
      const bobY = Math.sin(time * 0.8 + v.bobPhase) * v.bobAmplitude;
      const vy = v.y + (my - h / 2) * parallaxFactor + bobY;

      ctx.save();
      ctx.globalAlpha = 0.12 + v.z * 0.12;
      ctx.translate(vx, vy);
      ctx.rotate((v.rotation + time * v.rotationSpeed * 30) * Math.PI / 180);
      ctx.font = `${v.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Glow behind emoji
      ctx.shadowColor = `hsla(140, 60%, 45%, 0.4)`;
      ctx.shadowBlur = 20 + v.z * 15;
      ctx.fillText(v.emoji, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Movement
      v.x += v.speedX;
      v.y += v.speedY;

      // Wrap
      if (v.y < -60) { v.y = h + 60; v.x = Math.random() * w; }
      if (v.x < -60) v.x = w + 60;
      if (v.x > w + 60) v.x = -60;
    }

    // ── Vignette overlay ────────────────────────────────────────────────
    const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.9);
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, w, h);


    timeRef.current += 0.016;
    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  // ─── Setup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      initParticles(window.innerWidth, window.innerHeight);
      initVeggies(window.innerWidth, window.innerHeight);
      initOrbs(window.innerWidth, window.innerHeight);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [initParticles, initVeggies, initOrbs, render]);

  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* Deep forest-green ambient base */}
      <div className="absolute inset-0 bg-[#040e07]" />

      {/* 3D Organic Video Background (plays across Home, Products, and all customer screens) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover object-center opacity-85 scale-[1.02] transition-opacity duration-1000 motion-reduce:hidden"
      >
        <source src="/videos/organic-vegetables-bg.mp4" type="video/mp4" />
      </video>

      {/* Subtle cinematic vignette for clean contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-emerald-950/30 to-slate-950/70 pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-slate-950/20 to-slate-950/60 pointer-events-none" />

      {/* Floating particles & 3D ambient canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
};

export default AnimatedBackground;
