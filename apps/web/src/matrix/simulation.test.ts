import { describe, expect, it } from 'vitest';
import { RunSchema } from '@eulogy/shared';
import { SourceSchema, exampleThreads } from '../../../../packages/shared/src/conversations';
import { assignAgents, demoRecipe } from './analysis';
import { distribution, getLives, peakLife, simulate } from './simulation';

describe('Matrix screening', () => {
  it('replays 100 distinct lives, with five relatives, six chronological chapters and truthful frequencies', () => {
    const lives = getLives(demoRecipe),
      bins = distribution(lives),
      peak = peakLife(bins);
    expect(lives).toHaveLength(100);
    expect(new Set(lives.map((r) => r.run_id)).size).toBe(100);
    expect(bins.reduce((sum, b) => sum + b.percent, 0)).toBe(100);
    expect(bins.find((bin) => bin.lives.includes(peak))!.percent).toBe(
      Math.max(...bins.map((b) => b.percent)),
    );
    expect(simulate(demoRecipe)[9]).toEqual(lives[9]);
    for (const run of lives) {
      expect(RunSchema.safeParse(run).success).toBe(true);
      expect(run.eulogies).toHaveLength(5);
      const o = run.life_outcome;
      if (o.divorce_age !== null) {
        expect(o.marriage_age).not.toBeNull();
        expect(o.divorce_age).toBeGreaterThan(o.marriage_age!);
      }
      if (o.affair !== 'none') {
        expect(o.divorce_age).not.toBeNull();
        expect(run.years.some((y) => y.shock.includes(o.turning_point))).toBe(true);
      }
      expect(o.health_age).toBeLessThan(run.death_age);
    }
  });
  it('preserves the edited cast and the evidence bearing on their personas', () => {
    const profile = {
      ...demoRecipe.profile,
      name: 'Alex',
      age: 70,
      relatives: demoRecipe.profile.relatives.map((p, i) => ({
        ...p,
        id: 'w' + i,
        name: 'Witness ' + i,
      })),
    };
    const archives = SourceSchema.options.map((source) => ({
      source,
      threads: exampleThreads(source),
    }));
    const agents = assignAgents(profile, archives);
    expect(new Set(agents.map((a) => a.label)).size).toBe(5);
    for (const agent of agents)
      expect(
        archives.some(
          (a) =>
            a.source === agent.source && a.threads.some((t) => t.messages.includes(agent.quote)),
        ),
      ).toBe(true);
    const life = simulate({ ...demoRecipe, profile, agents })[0]!;
    expect(life.years[0]!.protagonist_age).toBeGreaterThan(70);
    expect(life.eulogies.map((e) => e.relative_id)).toEqual(profile.relatives.map((r) => r.id));
  });
});
