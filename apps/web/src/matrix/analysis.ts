import { z } from 'zod';
import type { Profile } from '@eulogy/shared';
import {
  exampleThreads,
  SourceSchema,
  type Source,
  type SampleThread,
} from '../../../../packages/shared/src/conversations';
import {
  bankRelease,
  ReferenceSchema,
  cdcRelease,
  WebEvidenceSchema,
} from '../../../../packages/shared/src/reference';
import { callTool, openMcp, readArchive, type ReportTrace } from './mcpClient';
import { initialProfile, MatrixProfile } from './profile';

export const sources: Record<Source, { name: string; color: string; example: string }> = {
  whatsapp: { name: 'WhatsApp', color: '#79c79d', example: 'Weekend group' },
  instagram: { name: 'Instagram', color: '#e09fb9', example: '@sample.profile' },
  imessage: { name: 'iMessage', color: '#86b6ea', example: 'Family thread' },
  snapchat: { name: 'Snapchat', color: '#e8d47d', example: '@sample.snap' },
  gmail: { name: 'Gmail', color: '#e59c87', example: 'Sample inbox' },
};
const castColors = ['#eff9dc', '#b4dd85', '#e8b47e', '#8abada', '#c09fd9', '#7dc8ba'];
export function castColor(index: number) {
  return castColors[index] ?? `hsl(${Math.round((index * 137.508) % 360)}, 52%, 73%)`;
}
const voices = [
  {
    label: 'Protective',
    matches: /worr|safe|home|plate|dinner|kitchen|look after/gi,
    bonding: 0.8,
    quote: 'I want to hear from you.',
  },
  {
    label: 'Sentimental',
    matches: /miss|music|song|seat|playlist|front row|remember|memory/gi,
    bonding: 0.63,
    quote: 'I remember when you showed up.',
  },
  {
    label: 'Competitive',
    matches: /win|match|court|risk|pitch|tennis|race|practice|compet/gi,
    bonding: 0.42,
    quote: 'One more try. We can do this.',
  },
  {
    label: 'Reserved',
    matches: /fix|garage|bike|quiet|months ago|no rush|easier|first call/gi,
    bonding: 0.33,
    quote: 'Take your time. I am here.',
  },
  {
    label: 'Connector',
    matches: /group|plan|everyone|invite|book|together|sunday free/gi,
    bonding: 0.76,
    quote: 'Let’s get everyone around the table.',
  },
];
// Give each saved person consistent sample conversations when the roster is edited.
export function sampleTemplates(profile: Profile): number[] {
  return profile.relatives.map((person) => {
    const original = initialProfile.relatives.findIndex((relative) => relative.id === person.id);
    if (original !== -1) return original;
    const notes = person.relationshipState + ' ' + person.grievance;
    const scores = voices.map((voice) => (notes.match(voice.matches) ?? []).length);
    const best = Math.max(...scores);
    if (best) return scores.indexOf(best);
    const defaults = {
      parent: 0,
      partner: 1,
      child: 1,
      sibling: 2,
      cofounder: 2,
      friend: 4,
      other: 3,
    };
    return defaults[person.relation];
  });
}
export const PersonaSchema = z.object({
  id: z.string(),
  label: z.string(),
  bonding: z.number().min(0).max(1),
  quote: z.string(),
  source: SourceSchema.nullable(),
  excerpts: z.number().int().nonnegative(),
});
export type Persona = z.infer<typeof PersonaSchema>;
export const RecipeSchema = z
  .object({
    version: z.literal(1),
    profile: MatrixProfile,
    agents: z.array(PersonaSchema).min(1),
    sources: z.array(SourceSchema),
    reference: ReferenceSchema,
    webEvidence: WebEvidenceSchema.optional(),
    transport: z.enum(['MCP', 'Local archive']),
    seed: z.number().int(),
  })
  .refine(
    (r) =>
      r.agents.length === r.profile.relatives.length &&
      r.agents.every((agent, index) => agent.id === r.profile.relatives[index]?.id),
    'Each person in the circle needs their own agent.',
  );
export type Recipe = z.infer<typeof RecipeSchema>;
export function assignAgents(
  profile: Profile,
  archives: { source: Source; threads: SampleThread[] }[],
  report?: ReportTrace,
): Persona[] {
  return profile.relatives.map((person, i) => {
    const excerpts = archives.flatMap(({ source, threads }) =>
      threads
        .filter((t) => t.seat === i)
        .flatMap((t) => t.messages.map((text) => ({ source, text }))),
    );
    report?.({
      operation: 'agent.bind',
      detail: person.name + ' · matching relationship notes · excerpts=' + excerpts.length,
      agent: { id: person.id, state: 'connecting' },
    });
    const notes = [person.relationshipState, person.grievance].join(' ');
    const ranked = voices
      .map((v) => {
        const hits = (text: string) => (text.match(v.matches) ?? []).length;
        return {
          ...v,
          score: hits(notes) + excerpts.reduce((a, item) => a + 2 * hits(item.text), 0),
          example: [...excerpts].sort((a, b) => hits(b.text) - hits(a.text))[0],
        };
      })
      .sort((a, b) => b.score - a.score);
    const voice = ranked[0]!.score
      ? ranked[0]!
      : { ...voices[i % voices.length]!, example: excerpts[0] };
    if (voice.example)
      report?.({
        operation: 'agent.evidence',
        detail:
          person.name +
          ' · ' +
          sources[voice.example.source].name +
          ' · “' +
          voice.example.text +
          '”',
      });
    report?.({
      operation: 'agent.connect',
      detail: person.name + ' · ' + voice.label + ' · bonding=' + voice.bonding.toFixed(2),
      agent: { id: person.id, state: 'connected' },
    });
    return {
      id: person.id,
      label: voice.label,
      bonding: voice.bonding,
      quote: voice.example?.text || person.grievance || person.relationshipState || voice.quote,
      source: voice.example?.source ?? null,
      excerpts: excerpts.length,
    };
  });
}
export async function analyze(
  profile: Profile,
  selected: Source[],
  signal: AbortSignal,
  report: ReportTrace = () => {},
): Promise<Recipe> {
  const templates = sampleTemplates(profile);
  const emit: ReportTrace = (event) => {
    if (!signal.aborted) report(event);
  };
  emit({
    operation: 'profile.load',
    detail:
      profile.name +
      ' · ' +
      templates.length +
      ' relatives · ' +
      selected.length +
      ' sample sources',
  });
  const timed = AbortSignal.any([signal, AbortSignal.timeout(11500)]);
  let tools: string[] = [];
  let usedMcp = false;
  try {
    tools = (await openMcp(timed, emit)).tools;
  } catch {
    signal.throwIfAborted();
    emit({
      operation: 'transport.local',
      detail: 'MCP session unavailable · opening bundled samples and reference releases',
    });
  }

  async function read<T>(
    name: string,
    readRemote: () => Promise<T>,
    local: () => T,
    label: string,
  ): Promise<T> {
    const started = performance.now();
    if (tools.includes(name)) {
      emit({ operation: 'tools/call', detail: name + ' · ' + label });
      try {
        const value = await readRemote();
        signal.throwIfAborted();
        usedMcp = true;
        emit({
          operation: 'schema.valid',
          detail: name + ' · ' + label,
          durationMs: performance.now() - started,
        });
        return value;
      } catch {
        signal.throwIfAborted();
      }
    }
    emit({ operation: 'sample.local', detail: label + ' · bundled copy selected' });
    return local();
  }
  const [reference, webEvidence, archives] = await Promise.all([
    read(
      'read_population_reference',
      async () =>
        z
          .object({ reference: ReferenceSchema })
          .parse(await callTool('read_population_reference', {}, timed)).reference,
      () => bankRelease,
      'US life expectancy',
    ),
    read(
      'read_public_web_evidence',
      async () =>
        z
          .object({ evidence: WebEvidenceSchema })
          .parse(await callTool('read_public_web_evidence', {}, timed)).evidence,
      () => cdcRelease,
      'US marriage and divorce rates',
    ),
    Promise.all(
      selected.map(async (source) => {
        const threads = await read(
          'list_conversations',
          () => readArchive(source, templates, timed),
          () => exampleThreads(source, templates),
          sources[source].name,
        );
        const excerpts = threads.reduce((sum, thread) => sum + thread.messages.length, 0);
        emit({
          operation: 'archive.index',
          detail: sources[source].name + ' · threads=' + threads.length + ' · excerpts=' + excerpts,
        });
        return { source, threads };
      }),
    ),
  ]);
  signal.throwIfAborted();
  emit({
    operation: 'reference.lifespan',
    detail:
      reference.provider +
      ' · ' +
      reference.year +
      ' · ' +
      reference.lifeExpectancy.toFixed(2) +
      ' years',
  });
  emit({
    operation: 'reference.family',
    detail:
      webEvidence.provider +
      ' · ' +
      webEvidence.year +
      ' · ' +
      webEvidence.marriageRate +
      ' marriages and ' +
      webEvidence.divorceRate +
      ' divorces per 1,000',
  });
  const agents = assignAgents(profile, archives, emit);
  const recipe = RecipeSchema.parse({
    version: 1,
    profile,
    sources: selected,
    agents,
    reference,
    webEvidence,
    transport: usedMcp ? 'MCP' : 'Local archive',
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
  });
  emit({
    operation: 'run.prepare',
    detail: 'seed=' + recipe.seed + ' · ' + (agents.length + 1) + ' agents ready',
  });
  return recipe;
}
export const demoRecipe: Recipe = RecipeSchema.parse({
  version: 1,
  profile: initialProfile,
  agents: assignAgents(
    initialProfile,
    SourceSchema.options.map((source) => ({ source, threads: exampleThreads(source) })),
  ),
  sources: [...SourceSchema.options],
  reference: bankRelease,
  webEvidence: cdcRelease,
  transport: 'Local archive',
  seed: 1701,
});
let current: Recipe | undefined;
export function saveRecipe(recipe: Recipe) {
  current = recipe;
  try {
    sessionStorage.setItem('matrix.experiment.v1', JSON.stringify(recipe));
  } catch {
    /* In-memory runs stay usable. */
  }
}
export function getRecipe(): Recipe | undefined {
  if (current) return current;
  try {
    const parsed = RecipeSchema.safeParse(
      JSON.parse(sessionStorage.getItem('matrix.experiment.v1') ?? 'null'),
    );
    if (parsed.success) current = parsed.data;
  } catch {
    /* A new session starts at the profile. */
  }
  return current;
}
