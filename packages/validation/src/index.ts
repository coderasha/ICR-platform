import { z } from 'zod';

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Currency must be a three-letter uppercase code');

export const moneySchema = z.object({
  amount: z
    .string()
    .regex(/^-?\d+(\.\d{1,6})?$/, 'Amount must be a valid decimal string'),
  currency: currencyCodeSchema,
});

export const canonicalTransactionSchema = z.object({
  organizationId: z.string().min(1),
  legalEntityId: z.string().min(1),
  counterpartyId: z.string().min(1),
  reference: z.string().nullable(),
  amount: z
    .string()
    .regex(/^-?\d+(\.\d{1,6})?$/, 'Amount must be a valid decimal string'),
  currency: currencyCodeSchema,
  transactionDate: z.iso.date(),
});

export type MoneyInput = z.infer<typeof moneySchema>;
export type CanonicalTransactionInput = z.infer<
  typeof canonicalTransactionSchema
>;
