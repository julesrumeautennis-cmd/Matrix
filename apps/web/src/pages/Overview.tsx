import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SourceSchema, type Source } from '../../../../packages/shared/src/conversations';
import { useProfileStore } from '../store/profile';
import { castColor, sources } from '../matrix/analysis';
import { Shell, Heading, Orbit, SourceIcon } from '../matrix/Chrome';

function Connector({ source, close }: { source: Source; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { links, setLink } = useProfileStore();
  const [value, setValue] = useState(links[source] ?? '');
  const config = sources[source];
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  function submit(e: FormEvent) {
    e.preventDefault();
    setLink(source, value.trim() || config.example);
    close();
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
            maxLength={120}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={config.example}
            autoComplete="off"
          />
        </label>
        <div className="mx-dialog-foot">
          {links[source] && (
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
          <button className="mx-primary" type="submit">
            {value.trim() ? 'Save connection' : 'Use sample archive'} <span>→</span>
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
