import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { castColor, getRecipe, type Recipe } from '../matrix/analysis';
import { SimulationBatch } from '../matrix/simulation';
import { Heading, Shell } from '../matrix/Chrome';
import LifeField from '../matrix/LifeField';

const lifeLabel = (index: number) => 'Life ' + String(index + 1).padStart(3, '0');

function FieldPage({ recipe }: { recipe: Recipe }) {
  const navigate = useNavigate();
  const [batch] = useState(() => new SimulationBatch(recipe));
  const [state, setState] = useState(() => batch.advance(0));
  const [focus, setFocus] = useState(0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const done = state.completed === batch.totalChapters;
  useEffect(() => {
    const timer = window.setInterval(
      () => {
        const next = batch.advance(reduced ? 50 : 5);
        setState(next);
        if (next.completed === batch.totalChapters) window.clearInterval(timer);
      },
      reduced ? 110 : 300,
    );
    return () => window.clearInterval(timer);
  }, [batch, reduced]);
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(
      () => navigate('/lives', { replace: true }),
      reduced ? 1400 : 3800,
    );
    return () => window.clearTimeout(timer);
  }, [done, navigate, reduced]);

  const people = [recipe.profile, ...recipe.profile.relatives];
  const nameOf = (id: string) => people.find((person) => person.id === id)?.name ?? id;
  const frame = state.frames[focus]!,
    chapter = frame.chapter;
  const message = chapter?.private_messages[0];
  const decision = chapter?.decisions.find((item) => item.actor === message?.from);
  const bond = chapter?.relative_states.find((item) => item.relative_id === message?.from);
  const previousBond = frame.previous?.relative_states.find(
    (item) => item.relative_id === message?.from,
  );
  const change =
    bond && previousBond ? bond.relationship_score - previousBond.relationship_score : undefined;
  const percent = Math.floor((state.completed * 100) / batch.totalChapters);

  function openDistribution() {
    if (!done) batch.advance(batch.totalChapters);
    navigate('/lives', { replace: true });
  }
  return (
    <Shell step={2}>
      <Heading
        label="Parallel simulation"
        detail="Each square follows one life. Select a square to see the decisions and messages behind its moving dots."
      >
        A hundred lives, <em>in motion.</em>
      </Heading>
      <div className="mx-run-stats" aria-label="Simulation counters">
        <div>
          <span>Chapters processed</span>
          <strong>
            {state.completed.toLocaleString('en-US')} <small>/ {batch.totalChapters}</small>
          </strong>
        </div>
        <div>
          <span>Agent decisions</span>
          <strong>{state.decisions.toLocaleString('en-US')}</strong>
        </div>
        <div>
          <span>Messages exchanged</span>
          <strong>{state.messages.toLocaleString('en-US')}</strong>
        </div>
        <div>
          <span>Lives completed</span>
          <strong>
            {state.finishedLives} <small>/ {state.frames.length}</small>
          </strong>
        </div>
      </div>
      <div className="mx-field-layout">
        <section className="mx-field-panel" aria-label="Parallel lives">
          <div className="mx-panel-head">
            <span className="mx-kicker">
              <i />
              {done ? 'Complete' : 'Simulating'}
            </span>
            <span>{percent}%</span>
          </div>
          <progress
            value={state.completed}
            max={batch.totalChapters}
            aria-label="Simulation progress"
          />
          <LifeField recipe={recipe} frames={state.frames} selected={focus} onSelect={setFocus} />
          <div className="mx-legend">
            {people.map((person, i) => (
              <span key={person.id}>
                <i style={{ background: castColor(i) }} />
                {person.name}
              </span>
            ))}
          </div>
        </section>
        <section className="mx-inspector" aria-label="Interaction trace">
          <div className="mx-panel-head">
            <span className="mx-kicker">Interaction trace</span>
            <span>{chapter ? 'Chapter ' + (chapter.year_index + 1) : 'Queued'}</span>
          </div>
          <div className="mx-inspector-body">
            <label>
              Inspect a life
              <select value={focus} onChange={(e) => setFocus(Number(e.target.value))}>
                {state.frames.map((_, i) => (
                  <option key={i} value={i}>
                    {lifeLabel(i)}
                  </option>
                ))}
              </select>
            </label>
            <div className="mx-trial-id">
              Seed 0x{frame.seed.toString(16).padStart(8, '0')}
              {chapter && ' · Age ' + chapter.protagonist_age}
            </div>
            {chapter && message && decision && bond ? (
              <dl className="mx-interactions">
                <div>
                  <dt>Decision</dt>
                  <dd>
                    <strong>{nameOf(decision.actor)}</strong>
                    <p>{decision.action}.</p>
                  </dd>
                </div>
                <div>
                  <dt>Message</dt>
                  <dd>
                    <strong>
                      {nameOf(message.from)} <span>→</span> {nameOf(message.to)}
                    </strong>
                    <p>“{message.text}”</p>
                  </dd>
                </div>
                <div>
                  <dt>Relationship score</dt>
                  <dd>
                    <strong>
                      {nameOf(bond.relative_id)} <span>↔</span> {recipe.profile.name}
                    </strong>
                    <p className="mx-bond-value">
                      {bond.relationship_score} <small>/ 100</small>
                      {change !== undefined && (
                        <small>
                          {' '}
                          · {change > 0 ? '+' : ''}
                          {change} since last chapter
                        </small>
                      )}
                    </p>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mx-trial-wait">Waiting for this life’s first chapter.</p>
            )}
          </div>
        </section>
      </div>
      <div className="mx-launch">
        <p>
          {done
            ? batch.lives.filter((life) => life.life_outcome.marriage_age !== null).length +
              ' of ' +
              state.finishedLives +
              ' lives included a marriage. ' +
              batch.lives.filter((life) => life.death_age < 80).length +
              ' ended before age 80.'
            : people.length + ' agents in each of ' + state.frames.length + ' lives.'}
        </p>
        <button className="mx-ghost" onClick={openDistribution}>
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
