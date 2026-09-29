import { describe, expect, it } from 'vitest';
import { canWorkerClaimImport } from './import-lifecycle.js';

describe('import worker lifecycle guard', () => {
  it('claims only durably queued batches', () => {
    expect(canWorkerClaimImport('QUEUED')).toBe(true);
    expect(canWorkerClaimImport('DRAFT')).toBe(false);
    expect(canWorkerClaimImport('PROCESSING')).toBe(false);
    expect(canWorkerClaimImport('COMPLETED')).toBe(false);
    expect(canWorkerClaimImport('FAILED')).toBe(false);
  });
});
