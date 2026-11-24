import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { type Profile, type Relative } from '@eulogy/shared';
import { z } from 'zod';
import { InnerCircle, RelativeFields } from '../matrix/InnerCircle';
import { MatrixProfile } from '../matrix/profile';
import { Heading, Shell } from '../matrix/Chrome';
import { useProfileStore } from '../store/profile';

const traits = [
  'ambitious',
  'disciplined',
  'generous',
  'loyal',
  'curious',
  'charismatic',
  'stubborn',
  'anxious',
  'competitive',
  'calm',
  'impulsive',
  'workaholic',
];
async function portraitPost(route: string, body: unknown) {
  const res = await fetch('/api/' + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw Error('Portrait service unavailable');
  return res.json();
}
function Photo({
  profile,
  update,
}: {
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
}) {
  const stream = useRef<MediaStream | null>(null),
    video = useRef<HTMLVideoElement>(null),
    mounted = useRef(true);
  const [camera, setCamera] = useState(false),
    [note, setNote] = useState(''),
    [working, setWorking] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (camera && video.current) video.current.srcObject = stream.current;
  }, [camera]);
  function stop() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera(false);
  }
  async function open() {
    try {
      const next = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!mounted.current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = next;
      setCamera(true);
    } catch {
      setNote('Camera unavailable. Choose a photo instead.');
    }
  }
  function resize(image: CanvasImageSource, width: number, height: number) {
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 480 / Math.max(width, height));
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    update({
      photoUrl: canvas.toDataURL('image/jpeg', 0.82),
      portraits: undefined,
      bustUrl: undefined,
    });
    setNote('');
  }
  async function upload(file: File) {
    if (file.size > 2500000) {
      setNote('Choose an image smaller than 2.5 MB.');
      return;
    }
    try {
      const img = await createImageBitmap(file);
      resize(img, img.width, img.height);
      img.close();
    } catch {
      setNote('Choose a JPEG, PNG or WebP image.');
    }
  }
  async function generate() {
    setWorking(true);
    try {
      let url = profile.photoUrl;
      if (url?.startsWith('data:'))
        url = z
          .object({ photoUrl: z.string().url() })
          .parse(await portraitPost('upload', { image: url })).photoUrl;
      const faces = z
        .object({
          portraits: z.array(z.string().url()).max(3),
          bustUrl: z.string().url().optional(),
        })
        .parse(await portraitPost('portraits', { ...profile, photoUrl: url }));
      update({ ...faces, photoUrl: url });
      setNote('Portraits ready.');
    } catch {
      setNote('Aged portraits are unavailable. Your selected photo is saved with your profile.');
    } finally {
      setWorking(false);
    }
  }
  return (
    <fieldset>
      <legend>Your portrait</legend>
      <div className="mx-photo-flex">
        {profile.photoUrl && <img src={profile.photoUrl} alt="Profile portrait" />}
        <label>
          Choose a photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>
        <button className="mx-ghost" type="button" onClick={open}>
          Use camera
        </button>
        {profile.photoUrl && (
          <button className="mx-ghost" type="button" disabled={working} onClick={generate}>
            {working ? 'Preparing…' : 'Generate aged portraits'}
          </button>
        )}
      </div>
      {camera && (
        <div>
          <video ref={video} autoPlay muted playsInline />
          <button
            type="button"
            onClick={() => {
              const v = video.current;
              if (v?.videoWidth) {
                resize(v, v.videoWidth, v.videoHeight);
                stop();
              }
            }}
          >
            Capture
          </button>
          <button type="button" onClick={stop}>
            Close camera
          </button>
        </div>
      )}
      {profile.portraits?.map((p, i) => (
        <img key={p} src={p} alt={'Aged portrait ' + (i + 1)} />
      ))}
      {note && <p role="status">{note}</p>}
    </fieldset>
  );
}

export default function Onboarding() {
  const { id } = useParams(),
    navigate = useNavigate();
  const live = useProfileStore((s) => s.profile),
    save = useProfileStore((s) => s.setProfile);
  const [draft, setDraft] = useState<Profile>(() => structuredClone(live)),
    [error, setError] = useState(''),
    [editId, setEditId] = useState<string | null>(null),
    [dirty, setDirty] = useState(false);
  const person = draft.relatives.find((r) => r.id === id);
  if (id && !person) return <Navigate replace to="/you" />;
  const update = (patch: Partial<Profile>) => {
    setDirty(true);
    setError('');
    setDraft((p) => ({ ...p, ...patch }));
  };
  function change(patch: Partial<Relative>) {
    setDraft((p) => ({
      ...p,
      relatives: p.relatives.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = MatrixProfile.safeParse(draft);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'relatives' && typeof issue.path[1] === 'number') {
        const invalid = draft.relatives[issue.path[1]];
        if (invalid) setEditId(invalid.id);
        setError('Enter a name and an age from 0 to 125 for each person in your circle.');
      } else {
        setError(issue?.message ?? 'Check your profile.');
      }
      return;
    }
    save(parsed.data);
    navigate('/you');
  }
  const field = (
    key: 'name' | 'city' | 'currentActivity' | 'fear' | 'ambition10y' | 'flaw',
    label: string,
  ) => (
    <label>
      {label}
      <input
        required
        maxLength={key === 'name' ? 80 : 800}
        value={draft[key]}
        onChange={(e) => update({ [key]: e.target.value })}
      />
    </label>
  );
  const habits = [
    ['heightCm', 'Height (cm)', 80, 250],
    ['weightKg', 'Weight (kg)', 25, 350],
    ['sugar', 'Sweet servings per week', 0, 30],
    ['sport', 'Weekly sport hours', 0, 10],
    ['alcohol', 'Drinks per week', 0, 10],
    ['sleep', 'Nights with seven hours of sleep per week', 0, 7],
  ] as const;
  return (
    <Shell step={0}>
      <Link className="mx-back" to="/you">
        ← Back to setup
      </Link>
      <Heading label={person ? 'Your circle' : 'Your profile'}>
        {person ? (
          <>
            About <em>{person.name || 'this person'}.</em>
          </>
        ) : (
          <>
            Your life, <em>in detail.</em>
          </>
        )}
      </Heading>
      <form className="mx-form" onSubmit={submit}>
        {error && (
          <p className="mx-form-error" role="alert">
            {error}
          </p>
        )}
        {person ? (
          <fieldset>
            <legend>Person details</legend>
            <RelativeFields person={person} change={change} />
          </fieldset>
        ) : (
          <>
            <InnerCircle
              people={draft.relatives}
              editId={editId}
              setEditId={setEditId}
              dirty={dirty}
              update={(relatives) => update({ relatives })}
            />
            <fieldset>
              <legend>Where you are now</legend>
              <div className="mx-fields">
                {field('name', 'First name')}
                <label>
                  Age
                  <input
                    required
                    type="number"
                    min={16}
                    max={70}
                    value={draft.age || ''}
                    onChange={(e) => update({ age: Number(e.target.value) })}
                  />
                </label>
                {field('city', 'City')}
                {field('currentActivity', 'What fills your days?')}
              </div>
            </fieldset>
            <fieldset>
              <legend>Who you are</legend>
              <p>Choose three traits.</p>
              <div className="mx-traits">
                {[...new Set([...traits, ...draft.traits])].map((t) => (
                  <button
                    type="button"
                    key={t}
                    disabled={!draft.traits.includes(t) && draft.traits.length >= 3}
                    aria-pressed={draft.traits.includes(t)}
                    onClick={() =>
                      update({
                        traits: draft.traits.includes(t)
                          ? draft.traits.filter((v) => v !== t)
                          : [...draft.traits, t],
                      })
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="mx-fields">
                {field('ambition10y', 'Ten-year ambition')}
                {field('fear', 'Biggest fear')}
                {field('flaw', 'What trips you up?')}
              </div>
            </fieldset>
            <fieldset>
              <legend>Body & habits</legend>
              <div className="mx-fields">
                {habits.map(([key, label, min, max]) => (
                  <label key={key}>
                    {label}
                    <input
                      required
                      type="number"
                      min={min}
                      max={max}
                      step={key === 'weightKg' ? 0.1 : 1}
                      value={draft.habits[key] ?? ''}
                      onChange={(e) =>
                        update({
                          habits: {
                            ...draft.habits,
                            [key]: e.target.value === '' ? undefined : Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <Photo profile={draft} update={update} />
          </>
        )}
        <div className="mx-form-foot">
          <Link to="/you" className="mx-text-button">
            Cancel
          </Link>
          <button className="mx-primary" type="submit">
            Save changes <span>→</span>
          </button>
        </div>
      </form>
    </Shell>
  );
}
