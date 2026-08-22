'use client';

import { FormEvent, useState } from 'react';

export default function LeadForm({ campaign = 'website' }: { campaign?: 'website' | 'captain97' }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    setStatus('sending');
    setMessage('');

    try {
      const response = await fetch('/api/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: crypto.randomUUID(),
          websiteFax: String(data.get('websiteFax') || ''),
          name: String(data.get('name') || '').trim(),
          business: String(data.get('business') || '').trim(),
          email: String(data.get('email') || '').trim(),
          phone: String(data.get('phone') || '').trim(),
          package: String(data.get('package') || '').trim(),
          project: String(data.get('project') || '').trim(),
          campaign,
        }),
      });
      if (!response.ok) throw new Error('Lead intake rejected the submission.');
      form.reset();
      setStatus('sent');
      setMessage('Thank you — your request is in. Check your inbox for a message from Kyle@NewBernWebsites.com.');
    } catch (error) {
      console.error('Lead submission failed', error);
      setStatus('error');
      setMessage('Something went wrong sending your request. Please email hello@newbernwebsites.com.');
    }
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
      <label className="form-honeypot" aria-hidden="true">
        Website fax
        <input autoComplete="off" name="websiteFax" tabIndex={-1} />
      </label>
      <div className="form-row">
        <label className="form-field">
          <span>Your name <i aria-hidden="true">*</i></span>
          <input autoComplete="name" name="name" placeholder="Your name" required maxLength={100} />
        </label>
        <label className="form-field">
          <span>Business name <i aria-hidden="true">*</i></span>
          <input autoComplete="organization" name="business" placeholder="Business name" required maxLength={150} />
        </label>
      </div>
      <div className="form-row">
        <label className="form-field">
          <span>Email address <i aria-hidden="true">*</i></span>
          <input autoComplete="email" type="email" name="email" placeholder="you@email.com" required maxLength={200} />
        </label>
        <label className="form-field">
          <span>Phone number</span>
          <input autoComplete="tel" inputMode="tel" type="tel" name="phone" placeholder="(252) 555-0123" maxLength={30} />
        </label>
      </div>
      <label className="form-field">
        <span>Project type</span>
        <select name="package" defaultValue="Free Website Audit">
          <option value="" disabled>What are you interested in?</option>
          <option value="Free Website Audit">Free 15-minute website audit</option>
          <option value="Turnkey Website - $2,500">Turnkey Website — $2,500</option>
          <option value="Website + Professional Media - $3,500">Website + Professional Media — $3,500</option>
          <option value="Custom Project">Custom Project</option>
          <option value="Not Sure Yet">Not sure yet</option>
        </select>
      </label>
      <label className="form-field">
        <span>Tell us about your project</span>
        <textarea name="project" rows={5} placeholder="A few details about your business and what you need…" maxLength={3000} />
      </label>
      <button
        aria-busy={status === 'sending'}
        className="button primary full"
        disabled={status === 'sending'}
        type="submit"
      >
        {status === 'sending' ? 'Sending…' : 'Request My Free Audit'}
      </button>
      {message && <p aria-live="polite" className={`form-status ${status}`} role="status">{message}</p>}
      <p className="form-note">No obligation. Tell us what you need and we’ll recommend the right path.</p>
    </form>
  );
}
