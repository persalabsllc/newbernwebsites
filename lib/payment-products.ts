export const paymentProducts = {
  'turnkey-deposit': {
    name: 'Turnkey Website — Kickoff Deposit',
    shortName: 'Turnkey Website deposit',
    description: '50% kickoff deposit for the New Bern Websites Turnkey Website package.',
    amount: 125_000,
  },
  'turnkey-balance': {
    name: 'Turnkey Website — Final Balance',
    shortName: 'Turnkey Website final balance',
    description: 'Final 50% balance for the New Bern Websites Turnkey Website package.',
    amount: 125_000,
  },
  'media-deposit': {
    name: 'Media Website — Kickoff Deposit',
    shortName: 'Media Website deposit',
    description: '50% kickoff deposit for the New Bern Websites Website + Professional Media package.',
    amount: 175_000,
  },
  'media-balance': {
    name: 'Media Website — Final Balance',
    shortName: 'Media Website final balance',
    description: 'Final 50% balance for the New Bern Websites Website + Professional Media package.',
    amount: 175_000,
  },
} as const;

export type PaymentProductKey = keyof typeof paymentProducts;

export function isPaymentProductKey(value: string): value is PaymentProductKey {
  return Object.prototype.hasOwnProperty.call(paymentProducts, value);
}

export function formatPaymentAmount(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount / 100);
}
