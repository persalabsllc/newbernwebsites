'use client';

import type { User } from 'firebase/auth';
import { useEffect, useState } from 'react';

type OutreachLead = {
  id: string;
  name?: string;
  business?: string;
  email?: string;
  outreachSubject?: string;
  outreachBody?: string;
  outreachStatus?: string;
  outreachSentAt?: string;
};

type Props = {
  user: User;
  lead: OutreachLead;
  onSaved: (fields: Partial<OutreachLead> & { status?: string }) => Promise<void>;
};

function starter(lead: OutreachLead) {
  const business = lead.business || 'your business';
  const greeting = lead.name ? `Hi ${lead.name.split(/\s+/)[0]},` : 'Hi there,';
  return {
    subject: `Quick website idea for ${business}`,
    body: `${greeting}\n\nI came across ${business} while looking at local businesses in the New Bern area. I had one specific website idea that may help turn more visitors into calls and inquiries.\n\nWe build turnkey local-business websites and handle the design, copy, domain, hosting, and launch. Would it be useful if I sent over the idea?\n\nKyle\nNew Bern Websites`,
  };
}

export default function OutreachComposer({ user, lead, onSaved }: Props) {
  const initial = starter(lead);
  const [subject, setSubject] = useState(lead.outreachSubject || initial.subject);
  const [body, setBody] = useState(lead.outreachBody || initial.body);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const next = starter(lead);
    setSubject(lead.outreachSubject || next.subject);
    setBody(lead.outreachBody || next.body);
    setConfirm(false);
    setMessage('');
  }, [lead.id, lead.outreachSubject, lead.outreachBody]);

  async function saveDraft() {
    setBusy(true);
    try {
      await onSaved({ outreachSubject: subject, outreachBody: body, outreachStatus: 'Draft' });
      setMessage('Draft saved.');
    } finally { setBusy(false); }
  }

  async function send() {
    if (!lead.email || !confirm || lead.outreachStatus === 'Sent') return;
    setBusy(true);
    setMessage('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/automation/mail', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'send-prospect',
          confirmation: 'SEND_APPROVED_FIRST_TOUCH',
          to: lead.email,
          subject,
          message: body,
        }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!result.ok) throw new Error(result.error || 'Send failed.');
      const sentAt = new Date().toISOString();
      await onSaved({ outreachSubject: subject, outreachBody: body, outreachStatus: 'Sent', outreachSentAt: sentAt, status: 'Contacted' });
      setConfirm(false);
      setMessage(`Sent to ${lead.email}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Send failed.');
    } finally { setBusy(false); }
  }

  const alreadySent = lead.outreachStatus === 'Sent';
  return <section style={{ marginTop: 22, padding: 20, border: '1px solid #dfe5ec', borderRadius: 14, background: '#fff' }}>
    <p className="crm-kicker" style={{ margin: 0 }}>SUPERVISED OUTREACH</p>
    <h3 style={{ margin: '6px 0' }}>Personalized first-touch email</h3>
    <p style={{ margin: '0 0 14px', color: '#637083', fontSize: 13 }}>Review the business-specific sentence before sending. The required address, ad disclosure, and reply-to-opt-out footer are added automatically.</p>
    <label style={{ display: 'grid', gap: 6, marginBottom: 12 }}><span>Subject</span><input value={subject} maxLength={120} onChange={event => setSubject(event.target.value)} /></label>
    <label style={{ display: 'grid', gap: 6 }}><span>Message</span><textarea value={body} maxLength={5000} rows={10} onChange={event => setBody(event.target.value)} /></label>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
      <button disabled={busy || alreadySent} onClick={saveDraft}>Save draft</button>
      <label style={{ display: 'flex', gap: 7, alignItems: 'center', fontSize: 12 }}><input type="checkbox" checked={confirm} disabled={alreadySent} onChange={event => setConfirm(event.target.checked)} /> I reviewed this recipient and message</label>
      <button disabled={busy || alreadySent || !confirm || !lead.email} onClick={send}>{busy ? 'Working…' : alreadySent ? 'First touch sent' : 'Approve & send'}</button>
    </div>
    {lead.outreachSentAt && <small style={{ display: 'block', marginTop: 8 }}>Sent {new Date(lead.outreachSentAt).toLocaleString()}</small>}
    {message && <p className={message.includes('failed') || message.includes('cannot') ? 'form-status error' : 'form-status sent'} style={{ marginTop: 12 }}>{message}</p>}
  </section>;
}
