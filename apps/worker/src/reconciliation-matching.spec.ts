import { describe, expect, it } from 'vitest';
import { matchReconciliationTransactions } from './reconciliation-matching.js';

describe('matchReconciliationTransactions', () => {
  it('uses fixed decimals and never reuses a counterpart', () => {
    const result = matchReconciliationTransactions(
      [{ id: 'l1', documentReference: ' inv-7 ', currencyCode: 'USD', amount: '10.100000' }, { id: 'l2', documentReference: 'INV-7', currencyCode: 'USD', amount: '10.100000' }],
      [{ id: 'r1', documentReference: 'INV-7', currencyCode: 'USD', amount: '-10.100000' }],
    );
    expect(result.matches).toEqual([{ leftId: 'l1', rightId: 'r1' }]);
    expect(result.unmatchedLeftIds).toEqual(['l2']);
  });
});
