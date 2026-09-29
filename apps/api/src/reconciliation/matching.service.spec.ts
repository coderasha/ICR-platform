import { describe, expect, it } from 'vitest';
import { amountToScaledInteger, matchExactReferences } from './matching.service.js';

describe('deterministic exact matching', () => {
  it('preserves six-decimal precision without floating-point arithmetic', () => {
    expect(amountToScaledInteger('0.100001') + amountToScaledInteger('-0.100001')).toBe(0n);
    expect(amountToScaledInteger('100.1')).toBe(100100000n);
  });
  it('matches only the same normalized reference, currency and opposite exact amount', () => {
    const outcome = matchExactReferences([{ id: 'l1', documentReference: ' inv-001 ', currencyCode: 'USD', amount: '125.000000', transactionDate: new Date() }, { id: 'l2', documentReference: 'INV-002', currencyCode: 'USD', amount: '1.000000', transactionDate: new Date() }], [{ id: 'r1', documentReference: 'INV-001', currencyCode: 'USD', amount: '-125.000000', transactionDate: new Date() }, { id: 'r2', documentReference: 'INV-002', currencyCode: 'EUR', amount: '-1.000000', transactionDate: new Date() }]);
    expect(outcome.matches).toEqual([{ leftId: 'l1', rightId: 'r1', rule: 'EXACT_REFERENCE_AMOUNT' }]);
    expect(outcome.unmatchedLeftIds).toEqual(['l2']);
    expect(outcome.unmatchedRightIds).toEqual(['r2']);
  });
  it('does not create a many-to-one match', () => {
    const outcome = matchExactReferences([{ id: 'l1', documentReference: 'A', currencyCode: 'USD', amount: '5', transactionDate: new Date() }, { id: 'l2', documentReference: 'A', currencyCode: 'USD', amount: '5', transactionDate: new Date() }], [{ id: 'r1', documentReference: 'A', currencyCode: 'USD', amount: '-5', transactionDate: new Date() }]);
    expect(outcome.matches).toHaveLength(1);
    expect(outcome.unmatchedLeftIds).toHaveLength(1);
  });
});
