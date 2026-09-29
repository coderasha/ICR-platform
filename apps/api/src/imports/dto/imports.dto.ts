import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Matches } from 'class-validator';

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
  @IsString() @IsNotEmpty() @MaxLength(13_981_016) @Matches(/^[A-Za-z0-9+/]+={0,2}$/) contentBase64!: string;
}
