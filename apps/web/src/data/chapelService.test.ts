import { expect, it } from 'vitest';
import { sampleProfile, sampleRun } from '@eulogy/shared';
import { chapelSeat, lectern, movementDuration, seatsPerView } from '../components/chapelBlocking';
import { chapelModel, funeralPerformer } from './funeralCast';
import { demoRecipe } from '../matrix/analysis';
import { getLives } from '../matrix/simulation';
import { buildChapelService } from './chapelService';
import { chapelScreening } from './chapelScreening';
import { homily, missedCalls, testimony } from './chapelLines';
import { findFuneralRecording } from './funeralAudio';

it('stages the two sides of an affair from the selected life, including a future spouse and five named guests', () => {
  const lives = getLives(demoRecipe);
  for (const who of ['spouse', 'protagonist'] as const) {
    const selected = lives.find((run) => run.life_outcome.affair === who)!;
    const screening = chapelScreening(null, selected.run_id)!;
    expect(screening.runs[0]).toBe(selected);
    const { guests, cues, serviceLength } = buildChapelService(screening.profile, selected);
    expect(guests.slice(0, 5)).toEqual(screening.profile.relatives);
    expect(guests).toHaveLength(6);
    expect(guests.map((_, i) => chapelSeat(i).position.x)).toEqual([
      -2.65, -1.45, 1.45, 2.65, -3.52, 3.52,
    ]);
    const program = cues.slice(0, serviceLength);
    expect(program[0]?.kind).toBe('opening');
    expect(program.at(-1)?.kind).toBe('blessing');
    const [reaction] = program.filter((line) => line.kind === 'witness');
    const key = who === 'spouse' ? 'spouseAffair' : 'protagonistAffair';
    expect(program.find((line) => line.id === 'vows')).toMatchObject({
      text: homily[key],
      focusId: guests[5]!.id,
    });
    expect(reaction).toMatchObject({
      text: testimony[key],
      relativeId: guests[5]!.id,
      tearful: true,
    });
    for (const line of program)
      expect(findFuneralRecording({ relatives: guests }, line)?.text).toBe(line.text);
    const count = selected.years.filter((y) =>
      y.decisions.some(
        (d) => d.actor === screening.profile.id && d.action === 'Let the call go to voicemail',
      ),
    ).length;
    expect(program.find((line) => line.id === 'missed-calls')?.text).toBe(missedCalls[count - 1]);
  }
});

it.each([1, 6, 8])(
  'seats %i contacts and the spouse in this life, including named partners',
  (count) => {
    const life = getLives(demoRecipe).find((r) => r.life_outcome.affair === 'spouse')!;
    for (const hasPartner of [true, false]) {
      const relatives = Array.from({ length: count }, (_, i) => ({
        ...sampleProfile.relatives[0]!,
        id: 'guest-' + i,
        name: 'Guest ' + i,
        relation: hasPartner && i === 0 ? ('partner' as const) : ('friend' as const),
      }));
      const profile = { ...sampleProfile, relatives };
      const run = {
        ...life,
        eulogies: relatives.map((r) => ({ ...life.eulogies[0]!, relative_id: r.id, speaks: true })),
      };
      const { guests, cues } = buildChapelService(profile, run);
      expect(guests.length).toBe(count + Number(!hasPartner));
      const places = guests.map((_, i) => chapelSeat(i).position.toArray().join(','));
      expect(new Set(places).size).toBe(guests.length);
      for (const cue of cues.filter((c) => c.speaks))
        expect(funeralPerformer({ relatives: guests }, cue)).toBeTruthy();
      expect(cues.find((c) => c.tearful)?.relativeId).toBe(guests[hasPartner ? 0 : count]?.id);
      expect(guests.map((g, i) => chapelModel(profile.id, g, i))).not.toContain(undefined);
    }
  },
);

it('takes every seat to the lectern through the aisle and reuses physical places for subsequent seating sections', () => {
  for (let index = 0; index < seatsPerView; index++) {
    const seat = chapelSeat(index);
    expect(seat.path.getPointAt(0).distanceTo(seat.position)).toBeLessThan(1e-8);
    expect(seat.path.getPointAt(1).distanceTo(lectern)).toBeLessThan(1e-8);
    expect(movementDuration(index, 'return')).toBeGreaterThan(movementDuration(index, 'approach'));
    if (seat.row > 0) {
      expect(seat.position.z).toBeGreaterThan(chapelSeat(0).position.z);
      for (const point of seat.path.getSpacedPoints(120)) {
        // While passing the seats in front, the walk must be inside the central aisle.
        if (point.z >= 0.85 && point.z < seat.position.z - 1.35)
          expect(Math.abs(point.x)).toBeLessThan(0.5);
      }
    }
    expect(chapelSeat(index + seatsPerView)).toBe(seat);
  }
  const guests = Array.from({ length: 70 }, (_, i) => ({
    id: String(i),
    name: String(i),
    relation: 'friend' as const,
  }));
  const voices = guests.map((g) =>
    funeralPerformer({ relatives: guests }, { kind: 'witness', relativeId: g.id, speaks: true }),
  );
  expect(voices).not.toContain(undefined);
  expect(voices.slice(0, 5)).toEqual(voices.slice(5, 10));
  expect(chapelModel('custom', guests[65], 65)).toBe(chapelModel('custom', guests[5], 5));
});

it('honors a named partner who stays silent and keeps archived services and unavailable links distinct', () => {
  const { life_outcome } = getLives(demoRecipe).find((r) => r.life_outcome.affair === 'spouse')!;
  const service = buildChapelService(sampleProfile, { ...sampleRun, life_outcome });
  const partner = sampleProfile.relatives.find((r) => r.relation === 'partner')!;
  expect(service.guests).toEqual(sampleProfile.relatives);
  expect(service.cues.find((c) => c.relativeId === partner.id)).toMatchObject({ speaks: false });
  const archive = buildChapelService(sampleProfile, sampleRun);
  expect(archive.cues.filter((c) => c.tearful)).toHaveLength(0);
  expect(chapelScreening('jules', null)?.profile.id).toBe('jules-film');
  expect(chapelScreening(null, 'another-persons-private-run')).toBeUndefined();
});
