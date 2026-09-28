import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateLegalEntityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'])
  currencyCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
