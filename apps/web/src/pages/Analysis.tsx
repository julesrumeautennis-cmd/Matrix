import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { SourceSchema } from '../../../../packages/shared/src/conversations';
import { analyze, castColor, saveRecipe, sources, type Recipe } from '../matrix/analysis';
import { cohortName, getLives } from '../matrix/simulation';
import { Heading, Shell } from '../matrix/Chrome';
import { useProfileStore } from '../store/profile';

export default function Analysis() {
  const count = useProfileStore((s) => s.profile.relatives.length);
  return count ? <AnalyzeCircle /> : <Navigate to="/you/profile#circle" replace />;
}
function AnalyzeCircle() {
  const { profile, links } = useProfileStore(),
    navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe>(),
    [tick, setTick] = useState(0),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [expedite, setExpedite] = useState(false),
    output = useRef<HTMLDivElement>(null);
  const connected = SourceSchema.options.filter((s) => links[s]);
  useEffect(() => {
    const controller = new AbortController();
    const enabled = SourceSchema.options.filter((source) => links[source]);
    analyze(profile, enabled.length ? enabled : SourceSchema.options, controller.signal)
      .then((r) => {
        if (!controller.signal.aborted) {
          saveRecipe(r);
          setRecipe(r);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [profile, links, attempt]);
  useEffect(() => {
    const timer = window.setInterval(
      () =>
        setTick((n) =>
          Math.min(n + 1, profile.relatives.length + SourceSchema.options.length + 10),
        ),
      360,
    );
    return () => clearInterval(timer);
  }, [profile.relatives.length]);
  const detailed = recipe ? getLives(recipe) : [];
  const cohort = cohortName(profile.currentActivity);
  const married = detailed.filter((r) => r.life_outcome.marriage_age !== null).length;
  const early = detailed.filter((r) => r.death_age < 80).length;
  const logs = recipe
    ? [
        'initialize  /api/mcp  ·  ' + recipe.transport,
        'tools/list  →  conversation archive + population reference',
        ...recipe.sources.map(
          (s) =>
            'read  ' +
            s +
            '  /  ' +
            recipe.agents.length +
            (recipe.agents.length === 1 ? ' sample thread' : ' sample threads'),
        ),
        ...recipe.agents.map(
          (a, i) =>
            'bind  ' +
            profile.relatives[i]!.name +
            '  →  ' +
            a.label.toLowerCase() +
            '  /  ' +
            a.excerpts +
            ' excerpts',
        ),
        'nexla/mcp  ' +
          (recipe.reference.provider === 'Nexla MCP' || recipe.webEvidence?.provider === 'Nexla MCP'
            ? 'live Nexset read'
            : 'demo adapter · public reference path'),
        'reference  ' + recipe.reference.provider + '  /  US ' + recipe.reference.year,
        ...(recipe.webEvidence
          ? [
              'web/read  ' +
                recipe.webEvidence.provider +
                '  /  marriage + divorce, ' +
                recipe.webEvidence.year,
            ]
          : []),
        'cohort  ' + cohort + '  /  ' + detailed.length + ' fictional lives',
        'complete  ' +
          recipe.agents.length +
          (recipe.agents.length === 1
            ? ' character profile assigned'
            : ' character profiles assigned'),
      ]
    : [];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shown = expedite || reduced ? logs.length : Math.min(tick, logs.length);
  const done = !!recipe && shown === logs.length;
  useEffect(() => {
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [shown]);
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => navigate('/simulate', { replace: true }), reduced ? 2300 : 3000);
    return () => clearTimeout(timer);
  }, [done, navigate, reduced]);
  return (
    <Shell step={1}>
      <Heading
        label="Signal analysis"
        detail={
          connected.length
            ? 'Reading the sample archives you connected.'
            : 'Reading the five demo archives for your circle.'
        }
      >
        {done ? (
          <>
            Your circle is <em>ready.</em>
          </>
        ) : (
          <>
            Reading your <em>signals.</em>
          </>
        )}
      </Heading>
      <div className="mx-analysis-grid">
        <section className="mx-terminal">
          <div className="mx-panel-head">
            <span className="mx-kicker">
              <i />
              Run log
            </span>
            <span>{done ? 'COMPLETE' : 'PROCESSING'}</span>
          </div>
          <div className="mx-terminal-body" ref={output} aria-label="Analysis log">
            <div>
              <small>00</small>
              <span>open matrix / context pipeline</span>
            </div>
            {logs.slice(0, shown).map((line, i) => (
              <div key={i}>
                <small>{String(i + 1).padStart(2, '0')}</small>
                <span>{line}</span>
              </div>
            ))}
            {!done && <b className="mx-cursor">▌</b>}
          </div>
        </section>
        <section className="mx-agents">
          <div className="mx-panel-head">
            <span className="mx-kicker">Agent roster</span>
            <span>{String(profile.relatives.length).padStart(2, '0')}</span>
          </div>
          {profile.relatives.map((p, i) => {
            const a = recipe?.agents[i],
              ready = done || (!!a && shown > 2 + (recipe?.sources.length ?? 0) + i);
            return (
              <div className="mx-agent" key={p.id}>
                <i style={{ background: castColor(i + 1) }} />
                <div>
                  <strong>{p.name}</strong>
                  {ready && a && (
                    <small>
                      {a.source
                        ? sources[a.source].name + ' · ' + a.excerpts + ' excerpts'
                        : 'Profile notes'}
                    </small>
                  )}
                </div>
                <span>{ready ? a?.label : 'Pending'}</span>
              </div>
            );
          })}
        </section>
      </div>
      {done && recipe && (
        <div className="mx-reference">
          <strong>Personas assigned. Statistics ready.</strong>
          <p>
            {cohort} · {married}% married and {early}% died before 80 in this fictional cohort. US
            life expectancy at birth, {recipe.reference.year}:{' '}
            {recipe.reference.lifeExpectancy.toFixed(1)} years.{' '}
            <a href={recipe.reference.sourceUrl} target="_blank" rel="noreferrer">
              {recipe.reference.provider} ↗
            </a>
          </p>
        </div>
      )}
      <div className="mx-launch">
        <Link to="/you" className="mx-back">
          ← Back to setup
        </Link>
        {error ? (
          <button
            onClick={() => {
              setError(false);
              setAttempt((a) => a + 1);
            }}
          >
            Retry analysis
          </button>
        ) : (
          <button
            className="mx-ghost"
            disabled={!recipe}
            onClick={() => (done ? navigate('/simulate', { replace: true }) : setExpedite(true))}
          >
            {done ? 'Start simulation →' : 'Finish analysis →'}
          </button>
        )}
      </div>
    </Shell>
  );
}
