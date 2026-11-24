import { json } from './http';
export { json } from './http';
import { ProfileSchema, RunSchema, RunSummarySchema } from '@eulogy/shared';
import { z } from 'zod';

export const Id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = z.string().trim().min(1).max(1200);
export const InputProfile = ProfileSchema.extend({
  id: Id,
  age: z.number().int().min(16).max(70),
  name: text,
  city: text,
  currentActivity: text,
  ambition10y: text,
  flaw: text,
  fear: text,
  traits: z.array(text).length(3),
  relatives: z
    .array(
      ProfileSchema.shape.relatives.element.extend({
        id: Id,
        name: text,
        relationshipState: text,
        grievance: text,
        age: z.number().int().min(0).max(125),
      }),
    )
    .min(1)
    .max(5),
  photoUrl: z.string().url().max(6000).optional(),
}).refine(
  (p) =>
    new Set([p.id, 'destiny', ...p.relatives.map((r) => r.id)]).size === p.relatives.length + 2,
  'Cast IDs must be distinct.',
);
export const Manifest = z.object({
  profile_id: Id,
  run_ids: z.array(z.string()).length(12),
  summary: RunSummarySchema,
});
export const Batch = Manifest.extend({ runs: z.array(RunSchema).length(12) });
export function checkRequest(request: Request, method: string, keys: string[]) {
  if (request.method !== method)
    return json({ error: 'Method not allowed.' }, 405, { Allow: method });
  if (keys.some((k) => !process.env[k]))
    return json({ error: 'The live service is not configured.' }, 501);
  return null;
}
export async function readBody<T>(request: Request, schema: z.ZodType<T>, maxBytes: number) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return { error: json({ error: 'Expected JSON.' }, 415) } as const;
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes)
    return { error: json({ error: 'Body too large.' }, 413) } as const;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > maxBytes)
      return { error: json({ error: 'Body too large.' }, 413) } as const;
    const parsed = schema.safeParse(JSON.parse(body));
    if (parsed.success) return { data: parsed.data } as const;
  } catch {
    /* The response deliberately reports only the input boundary. */
  }
  return { error: json({ error: 'Invalid request.' }, 400) } as const;
}
