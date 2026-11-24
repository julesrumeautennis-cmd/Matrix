import { z } from 'zod';
import { ThreadsSchema, type Source } from '../../../../packages/shared/src/conversations';

export type TraceEvent = {
  operation: string;
  detail: string;
  durationMs?: number;
  agent?: { id: string; state: 'connecting' | 'connected' };
};
export type ReportTrace = (event: TraceEvent) => void;
const protocol = '2025-06-18';
let sequence = 0;

async function rpc(method: string, params: unknown, signal: AbortSignal, notification = false) {
  const id = ++sequence;
  const response = await fetch('/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': protocol,
    },
    signal,
    body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), method, params }),
  });
  if (!response.ok) throw Error('MCP returned HTTP ' + response.status);
  if (notification) return;
  const data = z
    .object({
      jsonrpc: z.literal('2.0'),
      id: z.literal(id),
      result: z.unknown(),
      error: z.object({ code: z.number() }).optional(),
    })
    .parse(await response.json());
  if (data.error) throw Error('MCP error ' + data.error.code);
  return data.result;
}

export async function openMcp(signal: AbortSignal, report?: ReportTrace) {
  const start = performance.now();
  report?.({ operation: 'initialize.send', detail: 'POST /api/mcp · JSON-RPC 2.0' });
  const server = z
    .object({
      protocolVersion: z.literal(protocol),
      serverInfo: z.object({ name: z.string(), version: z.string() }),
    })
    .parse(
      await rpc(
        'initialize',
        {
          protocolVersion: protocol,
          capabilities: {},
          clientInfo: { name: 'Matrix browser', version: '1.0' },
        },
        signal,
      ),
    );
  report?.({
    operation: 'initialize.ok',
    detail:
      server.serverInfo.name +
      ' v' +
      server.serverInfo.version +
      ' · protocol ' +
      server.protocolVersion,
    durationMs: performance.now() - start,
  });
  await rpc('notifications/initialized', {}, signal, true);
  report?.({
    operation: 'notifications/initialized',
    detail: 'Session acknowledged by the server',
  });
  const listTime = performance.now();
  const list = z
    .object({ tools: z.array(z.object({ name: z.string() })) })
    .parse(await rpc('tools/list', {}, signal));
  const tools = list.tools.map((tool) => tool.name);
  report?.({
    operation: 'tools/list',
    detail: tools.join(' · '),
    durationMs: performance.now() - listTime,
  });
  if (!tools.includes('list_conversations')) throw Error('Archive tool unavailable');
  return { server: server.serverInfo.name, tools };
}

export async function callTool(name: string, args: Record<string, unknown>, signal: AbortSignal) {
  return z
    .object({ structuredContent: z.unknown() })
    .parse(await rpc('tools/call', { name, arguments: args }, signal)).structuredContent;
}

export async function readArchive(
  source: Source,
  templates: number[] | undefined,
  signal: AbortSignal,
) {
  const data = await callTool('list_conversations', { source, templates }, signal);
  const { threads } = z.object({ threads: ThreadsSchema.min(1) }).parse(data);
  if (
    (templates && templates.length !== threads.length) ||
    threads.some((row, i) => row.seat !== i)
  )
    throw Error('Archive cast mismatch');
  return threads;
}
