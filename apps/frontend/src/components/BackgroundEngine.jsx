import React, { useEffect, useRef } from 'react';

const BackgroundEngine = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId = null;
    const mouse = { x: -1000, y: -1000 };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = 0;
        this.vy = 0.8 + Math.random() * 1.5;
        this.originalX = this.x;
        this.size = 2 + Math.random() * 2;
        this.opacity = 0.4 + Math.random() * 0.4;
      }

      update() {
        this.y += this.vy;
        
        if (this.y > canvas.height) {
          this.y = -10;
          this.x = Math.random() * canvas.width;
          this.originalX = this.x;
        }

        const dx = this.x - mouse.x;
        const dy = this.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 150) {
          const force = (150 - dist) / 150;
          const angle = Math.atan2(dy, dx);
          this.vx += Math.cos(angle) * force * 0.8;
        }

        this.x += this.vx;
        this.vx *= 0.9;
        this.x += (this.originalX - this.x) * 0.03;
      }

      draw() {
        ctx.fillStyle = `rgba(255, 92, 0, ${this.opacity * 0.6})`;
        ctx.fillRect(this.x, this.y, this.size, this.size);
      }
    }

    const init = () => {
      resize();
      particles = [];
      for (let i = 0; i < 250; i++) {
        particles.push(new Particle());
      }
    };

    const drawGrid = () => {
      ctx.strokeStyle = 'rgba(255, 92, 0, 0.08)';
      ctx.lineWidth = 1;
      
      for (let x = 0; x < canvas.width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    const animate = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      drawGrid();
      
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      
      animationId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleResize = () => {
      resize();
      particles.forEach(p => {
        if (p.y > canvas.height) p.y = 0;
        if (p.x > canvas.width) p.x = canvas.width / 2;
      });
    };

    init();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 1,
        pointerEvents: 'none'
      }}
    />
  );
};

export default BackgroundEngine;
