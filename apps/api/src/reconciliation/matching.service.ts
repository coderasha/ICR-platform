export type MatchableTransaction = {
  id: string;
  documentReference: string | null;
  currencyCode: string;
  amount: string;
  transactionDate: Date;
};

export type MatchResult = { leftId: string; rightId: string; rule: 'EXACT_REFERENCE_AMOUNT' };
export type MatchingOutcome = { matches: MatchResult[]; unmatchedLeftIds: string[]; unmatchedRightIds: string[] };

/** Converts a PostgreSQL DECIMAL(20,6)-compatible string to a fixed six-decimal integer. */
export function amountToScaledInteger(value: string): bigint {
  if (!/^-?\d+(\.\d{1,6})?$/.test(value)) throw new Error('Invalid decimal amount');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const scaled = BigInt(whole) * 1_000_000n + BigInt((fraction + '000000').slice(0, 6));
  return negative ? -scaled : scaled;
}

function normalizedReference(reference: string | null): string | null {
  const value = reference?.trim().toUpperCase();
  return value || null;
}

export function matchExactReferences(left: MatchableTransaction[], right: MatchableTransaction[]): MatchingOutcome {
  const usedRight = new Set<string>();
  const matches: MatchResult[] = [];
  const unmatchedLeftIds: string[] = [];
  for (const candidate of left) {
    const reference = normalizedReference(candidate.documentReference);
    const amount = amountToScaledInteger(candidate.amount);
    if (!reference) { unmatchedLeftIds.push(candidate.id); continue; }
    const counterpart = right.find((item) => !usedRight.has(item.id) && normalizedReference(item.documentReference) === reference && item.currencyCode === candidate.currencyCode && amountToScaledInteger(item.amount) + amount === 0n);
    if (!counterpart) { unmatchedLeftIds.push(candidate.id); continue; }
    usedRight.add(counterpart.id);
    matches.push({ leftId: candidate.id, rightId: counterpart.id, rule: 'EXACT_REFERENCE_AMOUNT' });
  }
  return { matches, unmatchedLeftIds, unmatchedRightIds: right.filter((item) => !usedRight.has(item.id)).map((item) => item.id) };
}
