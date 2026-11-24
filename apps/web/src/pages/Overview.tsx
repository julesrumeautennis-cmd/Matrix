import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SourceSchema, type Source } from '../../../../packages/shared/src/conversations';
import { useProfileStore } from '../store/profile';
import { openMcp, readArchive } from '../matrix/mcpClient';
import { castColor, sampleTemplates, sources } from '../matrix/analysis';
import { Shell, Heading, Orbit, SourceIcon } from '../matrix/Chrome';

function Connector({ source, close }: { source: Source; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { profile, links, setLink } = useProfileStore();
  const pending = useRef<AbortController | null>(null);
  const [stage, setStage] = useState<'idle' | 'session' | 'archive' | 'verified' | 'error'>('idle');
  const [receipt, setReceipt] = useState('');
  const working = stage === 'session' || stage === 'archive' || stage === 'verified';
  const [value, setValue] = useState(links[source] ?? '');
  const config = sources[source];
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => {
      pending.current?.abort();
      node?.close();
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
    const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    setStage('session');
    setReceipt('Negotiating the protocol and discovering archive tools.');
    try {
      const [session] = await Promise.all([openMcp(signal), pause(950)]);
      signal.throwIfAborted();
      setStage('archive');
      setReceipt(session.server + ' · list_conversations');
      const templates = sampleTemplates(profile);
      const [threads] = await Promise.all([
        readArchive(source, templates.length ? templates : undefined, signal),
        pause(1050),
      ]);
      signal.throwIfAborted();
      setStage('verified');
      const excerpts = threads.reduce((sum, thread) => sum + thread.messages.length, 0);
      setReceipt(
        threads.length +
          (threads.length === 1 ? ' sample thread · ' : ' sample threads · ') +
          excerpts +
          (excerpts === 1 ? ' excerpt verified' : ' excerpts verified'),
      );
      await pause(800);
      controller.signal.throwIfAborted();
      setLink(source, value.trim() || config.example);
      close();
    } catch {
      if (!controller.signal.aborted) {
        setStage('error');
        setReceipt(
          'The archive could not be verified. Retry the connection, or close to use the bundled samples.',
        );
      }
    } finally {
      pending.current = null;
    }
  }
  return (
    <dialog
      className="mx-dialog"
      ref={dialog}
      onCancel={close}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
      aria-labelledby="connector-heading"
    >
      <form onSubmit={submit}>
        <div className="mx-row">
          <span className="mx-source-icon" style={{ color: config.color }}>
            <SourceIcon source={source} />
          </span>
          <button type="button" className="mx-close" aria-label="Close connector" onClick={close}>
            ×
          </button>
        </div>
        <div className="mx-kicker">Nexla MCP adapter · demo</div>
        <h2 id="connector-heading">{config.name}</h2>
        <p>
          Name this source or use the sample. Matrix assigns fictional conversation excerpts to the
          people in your circle.
        </p>
        <label>
          Account or archive label{' '}
          <input
            disabled={working}
            maxLength={120}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={config.example}
            autoComplete="off"
          />
        </label>
        {stage !== 'idle' && (
          <div className="mx-connection-status" role="status">
            <strong>
              {stage === 'session'
                ? 'Opening MCP session'
                : stage === 'archive'
                  ? 'Reading sample archive'
                  : stage === 'verified'
                    ? 'Archive verified'
                    : 'Connection unavailable'}
            </strong>
            <small>{receipt}</small>
            {working && (
              <progress
                aria-label="Connection progress"
                value={stage === 'session' ? 1 : stage === 'archive' ? 2 : 3}
                max={3}
              />
            )}
          </div>
        )}
        <div className="mx-dialog-foot">
          {links[source] && !working && (
            <button
              type="button"
              className="mx-text-button"
              onClick={() => {
                setLink(source);
                close();
              }}
            >
              Disconnect
            </button>
          )}
          <button className="mx-primary" disabled={working} type="submit">
            {working
              ? stage === 'verified'
                ? 'Verified'
                : 'Connecting…'
              : stage === 'error'
                ? 'Retry connection'
                : value.trim()
                  ? 'Save connection'
                  : 'Use sample archive'}{' '}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </dialog>
  );
}
export default function Overview() {
  const { profile, links } = useProfileStore();
  const [source, setSource] = useState<Source | null>(null);
  return (
    <Shell step={0}>
      <Heading
        label="Simulation setup"
        detail="Start with who you are and the people who know you."
      >
        Where you are <em>now.</em>
      </Heading>
      <section className="mx-profile-card" aria-label="Your profile">
        <div className="mx-profile-top">
          <Link
            to="/you/profile"
            className="mx-portrait"
            aria-label={'Edit ' + profile.name + '’s profile'}
          >
            {profile.photoUrl ? <img src={profile.photoUrl} alt="" /> : <Orbit small />}
          </Link>
          <div className="mx-identity">
            <div className="mx-kicker">Your profile</div>
            <Link to="/you/profile">
              <h2>{profile.name}</h2>
            </Link>
            <p>
              {profile.age} years old <b>·</b> {profile.city}
            </p>
            <p className="mx-activity">{profile.currentActivity}</p>
          </div>
          <Link to="/you/profile" className="mx-ghost">
            Edit profile <span>↗</span>
          </Link>
        </div>
        <div className="mx-circle">
          <h3>Your inner circle</h3>
          <div>
            {profile.relatives.map((p, i) => (
              <Link to={'/you/person/' + encodeURIComponent(p.id)} key={p.id}>
                <i style={{ background: castColor(i + 1) }} />
                {p.name}
              </Link>
            ))}
          </div>
          <Link to="/you/profile#circle" className="mx-manage-circle">
            Manage circle ↗
          </Link>
        </div>
      </section>
      <section className="mx-connect">
        <div className="mx-section-row">
          <div>
            <h2>Conversation sources</h2>
            <p>Give your agents a voice with sample archives through the Nexla MCP adapter demo.</p>
          </div>
          <span className="mx-chip">{Object.keys(links).length} / 5 connected</span>
        </div>
        <div className="mx-sources">
          {SourceSchema.options.map((s) => (
            <button
              key={s}
              aria-label={(links[s] ? 'Manage ' : 'Connect ') + sources[s].name}
              onClick={() => setSource(s)}
            >
              <span className="mx-source-icon" style={{ color: sources[s].color }}>
                <SourceIcon source={s} />
              </span>
              <strong>{sources[s].name}</strong>
              <span className={links[s] ? 'linked' : ''}>
                {links[s] ? '✓ Connected' : '+ Connect'}
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="mx-launch">
        <p>
          <span className="mx-live-dot" />{' '}
          {Object.keys(links).length ? 'Sample archives ready' : 'Using sample archives by default'}
        </p>
        <Link
          to={profile.relatives.length ? '/analysis' : '/you/profile#circle'}
          className="mx-primary"
        >
          {profile.relatives.length ? 'Analyze my life' : 'Add someone to begin'} <span>→</span>
        </Link>
      </div>
      {source && <Connector source={source} close={() => setSource(null)} />}
    </Shell>
  );
}
