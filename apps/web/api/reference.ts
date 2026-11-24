import { z } from 'zod';
import {
  bankPage,
  bankRelease,
  ReferenceSchema,
  type Reference,
} from '../../../packages/shared/src/reference';

const bankApi =
  'https://api.worldbank.org/v2/country/USA/indicator/SP.DYN.LE00.IN?format=json&mrnev=1';
const bankRows = z.tuple([
  z.unknown(),
  z
    .array(
      z.object({
        date: z.string(),
        value: z.number(),
        countryiso3code: z.literal('USA'),
        indicator: z.object({ id: z.literal('SP.DYN.LE00.IN') }),
      }),
    )
    .nonempty(),
]);
const rpcReply = z.object({ result: z.unknown() });
const dataFrame = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())).nonempty(),
});

async function fromNexla(endpoint: string, key: string, tool: string): Promise<Reference> {
  // Only the server operator can select a workspace, tool and credential.
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.hostname !== 'api-genai.nexla.io')
    throw Error('Invalid Nexla workspace');
  const headers = new Headers({
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  });
  const signal = AbortSignal.timeout(6500);
  let id = 0;
  async function rpc(method: string, params: unknown, notification = false) {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      redirect: 'error',
      signal,
      body: JSON.stringify({
        jsonrpc: '2.0',
        ...(notification ? {} : { id: ++id }),
        method,
        params,
      }),
    });
    if (!response.ok) throw Error('Nexla MCP unavailable');
    const session = response.headers.get('mcp-session-id');
    if (session) headers.set('Mcp-Session-Id', session);
    if (notification) return;
    const body = await response.text();
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      for (const line of body.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const item = JSON.parse(line.slice(5));
        if (item.id === id) return rpcReply.parse(item).result;
      }
      throw Error('Missing MCP event');
    }
    return rpcReply.parse(JSON.parse(body)).result;
  }
  const init = z
    .object({ protocolVersion: z.string() })
    .parse(
      await rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'Matrix', version: '1.0' },
      }),
    );
  headers.set('MCP-Protocol-Version', init.protocolVersion);
  await rpc('notifications/initialized', {}, true);
  const list = z
    .object({ tools: z.array(z.object({ name: z.string() })) })
    .parse(await rpc('tools/list', {}));
  if (!list.tools.some((item) => item.name === tool)) throw Error('Nexset tool missing');
  const reply = z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.unknown().optional(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    })
    .parse(
      await rpc('tools/call', { name: tool, arguments: { format: 'dataframe_columns', limit: 1 } }),
    );
  if (reply.isError) throw Error('Nexset read failed');
  const payload =
    reply.structuredContent ??
    JSON.parse(reply.content?.find((part) => part.type === 'text')?.text ?? 'null');
  const frame = dataFrame.parse(payload?.result?.data ?? payload?.data ?? payload);
  const row = Object.fromEntries(frame.columns.map((col, i) => [col, frame.rows[0][i]]));
  return ReferenceSchema.parse({
    year: String(row.year),
    lifeExpectancy: Number(row.life_expectancy),
    sourceUrl: row.source_url,
    provider: 'Nexla MCP',
  });
}

let cached: { at: number; value: Reference } | undefined;
export async function loadReference(): Promise<Reference> {
  if (cached && Date.now() - cached.at < 3600000) return cached.value;
  const { NEXLA_MCP_URL, NEXLA_SERVICE_KEY, NEXLA_COHORT_TOOL } = process.env;
  let value: Reference | undefined;
  if (NEXLA_MCP_URL && NEXLA_SERVICE_KEY && NEXLA_COHORT_TOOL) {
    try {
      value = await fromNexla(NEXLA_MCP_URL, NEXLA_SERVICE_KEY, NEXLA_COHORT_TOOL);
    } catch {
      /* The public feed is the next source. */
    }
  }
  if (!value) {
    try {
      const r = await fetch(bankApi, { signal: AbortSignal.timeout(3500) });
      if (!r.ok) throw Error('Feed unavailable');
      const [, [row]] = bankRows.parse(await r.json());
      value = ReferenceSchema.parse({
        year: row.date,
        lifeExpectancy: row.value,
        sourceUrl: bankPage,
        provider: 'World Bank API',
      });
    } catch {
      return bankRelease;
    }
  }
  cached = { at: Date.now(), value };
  return value;
}
