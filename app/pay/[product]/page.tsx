import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createCheckoutSession } from '../../actions/checkout';
import {
  formatPaymentAmount,
  isPaymentProductKey,
  paymentProducts,
} from '../../../lib/payment-products';

export const metadata: Metadata = {
  title: 'Secure Payment | New Bern Websites',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ product: string }>;
  searchParams: Promise<{ email?: string; business?: string; cancelled?: string }>;
};

export default async function PaymentPage({ params, searchParams }: Props) {
  const { product: productKey } = await params;
  const query = await searchParams;

  if (!isPaymentProductKey(productKey)) notFound();

  const product = paymentProducts[productKey];
  const checkout = createCheckoutSession.bind(null, productKey);

  return (
    <main className="payment-page">
      <section className="payment-panel">
        <a className="payment-brand" href="/" aria-label="New Bern Websites home">
          <span>NEW BERN</span>
          <strong>WEBSITES</strong>
        </a>
        <p className="payment-kicker">SECURE PROJECT PAYMENT</p>
        <h1>{product.shortName}</h1>
        <div className="payment-total">{formatPaymentAmount(product.amount)}</div>
        <p className="payment-description">{product.description}</p>
        {query.cancelled === '1' && (
          <p className="payment-notice">Checkout was cancelled. No payment was taken.</p>
        )}
        <form action={checkout} className="payment-form">
          <label>
            <span>Business name</span>
            <input
              defaultValue={query.business || ''}
              maxLength={150}
              name="business"
              placeholder="Your business"
              required
            />
          </label>
          <label>
            <span>Email for receipt</span>
            <input
              autoComplete="email"
              defaultValue={query.email || ''}
              maxLength={254}
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </label>
          <button className="button primary payment-submit" type="submit">
            Continue to secure checkout
          </button>
        </form>
        <p className="payment-security">Payments are processed securely by Stripe. New Bern Websites does not store your card or bank information.</p>
        <a className="payment-help" href="mailto:kyle@newbernwebsites.com">Questions about this payment?</a>
      </section>
    </main>
  );
}
