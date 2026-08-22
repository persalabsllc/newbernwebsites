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
  dailyLimit?: number;
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
          <p style={{ margin: '5px 0 0', color: '#637083' }}>A daily 75-mile research run verifies public business websites and email addresses, then the outreach ramp releases 15, 25, 35, and 50 personalized first touches per weekday with follow-ups on days 4, 9, and 14.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={Boolean(busy)} onClick={() => run('verify')}>{busy === 'verify' ? 'Checking…' : 'Check connection'}</button>
          <button disabled={Boolean(busy)} onClick={() => run('send-self-test')}>{busy === 'send-self-test' ? 'Sending…' : 'Send self-test'}</button>
        </div>
      </div>
      {result?.ok && result.inbox && <p className="form-status sent">Connected. Inbox: {result.inbox.messages} messages, {result.inbox.unseen} unread.</p>}
      {result?.ok && result.autopilotReady && <p className="form-status sent">Autopilot live. {result.queued || 0} verified prospects are in the pipeline; the current daily first-touch allowance is {result.dailyLimit || 0}.</p>}
      {result?.ok && result.autopilotReady === false && <p className="form-status error">Autopilot is safely paused until the scheduler secret is added in Vercel.</p>}
      {result?.ok && result.recipient && <p className="form-status sent">Self-test sent to {result.recipient}.</p>}
      {result?.error && <p className="form-status error">{result.error}</p>}
      <details className="background-details">
        <summary>What runs silently—and what still needs you</summary>
        <div className="background-grid">
          <div><strong>Runs silently</strong><ul><li>Each weekday morning, the research engine scans eligible local-business listings within 75 miles, visits the public website, verifies a displayed business email, and creates three audit findings.</li><li>Five new first touches are released each hour until the current weekday allowance is reached.</li><li>Replies are checked hourly from 8 AM to 8 PM Eastern on weekdays; “send it” receives the correct private audit automatically.</li><li>Safe opt-outs, pricing information, scheduling links, and the correct kickoff payment link are handled automatically.</li></ul></div>
          <div><strong>Does not run silently</strong><ul><li>Ambiguous, legal, discount, complaint, attachment, or unusual replies are escalated to your inbox.</li><li>Requested appointments still need your final confirmation; calls, project delivery, and payment disputes still need you.</li><li>One-off emails send only when you click Send and do not receive automated follow-ups.</li></ul></div>
        </div>
      </details>
    </section>
  );
}
