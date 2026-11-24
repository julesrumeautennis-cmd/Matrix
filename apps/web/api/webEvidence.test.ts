import { describe, expect, it } from 'vitest';
import { parseCdcPage } from './webEvidence';
describe('public web evidence', () => {
  it('extracts annual rates with units, year, geography and source', () => {
    const html =
      '<li>Marriage rate: <b>6.1</b> per 1,000 total population</li><li>Divorce rate: 2.4 per 1,000 population (45 reporting States and D.C.)</li><p>(data shown are provisional 2023)</p>';
    expect(parseCdcPage(html)).toMatchObject({
      year: '2023',
      marriageRate: 6.1,
      divorceRate: 2.4,
      divorceArea: '45 reporting States and D.C.',
      provider: 'CDC web page',
    });
  });
  it('rejects changed units or missing coverage before a source is reported as live', () => {
    expect(() => parseCdcPage('<p>Marriage rate: 5 percent</p>')).toThrow();
  });
});
