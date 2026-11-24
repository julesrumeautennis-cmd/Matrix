import { afterEach, expect, it, vi } from 'vitest';
import { mcp } from './mcp';

const post = (method: string, params: unknown = {}) =>
  mcp(
    new Request('https://matrix.example/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 7, method, params }),
    }),
  );
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
it('discovers and executes read-only tools and rejects arbitrary sources', async () => {
  const init = await (await post('initialize')).json();
  expect(init.result.capabilities.tools).toBeDefined();
  const tools = await (await post('tools/list')).json();
  expect(tools.result.tools.map((t: { name: string }) => t.name)).toContain(
    'read_population_reference',
  );
  const output = await (
    await post('tools/call', { name: 'list_conversations', arguments: { source: 'gmail' } })
  ).json();
  expect(output.result.structuredContent.threads).toHaveLength(5);
  expect(
    (
      await (
        await post('tools/call', { name: 'list_conversations', arguments: { source: 'unknown' } })
      ).json()
    ).error.code,
  ).toBe(-32602);
});
it('reads a configured Nexla toolset through discovery and a validated data frame', async () => {
  vi.stubEnv('NEXLA_MCP_URL', 'https://api-genai.nexla.io/mcp/service_key/test-workspace');
  vi.stubEnv('NEXLA_SERVICE_KEY', 'test-only');
  vi.stubEnv('NEXLA_COHORT_TOOL', 'read_life_table');
  const methods: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init: RequestInit) => {
      const { method, id, params } = JSON.parse(String(init.body));
      methods.push(method);
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-only');
      if (method === 'notifications/initialized') return new Response(null, { status: 202 });
      const results: Record<string, unknown> = {
        initialize: { protocolVersion: '2025-06-18' },
        'tools/list': { tools: [{ name: 'read_life_table' }] },
        'tools/call': {
          structuredContent: {
            data: {
              columns: ['year', 'life_expectancy', 'source_url'],
              rows: [['2024', 78.9, 'https://data.worldbank.org/']],
            },
          },
        },
      };
      if (method === 'tools/call') expect(params.name).toBe('read_life_table');
      return Response.json({ jsonrpc: '2.0', id, result: results[method] });
    }),
  );
  const { loadReference } = await import('./reference');
  expect((await loadReference()).provider).toBe('Nexla MCP');
  expect(methods).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
});
