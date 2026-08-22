import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { requireFirebaseUser } from '../../../../lib/firebase-server-auth';
import { getStripe } from '../../../../lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPRINT_START = Math.floor(Date.parse('2026-08-22T00:00:00-04:00') / 1000);
const SPRINT_END = Math.floor(Date.parse('2026-12-02T00:00:00-05:00') / 1000) - 1;
const CASH_GOAL = 2_000_000;
const OPERATING_CASH_TARGET = 2_150_000;
const CONTRACT_TARGET = 2_800_000;

const contractValueByDeposit: Record<string, number> = {
  'turnkey-deposit': 250_000,
  'media-deposit': 350_000,
};

function daysUntil(value: string) {
  return Math.max(0, Math.ceil((Date.parse(value) - Date.now()) / 86_400_000));
}

function projectKey(session: Stripe.Checkout.Session) {
  const business = String(session.metadata?.business || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return business || session.customer_details?.email?.toLowerCase() || session.id;
}

export async function GET(request: Request) {
  try {
    await requireFirebaseUser(request);
    const stripe = getStripe();
    const sessions: Stripe.Checkout.Session[] = [];
    let startingAfter: string | undefined;

    do {
      const page = await stripe.checkout.sessions.list({
        limit: 100,
        created: { gte: SPRINT_START, lte: SPRINT_END },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      sessions.push(...page.data);
      startingAfter = page.has_more ? page.data.at(-1)?.id : undefined;
    } while (startingAfter && sessions.length < 500);

    const relevant = sessions.filter(session => session.metadata?.source === 'newbernwebsites.com');
    const paid = relevant.filter(session => session.payment_status === 'paid');
    const collected = paid.reduce((total, session) => total + (session.amount_total || 0), 0);
    const depositsByProject = new Map<string, Stripe.Checkout.Session>();
    for (const session of paid.filter(item => item.metadata?.payment_product?.endsWith('-deposit'))) {
      if (!depositsByProject.has(projectKey(session))) depositsByProject.set(projectKey(session), session);
    }
    const completedProjects = new Set(
      paid
        .filter(session => session.metadata?.payment_product?.endsWith('-balance'))
        .map(projectKey)
        .filter(key => depositsByProject.has(key)),
    );
    const deposits = [...depositsByProject.values()];
    const contracted = deposits.reduce((total, session) => {
      return total + (contractValueByDeposit[session.metadata?.payment_product || ''] || 0);
    }, 0);

    return NextResponse.json({
      ok: true,
      cashGoal: CASH_GOAL,
      operatingCashTarget: OPERATING_CASH_TARGET,
      contractTarget: CONTRACT_TARGET,
      collected,
      contracted,
      deposits: deposits.length,
      completions: completedProjects.size,
      pendingSessions: relevant.length - paid.length,
      remaining: Math.max(0, CASH_GOAL - collected),
      operatingRemaining: Math.max(0, OPERATING_CASH_TARGET - collected),
      daysToInternalDeadline: daysUntil('2026-11-20T23:59:59-05:00'),
      daysToPublicDeadline: daysUntil('2026-12-01T23:59:59-05:00'),
      internalDeadline: 'November 20, 2026',
      publicDeadline: 'December 1, 2026',
      lastUpdated: new Date().toISOString(),
      payments: paid.slice(0, 12).map(session => ({
        id: session.id,
        business: session.metadata?.business || 'Unspecified business',
        product: session.metadata?.payment_product || 'Website payment',
        amount: session.amount_total || 0,
        recordedAt: new Date(session.created * 1000).toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read Stripe revenue.';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
