'use client';

import type { User } from 'firebase/auth';
import { useState } from 'react';

type Result = {
  ok?: boolean;
  error?: string;
  inbox?: { messages: number; unseen: number };
  recipient?: string;
  autopilotReady?: boolean;
  queued?: number;
  mode?: string;
};

export default function MailAutomationPanel({ user }: { user: User }) {
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  async function run(action: 'verify' | 'send-self-test') {
    setBusy(action);
    setResult(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/automation/mail', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setResult(await response.json());
    } catch {
      setResult({ ok: false, error: 'The diagnostic request failed.' });
    } finally {
      setBusy('');
    }
  }

  return (
    <section style={{ margin: '20px auto 0', maxWidth: 1180, padding: '18px 20px', border: '1px solid #dfe5ec', borderRadius: 14, background: '#fff' }}>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <p className="crm-kicker" style={{ margin: 0 }}>LIVE AUTOMATION</p>
          <strong>Email autopilot</strong>
          <p style={{ margin: '5px 0 0', color: '#637083' }}>A gradual ramp from three to ten personalized first touches each weekday, follow-ups on days 4, 9, and 14, hourly weekday reply checks, and escalation only when your involvement is necessary.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={Boolean(busy)} onClick={() => run('verify')}>{busy === 'verify' ? 'Checking…' : 'Check connection'}</button>
          <button disabled={Boolean(busy)} onClick={() => run('send-self-test')}>{busy === 'send-self-test' ? 'Sending…' : 'Send self-test'}</button>
        </div>
      </div>
      {result?.ok && result.inbox && <p className="form-status sent">Connected. Inbox: {result.inbox.messages} messages, {result.inbox.unseen} unread.</p>}
      {result?.ok && result.autopilotReady && <p className="form-status sent">Autopilot live. {result.queued || 0} verified prospects are in the pipeline; the first-touch allowance ramps from three to ten each weekday.</p>}
      {result?.ok && result.autopilotReady === false && <p className="form-status error">Autopilot is safely paused until the scheduler secret is added in Vercel.</p>}
      {result?.ok && result.recipient && <p className="form-status sent">Self-test sent to {result.recipient}.</p>}
      {result?.error && <p className="form-status error">{result.error}</p>}
      <details className="background-details">
        <summary>What runs silently—and what still needs you</summary>
        <div className="background-grid">
          <div><strong>Runs silently</strong><ul><li>Each weekday morning, the scheduler sends the current warmed-up first-touch allowance and any due follow-ups.</li><li>Replies are checked hourly from 8 AM to 8 PM Eastern on weekdays; only verified thread replies enter routine automation.</li><li>Safe opt-outs, pricing information, and the correct kickoff payment link are handled automatically.</li><li>Manual prospects join the same queue without an approval step.</li></ul></div>
          <div><strong>Does not run silently</strong><ul><li>Ambiguous, legal, discount, complaint, attachment, or unusual replies are escalated to your inbox.</li><li>Meetings, phone calls, personalized video audits, project delivery, and payment disputes still need you.</li><li>One-off emails send only when you click Send and do not receive automated follow-ups.</li></ul></div>
        </div>
      </details>
    </section>
  );
}
