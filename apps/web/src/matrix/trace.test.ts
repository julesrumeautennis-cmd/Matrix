import { afterEach, expect, it, vi } from 'vitest';
import { mcp } from '../../api/mcp';
import { bankRelease, cdcRelease } from '../../../../packages/shared/src/reference';
import { analyze, demoRecipe } from './analysis';
import type { TraceEvent } from './mcpClient';
import { SimulationBatch, getLives, simulate } from './simulation';

afterEach(() => vi.unstubAllGlobals());

it('records real archive results, per-tool fallback and the order of character binding', async () => {
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const { id, params } = JSON.parse(String(init.body));
    if (params?.name === 'list_conversations' && params.arguments.source === 'gmail')
      return new Response(null, { status: 503 });
    if (
      params?.name === 'read_population_reference' ||
      params?.name === 'read_public_web_evidence'
    ) {
      const data =
        params.name === 'read_population_reference'
          ? { reference: bankRelease }
          : { evidence: cdcRelease };
      return Response.json({ jsonrpc: '2.0', id, result: { structuredContent: data } });
    }
    return mcp(new Request('https://matrix.example/api/mcp', init));
  });
  const trace: TraceEvent[] = [];
  const recipe = await analyze(
    demoRecipe.profile,
    ['gmail', 'snapchat'],
    new AbortController().signal,
    (event) => trace.push(event),
  );
  expect(recipe.transport).toBe('MCP');
  expect(trace.filter((e) => e.operation === 'sample.local').map((e) => e.detail)).toEqual([
    'Gmail · bundled copy selected',
  ]);
  expect(trace.find((e) => e.operation === 'tools/list')?.durationMs).toBeGreaterThanOrEqual(0);
  expect(trace.filter((e) => e.operation === 'archive.index')).toHaveLength(2);
  for (const persona of recipe.agents) {
    expect(trace.filter((e) => e.agent?.id === persona.id).map((e) => e.agent?.state)).toEqual([
      'connecting',
      'connected',
    ]);
    expect(persona.excerpts).toBeGreaterThan(0);
  }
  expect(trace.at(-1)?.detail).toContain(String(recipe.seed));
});

it('reports local execution on a failed handshake and respects cancellation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
  const trace: TraceEvent[] = [];
  const recipe = await analyze(
    demoRecipe.profile,
    ['gmail'],
    new AbortController().signal,
    (event) => trace.push(event),
  );
  expect(recipe.transport).toBe('Local archive');
  expect(trace.some((e) => e.operation === 'transport.local')).toBe(true);
  expect(trace.some((e) => e.operation === 'initialize.ok')).toBe(false);
  const canceled = new AbortController();
  canceled.abort();
  await expect(analyze(demoRecipe.profile, ['gmail'], canceled.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
});

it('advances only processed chapters, exposes real exchanges and resumes to the identical batch', () => {
  const recipe = { ...demoRecipe };
  const expected = simulate({ ...recipe });
  const batch = new SimulationBatch(recipe);
  const start = batch.advance(0);
  expect(start.frames.every((f) => !f.chapter)).toBe(true);
  const part = batch.advance(105);
  expect(part.completed).toBe(105);
  expect(part.decisions).toBe(630);
  expect(part.messages).toBe(315);
  expect(part.frames[4]!.previous).toEqual(expected[4]!.years[0]);
  expect(part.frames[4]!.chapter).toEqual(expected[4]!.years[1]);
  expect(part.frames[5]!.chapter).toEqual(expected[5]!.years[0]);
  expect(part.finishedLives).toBe(0);
  const near = batch.advance(396);
  expect(near.finishedLives).toBe(1);
  const end = batch.advance(batch.totalChapters);
  expect(end.completed).toBe(600);
  expect(end.decisions).toBe(3600);
  expect(end.messages).toBe(1800);
  expect(start.frames.every((f) => !f.chapter)).toBe(true);
  expect(batch.lives).toEqual(expected);
  expect(getLives(recipe)).toBe(batch.lives);
  expect(batch.advance(15).finishedLives).toBe(100);
});
