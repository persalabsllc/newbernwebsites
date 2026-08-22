import type { Metadata } from 'next';
import { getStripe } from '../../../lib/stripe';
import { formatPaymentAmount } from '../../../lib/payment-products';

export const metadata: Metadata = {
  title: 'Payment Received | New Bern Websites',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ session_id?: string }> };

export default async function PaymentSuccess({ searchParams }: Props) {
  const { session_id: sessionId } = await searchParams;
  const session = sessionId
    ? await getStripe().checkout.sessions.retrieve(sessionId).catch(() => null)
    : null;
  const paid = session?.payment_status === 'paid' || session?.payment_status === 'unpaid';

  return (
    <main className="payment-page">
      <section className="payment-panel payment-success">
        <a className="payment-brand" href="/">
          <span>NEW BERN</span>
          <strong>WEBSITES</strong>
        </a>
        <div className="success-mark" aria-hidden="true">✓</div>
        <p className="payment-kicker">{paid ? 'PAYMENT SUBMITTED' : 'PAYMENT STATUS'}</p>
        <h1>{paid ? 'Thank you. We have it from here.' : 'We’re checking your payment.'}</h1>
        {session?.amount_total != null && (
          <div className="payment-total">{formatPaymentAmount(session.amount_total)}</div>
        )}
        <p className="payment-description">
          {session?.payment_status === 'unpaid'
            ? 'Your bank payment was submitted and may take several business days to finish processing. Stripe will email updates to you.'
            : 'Stripe will email your receipt. We’ll follow up with the next project step.'}
        </p>
        <a className="button primary payment-submit" href="/">Return to New Bern Websites</a>
      </section>
    </main>
  );
}
