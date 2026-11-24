import { useEffect, useRef } from 'react';
import type { Recipe } from './analysis';
import { castColors } from './analysis';
import { lifeNumber, type MatrixLife } from './simulation';

export default function LifeField({
  recipe,
  lives,
  progress,
}: {
  recipe: Recipe;
  lives: MatrixLife[];
  progress: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    phase = useRef(progress);
  useEffect(() => {
    phase.current = progress;
  }, [progress]);
  useEffect(() => {
    const el = ref.current,
      ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      last = -100;
    function draw(now: number) {
      if (!el || !ctx) return;
      const width = el.clientWidth,
        cols = width < 500 ? 8 : width < 900 ? 12 : 16,
        size = width / cols;
      const height = Math.ceil(lives.length / cols) * size,
        dpi = Math.min(devicePixelRatio, 1.6);
      if (el.width !== Math.round(width * dpi) || el.height !== Math.round(height * dpi)) {
        el.width = Math.round(width * dpi);
        el.height = Math.round(height * dpi);
        el.style.height = height + 'px';
      }
      ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const t = media.matches ? 0.8 : now * 0.001;
      lives.forEach((life, i) => {
        const left = (i % cols) * size + 1,
          top = Math.floor(i / cols) * size + 1,
          cx = left + size * 0.48,
          cy = top + size * 0.49;
        ctx.fillStyle = i % 7 === 0 ? '#19231b' : '#131a16';
        ctx.fillRect(left, top, size - 3, size - 3);
        const clock = phase.current,
          chapter = life.years[Math.min(5, Math.floor(clock * 6))]!;
        const points = Array.from({ length: 6 }, (_, k) => {
          const seed = (life.seed % 533) * 0.029;
          const angle =
            seed + k * 1.047 + t * (k % 2 ? 0.22 : -0.2) + Math.sin(t * 0.71 + seed + k) * 0.42;
          const score = k ? chapter.relative_states[k - 1]!.relationship_score : 50;
          const radius =
            size *
            ((k ? 0.17 : 0.065) + (100 - score) * 0.00085 + 0.042 * Math.sin(t * 0.9 + seed + k));
          return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
        });
        const beat = t * 1.05 + i * 0.37;
        const message =
          chapter.private_messages[Math.floor(beat) % chapter.private_messages.length]!;
        const from = recipe.agents.findIndex((a) => a.id === message.from) + 1,
          to = recipe.agents.findIndex((a) => a.id === message.to) + 1;
        function line(a: number, b: number, color: string) {
          ctx!.strokeStyle = color;
          ctx!.lineWidth = 0.8;
          ctx!.beginPath();
          ctx!.moveTo(...points[a]!);
          ctx!.lineTo(...points[b]!);
          ctx!.stroke();
        }
        line(from, to, 'rgba(211,239,170,.69)');
        if (from && to) line(0, from, 'rgba(205,220,187,.32)');
        const travel = beat % 1;
        const a = points[from]!,
          b = points[to]!;
        ctx.fillStyle = '#f3f9d4';
        ctx.beginPath();
        ctx.arc(
          a[0] + (b[0] - a[0]) * travel,
          a[1] + (b[1] - a[1]) * travel,
          Math.max(1, size * 0.018),
          0,
          Math.PI * 2,
        );
        ctx.fill();
        points.forEach(([x, y], k) => {
          ctx.fillStyle = castColors[k]!;
          ctx.beginPath();
          ctx.arc(
            x,
            y,
            k ? Math.max(1.15, size * 0.026) : Math.max(1.5, size * 0.035),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        });
        if (size > 54) {
          ctx.fillStyle = '#8f9c90';
          ctx.font = '8px monospace';
          ctx.fillText(lifeNumber(life), left + 4, top + size - 7);
        }
      });
    }
    function tick(now: number) {
      if (now - last > 65) {
        draw(now);
        last = now;
      }
      if (!media.matches) frame = requestAnimationFrame(tick);
    }
    function redraw() {
      cancelAnimationFrame(frame);
      draw(performance.now());
      if (!media.matches) frame = requestAnimationFrame(tick);
    }
    const ob = new ResizeObserver(redraw);
    ob.observe(el);
    media.addEventListener('change', redraw);
    redraw();
    return () => {
      ob.disconnect();
      cancelAnimationFrame(frame);
      media.removeEventListener('change', redraw);
    };
  }, [recipe, lives]);
  return (
    <canvas
      ref={ref}
      className="mx-field"
      role="img"
      aria-label="100 simulated lives. Each square contains you and five color-coded people. Active lines follow their interactions."
    />
  );
}
