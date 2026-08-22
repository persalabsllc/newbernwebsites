'use client';

import type { User } from 'firebase/auth';
import { FormEvent, useEffect, useMemo, useState } from 'react';

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
  phone: string;
  contactPerson: string;
  addedManually: boolean;
  addedAt: string;
  sentAt: string;
  repliedAt: string;
};

type Result = {
  ok?: boolean;
  error?: string;
  dailyLimit?: number;
  prospects?: Prospect[];
  background?: { schedule: string; firstTouchLimit: number; replyChecks: string };
};

const filters = ['All', 'Pending email', 'Contacted', 'Replied', 'Needs Kyle'];

export default function ProspectPipeline({ user }: { user: User }) {
  const [result, setResult] = useState<Result>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [adding, setAdding] = useState(false);
  const [addStatus, setAddStatus] = useState('');

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

  async function addProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setAddStatus('');
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/automation/prospects', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not add prospect.');
      form.reset();
      setAddStatus('Prospect added. The first email is drafted and queued for a future weekday run.');
      await load();
    } catch (error) {
      setAddStatus(error instanceof Error ? error.message : 'Could not add prospect.');
    } finally {
      setAdding(false);
    }
  }

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
  const activity = prospects.flatMap(prospect => {
    const rows: Array<{ date: string; action: string; business: string; result: string }> = [];
    if (prospect.sent) rows.push({ date: prospect.sentAt, action: 'First-touch sent', business: prospect.business, result: prospect.replyStage });
    if (prospect.repliedAt) rows.push({ date: prospect.repliedAt, action: 'Reply received', business: prospect.business, result: prospect.status });
    return rows;
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return <section className="prospect-pipeline">
    <div className="admin-module">
      <div className="pipeline-head">
        <div><p className="crm-kicker">MANUAL INTAKE</p><h2>Add a prospect</h2><p>Add a business to the same automated queue. Its first-touch draft is created immediately; sending follows queue order and the three-per-weekday cap.</p></div>
      </div>
      <form className="prospect-add-form" onSubmit={addProspect}>
        <label><span>Business name</span><input name="business" required maxLength={120} /></label>
        <label><span>Website</span><input name="website" type="url" placeholder="https://…" required /></label>
        <label><span>Phone number</span><input name="phone" type="tel" /></label>
        <label><span>Contact person</span><input name="contactPerson" /></label>
        <label><span>Email</span><input name="email" type="email" required /></label>
        <button className="button primary" disabled={adding}>{adding ? 'Adding…' : 'Add to automated queue'}</button>
      </form>
      {addStatus && <p className={`form-status ${/could not|already|required/i.test(addStatus) ? 'error' : 'sent'}`}>{addStatus}</p>}
    </div>

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
            {prospect.addedManually && <small>Manually added{prospect.contactPerson ? ` · ${prospect.contactPerson}` : ''}</small>}
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

    <div className="admin-module report-module">
      <div className="pipeline-head"><div><p className="crm-kicker">ACTIVITY REPORT</p><h2>What happened and the result</h2><p>Live evidence from sent-message markers and inbound replies in the private mailbox.</p></div></div>
      <div className="report-summary">
        <span><strong>{contacted}</strong> first touches sent</span>
        <span><strong>{replied}</strong> automated reply outcomes</span>
        <span><strong>{needsKyle}</strong> requiring Kyle</span>
      </div>
      {activity.length === 0 ? <p className="pipeline-empty">No automated sales activity has been recorded yet.</p> : <div className="prospect-table-wrap"><table className="prospect-table report-table">
        <thead><tr><th>When</th><th>Business</th><th>Action</th><th>Result / next step</th></tr></thead>
        <tbody>{activity.map((row, index) => <tr key={`${row.business}-${row.action}-${index}`}><td>{row.date ? new Date(row.date).toLocaleString() : 'Recorded'}</td><td><strong>{row.business}</strong></td><td>{row.action}</td><td>{row.result}</td></tr>)}</tbody>
      </table></div>}
    </div>
  </section>;
}
