import { demoRecipe, getRecipe } from '../matrix/analysis';
import { getLives } from '../matrix/simulation';
import { demo, getScreening, type Screening } from './screening';

export type ChapelScreening = Pick<Screening, 'profile' | 'runs'> & {
  summary: Pick<Screening['summary'], 'most_probable_run_id' | 'best_run_id' | 'generation'>;
};

export function chapelScreening(
  sample: string | null,
  life: string | null,
): ChapelScreening | undefined {
  const saved = getScreening(sample);
  if (sample === 'jules' || sample === 'louis' || saved !== demo) {
    if (!life || saved.runs.some((run) => run.run_id === life)) return saved;
    if (sample === 'jules' || sample === 'louis') return undefined;
  }
  const recipe = getRecipe() ?? demoRecipe;
  for (const source of new Set([recipe, demoRecipe])) {
    const runs = getLives(source);
    const run = life
      ? runs.find((item) => item.run_id === life)
      : (runs.find(
          ({ life_outcome: o }) =>
            o.affair === 'spouse' &&
            o.wellbeing === 'fulfilled' &&
            o.children.some((c) => c.bond === 'close'),
        ) ??
        runs.find(({ life_outcome: o }) => o.affair === 'spouse') ??
        runs[0]);
    if (run)
      return {
        profile: source.profile,
        runs: [run],
        summary: { generation: { scripted: run.years.length } },
      };
  }
  return undefined;
}
