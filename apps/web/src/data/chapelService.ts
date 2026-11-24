import { buildFuneralScript, type Profile, type Run } from '@eulogy/shared';
import { homily, missedCalls, testimony } from './chapelLines';
import type { ChapelCue, ChapelGuest } from './funeralCast';

function priest(id: string, text: string, kind: ChapelCue['kind'] = 'homily'): ChapelCue {
  return { id, text, kind, speaks: true };
}

function spouseInThisLife(guests: ChapelGuest[], divorced: boolean): ChapelGuest {
  const partner = guests.find((person) => person.relation === 'partner');
  if (partner) return partner;
  // A future spouse is a role in this life, distinct from the user's named contacts.
  let id = 'simulated-spouse';
  while (guests.some((guest) => guest.id === id)) id += '-';
  const spouse: ChapelGuest = {
    id,
    name: divorced ? 'Former spouse' : 'Spouse',
    relation: 'partner',
  };
  guests.push(spouse);
  return spouse;
}

export function buildChapelService(profile: Profile, run: Run) {
  const [death, ...farewells] = buildFuneralScript(profile, run);
  const guests: ChapelGuest[] = [...profile.relatives];
  const outcome = run.life_outcome;
  const partner = guests.find((guest) => guest.relation === 'partner');
  let witness: ChapelCue | undefined =
    farewells.find((cue) => cue.relativeId === partner?.id && cue.speaks) ??
    farewells.find((cue) => cue.speaks);
  const cues: ChapelCue[] = [];

  if (outcome) {
    cues.push(priest('welcome', homily[outcome.wellbeing], 'opening'));
    const missed = run.years.filter((year) =>
      year.decisions.some(
        (d) => d.actor === profile.id && d.action === 'Let the call go to voicemail',
      ),
    ).length;
    const regret = missedCalls[missed - 1];
    if (regret) cues.push(priest('missed-calls', regret));
    if (outcome.marriage_age !== null) {
      const divorced = outcome.divorce_age !== null;
      const spouse = spouseInThisLife(guests, divorced);
      const passage =
        outcome.affair === 'protagonist'
          ? 'protagonistAffair'
          : outcome.affair === 'spouse'
            ? 'spouseAffair'
            : divorced
              ? 'divorce'
              : 'marriage';
      cues.push({ ...priest('vows', homily[passage]), focusId: spouse.id });
      const farewell = farewells.find((cue) => cue.relativeId === spouse.id);
      if (!farewell || farewell.speaks) {
        witness = {
          id: 'witness-' + spouse.id,
          relativeId: spouse.id,
          kind: 'witness',
          speaks: true,
          tearful: true,
          text: testimony[passage],
        };
      }
    } else if (outcome.turning_point.trim()) {
      cues.push(priest('turning-point', outcome.turning_point));
    }
  } else {
    cues.push(priest('welcome', homily.archiveOpening, 'opening'), death!);
    if (witness) cues.push(priest('invitation', homily.archiveWitness));
  }

  if (witness) cues.push(witness);
  else cues.push(priest('quiet', homily.silence));

  const child = outcome?.children.find((child) => child.bond === 'close') ?? outcome?.children[0];
  if (child) {
    const text =
      child.kind === 'daughter'
        ? child.bond === 'close'
          ? homily.daughterClose
          : homily.daughterDistant
        : child.bond === 'close'
          ? homily.sonClose
          : homily.sonDistant;
    cues.push(priest('family', text));
  }
  cues.push(priest('dismissal', homily.blessing, 'blessing'));
  const serviceLength = cues.length;
  // The priest leads the service. Other recorded farewells remain available from the cast list.
  cues.push(...farewells.filter((cue) => cue.relativeId !== witness?.relativeId));
  return { guests, cues, serviceLength };
}
