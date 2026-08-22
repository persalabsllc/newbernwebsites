import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function stripeSecretKey() {
  if (process.env.VERCEL_ENV === 'production') {
    const liveKey = process.env.STRIPE_LIVE_SECRET_KEY;

    if (!liveKey?.startsWith('sk_live_')) {
      throw new Error('STRIPE_LIVE_SECRET_KEY is not configured for production.');
    }

    return liveKey;
  }

  const testKey = process.env.STRIPE_SECRET_KEY;

  if (!testKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured for preview or development.');
  }

  if (process.env.VERCEL_ENV === 'preview' && !testKey.startsWith('sk_test_')) {
    throw new Error('Preview deployments must use a Stripe test key.');
  }

  return testKey;
}

export function getStripe() {
  const secretKey = stripeSecretKey();

  stripeClient ??= new Stripe(secretKey, {
    typescript: true,
  });

  return stripeClient;
}
