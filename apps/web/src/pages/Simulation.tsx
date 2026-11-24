import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { castColor, getRecipe, type Recipe } from '../matrix/analysis';
import { getLives } from '../matrix/simulation';
import { Heading, Shell } from '../matrix/Chrome';
import LifeField from '../matrix/LifeField';
function FieldPage({ recipe }: { recipe: Recipe }) {
  const lives = getLives(recipe),
    navigate = useNavigate(),
    [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = Date.now(),
      duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1400 : 9600;
    const interval = setInterval(
      () => setProgress(Math.min(1, (Date.now() - start) / duration)),
      90,
    );
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (progress < 1) return;
    const timer = setTimeout(() => navigate('/lives', { replace: true }), 1150);
    return () => clearTimeout(timer);
  }, [progress, navigate]);
  const chapter = Math.min(5, Math.floor(progress * 6));
  return (
    <Shell step={2}>
      <Heading
        label="Parallel simulation"
        detail="Each square is one possible life. Each dot represents someone in your circle. A line appears when two people interact."
      >
        A hundred lives, <em>in motion.</em>
      </Heading>
      <div className="mx-field-panel">
        <div className="mx-panel-head">
          <span className="mx-kicker">
            <i />
            {progress === 1 ? 'Complete' : 'Simulating'}
          </span>
          <span>Chapter {chapter + 1} / 6</span>
        </div>
        <LifeField lives={lives} recipe={recipe} progress={progress} />
        <div className="mx-legend">
          {[recipe.profile.name, ...recipe.profile.relatives.map((a) => a.name)].map((name, i) => (
            <span key={i}>
              <i style={{ background: castColor(i) }} />
              {name}
            </span>
          ))}
        </div>
      </div>
      <div className="mx-sim-foot">
        <div>
          <div className="mx-row">
            <span>Simulating six chapters across {lives.length} lives</span>
            <strong>{Math.round(progress * 100)}%</strong>
          </div>
          <progress value={progress} max={1} aria-label="Simulation progress" />
        </div>
        <button className="mx-ghost" onClick={() => navigate('/lives', { replace: true })}>
          See distribution <span>→</span>
        </button>
      </div>
    </Shell>
  );
}
export default function Simulation() {
  const recipe = getRecipe();
  return recipe ? <FieldPage recipe={recipe} /> : <Navigate to="/you" replace />;
}
