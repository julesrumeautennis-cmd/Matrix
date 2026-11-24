import {
  clamp,
  makeRng,
  RunSchema,
  type LifeOutcome,
  type Run,
  type YearEvent,
} from '@eulogy/shared';
import type { Recipe } from './analysis';

export const population = 100;
const chapterMoments = [0.06, 0.19, 0.34, 0.52, 0.74, 1];
const chapterScenes = [
  'The first invitation arrives on a busy night.',
  'An old routine becomes a promise.',
  'Work and home both need an answer.',
  'An empty chair brings everyone together.',
  'The phone rings on an ordinary Sunday.',
  'The people closest to you remember the choices you made.',
];
const practices = [
  'kept playing doubles into retirement',
  'traded competition for long walks',
  'returned to the court after a knee injury',
  'took a season off to recover from exhaustion',
];
const recoveries = [
  'learned to live at a slower pace',
  'built a daily walking habit',
  'recovered after a long hospital stay',
  'joined a running club for the first time',
];
const endings = [
  'old age',
  'heart disease',
  'a sudden illness',
  'an accident',
  'complications after a stroke',
];
export function cohortName(activity: string) {
  if (/startup|founder|company|entrepreneur/i.test(activity)) return 'Founders & builders';
  if (/university|college|student|study|school/i.test(activity)) return 'Students & graduates';
  if (/sport|tennis|athlet|coach/i.test(activity)) return 'Athletes & coaches';
  return 'Working adults';
}
const choose = <T>(items: readonly T[], rng: () => number): T =>
  items[Math.floor(rng() * items.length)]!;
const between = (rng: () => number, low: number, high: number) =>
  low + Math.floor(rng() * (high - low + 1));
const fictionAge = (start: number, end: number, fraction: number) =>
  Math.round(start + (end - start) * fraction);
function outcome(recipe: Recipe, death: number, rng: () => number): LifeOutcome {
  const { profile, agents } = recipe;
  const start = profile.age;
  const close = agents.reduce((sum, a) => sum + a.bonding, 0) / agents.length;
  const founder = cohortName(profile.currentActivity) === 'Founders & builders';
  const marry =
    rng() < (profile.relatives.some((p) => p.relation === 'partner') ? 0.9 : 0.58 + 0.22 * close);
  const marriage_age = marry
    ? Math.min(death - 4, start + between(rng, 2, founder ? 16 : 13))
    : null;
  const divorce_age =
    marriage_age !== null && rng() < (founder ? 0.44 : 0.33)
      ? Math.min(death - 2, marriage_age + between(rng, 2, 23))
      : null;
  const affair =
    divorce_age === null || rng() < 0.4 ? 'none' : rng() < 0.5 ? 'spouse' : 'protagonist';
  const count = rng() < (marry ? 0.76 : 0.32) ? (rng() < 0.67 ? 1 : 2) : 0;
  const children: LifeOutcome['children'] = Array.from({ length: count }, (_, i) => ({
    kind: rng() < 0.5 ? 'daughter' : 'son',
    birth_age: Math.min(death - 1, (marriage_age ?? start + 2) + between(rng, 1, 5) + i * 5),
    bond: rng() < 0.37 + close * 0.46 ? 'close' : 'distant',
  }));
  const wellbeing =
    rng() < 0.23 + Number(divorce_age !== null) * 0.14
      ? 'restless'
      : rng() < 0.55
        ? 'fulfilled'
        : 'content';
  const health_event = choose(profile.habits.sport >= 4 ? practices : recoveries, rng);
  const health_age = fictionAge(start, death, 0.42 + rng() * 0.46);
  const turning_point =
    affair === 'spouse'
      ? 'You found a second relationship in a message left open on the kitchen table.'
      : affair === 'protagonist'
        ? 'You told your spouse about the affair before someone else could.'
        : divorce_age !== null
          ? 'The last thing you divided was the Sunday dinner table.'
          : children.length
            ? children[0]!.bond === 'close'
              ? 'Your ' + children[0]!.kind + ' called every Sunday, even after moving away.'
              : 'Your ' + children[0]!.kind + ' stopped calling. You kept the phone on anyway.'
            : marry
              ? 'Your partner kept every train ticket from the years you lived apart.'
              : 'Your closest friends kept a spare key and a seat at Sunday dinner.';
  return {
    marriage_age,
    divorce_age,
    affair,
    children,
    wellbeing,
    health_event,
    health_age,
    turning_point,
  };
}
type Life = Run & { life_outcome: LifeOutcome };
export type MatrixLife = Life;
function makeLife(recipe: Recipe, index: number): Life {
  const { profile, agents, reference } = recipe;
  const seed = (recipe.seed + Math.imul(index + 1, 2654435761)) >>> 0;
  const rng = makeRng(seed);
  const noise = Math.sqrt(-2 * Math.log(Math.max(0.000001, rng()))) * Math.cos(2 * Math.PI * rng());
  const { sport, sleep, alcohol, sugar = 4 } = profile.habits;
  const death = clamp(
    Math.round(
      reference.lifeExpectancy +
        (sport - 3) * 0.38 +
        (sleep - 4) * 0.52 -
        (alcohol - 2) * 0.24 -
        (sugar - 4) * 0.09 +
        noise * 7.5,
    ),
    profile.age + 8,
    101,
  );
  const record = outcome(recipe, death, rng);
  const id = 'mx-' + recipe.seed.toString(36) + '-' + String(index + 1).padStart(3, '0');
  const scores = agents.map((a) => Math.round(43 + a.bonding * 30 + rng() * 12));
  const timeline: [number, string][] = [[record.health_age, 'You ' + record.health_event + '.']];
  if (record.marriage_age !== null)
    timeline.push([record.marriage_age, 'You got married at ' + record.marriage_age + '.']);
  if (record.divorce_age !== null)
    timeline.push([
      record.divorce_age,
      'You divorced at ' + record.divorce_age + '. ' + record.turning_point,
    ]);
  for (const child of record.children)
    timeline.push([
      child.birth_age,
      'At ' + child.birth_age + ', you welcomed a ' + child.kind + '.',
    ]);
  timeline.sort((a, b) => a[0] - b[0]);
  let previous = profile.age;
  const years: YearEvent[] = chapterMoments.map((fraction, i) => {
    const age = Math.min(
      death - (5 - i),
      Math.max(previous + 1, fictionAge(profile.age, death, fraction)),
    );
    const events = timeline.filter(([a]) => a > previous && a <= age).map(([, detail]) => detail);
    previous = age;
    const first = between(rng, 0, 4),
      second = (first + between(rng, 1, 4)) % 5;
    const visited = rng() < 0.45 + (record.wellbeing === 'fulfilled' ? 0.18 : 0);
    const relative_states = agents.map((a, k) => {
      scores[k] = clamp(
        Math.round(
          scores[k]! +
            (visited ? 5 : -5) +
            (a.bonding - 0.5) * 6 +
            (rng() - 0.5) * 15 +
            (k === first ? 2 : 0),
        ),
        0,
        100,
      );
      const memory =
        k === first && events[0]
          ? events[0]
          : visited
            ? 'We made time for each other that year.'
            : 'I kept waiting for a call back.';
      return {
        relative_id: a.id,
        relationship_score: scores[k]!,
        emotion: { valence: (scores[k]! - 50) / 50, arousal: rng() },
        memory_update: memory,
      };
    });
    return {
      run_id: id,
      year_index: i,
      protagonist_age: age,
      generation: 'scripted',
      shock_source: 'destiny',
      shock: events.join(' ') || chapterScenes[i]!,
      decisions: [
        {
          actor: profile.id,
          action: visited
            ? 'Showed up for ' + profile.relatives[first]!.name
            : 'Let the call go to voicemail',
          reason: visited ? 'I wanted to be there this time.' : 'I thought we had another week.',
        },
      ],
      relative_states,
      private_messages: [
        {
          from: agents[first]!.id,
          to: agents[second]!.id,
          text: visited
            ? 'We finally had that evening together.'
            : 'Have you heard from ' + profile.name + ' this week?',
        },
      ],
    };
  });
  const eulogies = agents.map((a, i) => ({
    run_id: id,
    relative_id: a.id,
    speaks: scores[i]! >= 55,
    sentiment: (scores[i]! - 50) / 50,
    text:
      scores[i]! >= 55
        ? 'I can still hear ' +
          profile.name +
          ' picking up the phone. That small thing meant everything.'
        : 'I wrote down the things I never found a way to say to ' + profile.name + '.',
  }));
  const run = {
    run_id: id,
    profile_id: profile.id,
    seed,
    death_age: death,
    cause_of_death: choose(endings, rng),
    years,
    eulogies,
    ending_cluster: record.wellbeing,
    life_outcome: record,
  };
  RunSchema.parse(run);
  return run;
}
export function simulate(recipe: Recipe): MatrixLife[] {
  return Array.from({ length: population }, (_, i) => makeLife(recipe, i));
}
export function distribution(lives: MatrixLife[]) {
  const ages = lives.map((r) => r.death_age);
  const lo = 5 * Math.floor(Math.min(...ages) / 5),
    hi = 5 * Math.floor(Math.max(...ages) / 5);
  return Array.from({ length: (hi - lo) / 5 + 1 }, (_, i) => {
    const from = lo + i * 5;
    const members = lives.filter((r) => r.death_age >= from && r.death_age < from + 5);
    return { from, to: from + 4, lives: members, percent: (100 * members.length) / lives.length };
  });
}
export function peakLife(bins: ReturnType<typeof distribution>) {
  const peak = bins.reduce((best, bin) => (bin.lives.length > best.lives.length ? bin : best));
  const signature = (life: MatrixLife) => {
    const o = life.life_outcome;
    return [o.marriage_age !== null, o.divorce_age !== null, o.children.length, o.wellbeing].join(
      '/',
    );
  };
  const counts = new Map<string, number>();
  for (const life of peak.lives)
    counts.set(signature(life), (counts.get(signature(life)) ?? 0) + 1);
  return [...peak.lives].sort(
    (a, b) =>
      counts.get(signature(b))! - counts.get(signature(a))! ||
      Math.abs(a.death_age - peak.from - 2) - Math.abs(b.death_age - peak.from - 2),
  )[0]!;
}
const cache = new WeakMap<Recipe, MatrixLife[]>();
export function getLives(recipe: Recipe) {
  const cached = cache.get(recipe);
  if (cached) return cached;
  const lives = simulate(recipe);
  cache.set(recipe, lives);
  return lives;
}
export const lifeNumber = (r: Run) => r.run_id.split('-').at(-1)!;
