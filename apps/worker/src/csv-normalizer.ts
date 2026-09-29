export type CsvRow = Record<string, string>;
export type NormalizedRow = { sourceRecordKey: string; documentReference: string | null; transactionDate: string; amount: string; currencyCode: string };
export type RowValidation = { rowNumber: number; raw: CsvRow; normalized?: NormalizedRow; errors: string[] };

/** Parses a CSV payload with quoted cells; callers must impose an upload-size limit before parsing. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted && character === '"' && input[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && character === ',') { row.push(cell); cell = ''; continue; }
    if (!quoted && (character === '\n' || character === '\r')) { if (character === '\r' && input[index + 1] === '\n') index += 1; row.push(cell); if (row.some((value) => value.length > 0)) rows.push(row); row = []; cell = ''; continue; }
    cell += character;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  row.push(cell); if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function normalizeCsv(input: string): RowValidation[] {
  const rows = parseCsv(input); const [header, ...data] = rows;
  if (!header) throw new Error('CSV requires a header row');
  const headers = header.map((item) => item.trim().toLowerCase());
  return data.map((cells, offset) => {
    const raw = Object.fromEntries(headers.map((name, index) => [name, cells[index]?.trim() ?? '']));
    const errors: string[] = [];
    const sourceRecordKey = raw.source_record_key;
    const amount = raw.amount;
    const currencyCode = raw.currency_code?.toUpperCase();
    const transactionDate = raw.transaction_date;
    if (!sourceRecordKey) errors.push('source_record_key is required');
    if (!/^-?\d+(\.\d{1,6})?$/.test(amount ?? '')) errors.push('amount must be a decimal with up to six places');
    if (!/^[A-Z]{3}$/.test(currencyCode ?? '')) errors.push('currency_code must be a three-letter ISO code');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate ?? '') || Number.isNaN(Date.parse(`${transactionDate}T00:00:00Z`))) errors.push('transaction_date must be ISO YYYY-MM-DD');
    return { rowNumber: offset + 2, raw, ...(errors.length === 0 ? { normalized: { sourceRecordKey, documentReference: raw.document_reference || null, transactionDate, amount, currencyCode: currencyCode! } } : {}), errors };
  });
}
