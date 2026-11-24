import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { Link, useSearchParams } from 'react-router-dom';
import type { ChapelGuest } from '../data/funeralCast';
import ChapelScene from '../components/ChapelScene';
import { type Shot } from '../components/chapelBlocking';
import Ledger from '../components/Ledger';
import PrivateFeed from '../components/PrivateFeed';
import { screeningQuery } from '../data/screening';
import { chapelScreening, type ChapelScreening } from '../data/chapelScreening';
import { useFuneralPlayback } from './useFuneralPlayback';
import './chapel.css';

class ProjectionBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { unavailable: boolean }
> {
  state = { unavailable: false };
  static getDerivedStateFromError() {
    return { unavailable: true };
  }
  componentDidCatch() {
    this.props.onUnavailable();
  }
  render() {
    if (this.state.unavailable)
      return (
        <div className="projection-unavailable" role="status">
          <img src="/textures/rose.png" alt="" />
          <p>The 3D projection is unavailable. The service continues with audio and captions.</p>
        </div>
      );
    return this.props.children;
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  return reduced;
}
const pad = (n: number) => String(n).padStart(2, '0');
const views: { shot: Shot | null; title: string }[] = [
  { shot: null, title: 'Director' },
  { shot: 'wide', title: 'Nave' },
  { shot: 'pulpit', title: 'Lectern' },
  { shot: 'front_row', title: 'Pews' },
];
function relation(relative: ChapelGuest, id: string) {
  if (id === 'jules-film') {
    if (relative.id === 'ines') return 'Sister';
    if (relative.id === 'papa') return 'Father';
    if (relative.id === 'maman') return 'Mother';
  }
  return relative.relation.charAt(0).toUpperCase() + relative.relation.slice(1);
}

function Service({
  screening: { profile, runs, summary },
  sample,
  life,
}: {
  screening: ChapelScreening;
  sample: string | null;
  life: string | null;
}) {
  const initial = Math.max(
    0,
    runs.findIndex((r) => r.run_id === (life ?? summary.most_probable_run_id)),
  );
  const best = runs.findIndex((r) => r.run_id === summary.best_run_id);
  const remaining = Array.from(
    { length: runs.length },
    (_, i) => ((best < 0 ? initial : best) + i) % runs.length,
  );
  const playlist = [initial, ...remaining.filter((i) => i !== initial)];
  const [position, setPosition] = useState(0);
  const [manual, setManual] = useState<Shot | null>(null);
  const [visited, setVisited] = useState<string>();
  const [projectionReady, setProjectionReady] = useState(false);
  const projection = useRef<HTMLDivElement>(null);
  const ready = useCallback(() => setProjectionReady(true), []);
  const [tab, setTab] = useState<'Agents' | 'Decisions' | 'Private feed'>('Agents');
  const reduced = useReducedMotion();
  const index = playlist[position]!;
  const run = runs[index]!;
  const player = useFuneralPlayback(profile, run, reduced, projectionReady);
  const { state, cues, guests, serviceLength } = player;
  const cue = cues[state.index]!;
  const witnessIndex = guests.findIndex((person) => person.id === cue.relativeId);
  const witness = guests[witnessIndex];
  const isPlaying = state.status === 'playing';
  const isSpeaking = isPlaying && state.beat === 'speak';
  const speakingForFamily = cues
    .slice(0, serviceLength)
    .filter((line) => line.kind === 'witness' && line.speaks).length;
  const finalChapter = Math.max(0, run.years.length - 1);
  const activeChapter =
    state.status === 'complete'
      ? finalChapter
      : Math.min(
          finalChapter,
          Math.round((state.index * finalChapter) / Math.max(1, serviceLength - 1)),
        );
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const chapter = selectedChapter ?? activeChapter;
  const focus = isPlaying
    ? (cue.focusId ?? (state.beat === 'silence' ? cue.relativeId : undefined))
    : undefined;
  const shot =
    manual ??
    (!isPlaying
      ? 'wide'
      : focus
        ? 'front_row'
        : isSpeaking || state.beat === 'pause'
          ? cue.tearful
            ? 'testimony'
            : 'pulpit'
          : 'wide');
  const name = witness?.name ?? 'The priest';
  const backQuery = new URLSearchParams(screeningQuery(sample));
  if (life || run.life_outcome) backQuery.set('life', run.run_id);
  const back = '/lives' + (backQuery.size ? '?' + backQuery.toString() : '');
  function nextLife() {
    player.stop();
    setPosition((position + 1) % playlist.length);
    setManual(null);
    setVisited(undefined);
    setSelectedChapter(null);
  }
  function nextVoice() {
    player.play(state.index >= serviceLength ? serviceLength - 1 : state.index + 1);
  }
  const sampleLabel = summary.generation?.scripted
    ? 'Dramatized screening'
    : summary.generation?.mock === run.years.length * runs.length
      ? 'Deterministic screening'
      : 'Simulation screening';
  return (
    <main className="theatre">
      <header className="film-bar chapel-bar">
        <Link to="/">Matrix</Link>
        <span>The chapel</span>
        <Link to={back}>Life atlas ↗</Link>
      </header>
      <div className="chapel">
        <div className="chapel-canvas" ref={projection}>
          <ProjectionBoundary onUnavailable={ready}>
            <Canvas
              dpr={[1, 1.35]}
              camera={{ position: [0, 2.6, 9.35], fov: 48, near: 0.1, far: 65 }}
              gl={{ antialias: true, alpha: false }}
            >
              <Suspense fallback={null}>
                <ChapelScene
                  profile={profile}
                  guests={guests}
                  onReady={ready}
                  speaker={isPlaying && cue.speaks ? cue.relativeId : undefined}
                  priestSpeaking={isSpeaking && cue.kind !== 'witness'}
                  tearful={!!cue.tearful}
                  focus={manual === 'front_row' ? visited : focus}
                  beat={state.beat}
                  shot={shot}
                  reduced={reduced}
                  level={player.level}
                />
              </Suspense>
            </Canvas>
          </ProjectionBoundary>
          <div className="chapel-lenses" aria-label="Camera angles" role="group">
            {views.map((view) => (
              <button
                key={view.title}
                aria-pressed={view.shot === manual}
                onClick={() => {
                  setManual(view.shot);
                  setVisited(undefined);
                }}
              >
                {view.title}
              </button>
            ))}
          </div>
          <div className="chapel-lower">
            <div className="chapel-caption" aria-live="polite" aria-atomic="true">
              {isPlaying ? (
                <>
                  <small>
                    {name} <i /> {witness ? relation(witness, profile.id) : 'Officiant'}
                    {cue.tearful && isSpeaking && (
                      <>
                        {' '}
                        <i /> Through tears
                      </>
                    )}
                  </small>
                  {isSpeaking || state.beat === 'pause' ? (
                    <p className="spoken-line">{cue.text}</p>
                  ) : (
                    <p className="stage-direction">
                      {state.beat === 'silence'
                        ? witness?.name + ' stays seated.'
                        : state.beat === 'approach'
                          ? witness?.name + ' takes the lectern.'
                          : witness?.name + ' returns to the pew.'}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <small>{state.status === 'complete' ? 'End of service' : 'In memory of'}</small>
                  <p className="service-name">{profile.name}</p>
                </>
              )}
            </div>
            <div className="chapel-transport">
              {isPlaying ? (
                <>
                  <button className="service-primary" onClick={nextVoice}>
                    {state.index === serviceLength - 1 ? 'Finish service' : 'Next line'}{' '}
                    <span aria-hidden="true">→</span>
                  </button>
                  <button onClick={player.stop}>Stop</button>
                </>
              ) : (
                <button
                  className="service-primary"
                  disabled={!projectionReady}
                  onClick={() => player.play()}
                >
                  <span aria-hidden="true">▶</span>{' '}
                  {!projectionReady
                    ? 'Opening chapel…'
                    : state.status === 'complete'
                      ? 'Replay service'
                      : 'Play service'}
                </button>
              )}
              <button
                aria-pressed={player.sound}
                onClick={player.toggleSound}
                aria-label={player.sound ? 'Mute voices' : 'Unmute voices'}
              >
                {player.sound ? 'Sound on' : 'Muted'}
              </button>
              {isSpeaking && player.voiceMode !== 'recording' && (
                <small>{player.voiceMode === 'device' ? 'Device voice' : 'Captions'}</small>
              )}
            </div>
          </div>
        </div>
        <aside className="chapel-side">
          <div className="service-record">
            <div className="record-meta">
              <span>{sampleLabel}</span>
              <span>
                {pad(position + 1)} / {pad(runs.length)}
              </span>
            </div>
            <h1>Life record</h1>
            <dl className="record-facts">
              <div>
                <dt>Subject</dt>
                <dd>
                  <span className="agent-id">Agent 01</span> {profile.name}
                </dd>
              </div>
              <div>
                <dt>Age at death</dt>
                <dd>{run.death_age}</dd>
              </div>
              <div>
                <dt>Cause</dt>
                <dd>{run.cause_of_death}</dd>
              </div>
              <div>
                <dt>Witnesses</dt>
                <dd>
                  {guests.length} present · {speakingForFamily}{' '}
                  {speakingForFamily === 1 ? 'testimony' : 'testimonies'}
                </dd>
              </div>
            </dl>
            {runs.length > 1 && (
              <button className="next-life" onClick={nextLife}>
                Next life <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          <div className="record-tabs" aria-label="Service records" role="group">
            {(['Agents', 'Decisions', 'Private feed'] as const).map((item) => (
              <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="record-details">
            {tab === 'Agents' ? (
              <ol className="agent-list" aria-label="Service cast">
                {[undefined, ...guests].map((guest, n) => {
                  const i = guest ? cues.findIndex((line) => line.relativeId === guest.id) : 0;
                  const line = cues[i];
                  const active =
                    isPlaying && (guest ? cue.relativeId === guest.id : cue.kind !== 'witness');
                  const person = guest?.name ?? 'The priest';
                  const bond =
                    guest &&
                    run.years.at(-1)?.relative_states.find((s) => s.relative_id === guest.id)
                      ?.relationship_score;
                  return (
                    <li key={guest ? 'guest-' + guest.id : 'officiant'}>
                      <button
                        disabled={!projectionReady}
                        aria-label={(line?.speaks ? 'Hear ' : 'Visit ') + person}
                        aria-current={active ? 'step' : undefined}
                        onClick={() => {
                          if (matchMedia('(max-width: 800px)').matches) {
                            projection.current?.scrollIntoView({
                              block: 'start',
                              behavior: reduced ? 'instant' : 'smooth',
                            });
                          }
                          if (i < 0) {
                            setVisited(guest?.id);
                            setManual('front_row');
                          } else {
                            setManual(null);
                            player.play(i, true);
                          }
                        }}
                      >
                        <span className="agent-code">{guest ? 'SEAT ' + pad(n) : 'PULPIT'}</span>
                        <span className="agent-person">
                          <strong>{person}</strong>
                          <small>
                            {guest ? relation(guest, profile.id) : 'Officiant'}
                            {bond !== undefined ? ' · Bond ' + bond : ''}
                          </small>
                        </span>
                        <span className="agent-state">
                          {active && isSpeaking
                            ? 'Speaking'
                            : !guest
                              ? 'Presides'
                              : !line?.speaks
                                ? 'Silent'
                                : i < serviceLength
                                  ? 'Testimony'
                                  : 'Farewell'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <>
                {run.years.length > 0 && (
                  <label className="chapter-select">
                    Chapter
                    <select
                      value={chapter}
                      onChange={(e) => setSelectedChapter(Number(e.target.value))}
                    >
                      {run.years.map((y, i) => (
                        <option key={i} value={i}>
                          {pad(i + 1)} · Age {y.protagonist_age}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {tab === 'Decisions' ? (
                  <Ledger run={run} active={chapter} onlyActive />
                ) : (
                  <PrivateFeed run={run} chapter={chapter} />
                )}
              </>
            )}
          </div>
          <nav className="record-samples" aria-label="Sample services">
            {profile.id !== 'jules-film' && (
              <Link to="/chapel?screening=jules">Jules’s service ↗</Link>
            )}
            {sample !== 'louis' && profile.id !== 'louis-demo' && (
              <Link to="/chapel?screening=louis">Louis’s service ↗</Link>
            )}
            <Link to="/you">Your profile ↗</Link>
          </nav>
        </aside>
      </div>
    </main>
  );
}

export default function Chapel() {
  const [params] = useSearchParams();
  const sample = params.get('screening');
  const life = params.get('life');
  const screening = useMemo(() => chapelScreening(sample, life), [sample, life]);
  if (!screening)
    return (
      <main className="theatre screening-missing">
        <h1>This life belongs to another screening.</h1>
        <Link to="/lives">Choose a life in the atlas →</Link>
      </main>
    );
  return (
    <Service
      key={screening.profile.id + screeningQuery(sample) + (life ?? '')}
      screening={screening}
      sample={sample}
      life={life}
    />
  );
}
