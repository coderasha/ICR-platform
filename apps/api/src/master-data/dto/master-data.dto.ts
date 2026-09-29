import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';

const currencyCodes = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AED'];
const accountTypes = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'OTHER',
];

export class CreateCounterpartyDto {
  @IsUUID()
  legalEntityId!: string;

  @IsString() @IsNotEmpty() @MaxLength(50) @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @IsOptional() @IsString() @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @IsOptional() @IsIn(currencyCodes)
  currencyCode?: string;
}

export class UpdateCounterpartyDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  name?: string;

  @IsOptional() @IsString() @Matches(/^[A-Z]{2}$/)
  countryCode?: string;

  @IsOptional() @IsIn(currencyCodes)
  currencyCode?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateAccountDto {
  @IsUUID()
  legalEntityId!: string;

  @IsString() @IsNotEmpty() @MaxLength(50) @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @IsIn(accountTypes)
  accountType!: (typeof accountTypes)[number];

  @IsOptional() @IsIn(currencyCodes)
  currencyCode?: string;
}

export class UpdateAccountDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  name?: string;

  @IsOptional() @IsIn(accountTypes)
  accountType?: (typeof accountTypes)[number];

  @IsOptional() @IsIn(currencyCodes)
  currencyCode?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateIntercompanyRelationshipDto {
  @IsUUID()
  sourceLegalEntityId!: string;

  @IsUUID()
  targetLegalEntityId!: string;

  @IsString() @IsNotEmpty() @MaxLength(200)
  name!: string;

  @IsOptional() @IsISO8601()
  effectiveFrom?: string;

  @IsOptional() @IsISO8601()
  effectiveTo?: string;
}

export class UpdateIntercompanyRelationshipDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  name?: string;

  @IsOptional() @IsISO8601()
  effectiveTo?: string | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
