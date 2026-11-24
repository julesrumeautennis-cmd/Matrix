import { z } from 'zod';
import { exampleThreads, SourceSchema } from '../../../packages/shared/src/conversations';
import { loadWebEvidence } from './webEvidence';
import { loadReference } from './reference';
import { json } from './http';

const version = '2025-06-18';
const message = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.number().int(), z.string()]).optional(),
  method: z.string(),
  params: z.unknown().optional(),
});
const call = z.object({
  name: z.literal('list_conversations'),
  arguments: z.object({ source: SourceSchema }),
});
const referenceTool = {
  name: 'read_population_reference',
  description:
    'Read a US population reference from a configured Nexla Nexset, the World Bank feed, or its dated release.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true },
};
const webTool = {
  ...referenceTool,
  name: 'read_public_web_evidence',
  description:
    'Extract published US marriage and divorce rates from the CDC page or its configured Nexla web-data Nexset. Returns year, coverage, URL and actual retrieval provider.',
};
const tool = {
  name: 'list_conversations',
  description:
    'Read fictional conversation excerpts for five cast slots from a Matrix sample source.',
  inputSchema: {
    type: 'object',
    properties: { source: { type: 'string', enum: SourceSchema.options } },
    required: ['source'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
};

export async function mcp(request: Request): Promise<Response> {
  if (request.method !== 'POST')
    return json({ error: 'Use POST for stateless JSON-RPC.' }, 405, { Allow: 'POST' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: 'Origin mismatch.' }, 403);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ error: 'Expected JSON.' }, 415);
  if (Number(request.headers.get('content-length') ?? 0) > 10000)
    return json({ error: 'Request too large.' }, 413);
  const body = await request.text();
  if (body.length > 10000) return json({ error: 'Request too large.' }, 413);
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  }
  const parsed = message.safeParse(raw);
  if (!parsed.success)
    return json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } },
      400,
    );
  const { id, method, params } = parsed.data;
  if (id === undefined) return new Response(null, { status: 202 });
  const reply = (result: unknown) => json({ jsonrpc: '2.0', id, result });
  const error = (code: number, message: string) =>
    json({ jsonrpc: '2.0', id, error: { code, message } });
  if (method === 'initialize')
    return reply({
      protocolVersion: version,
      capabilities: { tools: {} },
      serverInfo: { name: 'matrix-sample-archive', version: '1.0.0' },
    });
  if (method === 'ping') return reply({});
  if (method === 'tools/list') return reply({ tools: [tool, referenceTool, webTool] });
  if (method !== 'tools/call') return error(-32601, 'Unknown method');
  if (
    z
      .object({
        name: z.literal('read_population_reference'),
        arguments: z.object({}).strict().optional(),
      })
      .safeParse(params).success
  ) {
    const reference = await loadReference();
    return reply({
      content: [{ type: 'text', text: JSON.stringify(reference) }],
      structuredContent: { reference },
    });
  }
  if (
    z
      .object({
        name: z.literal('read_public_web_evidence'),
        arguments: z.object({}).strict().optional(),
      })
      .safeParse(params).success
  ) {
    const evidence = await loadWebEvidence();
    return reply({
      content: [{ type: 'text', text: JSON.stringify(evidence) }],
      structuredContent: { evidence },
    });
  }
  const input = call.safeParse(params);
  if (!input.success) return error(-32602, 'Invalid tool or source');
  const threads = exampleThreads(input.data.arguments.source);
  return reply({
    content: [{ type: 'text', text: JSON.stringify(threads) }],
    structuredContent: { threads },
  });
}
export default { fetch: mcp };
