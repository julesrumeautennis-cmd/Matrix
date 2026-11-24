import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Profile } from '@eulogy/shared';
import { saveScreening } from '../data/screening';
import { prepareChapelEntry } from '../data/chapelEntry';
import { demoRecipe, getRecipe } from '../matrix/analysis';
import {
  getLives,
  distribution,
  lifeNumber,
  peakLife,
  type MatrixLife,
} from '../matrix/simulation';
import { Heading, Shell } from '../matrix/Chrome';
import { ProbabilityChart } from '../matrix/ProbabilityChart';
import LivesGrid from './LivesGrid';

function family(o: MatrixLife['life_outcome']) {
  return o.children.length
    ? o.children
        .map(
          (c) =>
            'A ' +
            c.kind +
            ' at ' +
            c.birth_age +
            ' · ' +
            (c.bond === 'close' ? 'stayed close' : 'grew distant'),
        )
        .join('. ')
    : 'No children in this life';
}
function enterService(profile: Profile, run: MatrixLife) {
  const pct = (type: 'child' | 'partner') => {
    const ids = profile.relatives.filter((r) => r.relation === type).map((r) => r.id);
    return ids.length
      ? Number(run.eulogies.some((e) => e.speaks && ids.includes(e.relative_id))) * 100
      : null;
  };
  saveScreening({
    profile,
    runs: [run],
    summary: {
      n_runs: 1,
      pct_child_speaks: pct('child'),
      pct_daughter_speaks: pct('child') ?? 0,
      pct_partner_speaks: pct('partner'),
      most_probable_run_id: run.run_id,
      best_run_id: run.run_id,
      generation: { scripted: run.years.length },
      clusters: { [run.ending_cluster!]: 1 },
    },
  });
}
function Explorer() {
  const recipe = getRecipe() ?? demoRecipe,
    lives = getLives(recipe);
  const bins = useMemo(() => distribution(lives), [lives]),
    peak = useMemo(() => peakLife(bins), [bins]);
  const [params, setParams] = useSearchParams(),
    navigate = useNavigate();
  const selected = lives.find((r) => r.run_id === params.get('life')) ?? peak;
  const bandIndex = bins.findIndex((b) => b.lives.includes(selected)),
    band = bins[bandIndex]!;
  const o = selected.life_outcome;
  const [expanded, setExpanded] = useState(false);
  const pick = (r: MatrixLife) => {
    setParams({ life: r.run_id }, { replace: true, preventScrollReset: true });
    setExpanded(false);
  };
  const twist =
    lives.find((r) => r.life_outcome.affair === 'spouse') ??
    lives.find((r) => r.life_outcome.divorce_age !== null);
  const longest = lives.reduce((best, r) => (r.death_age > best.death_age ? r : best));
  const modal = bins.find((b) => b.lives.includes(peak))!;
  function open() {
    setParams({ life: selected.run_id }, { replace: true });
    enterService(recipe.profile, selected);
    prepareChapelEntry(selected.run_id);
    navigate('/chapel?life=' + encodeURIComponent(selected.run_id));
  }
  return (
    <Shell step={3}>
      <Heading
        label="Simulation results"
        detail={
          'Explore ' +
          recipe.profile.name +
          '’s ' +
          lives.length +
          ' fictional futures. The peak marks the age range that occurred most often.'
        }
      >
        A hundred lives. <em>One peak.</em>
      </Heading>
      <div className="mx-results">
        <section className="mx-distribution">
          <div className="mx-panel-head">
            <span className="mx-kicker">
              <i />
              Probability distribution
            </span>
            <span>n = {lives.length}</span>
          </div>
          <div className="mx-plot-title">
            <div>
              <span>Most frequent lifespan</span>
              <strong>
                {modal.from}–{modal.to} <em>years</em>
              </strong>
            </div>
            <b>{modal.percent}% of lives</b>
          </div>
          <div className="mx-axis">Share of simulated lives</div>
          <ProbabilityChart
            bins={bins}
            selected={bandIndex}
            onPick={(i) => pick(bins[i]!.lives.includes(peak) ? peak : bins[i]!.lives[0]!)}
          />
          <div className="mx-axis mx-axis-x">Age at death · five-year bands</div>
          <div className="mx-select-band">
            <label>
              Explore ages {band.from}–{band.to}
              <select
                value={selected.run_id}
                onChange={(e) => {
                  const r = band.lives.find((life) => life.run_id === e.target.value);
                  if (r) pick(r);
                }}
              >
                {band.lives.map((r) => (
                  <option key={r.run_id} value={r.run_id}>
                    Life {lifeNumber(r)} · age {r.death_age}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mx-shortcuts">
            <button type="button" aria-pressed={selected === peak} onClick={() => pick(peak)}>
              Peak life
            </button>
            {twist && (
              <button aria-pressed={selected === twist} onClick={() => pick(twist)}>
                A plot twist
              </button>
            )}
            <button aria-pressed={selected === longest} onClick={() => pick(longest)}>
              Longest life
            </button>
          </div>
        </section>
        <article className="mx-life-record" key={selected.run_id}>
          <div className="mx-panel-head">
            <span className="mx-kicker">
              <i />
              {selected === peak ? 'Representative peak life' : 'Selected life'}
            </span>
            <span>Life {lifeNumber(selected)}</span>
          </div>
          <div className="mx-life-body">
            <span className="mx-axis">Age at death</span>
            <h2>
              {selected.death_age}
              <em> years</em>
            </h2>
            <p className="mx-story">{o.turning_point}</p>
            <dl>
              <div>
                <dt>Marriage</dt>
                <dd>
                  {o.marriage_age === null
                    ? 'Never married'
                    : 'Married at ' +
                      o.marriage_age +
                      (o.divorce_age !== null
                        ? ', divorced at ' + o.divorce_age
                        : ' · stayed together')}
                </dd>
              </div>
              <div>
                <dt>Family</dt>
                <dd>{family(o)}</dd>
              </div>
              <div>
                <dt>Wellbeing</dt>
                <dd>{o.wellbeing[0]!.toUpperCase() + o.wellbeing.slice(1)}</dd>
              </div>
              <div>
                <dt>Health & sport</dt>
                <dd>
                  At {o.health_age}, you {o.health_event}.
                </dd>
              </div>
            </dl>
            <button className="mx-primary" onClick={open}>
              Enter this life’s chapel <span>→</span>
            </button>
          </div>
        </article>
      </div>
      <div className="mx-details">
        <button
          className="mx-text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide' : 'Read'} the six chapters of life {lifeNumber(selected)}{' '}
          {expanded ? '−' : '+'}
        </button>
        {expanded && (
          <ol>
            {selected.years.map((year) => (
              <li key={year.year_index}>
                <span>
                  Age {year.protagonist_age} · {year.generation}
                </span>
                <p>{year.shock}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <details className="mx-source-notes">
        <summary>Conversation signals & population reference</summary>
        <p>
          This sample uses the {recipe.reference.year} US life expectancy at birth of{' '}
          {recipe.reference.lifeExpectancy.toFixed(1)} years.{' '}
          <a href={recipe.reference.sourceUrl} target="_blank" rel="noreferrer">
            {recipe.reference.provider} ↗
          </a>
        </p>
        <ul>
          {recipe.agents.map((a, i) => (
            <li key={a.id}>
              <strong>
                {recipe.profile.relatives[i]!.name} · {a.label}
              </strong>
              <span>
                {a.source ?? 'Profile notes'} · {a.excerpts} sample excerpts
              </span>
              <q>{a.quote}</q>
            </li>
          ))}
        </ul>
      </details>
      <div className="mx-result-foot">
        <Link to="/you" className="mx-back">
          ← Return to profile
        </Link>
        <span>Fictional outcomes · Empirical frequencies from this run</span>
      </div>
    </Shell>
  );
}
export default function Outcomes() {
  const [params] = useSearchParams();
  return ['jules', 'louis'].includes(params.get('screening') ?? '') ? <LivesGrid /> : <Explorer />;
}
