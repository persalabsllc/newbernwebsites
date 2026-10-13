type CheckoutStatus = {
  status: string | null;
  payment_status: string;
  metadata: Record<string, string> | null;
};

export function websitePaymentStatus(session: CheckoutStatus | null) {
  if (!session || session.metadata?.source !== 'newbernwebsites.com') return 'unknown';
  if (session.status !== 'complete') return 'not-submitted';
  if (session.payment_status === 'paid') return 'paid';
  if (session.payment_status === 'unpaid') return 'processing';
  return 'unknown';
}
