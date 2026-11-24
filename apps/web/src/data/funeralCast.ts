import type { FuneralCue, Relative } from '@eulogy/shared';

export type ChapelGuest = Pick<Relative, 'id' | 'name' | 'relation'>;
export type ChapelCue = Omit<FuneralCue, 'kind'> & {
  kind: FuneralCue['kind'] | 'homily' | 'blessing';
  tearful?: boolean;
  focusId?: string;
};

// Stock voices rotate in cast order within each relationship.
const performers = {
  partner: ['af_heart', 'am_michael', 'bf_alice', 'am_puck', 'bf_emma'],
  child: ['af_bella', 'am_puck', 'af_sarah', 'bm_fable', 'bf_alice'],
  parent: ['bf_emma', 'am_fenrir', 'af_nicole', 'bm_fable', 'af_sarah'],
  sibling: ['af_kore', 'am_fenrir', 'am_puck', 'af_alloy', 'bf_alice'],
  friend: ['am_puck', 'af_sarah', 'bm_fable', 'af_alloy', 'am_michael'],
  cofounder: ['am_michael', 'af_kore', 'bm_fable', 'af_alloy', 'am_puck'],
  other: ['af_kore', 'bm_fable', 'af_alloy', 'am_puck', 'bf_emma'],
} as const satisfies Record<Relative['relation'], readonly string[]>;

export function funeralPerformer(
  profile: { relatives: readonly ChapelGuest[] },
  cue: Pick<ChapelCue, 'speaks' | 'kind' | 'relativeId'>,
): string | undefined {
  if (!cue.speaks) return undefined;
  if (cue.kind !== 'witness') return 'bm_george';
  const relative = profile.relatives.find((person) => person.id === cue.relativeId);
  if (!relative) return undefined;
  const sameRelation = profile.relatives.filter((person) => person.relation === relative.relation);
  const voices = performers[relative.relation];
  return voices[sameRelation.indexOf(relative) % voices.length];
}

const julesCast: Record<string, string> = {
  maman: 'mother',
  papa: 'father',
  ines: 'sister',
  theo: 'friend',
};
const louisCast: Record<string, string> = {
  camille: 'mourner',
  lea: 'sister',
  anne: 'mother',
  jules: 'friend',
};

const stockModels = ['mother', 'sister', 'friend', 'father', 'visitor', 'mourner'] as const;
export function chapelModel(
  profileId: string,
  guest: ChapelGuest | undefined,
  index: number,
): string {
  if (!guest) return 'visitor';
  if (guest.relation === 'partner') return 'mourner';
  const cast =
    profileId === 'jules-film' ? julesCast : profileId === 'louis-demo' ? louisCast : undefined;
  if (cast && Object.hasOwn(cast, guest.id)) return cast[guest.id]!;
  return stockModels[index % stockModels.length]!;
}
