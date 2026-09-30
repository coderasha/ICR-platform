import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, Matches } from 'class-validator';

export class CreateSourceSystemDto {
  @IsString() @IsNotEmpty() @MaxLength(50) @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;
  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;
  @IsString() @IsNotEmpty() @MaxLength(80)
  systemType!: string;
}

export class CreateImportBatchDto {
  @IsUUID()
  legalEntityId!: string;
  @IsOptional() @IsUUID()
  sourceSystemId?: string;
  @IsString() @IsNotEmpty() @MaxLength(100)
  idempotencyKey!: string;
  @IsString() @IsNotEmpty() @MaxLength(255)
  originalFilename!: string;
  @IsString() @Matches(/^[a-fA-F0-9]{64}$/)
  contentHash!: string;
  @IsIn(['CSV', 'XLSX'])
  fileType!: 'CSV' | 'XLSX';
}

export class UploadImportDto {
  @IsUUID() legalEntityId!: string;
  @IsOptional() @IsUUID() sourceSystemId?: string;
  @IsString() @IsNotEmpty() @MaxLength(100) idempotencyKey!: string;
  @IsString() @IsNotEmpty() @MaxLength(255) originalFilename!: string;
  @IsIn(['CSV']) fileType!: 'CSV';
  @IsOptional() @IsObject()
  columnMapping?: Record<string, string>;
  @IsString() @IsNotEmpty() @MaxLength(13_981_016) @Matches(/^[A-Za-z0-9+/]+={0,2}$/) contentBase64!: string;
}

export class ListImportRowsDto {
  @IsOptional() @IsIn(['PENDING', 'VALID', 'REJECTED', 'IMPORTED'])
  status?: 'PENDING' | 'VALID' | 'REJECTED' | 'IMPORTED';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 50;
}

export class ListImportBatchesDto {
  @IsOptional() @IsIn(['DRAFT', 'QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED'])
  status?: 'DRAFT' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' | 'CANCELLED';
}
