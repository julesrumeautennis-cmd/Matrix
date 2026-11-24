import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { makeRng } from '@eulogy/shared';
import { type Source } from '../../../../packages/shared/src/conversations';
import './matrix.css';

export function Mark() {
  return (
    <span aria-hidden="true" className="mx-mark">
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}
export function Header({ step }: { step?: number }) {
  return (
    <header className="mx-header">
      <Link className="mx-brand" to="/">
        <Mark />
        Matrix
      </Link>
      {step === undefined ? (
        <span className="mx-header-tag">Life simulator</span>
      ) : (
        <nav className="mx-progress" aria-label="Simulation progress">
          {['Profile', 'Analysis', 'Simulation', 'Outcomes'].map((s, i) => (
            <span
              key={s}
              aria-current={i === step ? 'step' : undefined}
              className={i < step ? 'past' : ''}
            >
              <i />
              {s}
            </span>
          ))}
        </nav>
      )}
    </header>
  );
}
export function Shell({ step, children }: { step: number; children: ReactNode }) {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const section = hash === '#circle' ? document.getElementById('circle') : null;
    if (section) section.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return (
    <div className="mx">
      <Header step={step} />
      <main className="mx-main">{children}</main>
    </div>
  );
}
export function Heading({
  label,
  children,
  detail,
}: {
  label?: string;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="mx-heading">
      {label && (
        <div className="mx-kicker">
          <i />
          {label}
        </div>
      )}
      <h1>{children}</h1>
      {detail && <p>{detail}</p>}
    </div>
  );
}
export function SourceIcon({ source }: { source: Source }) {
  const paths: Record<Source, ReactNode> = {
    whatsapp: (
      <>
        <path d="M4 19l1-4a8 8 0 1 1 4 4z" />
        <path d="M9 8c0 3 3 6 6 6l1-2-2-1-1 1-2-2 1-1-1-2z" />
      </>
    ),
    instagram: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r=".7" fill="currentColor" />
      </>
    ),
    imessage: <path d="M21 11c0 4-4 7-9 7h-1l-5 3 1-4c-3-1-5-3-5-6 0-4 4-8 10-8s9 4 9 8z" />,
    snapchat: (
      <path d="M7 9c-.5-8 10-8 10 0l-.3 2c1.5 1.2 2.6-.8 3.1.6.3 1-1.7 1.5-2.5 2 .6 2 2.1 3.4 4 3.8-.6.9-1.5 1-2.6 1.1l-.5 1.5-2.4-.2c-2.4 2-5.1 2-7.6 0L6 20l-.6-1.5c-1.1-.1-2-.3-2.6-1.1 2-.4 3.4-1.8 4-3.8-.9-.5-2.8-1-2.5-2 .5-1.4 1.6.6 3.1-.6z" />
    ),
    gmail: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="2" />
        <path d="m3.5 6 8.5 7 8.5-7" />
      </>
    ),
  };
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {paths[source]}
    </svg>
  );
}
// A projected wireframe of branching trajectories. The same field identifies the subject on both screens.
export function Orbit({ small = false }: { small?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const rng = makeRng(1701);
    const stars = Array.from({ length: small ? 70 : 250 }, () => [rng(), rng(), rng()]);
    const rings = Array.from({ length: small ? 34 : 63 }, (_, i) => ({
      latitude: (i / (small ? 33 : 62)) * 2.62 - 1.31,
      offset: rng() * 6.28,
    }));
    let frame = 0,
      last = -100;
    function paint(now: number) {
      if (!el || !ctx) return;
      const { width: w, height: h } = el.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio || 1, 1.8);
      if (el.width !== Math.round(w * scale) || el.height !== Math.round(h * scale)) {
        el.width = Math.round(w * scale);
        el.height = Math.round(h * scale);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const radius = Math.min(w * (small ? 0.43 : 0.4), h * 0.44),
        cx = w * 0.5,
        cy = h * 0.5;
      for (const [sx, sy, alpha] of stars) {
        ctx.fillStyle = 'rgba(184,202,173,' + alpha! * 0.41 + ')';
        ctx.fillRect(sx! * w, sy! * h, 0.9, 0.9);
      }
      const t = media.matches ? 0 : now * 0.000065;
      function project(lat: number, lon: number) {
        const ripple =
          1 + 0.079 * Math.sin(lon * 3 + lat * 4 + t) + 0.038 * Math.cos(lon * 7 - lat * 3);
        const x = Math.cos(lat) * Math.cos(lon) * ripple,
          y = Math.sin(lat) * ripple,
          z = Math.cos(lat) * Math.sin(lon) * ripple;
        const tilt = -0.35,
          yy = y * 0.94 - z * 0.34;
        return [
          cx + radius * (x * Math.cos(tilt) - yy * Math.sin(tilt)),
          cy + radius * (x * Math.sin(tilt) + yy * Math.cos(tilt)),
          z * 0.94 + y * 0.34,
        ] as const;
      }
      for (let j = 0; j < rings.length; j++) {
        const ring = rings[j]!;
        for (let k = 0; k < (small ? 95 : 175); k++) {
          const lon = (k / (small ? 95 : 175)) * Math.PI * 2 + t + ring.offset * 0.021;
          const p = project(ring.latitude + 0.05 * Math.sin(lon * 3 + j * 0.08), lon);
          const a = 0.11 + (p[2] + 1) * 0.3;
          ctx.fillStyle = 'rgba(' + (j % 9 === 0 ? '224,247,162' : '164,203,151') + ',' + a + ')';
          const dot = small ? 0.85 : 1.22;
          ctx.fillRect(p[0], p[1], dot, dot);
        }
      }
      ctx.strokeStyle = 'rgba(196,221,167,.25)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.23, radius * 0.26, -0.51, 0, Math.PI * 2);
      ctx.stroke();
      const p = project(0.35, -0.55 + t);
      ctx.fillStyle = '#d6fa9b';
      ctx.beginPath();
      ctx.arc(p[0], p[1], small ? 2 : 3.6, 0, Math.PI * 2);
      ctx.fill();
      if (!small) {
        ctx.strokeStyle = 'rgba(214,250,155,.65)';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    function tick(now: number) {
      if (now - last > 55) {
        paint(now);
        last = now;
      }
      if (!media.matches && !small) frame = requestAnimationFrame(tick);
    }
    function redraw() {
      cancelAnimationFrame(frame);
      paint(performance.now());
      if (!media.matches && !small) frame = requestAnimationFrame(tick);
    }
    const observer = new ResizeObserver(redraw);
    observer.observe(el);
    media.addEventListener('change', redraw);
    redraw();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener('change', redraw);
    };
  }, [small]);
  return <canvas className="mx-orbit" aria-hidden="true" ref={ref} />;
}
