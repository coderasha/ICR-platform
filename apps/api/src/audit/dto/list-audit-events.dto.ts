import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListAuditEventsDto {
  @IsOptional() @IsString() @MaxLength(100)
  action?: string;
  @IsOptional() @IsString() @MaxLength(80)
  entityType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  limit = 50;
}
