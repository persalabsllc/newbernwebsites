import type { Metadata } from 'next';
import { getStripe } from '../../../lib/stripe';
import { formatPaymentAmount } from '../../../lib/payment-products';
import { websitePaymentStatus } from '../../../lib/payment-status';

export const metadata: Metadata = {
  title: 'Payment Status | New Bern Websites',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function PaymentSuccess({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;
  const session = sessionId
    ? await getStripe().checkout.sessions.retrieve(sessionId).catch(() => null)
    : null;
  const status = websitePaymentStatus(session);
  const copy = {
    paid: { label: 'PAYMENT RECEIVED', title: 'Thank you. We have it from here.', description: 'Your payment is complete. We’ll follow up with the next project step.' },
    processing: { label: 'PAYMENT PROCESSING', title: 'Your payment is processing.', description: 'Your payment was submitted and is awaiting confirmation. Bank payments may take several business days to finish processing.' },
    'not-submitted': { label: 'PAYMENT NOT COMPLETED', title: 'Your checkout was not completed.', description: 'We have not confirmed a completed payment for this checkout. Return to your payment link when you are ready to finish.' },
    unknown: { label: 'PAYMENT STATUS', title: 'We could not confirm your payment.', description: 'If you completed checkout, contact Kyle@NewBernWebsites.com to confirm its status before trying again.' },
  }[status];

  return (
    <main className="payment-page">
      <section className="payment-panel payment-success">
        <a className="payment-brand" href="/">
          <span>NEW BERN</span>
          <strong>WEBSITES</strong>
        </a>
        <div className="success-mark" aria-hidden="true">{status === 'paid' ? '✓' : status === 'processing' ? '…' : '?'}</div>
        <p className="payment-kicker">{copy.label}</p>
        <h1>{copy.title}</h1>
        {status !== 'unknown' && session?.amount_total != null && (
          <div className="payment-total">{formatPaymentAmount(session.amount_total)}</div>
        )}
        <p className="payment-description">
          {copy.description}
        </p>
        <a className="button primary payment-submit" href="/">Return to New Bern Websites</a>
      </section>
    </main>
  );
}
