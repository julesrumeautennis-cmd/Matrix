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

export const cdcMarriagePage = 'https://www.cdc.gov/nchs/fastats/marriage-divorce.htm';
export const WebEvidenceSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
  marriageRate: z.number().finite().min(0).max(100),
  divorceRate: z.number().finite().min(0).max(100),
  divorceArea: z.string().trim().min(1).max(160),
  sourceUrl: z.literal(cdcMarriagePage),
  provider: z.enum(['Nexla MCP', 'CDC web page', 'Saved CDC release']),
});
export type WebEvidence = z.infer<typeof WebEvidenceSchema>;
export const cdcRelease: WebEvidence = {
  year: '2023',
  marriageRate: 6.1,
  divorceRate: 2.4,
  divorceArea: '45 reporting states and D.C.',
  sourceUrl: cdcMarriagePage,
  provider: 'Saved CDC release',
};
