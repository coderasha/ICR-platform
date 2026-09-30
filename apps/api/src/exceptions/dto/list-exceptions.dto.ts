import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListExceptionsDto {
  @IsOptional() @IsIn(['OPEN', 'ASSIGNED', 'PROPOSED', 'APPROVED', 'RESOLVED'])
  status?: 'OPEN' | 'ASSIGNED' | 'PROPOSED' | 'APPROVED' | 'RESOLVED';
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean()
  assignedToMe?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean()
  overdue?: boolean;
  @IsOptional() @IsString() @MaxLength(100)
  rootCause?: string;
}
