/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyserNode: AnalyserNode | null;
  isRecording: boolean;
  isPaused: boolean;
}

export default function AudioVisualizer({
  analyserNode,
  isRecording,
  isPaused,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    // Render loop
    const render = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      // Clear with elegant soft dark background or very clean grid
      ctx.clearRect(0, 0, width, height);

      // Draw faint horizontal center line
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.4)'; // slate-200/40
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (isRecording && analyserNode && !isPaused) {
        // High fidelity waveform drawing
        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 2.5;
        // Dual layer waves for a rich, professional 3D-glowing effect
        
        // Layer 1: Ambient fill (translucent emerald/teal)
        ctx.beginPath();
        ctx.moveTo(0, height / 2);

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0; // Normalized between 0 and 2
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }
        ctx.lineTo(width, height / 2);
        
        const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
        fillGradient.addColorStop(0, 'rgba(16, 185, 129, 0.08)'); // emerald-500
        fillGradient.addColorStop(0.5, 'rgba(20, 184, 166, 0.15)'); // teal-500
        fillGradient.addColorStop(1, 'rgba(16, 185, 129, 0.01)');
        ctx.fillStyle = fillGradient;
        ctx.fill();

        // Layer 2: Glowing main line
        ctx.beginPath();
        x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            // Smooth curve interpolation
            const prevX = x - sliceWidth;
            const prevV = dataArray[i - 1] / 128.0;
            const prevY = (prevV * height) / 2;
            const cpX = prevX + sliceWidth / 2;
            ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
          }
          x += sliceWidth;
        }

        const lineGradient = ctx.createLinearGradient(0, 0, width, 0);
        lineGradient.addColorStop(0, '#10b981'); // emerald-500
        lineGradient.addColorStop(0.5, '#06b6d4'); // cyan-500
        lineGradient.addColorStop(1, '#14b8a6'); // teal-500
        ctx.strokeStyle = lineGradient;
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

      } else {
        // Idle state or paused state
        // Render a soft, living sinusoidal breathing wave
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = isPaused ? '#e11d48' : '#cbd5e1'; // Rose-600 when paused, Slate-300 when idle
        
        const amplitude = isPaused ? 4 : 2;
        const speed = isPaused ? 0.04 : 0.015;
        const frequency = 0.015;
        const offset = Date.now() * speed;

        ctx.moveTo(0, height / 2);
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * frequency + offset) * amplitude;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [analyserNode, isRecording, isPaused]);

  return (
    <div className="relative w-full h-32 bg-slate-50 border border-slate-200/60 rounded-xl overflow-hidden shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full block" id="audio-visualizer-canvas" />
      {isPaused && (
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-200/80 rounded-full text-xs font-semibold tracking-wider uppercase animate-pulse">
            Recording Paused
          </span>
        </div>
      )}
      {!isRecording && (
        <div className="absolute bottom-2 right-3 pointer-events-none text-[10px] text-slate-400 font-mono">
          Visualizer Idle
        </div>
      )}
    </div>
  );
}
