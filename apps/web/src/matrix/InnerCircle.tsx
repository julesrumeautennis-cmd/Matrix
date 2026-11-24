import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { RelationSchema, type Relative } from '@eulogy/shared';
import { castColor } from './analysis';

export function RelativeFields({
  person,
  change,
  focusName = false,
}: {
  person: Relative;
  change: (patch: Partial<Relative>) => void;
  focusName?: boolean;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusName) nameRef.current?.focus();
  }, [focusName]);
  return (
    <div className="mx-fields mx-relative-fields">
      <label>
        Name
        <input
          ref={nameRef}
          required
          maxLength={80}
          value={person.name}
          onChange={(e) => change({ name: e.target.value })}
        />
      </label>
      <label>
        Relationship
        <select
          value={person.relation}
          onChange={(e) => change({ relation: RelationSchema.parse(e.target.value) })}
        >
          {RelationSchema.options.map((relation) => (
            <option key={relation} value={relation}>
              {relation}
            </option>
          ))}
        </select>
      </label>
      <label>
        Age
        <input
          type="number"
          min={0}
          max={125}
          required
          value={Number.isFinite(person.age) ? person.age : ''}
          onChange={(e) => change({ age: e.target.valueAsNumber })}
        />
      </label>
      <label>
        Where you stand today
        <textarea
          maxLength={800}
          value={person.relationshipState}
          placeholder="What is your relationship like right now?"
          onChange={(e) => change({ relationshipState: e.target.value })}
        />
      </label>
      <label>
        What they wish you understood
        <textarea
          maxLength={800}
          value={person.grievance}
          placeholder="What might they say if they spoke freely?"
          onChange={(e) => change({ grievance: e.target.value })}
        />
      </label>
    </div>
  );
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/u)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] ?? '')
      .join('')
      .toUpperCase() || '+'
  );
}

export function InnerCircle({
  people,
  update,
  editId,
  setEditId,
  dirty,
}: {
  people: Relative[];
  update: (people: Relative[]) => void;
  editId: string | null;
  setEditId: (id: string | null) => void;
  dirty: boolean;
}) {
  const [removed, setRemoved] = useState<{ person: Relative; index: number } | null>(null);
  function add() {
    const person: Relative = {
      id: crypto.randomUUID(),
      name: '',
      relation: 'friend',
      age: NaN,
      relationshipState: '',
      grievance: '',
    };
    update([...people, person]);
    setEditId(person.id);
  }
  function remove(person: Relative, index: number) {
    setRemoved({ person, index });
    update(people.filter((p) => p.id !== person.id));
    if (editId === person.id) setEditId(null);
  }
  function undo() {
    if (!removed) return;
    const next = people.slice();
    next.splice(removed.index, 0, removed.person);
    update(next);
    setRemoved(null);
  }
  return (
    <section className="mx-inner-circle" id="circle" aria-labelledby="circle-heading">
      <div className="mx-roster-heading">
        <div>
          <h2 id="circle-heading">Your inner circle</h2>
          <p>
            Who will still be part of your story in twenty years? Each person you add gets a voice
            in your simulation.
          </p>
        </div>
        <button type="button" className="mx-ghost mx-add-person" onClick={add}>
          <b aria-hidden="true">＋</b> Add a person
        </button>
      </div>
      <div className="mx-roster-count">
        {people.length} {people.length === 1 ? 'person' : 'people'} in your circle
      </div>
      <ul className="mx-roster-list">
        {people.map((person, index) => {
          const editing = editId === person.id;
          const name = person.name.trim() || 'New person';
          const panelId = 'circle-person-' + person.id;
          return (
            <li key={person.id} className={editing ? 'editing' : ''}>
              <div className="mx-person-row">
                <button
                  type="button"
                  className="mx-person-summary"
                  aria-label={'Edit ' + name}
                  aria-expanded={editing}
                  aria-controls={panelId}
                  onClick={() => setEditId(editing ? null : person.id)}
                >
                  <span
                    className="mx-monogram"
                    aria-hidden="true"
                    style={{ '--person-color': castColor(index + 1) } as CSSProperties}
                  >
                    {initials(person.name)}
                  </span>
                  <span className="mx-person-identity">
                    <strong>{name}</strong>
                    <small>
                      {person.relation}
                      {Number.isFinite(person.age) && ' · Age ' + person.age}
                    </small>
                  </span>
                  <span className="mx-person-story">{person.relationshipState}</span>
                  <span className="mx-person-edit">
                    {editing ? 'Close' : 'Edit'}{' '}
                    <span aria-hidden="true">{editing ? '−' : '↗'}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="mx-person-remove"
                  aria-label={'Remove ' + name}
                  onClick={() => remove(person, index)}
                >
                  Remove
                </button>
              </div>
              <div id={panelId} hidden={!editing} className="mx-person-details">
                {editing && (
                  <RelativeFields
                    person={person}
                    focusName
                    change={(patch) =>
                      update(people.map((p) => (p.id === person.id ? { ...p, ...patch } : p)))
                    }
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {people.length === 0 && (
        <p className="mx-empty-circle">
          Your circle is empty. Add someone who knows you to start a simulation.
        </p>
      )}
      {removed && (
        <div className="mx-undo" role="status">
          <span>{removed.person.name || 'New person'} removed.</span>
          <button type="button" className="mx-text-button" onClick={undo}>
            Undo removal
          </button>
        </div>
      )}
      {dirty && (
        <div className="mx-save-circle">
          <span>Unsaved profile changes</span>
          <button type="submit" className="mx-primary">
            Save profile <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </section>
  );
}
