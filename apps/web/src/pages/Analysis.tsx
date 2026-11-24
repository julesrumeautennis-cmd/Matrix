import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { SourceSchema } from '../../../../packages/shared/src/conversations';
import { analyze, castColor, saveRecipe, type Recipe } from '../matrix/analysis';
import type { TraceEvent } from '../matrix/mcpClient';
import { cohortName } from '../matrix/simulation';
import { Heading, Shell } from '../matrix/Chrome';
import { useProfileStore } from '../store/profile';

export default function Analysis() {
  const count = useProfileStore((s) => s.profile.relatives.length);
  const [attempt, setAttempt] = useState(0);
  return count ? (
    <AnalyzeCircle key={attempt} retry={() => setAttempt((n) => n + 1)} />
  ) : (
    <Navigate to="/you/profile#circle" replace />
  );
}

function AnalyzeCircle({ retry }: { retry: () => void }) {
  const { profile, links } = useProfileStore();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe>();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [shown, setShown] = useState(0);
  const [fast, setFast] = useState(false);
  const [failed, setFailed] = useState(false);
  const output = useRef<HTMLDivElement>(null);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const controller = new AbortController();
    const enabled = SourceSchema.options.filter((source) => links[source]);
    setEvents([]);
    analyze(
      profile,
      enabled.length ? enabled : SourceSchema.options,
      controller.signal,
      (event) => {
        setEvents((previous) => [...previous, event]);
      },
    )
      .then((ready) => {
        if (controller.signal.aborted) return;
        saveRecipe(ready);
        setRecipe(ready);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [profile, links]);

  const visibleCount = fast || reduced ? events.length : Math.min(shown, events.length);
  const next = events[visibleCount];
  useEffect(() => {
    if (!next || fast || reduced) return;
    // Hold each recorded operation long enough to read. Request timings stay measured independently.
    const delay = next.operation.startsWith('agent.')
      ? Math.min(900, 5500 / profile.relatives.length)
      : 790;
    const timer = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 80 : delay);
    return () => window.clearTimeout(timer);
  }, [next, fast, reduced, shown, profile.relatives.length]);
  useEffect(() => {
    if (output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [visibleCount]);
  const visible = events.slice(0, visibleCount);
  const roster = new Map<string, 'connecting' | 'connected'>();
  for (const event of visible) if (event.agent) roster.set(event.agent.id, event.agent.state);
  const connectedCount = [...roster.values()].filter((state) => state === 'connected').length;
  const done = !!recipe && visibleCount === events.length;
  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(
      () => navigate('/simulate', { replace: true }),
      reduced ? 2300 : 3800,
    );
    return () => window.clearTimeout(timer);
  }, [done, navigate, reduced]);

  return (
    <Shell step={1}>
      <Heading
        label="Signal analysis"
        detail="Matrix reads the sample archives and public references, then connects an agent to each person in your circle."
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
              <i /> Run log
            </span>
            <span>{failed ? 'Interrupted' : done ? 'Complete' : 'Processing'}</span>
          </div>
          <div
            className="mx-terminal-body"
            ref={output}
            role="log"
            aria-live="off"
            aria-label="Analysis log"
          >
            {visible.map((event, i) => (
              <div className="mx-trace-line" key={i}>
                <small>{String(i + 1).padStart(2, '0')}</small>
                <div>
                  <code>{event.operation}</code>
                  <span>{event.detail}</span>
                </div>
                {event.durationMs !== undefined && <time>{Math.round(event.durationMs)} ms</time>}
              </div>
            ))}
            {!done && !failed && (
              <b className="mx-cursor" aria-hidden="true">
                ▌
              </b>
            )}
          </div>
        </section>
        <section className="mx-agents">
          <div className="mx-panel-head">
            <span className="mx-kicker">Agent roster</span>
            <span>
              {connectedCount} / {profile.relatives.length} connected
            </span>
          </div>
          {profile.relatives.map((person, index) => {
            const state = roster.get(person.id) ?? 'queued';
            const agent = state === 'connected' ? recipe?.agents[index] : undefined;
            return (
              <div className="mx-agent" key={person.id} data-state={state}>
                <i style={{ background: castColor(index + 1) }} />
                <div>
                  <strong>{person.name}</strong>
                  <small>
                    {agent
                      ? agent.label +
                        ' · ' +
                        agent.excerpts +
                        (agent.excerpts === 1 ? ' excerpt' : ' excerpts')
                      : state === 'connecting'
                        ? 'Matching conversation evidence'
                        : person.relation}
                  </small>
                </div>
                <span>
                  {state === 'connected'
                    ? '✓ Connected'
                    : state === 'connecting'
                      ? 'Connecting…'
                      : 'Queued'}
                </span>
              </div>
            );
          })}
        </section>
      </div>
      {done && recipe && (
        <div className="mx-reference">
          <strong>Personas assigned. Statistics ready.</strong>
          <p>
            Simulation cohort · {cohortName(profile.currentActivity)}. US life expectancy at birth
            in {recipe.reference.year} was {recipe.reference.lifeExpectancy.toFixed(1)} years.{' '}
            <a href={recipe.reference.sourceUrl} target="_blank" rel="noreferrer">
              {recipe.reference.provider} ↗
            </a>
          </p>
        </div>
      )}
      {failed && <p role="alert">Analysis stopped before the run could be prepared.</p>}
      <div className="mx-launch">
        <Link to="/you" className="mx-back">
          ← Back to setup
        </Link>
        {failed ? (
          <button className="mx-ghost" onClick={retry}>
            Retry analysis
          </button>
        ) : (
          <button
            className="mx-ghost"
            disabled={fast && !done}
            onClick={() => (done ? navigate('/simulate', { replace: true }) : setFast(true))}
          >
            {done ? 'Start simulation →' : fast ? 'Waiting for analysis…' : 'Finish analysis →'}
          </button>
        )}
      </div>
    </Shell>
  );
}
