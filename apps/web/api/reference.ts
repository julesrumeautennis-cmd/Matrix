import { readNexsetRow } from './nexla';
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

let cached: { at: number; value: Reference } | undefined;
export async function loadReference(): Promise<Reference> {
  if (cached && Date.now() - cached.at < 3600000) return cached.value;
  const { NEXLA_MCP_URL, NEXLA_SERVICE_KEY, NEXLA_COHORT_TOOL } = process.env;
  let value: Reference | undefined;
  if (NEXLA_MCP_URL && NEXLA_SERVICE_KEY && NEXLA_COHORT_TOOL) {
    try {
      const row = await readNexsetRow(NEXLA_MCP_URL, NEXLA_SERVICE_KEY, NEXLA_COHORT_TOOL);
      value = ReferenceSchema.parse({
        year: String(row.year),
        lifeExpectancy: row.life_expectancy,
        sourceUrl: row.source_url,
        provider: 'Nexla MCP',
      });
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
