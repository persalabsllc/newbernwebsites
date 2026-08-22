'use client';

import { FormEvent, useMemo, useState } from 'react';

type ScheduleFormProps = {
  defaultBusiness?: string;
  defaultEmail?: string;
  source?: string;
};

function availableDays() {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const days: Array<{ value: string; label: string }> = [];
  const cursor = new Date();
  while (days.length < 8) {
    cursor.setDate(cursor.getDate() + 1);
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short' }).format(cursor);
    if (weekday !== 'Sun' && weekday !== 'Sat') {
      days.push({ value: cursor.toISOString().slice(0, 10), label: formatter.format(cursor) });
    }
  }
  return days;
}

export default function ScheduleForm({ defaultBusiness = '', defaultEmail = '', source = 'website' }: ScheduleFormProps) {
  const days = useMemo(availableDays, []);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus('sending');
    setMessage('');
    try {
      const dayLabel = days.find(day => day.value === String(data.get('day')))?.label || String(data.get('day'));
      const response = await fetch('/api/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          submissionId: crypto.randomUUID(),
          websiteFax: String(data.get('websiteFax') || ''),
          name: String(data.get('name') || '').trim(),
          business: String(data.get('business') || '').trim(),
          email: String(data.get('email') || '').trim(),
          phone: String(data.get('phone') || '').trim(),
          package: 'Schedule a 15-minute call',
          project: `Preferred conversation: ${dayLabel} at ${String(data.get('time') || '')} Eastern. Source: ${source}. Notes: ${String(data.get('notes') || '').trim()}`,
          campaign: 'website',
        }),
      });
      if (!response.ok) throw new Error('The appointment request was not accepted.');
      setStatus('sent');
      setMessage('Your requested time is in. Check your inbox for Kyle’s confirmation.');
      form.reset();
    } catch (error) {
      console.error('Appointment request failed', error);
      setStatus('error');
      setMessage('We could not send that request. Call or text Kyle at 252-515-4389.');
    }
  }

  return (
    <form className="schedule-form" onSubmit={submit}>
      <label className="form-honeypot" aria-hidden="true">Website fax<input autoComplete="off" name="websiteFax" tabIndex={-1} /></label>
      <div className="form-row">
        <label className="form-field"><span>Your name <i>*</i></span><input autoComplete="name" name="name" required maxLength={100} /></label>
        <label className="form-field"><span>Business <i>*</i></span><input autoComplete="organization" defaultValue={defaultBusiness} name="business" required maxLength={150} /></label>
      </div>
      <div className="form-row">
        <label className="form-field"><span>Email <i>*</i></span><input autoComplete="email" defaultValue={defaultEmail} name="email" required type="email" maxLength={254} /></label>
        <label className="form-field"><span>Phone <i>*</i></span><input autoComplete="tel" name="phone" required type="tel" maxLength={40} /></label>
      </div>
      <div className="form-row">
        <label className="form-field"><span>Preferred day</span><select name="day" defaultValue={days[0]?.value}>{days.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
        <label className="form-field"><span>Preferred time</span><select name="time" defaultValue="10:30 AM"><option>10:30 AM</option><option>12:30 PM</option><option>4:30 PM</option><option>5:30 PM</option></select></label>
      </div>
      <label className="form-field"><span>Anything Kyle should review first?</span><textarea name="notes" rows={4} maxLength={1200} placeholder="Current website, goals, or questions…" /></label>
      <button aria-busy={status === 'sending'} className="button gold full" disabled={status === 'sending'} type="submit">{status === 'sending' ? 'Requesting…' : 'Request This Time →'}</button>
      {message && <p aria-live="polite" className={`form-status ${status}`} role="status">{message}</p>}
      <p className="form-note">Times are requested, not automatically confirmed. Kyle will reply personally from Kyle@NewBernWebsites.com.</p>
    </form>
  );
}
