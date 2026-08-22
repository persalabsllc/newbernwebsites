'use client';

import type { User } from 'firebase/auth';
import { useState } from 'react';

type Result = {
  ok?: boolean;
  error?: string;
  inbox?: { messages: number; unseen: number };
  recipient?: string;
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
          <p className="crm-kicker" style={{ margin: 0 }}>AUTOMATION SETUP</p>
          <strong>Private Email connection</strong>
          <p style={{ margin: '5px 0 0', color: '#637083' }}>Mail is connected. Prospect emails remain individually reviewed and approved while this new domain builds its sending reputation.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button disabled={Boolean(busy)} onClick={() => run('verify')}>{busy === 'verify' ? 'Checking…' : 'Verify mail'}</button>
          <button disabled={Boolean(busy)} onClick={() => run('send-self-test')}>{busy === 'send-self-test' ? 'Sending…' : 'Send self-test'}</button>
        </div>
      </div>
      {result?.ok && result.inbox && <p className="form-status sent">Connected. Inbox: {result.inbox.messages} messages, {result.inbox.unseen} unread.</p>}
      {result?.ok && result.recipient && <p className="form-status sent">Self-test sent to {result.recipient}.</p>}
      {result?.error && <p className="form-status error">{result.error}</p>}
    </section>
  );
}
