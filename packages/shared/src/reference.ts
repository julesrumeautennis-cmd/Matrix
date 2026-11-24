import { z } from 'zod';

export const ReferenceSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  lifeExpectancy: z.number().min(30).max(110),
  sourceUrl: z
    .string()
    .url()
    .regex(/^https:\/\//),
  provider: z.enum(['Nexla MCP', 'World Bank API', 'Saved World Bank release']),
});
export type Reference = z.infer<typeof ReferenceSchema>;
export const bankPage = 'https://data.worldbank.org/indicator/SP.DYN.LE00.IN?locations=US';
export const bankRelease: Reference = {
  year: '2024',
  lifeExpectancy: 78.890243902439,
  sourceUrl: bankPage,
  provider: 'Saved World Bank release',
};
