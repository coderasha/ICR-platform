import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReconciliationRunDto {
  @IsUUID()
  legalEntityId!: string;
  @IsOptional() @IsUUID()
  counterpartLegalEntityId?: string;
  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;
  @IsDateString()
  periodStart!: string;
  @IsDateString()
  periodEnd!: string;
  @IsString() @IsNotEmpty() @MaxLength(50)
  rulesVersion!: string;
}
