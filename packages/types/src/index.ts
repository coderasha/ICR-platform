export type CurrencyCode = string;

export type TransactionStatus =
  | 'PENDING'
  | 'RECONCILED'
  | 'UNMATCHED'
  | 'EXCEPTION';

export interface Money {
  amount: string;
  currency: CurrencyCode;
}

export interface CanonicalTransaction {
  id: string;
  organizationId: string;
  legalEntityId: string;
  counterpartyId: string;
  reference: string | null;
  amount: string;
  currency: CurrencyCode;
  transactionDate: string;
  status: TransactionStatus;
}
