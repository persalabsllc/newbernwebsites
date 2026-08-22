'use client';

import { FormEvent, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, firebaseReady } from '../lib/firebase';

export default function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    if (!firebaseReady || !db) {
      setStatus('error');
      setMessage('Online inquiries are being configured. Please email hello@newbernwebsites.com in the meantime.');
      return;
    }

    setStatus('sending');
    setMessage('');

    try {
      await addDoc(collection(db, 'websiteLeads'), {
        name: String(data.get('name') || '').trim(),
        business: String(data.get('business') || '').trim(),
        email: String(data.get('email') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        package: String(data.get('package') || '').trim(),
        project: String(data.get('project') || '').trim(),
        source: 'newbernwebsites.com',
        createdAt: serverTimestamp(),
      });
      form.reset();
      setStatus('sent');
      setMessage('Thank you — your project request is in. We’ll be in touch shortly.');
    } catch (error) {
      console.error('Lead submission failed', error);
      setStatus('error');
      setMessage('Something went wrong sending your request. Please email hello@newbernwebsites.com.');
    }
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit}>
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
