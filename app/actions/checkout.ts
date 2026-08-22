'use server';

import { redirect } from 'next/navigation';
import { getStripe } from '../../lib/stripe';
import { isPaymentProductKey, paymentProducts } from '../../lib/payment-products';

function siteUrl() {
  if (process.env.VERCEL_ENV === 'production') return 'https://newbernwebsites.com';
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export async function createCheckoutSession(productKey: string, formData: FormData) {
  if (!isPaymentProductKey(productKey)) {
    throw new Error('Unknown payment product.');
  }

  const email = String(formData.get('email') || '').trim();
  const business = String(formData.get('business') || '').trim().slice(0, 150);
  const product = paymentProducts[productKey];
  const baseUrl = siteUrl();

  const session = await getStripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: email || undefined,
    billing_address_collection: 'auto',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: product.amount,
          product_data: {
            name: product.name,
            description: product.description,
          },
        },
      },
    ],
    metadata: {
      payment_product: productKey,
      business,
      source: 'newbernwebsites.com',
    },
    payment_intent_data: {
      metadata: {
        payment_product: productKey,
        business,
        source: 'newbernwebsites.com',
      },
    },
    success_url: `${baseUrl}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pay/${productKey}?cancelled=1`,
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL.');
  redirect(session.url);
}
