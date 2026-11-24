import { expect, it } from 'vitest';
import { sampleProfile, sampleRun } from '@eulogy/shared';
import { seatPositions } from '../components/chapelBlocking';
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
    expect(seatPositions.length).toBeGreaterThanOrEqual(guests.length);
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
