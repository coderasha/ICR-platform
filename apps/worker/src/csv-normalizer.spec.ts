import { describe, expect, it } from 'vitest';
import { normalizeCsv, parseCsv } from './csv-normalizer.js';
describe('CSV normalization', () => {
  it('parses quoted commas without changing data', () => expect(parseCsv('a,b\n"one,two",three').at(1)).toEqual(['one,two', 'three']));
  it('normalizes valid canonical transaction rows', () => { const [row] = normalizeCsv('source_record_key,document_reference,transaction_date,amount,currency_code\nkey-1,"INV, 1",2026-09-01,-12.340000,usd'); expect(row.errors).toEqual([]); expect(row.normalized).toEqual({ sourceRecordKey: 'key-1', documentReference: 'INV, 1', transactionDate: '2026-09-01', amount: '-12.340000', currencyCode: 'USD' }); });
  it('normalizes mapped source headers while preserving the original source row', () => { const [row] = normalizeCsv('journal_id,posting_date,local_amount,ccy,invoice\nJ-1,2026-09-01,12.34,usd,INV-1', { sourceRecordKey: 'journal_id', transactionDate: 'posting_date', amount: 'local_amount', currencyCode: 'ccy', documentReference: 'invoice' }); expect(row.errors).toEqual([]); expect(row.raw.journal_id).toBe('J-1'); expect(row.normalized?.documentReference).toBe('INV-1'); });
  it('returns actionable row errors instead of accepting malformed finance data', () => { const [row] = normalizeCsv('source_record_key,transaction_date,amount,currency_code\n,not-date,12.1234567,US'); expect(row.rowNumber).toBe(2); expect(row.errors).toHaveLength(4); });
});
