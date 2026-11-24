import { useEffect, useRef } from 'react';
import { castColor, type Recipe } from './analysis';
import type { LifeFrame } from './simulation';

const columns = (width: number) => (width < 480 ? 8 : width < 900 ? 12 : 16);

export default function LifeField({
  recipe,
  frames,
  selected,
  onSelect,
}: {
  recipe: Recipe;
  frames: LifeFrame[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef({ frames, selected });
  const refresh = useRef<(() => void) | undefined>();
  useEffect(() => {
    current.current = { frames, selected };
    refresh.current?.();
  }, [frames, selected]);

  useEffect(() => {
    const el = ref.current,
      ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const ids = [recipe.profile.id, ...recipe.agents.map((a) => a.id)];
    const seats = new Map(ids.map((id, i) => [id, i]));
    const colors = ids.map((_, i) => castColor(i));
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      last = -100;
    function draw(now: number) {
      if (!el || !ctx) return;
      const { frames: tiles, selected: focus } = current.current;
      const width = el.clientWidth,
        cols = columns(width),
        size = width / cols;
      if (!width) return;
      const height = Math.ceil(tiles.length / cols) * size,
        dpi = Math.min(devicePixelRatio, 1.6);
      if (el.width !== Math.round(width * dpi) || el.height !== Math.round(height * dpi)) {
        el.width = Math.round(width * dpi);
        el.height = Math.round(height * dpi);
        el.style.height = height + 'px';
      }
      ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const t = media.matches ? 0.8 : now * 0.001;
      tiles.forEach((tile, i) => {
        const left = (i % cols) * size + 1,
          top = Math.floor(i / cols) * size + 1;
        const chapter = tile.chapter,
          seed = (tile.seed % 533) * 0.029;
        ctx.fillStyle = i === focus ? '#263823' : chapter ? '#171e18' : '#111712';
        ctx.fillRect(left, top, size - 3, size - 3);
        if (i === focus) {
          ctx.strokeStyle = '#c6e99b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(left + 1, top + 1, size - 5, size - 5);
        }
        const motion = chapter ? t : 0;
        const points = ids.map((_, k) => {
          const angle =
            seed +
            (k * Math.PI * 2) / ids.length +
            motion * (k % 2 ? 0.22 : -0.2) +
            Math.sin(motion * 0.71 + seed + k) * 0.42;
          const score = k ? (chapter?.relative_states[k - 1]?.relationship_score ?? 50) : 50;
          const radius =
            size *
            ((k ? 0.17 : 0.065) +
              (100 - score) * 0.00085 +
              0.042 * Math.sin(motion * 0.9 + seed + k));
          return [
            left + size * 0.48 + Math.cos(angle) * radius,
            top + size * 0.49 + Math.sin(angle) * radius,
          ] as const;
        });
        if (chapter) {
          const beat = t * 1.05 + i * 0.37;
          const messages = chapter.private_messages;
          const message = messages[i === focus ? 0 : Math.floor(beat) % messages.length]!;
          const from = points[seats.get(message.from)!]!,
            to = points[seats.get(message.to)!]!;
          ctx.strokeStyle = 'rgba(211,239,170,.74)';
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(...from);
          ctx.lineTo(...to);
          ctx.stroke();
          const travel = beat % 1;
          ctx.fillStyle = '#f3f9d4';
          ctx.beginPath();
          ctx.arc(
            from[0] + (to[0] - from[0]) * travel,
            from[1] + (to[1] - from[1]) * travel,
            Math.max(1, size * 0.019),
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.globalAlpha = chapter ? 1 : 0.33;
        points.forEach(([x, y], k) => {
          ctx.fillStyle = colors[k]!;
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
        ctx.globalAlpha = 1;
        if (size > 51) {
          ctx.fillStyle = i === focus ? '#d6eabe' : '#8b978c';
          ctx.font = '8px monospace';
          ctx.fillText(String(i + 1).padStart(3, '0'), left + 4, top + size - 6);
        }
      });
    }
    function tick(now: number) {
      if (now - last >= 65) {
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
    refresh.current = () => draw(performance.now());
    const observer = new ResizeObserver(redraw);
    observer.observe(el);
    media.addEventListener('change', redraw);
    redraw();
    return () => {
      observer.disconnect();
      media.removeEventListener('change', redraw);
      cancelAnimationFrame(frame);
      refresh.current = undefined;
    };
  }, [recipe]);
  return (
    <canvas
      ref={ref}
      className="mx-field"
      role="img"
      aria-label={`${frames.length} simulated lives, each with ${recipe.agents.length + 1} color-coded agents. Active lines follow their interactions.`}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect(),
          cols = columns(rect.width),
          size = rect.width / cols;
        const index =
          Math.floor((event.clientY - rect.top) / size) * cols +
          Math.floor((event.clientX - rect.left) / size);
        if (index >= 0 && index < frames.length) onSelect(index);
      }}
    />
  );
}
