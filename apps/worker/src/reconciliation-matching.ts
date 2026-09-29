export type ReconciliationTransaction = { id: string; documentReference: string | null; currencyCode: string; amount: string };
export type ReconciliationOutcome = { matches: Array<{ leftId: string; rightId: string }>; unmatchedLeftIds: string[]; unmatchedRightIds: string[] };

function scaledAmount(value: string): bigint {
  if (!/^-?\d+(\.\d{1,6})?$/.test(value)) throw new Error('Invalid decimal amount');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const scaled = BigInt(whole) * 1_000_000n + BigInt((fraction + '000000').slice(0, 6));
  return negative ? -scaled : scaled;
}

function reference(value: string | null): string | null { const normalized = value?.trim().toUpperCase(); return normalized || null; }

/** Exact document-reference/currency/opposite-amount matching with no candidate reuse. */
export function matchReconciliationTransactions(left: ReconciliationTransaction[], right: ReconciliationTransaction[]): ReconciliationOutcome {
  const usedRight = new Set<string>(); const matches: ReconciliationOutcome['matches'] = []; const unmatchedLeftIds: string[] = [];
  for (const candidate of left) {
    const candidateReference = reference(candidate.documentReference); const candidateAmount = scaledAmount(candidate.amount);
    const counterpart = candidateReference ? right.find((item) => !usedRight.has(item.id) && reference(item.documentReference) === candidateReference && item.currencyCode === candidate.currencyCode && scaledAmount(item.amount) + candidateAmount === 0n) : undefined;
    if (!counterpart) { unmatchedLeftIds.push(candidate.id); continue; }
    usedRight.add(counterpart.id); matches.push({ leftId: candidate.id, rightId: counterpart.id });
  }
  return { matches, unmatchedLeftIds, unmatchedRightIds: right.filter((item) => !usedRight.has(item.id)).map((item) => item.id) };
}
