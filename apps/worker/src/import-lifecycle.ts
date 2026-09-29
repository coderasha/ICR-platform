export type ImportLifecycleStatus = 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED';

/** A worker may only claim a batch that the API has durably queued. */
export function canWorkerClaimImport(status: ImportLifecycleStatus): boolean {
  return status === 'QUEUED';
}
