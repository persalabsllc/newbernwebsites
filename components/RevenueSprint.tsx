'use client';

import type { User } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';

type Payment = {
  id: string;
  business: string;
  product: string;
  amount: number;
  recordedAt: string;
};

type SprintResult = {
  ok?: boolean;
  error?: string;
  cashGoal?: number;
  operatingCashTarget?: number;
  contractTarget?: number;
  collected?: number;
  contracted?: number;
  deposits?: number;
  completions?: number;
  pendingSessions?: number;
  remaining?: number;
  operatingRemaining?: number;
  daysToInternalDeadline?: number;
  internalDeadline?: string;
  publicDeadline?: string;
  payments?: Payment[];
};

function money(cents = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function RevenueSprint({ user }: { user: User }) {
  const [result, setResult] = useState<SprintResult>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/automation/revenue', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      setResult(await response.json());
    } catch {
      setResult({ ok: false, error: 'Could not load the live Stripe scoreboard.' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const cashGoal = result.cashGoal || 2_000_000;
  const operatingCashTarget = result.operatingCashTarget || 2_150_000;
  const contractTarget = result.contractTarget || 2_800_000;
  const cashPercent = Math.min(100, ((result.collected || 0) / operatingCashTarget) * 100);

  return <section className="revenue-sprint">
    <div className="pipeline-head">
      <div>
        <p className="crm-kicker">90-DAY REVENUE SPRINT</p>
        <h2>$20,000 Cash Goal</h2>
        <p>Gross Stripe-confirmed successful checkout payments. Internal collection deadline: {result.internalDeadline || 'November 20, 2026'}; public deadline: {result.publicDeadline || 'December 1, 2026'}.</p>
      </div>
      <button onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh cash'}</button>
    </div>

    {result.error && <p className="form-status error">{result.error}</p>}
    {!result.error && <>
      <div
        className="revenue-progress"
        role="progressbar"
        aria-label="Fees-buffer collection target reached"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(cashPercent)}
      >
        <span style={{ width: `${cashPercent}%` }} />
      </div>
      <div className="revenue-cards">
        <article><span>Gross collected</span><strong>{money(result.collected)}</strong><small>of {money(operatingCashTarget)} fees-buffer target</small></article>
        <article><span>Contracted</span><strong>{money(result.contracted)}</strong><small>of {money(contractTarget)} operating target</small></article>
        <article><span>Projects sold</span><strong>{result.deposits || 0} / 10</strong><small>paid kickoff deposits</small></article>
        <article><span>Completed</span><strong>{result.completions || 0} / 6</strong><small>paid final balances</small></article>
        <article><span>Time remaining</span><strong>{result.daysToInternalDeadline ?? '—'}</strong><small>days to internal deadline</small></article>
      </div>
      <div className="revenue-foot">
        <span><strong>{money(result.remaining)}</strong> to the {money(cashGoal)} hard goal</span>
        <span><strong>{money(result.operatingRemaining)}</strong> to the fees-buffer target</span>
        <span><strong>{result.pendingSessions || 0}</strong> unpaid or pending checkout sessions</span>
      </div>
      {Boolean(result.payments?.length) && <details className="background-details">
        <summary>Recent confirmed payments</summary>
        <div className="prospect-table-wrap revenue-payments"><table className="prospect-table">
          <thead><tr><th>Checkout</th><th>Business</th><th>Payment</th><th>Amount</th></tr></thead>
          <tbody>{result.payments?.map(payment => <tr key={payment.id}>
            <td>{new Date(payment.recordedAt).toLocaleDateString()}</td>
            <td><strong>{payment.business}</strong></td>
            <td>{payment.product.replace(/-/g, ' ')}</td>
            <td><strong>{money(payment.amount)}</strong></td>
          </tr>)}</tbody>
        </table></div>
      </details>}
    </>}
  </section>;
}
