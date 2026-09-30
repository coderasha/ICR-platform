import { IsIn, IsOptional } from 'class-validator';

export class ListReconciliationRunsDto {
  @IsOptional() @IsIn(['DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_EXCEPTIONS', 'FAILED', 'CANCELLED'])
  status?: 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_EXCEPTIONS' | 'FAILED' | 'CANCELLED';
}
