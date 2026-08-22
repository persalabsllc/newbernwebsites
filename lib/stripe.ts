import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function stripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }

  if (process.env.VERCEL_ENV === 'production' && !secretKey.startsWith('sk_live_')) {
    throw new Error('Production deployments must use a Stripe live key.');
  }

  if (process.env.VERCEL_ENV === 'preview' && !secretKey.startsWith('sk_test_')) {
    throw new Error('Preview deployments must use a Stripe test key.');
  }

  return secretKey;
}

export function getStripe() {
  const secretKey = stripeSecretKey();

  stripeClient ??= new Stripe(secretKey, {
    typescript: true,
  });

  return stripeClient;
}
