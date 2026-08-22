'use client';

import type { User } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';

type Prospect = {
  key: string;
  business: string;
  email: string;
  sourceUrl: string;
  observation: string;
  recommendedPackage: string;
  subject: string;
  queuePosition: number;
  scheduledBatch: number;
  sent: boolean;
  status: string;
  replyStage: string;
  paymentStage: string;
  needsKyle: boolean;
};

type Result = {
  ok?: boolean;
  error?: string;
  dailyLimit?: number;
  prospects?: Prospect[];
};

const filters = ['All', 'Pending email', 'Contacted', 'Replied', 'Needs Kyle'];

export default function ProspectPipeline({ user }: { user: User }) {
  const [result, setResult] = useState<Result>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  async function load() {
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/automation/prospects', {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      setResult(await response.json());
    } catch {
      setResult({ ok: false, error: 'Could not load the prospect pipeline.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [user]);

  const prospects = result.prospects || [];
  const visible = useMemo(() => prospects.filter(prospect => {
    if (filter === 'All') return true;
    if (filter === 'Replied') return ['Replied automatically', 'Meeting requested', 'Deposit link sent'].includes(prospect.status);
    if (filter === 'Needs Kyle') return prospect.needsKyle;
    return prospect.status === filter;
  }), [filter, prospects]);

  const pending = prospects.filter(prospect => prospect.status === 'Pending email').length;
  const contacted = prospects.filter(prospect => prospect.sent).length;
  const replied = prospects.filter(prospect => ['Replied automatically', 'Meeting requested', 'Deposit link sent'].includes(prospect.status)).length;
  const needsKyle = prospects.filter(prospect => prospect.needsKyle).length;

  return <section className="prospect-pipeline">
    <div className="pipeline-head">
      <div>
        <p className="crm-kicker">OUTBOUND SALES</p>
        <h2>Prospect Pipeline</h2>
        <p>Verified businesses, pending first touches, replies, escalation, and payment progress. The scheduler sends up to three pending emails each weekday.</p>
      </div>
      <button onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh status'}</button>
    </div>

    <div className="pipeline-stats">
      <article><span>Identified</span><strong>{prospects.length}</strong></article>
      <article><span>Pending Emails</span><strong>{pending}</strong></article>
      <article><span>Sent</span><strong>{contacted}</strong></article>
      <article><span>Replies</span><strong>{replied}</strong></article>
      <article className={needsKyle ? 'attention' : ''}><span>Needs Kyle</span><strong>{needsKyle}</strong></article>
    </div>

    <div className="pipeline-filters">
      {filters.map(value => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value}</button>)}
    </div>

    {result.error && <p className="form-status error">{result.error}</p>}
    {!result.error && loading && prospects.length === 0 && <p className="pipeline-empty">Reading the live mailbox and queue…</p>}
    {!loading && visible.length === 0 && <p className="pipeline-empty">No prospects in this view.</p>}

    <div className="prospect-table-wrap">
      <table className="prospect-table">
        <thead><tr><th>Prospect</th><th>Why selected</th><th>Email</th><th>Reply</th><th>Payment</th></tr></thead>
        <tbody>{visible.map(prospect => <tr key={prospect.key} className={prospect.needsKyle ? 'needs-attention' : ''}>
          <td>
            <strong>{prospect.business}</strong>
            <span>{prospect.recommendedPackage}</span>
            <a href={prospect.sourceUrl} target="_blank" rel="noreferrer">Public source ↗</a>
          </td>
          <td><p>{prospect.observation}</p></td>
          <td>
            <span className={`pipeline-pill ${prospect.status.toLowerCase().replace(/\s+/g, '-')}`}>{prospect.status}</span>
            <small>{prospect.sent ? prospect.subject : `Queue #${prospect.queuePosition} · weekday batch ${prospect.scheduledBatch}`}</small>
          </td>
          <td><p>{prospect.replyStage}</p></td>
          <td><p>{prospect.paymentStage}</p></td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
