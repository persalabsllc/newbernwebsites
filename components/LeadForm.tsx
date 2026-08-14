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
        status: 'new',
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
        <input name="name" placeholder="Your name" required maxLength={100} />
        <input name="business" placeholder="Business name" required maxLength={150} />
      </div>
      <div className="form-row">
        <input type="email" name="email" placeholder="Email address" required maxLength={200} />
        <input type="tel" name="phone" placeholder="Phone number" maxLength={30} />
      </div>
      <select name="package" defaultValue="">
        <option value="" disabled>What are you interested in?</option>
        <option value="Turnkey Website - $2,500">Turnkey Website — $2,500</option>
        <option value="Website + Professional Media - $3,500">Website + Professional Media — $3,500</option>
        <option value="Custom Project">Custom Project</option>
        <option value="Not Sure Yet">Not sure yet</option>
      </select>
      <textarea name="project" rows={5} placeholder="Tell us about your business and what you need." maxLength={3000} />
      <button className="button primary full" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Start Your Website'}
      </button>
      {message && <p className={`form-status ${status}`}>{message}</p>}
      <p className="form-note">No obligation. Tell us what you need and we’ll recommend the right path.</p>
    </form>
  );
}
