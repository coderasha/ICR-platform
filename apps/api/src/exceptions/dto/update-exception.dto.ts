import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
export class UpdateExceptionDto {
  @IsOptional() @IsUUID() assignedToUserId?: string | null;
  @IsOptional() @IsIn(['ASSIGNED', 'PROPOSED', 'APPROVED', 'RESOLVED']) status?: 'ASSIGNED' | 'PROPOSED' | 'APPROVED' | 'RESOLVED';
  @IsOptional() @IsString() @MaxLength(1000) resolutionNote?: string;
  @IsOptional() @IsDateString() dueAt?: string | null;
}
