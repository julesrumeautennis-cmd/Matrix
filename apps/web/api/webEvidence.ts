import {
  cdcMarriagePage,
  cdcRelease,
  WebEvidenceSchema,
  type WebEvidence,
} from '../../../packages/shared/src/reference';
import { readNexsetRow } from './nexla';

export function parseCdcPage(html: string): WebEvidence {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ');
  const marriage = /Marriage rate:\s*([\d.]+) per 1,000 (?:total )?population/i.exec(text);
  const divorce = /Divorce rate:\s*([\d.]+) per 1,000 population\s*\(([^)]+)\)/i.exec(text);
  const release = /data shown are (?:provisional |final )?(\d{4})/i.exec(text);
  if (!marriage || !divorce || !release) throw Error('Unrecognized CDC publication');
  return WebEvidenceSchema.parse({
    year: release[1],
    marriageRate: Number(marriage[1]),
    divorceRate: Number(divorce[1]),
    divorceArea: divorce[2],
    sourceUrl: cdcMarriagePage,
    provider: 'CDC web page',
  });
}
let cached: { at: number; value: WebEvidence } | undefined;
export async function loadWebEvidence(): Promise<WebEvidence> {
  if (cached && Date.now() - cached.at < 3600000) return cached.value;
  const { NEXLA_MCP_URL, NEXLA_SERVICE_KEY, NEXLA_WEB_TOOL } = process.env;
  let value: WebEvidence | undefined;
  if (NEXLA_MCP_URL && NEXLA_SERVICE_KEY && NEXLA_WEB_TOOL) {
    try {
      const row = await readNexsetRow(NEXLA_MCP_URL, NEXLA_SERVICE_KEY, NEXLA_WEB_TOOL);
      value = WebEvidenceSchema.parse({
        year: String(row.year),
        marriageRate: row.marriage_rate,
        divorceRate: row.divorce_rate,
        divorceArea: row.divorce_area,
        sourceUrl: row.source_url,
        provider: 'Nexla MCP',
      });
    } catch {
      /* Read the original publication if the Nexset is unavailable. */
    }
  }
  if (!value) {
    try {
      const response = await fetch(cdcMarriagePage, {
        headers: { Accept: 'text/html' },
        signal: AbortSignal.timeout(3500),
      });
      if (!response.ok) throw Error('Public page unavailable');
      value = parseCdcPage(await response.text());
    } catch {
      return cdcRelease;
    }
  }
  cached = { at: Date.now(), value };
  return value;
}
