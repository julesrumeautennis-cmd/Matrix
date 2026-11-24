import { z } from 'zod';
import type { Profile } from '@eulogy/shared';
import {
  exampleThreads,
  SourceSchema,
  ThreadsSchema,
  type Source,
  type SampleThread,
} from '../../../../packages/shared/src/conversations';
import { bankRelease, ReferenceSchema } from '../../../../packages/shared/src/reference';
import { initialProfile, MatrixProfile } from './profile';

export const sources: Record<Source, { name: string; color: string; example: string }> = {
  whatsapp: { name: 'WhatsApp', color: '#79c79d', example: 'Weekend group' },
  instagram: { name: 'Instagram', color: '#e09fb9', example: '@sample.profile' },
  imessage: { name: 'iMessage', color: '#86b6ea', example: 'Family thread' },
  snapchat: { name: 'Snapchat', color: '#e8d47d', example: '@sample.snap' },
  gmail: { name: 'Gmail', color: '#e59c87', example: 'Sample inbox' },
};
export const castColors = ['#eff9dc', '#b4dd85', '#e8b47e', '#8abada', '#c09fd9', '#7dc8ba'];
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
export const PersonaSchema = z.object({
  id: z.string(),
  label: z.string(),
  bonding: z.number().min(0).max(1),
  quote: z.string(),
  source: SourceSchema.nullable(),
  excerpts: z.number().int().nonnegative(),
});
export type Persona = z.infer<typeof PersonaSchema>;
export const RecipeSchema = z.object({
  version: z.literal(1),
  profile: MatrixProfile,
  agents: z.array(PersonaSchema).length(5),
  sources: z.array(SourceSchema),
  reference: ReferenceSchema,
  transport: z.enum(['MCP', 'Local archive']),
  seed: z.number().int(),
});
export type Recipe = z.infer<typeof RecipeSchema>;
export function assignAgents(
  profile: Profile,
  archives: { source: Source; threads: SampleThread[] }[],
): Persona[] {
  return profile.relatives.map((person, i) => {
    const excerpts = archives.flatMap(({ source, threads }) =>
      threads
        .filter((t) => t.seat === i)
        .flatMap((t) => t.messages.map((text) => ({ source, text }))),
    );
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
    const voice = ranked[0]!.score ? ranked[0]! : { ...voices[i]!, example: excerpts[0] };
    return {
      id: person.id,
      label: voice.label,
      bonding: voice.bonding,
      quote: voice.example?.text ?? person.grievance,
      source: voice.example?.source ?? null,
      excerpts: excerpts.length,
    };
  });
}
let requestNo = 0;
async function rpc(method: string, params: unknown, signal: AbortSignal, notify = false) {
  const id = ++requestNo;
  const response = await fetch('/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    },
    signal,
    body: JSON.stringify({ jsonrpc: '2.0', ...(notify ? {} : { id }), method, params }),
  });
  if (!response.ok) throw Error('MCP response unavailable');
  if (notify) return;
  return z
    .object({ jsonrpc: z.literal('2.0'), id: z.literal(id), result: z.unknown() })
    .parse(await response.json()).result;
}
export async function analyze(
  profile: Profile,
  selected: Source[],
  signal: AbortSignal,
): Promise<Recipe> {
  let archives = selected.map((source) => ({ source, threads: exampleThreads(source) }));
  let reference = bankRelease;
  let transport: Recipe['transport'] = 'Local archive';
  try {
    const timed = AbortSignal.any([signal, AbortSignal.timeout(11500)]);
    z.object({ protocolVersion: z.string() }).parse(
      await rpc(
        'initialize',
        {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'Matrix browser', version: '1.0' },
        },
        timed,
      ),
    );
    await rpc('notifications/initialized', {}, timed, true);
    const list = z
      .object({ tools: z.array(z.object({ name: z.string() })) })
      .parse(await rpc('tools/list', {}, timed));
    if (
      !['read_population_reference', 'list_conversations'].every((name) =>
        list.tools.some((t) => t.name === name),
      )
    )
      throw Error('Missing MCP tools');
    const [publicData, threads] = await Promise.all([
      rpc('tools/call', { name: 'read_population_reference', arguments: {} }, timed),
      Promise.all(
        selected.map(async (source) => {
          const data = await rpc(
            'tools/call',
            { name: 'list_conversations', arguments: { source } },
            timed,
          );
          return {
            source,
            threads: z
              .object({ structuredContent: z.object({ threads: ThreadsSchema }) })
              .parse(data).structuredContent.threads,
          };
        }),
      ),
    ]);
    reference = z
      .object({ structuredContent: z.object({ reference: ReferenceSchema }) })
      .parse(publicData).structuredContent.reference;
    archives = threads;
    transport = 'MCP';
  } catch {
    if (signal.aborted) throw signal.reason;
  }
  return RecipeSchema.parse({
    version: 1,
    profile,
    sources: selected,
    agents: assignAgents(profile, archives),
    reference,
    transport,
    seed: crypto.getRandomValues(new Uint32Array(1))[0],
  });
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
