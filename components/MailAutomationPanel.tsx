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
          <p className="crm-kicker" style={{ margin: 0 }}>EMAIL CONNECTION</p>
          <strong>Automatic outreach is off</strong>
          <p style={{ margin: '5px 0 0', color: '#637083' }}>Website inquiries and appointment confirmations work normally. Prospect research is scheduled on weekdays, while prospect emails, automatic replies, and follow-up sequences stay paused. You can still send individual emails manually.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={Boolean(busy)} onClick={() => run('verify')}>{busy === 'verify' ? 'Checking…' : 'Check connection'}</button>
          <button disabled={Boolean(busy)} onClick={() => run('send-self-test')}>{busy === 'send-self-test' ? 'Sending…' : 'Send self-test'}</button>
        </div>
      </div>
      {result?.ok && result.inbox && <p className="form-status sent">Connected. Inbox: {result.inbox.messages} messages, {result.inbox.unseen} unread.</p>}
      {result?.ok && result.autopilotReady && <p className="form-status sent">Autopilot live. {result.queued || 0} verified prospects are in the pipeline; the current daily first-touch allowance is {result.dailyLimit || 0}.</p>}
      {result?.ok && result.autopilotReady === false && <p className="form-status">Automatic outreach is disabled. Research and manual email remain available.</p>}
      {result?.ok && result.recipient && <p className="form-status sent">Self-test sent to {result.recipient}.</p>}
      {result?.error && <p className="form-status error">{result.error}</p>}
      <details className="background-details">
        <summary>What is enabled</summary>
        <div className="background-grid">
          <div><strong>Enabled</strong><ul><li>Public website forms save inquiries and send an immediate confirmation.</li><li>Weekday research checks refill the prospect pipeline when needed, without emailing prospects.</li><li>Manual research, connection checks, and individual email controls remain available.</li></ul></div>
          <div><strong>Requires you</strong><ul><li>No automatic prospect emails, replies, or follow-up sequences are sent.</li><li>Review replies and opt-outs in your mailbox and respond manually.</li><li>Requested appointments still need your final confirmation; calls, project delivery, and payment disputes still need you.</li></ul></div>
        </div>
      </details>
    </section>
  );
}
