import { useId } from 'react';
import { distribution } from './simulation';
type Bins = ReturnType<typeof distribution>;
export function ProbabilityChart({
  bins,
  selected,
  onPick,
}: {
  bins: Bins;
  selected: number;
  onPick: (i: number) => void;
}) {
  const uid = useId().replace(/:/g, ''),
    left = 46,
    right = 630,
    top = 28,
    bottom = 208,
    width = right - left;
  const max = Math.max(10, Math.ceil(Math.max(...bins.map((b) => b.percent)) / 10) * 10);
  const band = width / bins.length,
    x = (i: number) => left + (i + 0.5) * band,
    y = (v: number) => bottom - (v / max) * (bottom - top);
  const peak = bins.reduce((best, b, i) => (b.percent > bins[best]!.percent ? i : best), 0);
  let curve = 'M ' + left + ' ' + bottom;
  for (let i = 0; i <= bins.length; i++) {
    const prevX = i === 0 ? left : x(i - 1),
      prevY = i === 0 ? bottom : y(bins[i - 1]!.percent);
    const nextX = i === bins.length ? right : x(i),
      nextY = i === bins.length ? bottom : y(bins[i]!.percent);
    const mid = (prevX + nextX) / 2;
    curve += ' C ' + mid + ' ' + prevY + ' ' + mid + ' ' + nextY + ' ' + nextX + ' ' + nextY;
  }
  const ticks = Array.from({ length: max / 10 + 1 }, (_, i) => i * 10);
  return (
    <svg
      className="mx-chart"
      viewBox="0 0 650 248"
      aria-label="Probability distribution by five-year age at death. Select an age range to explore its lives."
    >
      <defs>
        <linearGradient id={uid} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#bce58b" stopOpacity=".27" />
          <stop offset="1" stopColor="#bce58b" stopOpacity=".02" />
        </linearGradient>
      </defs>
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={left}
            x2={right}
            y1={y(v)}
            y2={y(v)}
            stroke="#354038"
            strokeDasharray={v ? '3 5' : '0'}
          />
          <text x={left - 9} y={y(v) + 4} textAnchor="end">
            {v}%
          </text>
        </g>
      ))}
      {bins.map((b, i) => (
        <rect
          key={b.from}
          x={x(i) - band * 0.39}
          y={y(b.percent)}
          width={band * 0.78}
          height={bottom - y(b.percent)}
          fill={i === selected ? '#435637' : '#273329'}
          stroke={i === selected ? '#677d52' : '#354638'}
          strokeWidth=".7"
        />
      ))}
      <path d={curve + ' L ' + left + ' ' + bottom + ' Z'} fill={'url(#' + uid + ')'} />
      <path
        className="mx-density"
        d={curve}
        fill="none"
        stroke="#c4e99d"
        strokeWidth="2.5"
        pathLength="1"
      />
      {bins.map((b, i) => (
        <g key={b.from}>
          <text x={x(i)} y={bottom + 19} textAnchor="middle">
            {b.from}
          </text>
          {i === selected || i === peak ? (
            <>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={y(b.percent)}
                y2={bottom}
                stroke="#c4e99d"
                strokeDasharray="3 4"
              />
              <circle
                cx={x(i)}
                cy={y(b.percent)}
                r="6"
                fill="#cdeca3"
                stroke="#1b241c"
                strokeWidth="2"
              />
            </>
          ) : null}
          {b.lives.length > 0 && (
            <g
              className="mx-hit"
              role="button"
              tabIndex={0}
              aria-label={'Ages ' + b.from + ' to ' + b.to + ', ' + b.percent + ' percent'}
              aria-pressed={i === selected}
              onClick={() => onPick(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(i);
                }
              }}
            >
              <title>
                {b.from}–{b.to} years · {b.lives.length} lives
              </title>
              <rect
                x={left + i * band}
                width={band}
                y={top - 9}
                height={bottom - top + 28}
                fill="transparent"
              />
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
