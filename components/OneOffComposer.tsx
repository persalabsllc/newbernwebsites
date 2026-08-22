'use client';

import type { User } from 'firebase/auth';
import { FormEvent, useState } from 'react';

export default function OneOffComposer({ user }: { user: User }) {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setStatus('');
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/automation/mail', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'send-one-off',
          to: data.get('to'),
          subject: data.get('subject'),
          message: data.get('message'),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Email could not be sent.');
      form.reset();
      setStatus(`Sent to ${payload.recipient}. This address was not added to the automated pipeline.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Email could not be sent.');
    } finally {
      setSending(false);
    }
  }

  return <section className="one-off-composer">
    <p className="crm-kicker">ONE-OFF EMAIL</p>
    <h2>Compose a new email</h2>
    <p>Send an immediate message to someone outside the prospect pipeline. It will not receive automated follow-ups unless you separately add the recipient as a prospect.</p>
    <form onSubmit={send}>
      <label><span>To</span><input name="to" type="email" required /></label>
      <label><span>Subject</span><input name="subject" required maxLength={120} /></label>
      <label><span>Message</span><textarea name="message" required maxLength={5000} rows={9} /></label>
      <button className="button primary" disabled={sending}>{sending ? 'Sending…' : 'Send email now'}</button>
    </form>
    {status && <p className={`form-status ${/could not|required|valid/i.test(status) ? 'error' : 'sent'}`}>{status}</p>}
  </section>;
}
