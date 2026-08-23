'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db, firebaseReady } from '../lib/firebase';
import MailAutomationPanel from './MailAutomationPanel';
import OutreachComposer from './OutreachComposer';
import ProspectPipeline from './ProspectPipeline';
import OneOffComposer from './OneOffComposer';
import RevenueSprint from './RevenueSprint';

type Lead = {
  id: string;
  name?: string;
  business?: string;
  email?: string;
  phone?: string;
  package?: string;
  project?: string;
  source?: string;
  status?: string;
  notes?: string;
  outreachSubject?: string;
  outreachBody?: string;
  outreachStatus?: string;
  outreachSentAt?: string;
  createdAt?: { toDate?: () => Date };
};

const statuses = ['New', 'Contacted', 'Quoted', 'Won', 'Lost'];
const ADMIN_EMAILS = new Set([
  'kyle@newbernwebsites.com',
  'persalabsllc@gmail.com',
  'cravencountysba@gmail.com',
  'kkratoville@gmail.com',
]);

function displaySource(lead: Lead) {
  return lead.project?.startsWith('[Captain 97.1 campaign]') ? 'Captain 97.1' : (lead.source || '—');
}

function displayProject(lead: Lead) {
  return lead.project?.replace(/^\[Captain 97\.1 campaign\]\s*/, '') || 'No project details provided.';
}

export default function AdminCRM() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [filter, setFilter] = useState('All');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!auth) { setAuthLoading(false); return; }
    const firebaseAuth = auth;
    return onAuthStateChanged(firebaseAuth, next => {
      if (next && !ADMIN_EMAILS.has(next.email?.toLowerCase() || '')) {
        setLoginError('This account is not authorized for the New Bern Websites CRM.');
        setUser(null);
        void signOut(firebaseAuth);
      } else {
        setUser(next);
      }
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const q = query(collection(db, 'websiteLeads'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      const next = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Lead, 'id'>) }));
      setLeads(next);
      setSelectedId(current => current || next[0]?.id || '');
    });
  }, [user]);

  const visible = useMemo(() => filter === 'All' ? leads : leads.filter(l => (l.status || 'New') === filter), [leads, filter]);
  const selected = leads.find(l => l.id === selectedId) || visible[0];

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auth) return;
    const data = new FormData(event.currentTarget);
    setLoginError('');
    setResetStatus('');
    try {
      await signInWithEmailAndPassword(auth, String(data.get('email') || ''), String(data.get('password') || ''));
    } catch {
      setLoginError('Sign in failed. Check your email and password.');
    }
  }

  async function resetPassword() {
    if (!auth) return;
    const email = loginEmail.trim();
    setLoginError('');
    setResetStatus('');

    if (!email) {
      setLoginError('Enter your admin email first.');
      return;
    }

    if (!ADMIN_EMAILS.has(email.toLowerCase())) {
      setLoginError('Enter an authorized New Bern Websites admin email.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setResetStatus('Password reset email sent. Check your inbox and spam folder.');
    } catch {
      setLoginError('Could not send the reset email. Check the address and try again.');
    }
  }

  async function saveLead(fields: Partial<Lead>) {
    if (!db || !selected) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'websiteLeads', selected.id), { ...fields, updatedAt: serverTimestamp() });
    } finally { setSaving(false); }
  }

  if (!firebaseReady) return <div className="crm-shell"><div className="crm-login"><h1>CRM unavailable</h1><p>Firebase is not configured.</p></div></div>;
  if (authLoading) return <div className="crm-shell"><div className="crm-login"><p>Loading…</p></div></div>;

  if (!user) return <div className="crm-shell">
    <form className="crm-login" onSubmit={login}>
      <a href="/" className="crm-brand">NEW BERN <span>WEBSITES</span></a>
      <p className="crm-kicker">PRIVATE CRM</p>
      <h1>Sign in to manage leads.</h1>
      <input name="email" type="email" placeholder="Email address" value={loginEmail} onChange={event => setLoginEmail(event.target.value)} required />
      <input name="password" type="password" placeholder="Password" required />
      <button className="button primary">Sign In</button>
      <button
        type="button"
        className="crm-back"
        style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
        onClick={resetPassword}
      >
        Forgot password?
      </button>
      {resetStatus && <p className="form-status">{resetStatus}</p>}
      {loginError && <p className="form-status error">{loginError}</p>}
      <a href="/" className="crm-back">← Back to website</a>
    </form>
  </div>;

  return <div className="crm-app">
    <header className="crm-topbar">
      <div><strong>New Bern Websites</strong><span>Lead CRM</span></div>
      <div><small>{user.email}</small><button onClick={() => auth && signOut(auth)}>Sign out</button></div>
    </header>
    <RevenueSprint user={user} />
    <MailAutomationPanel user={user} />
    <ProspectPipeline user={user} />
    <OneOffComposer user={user} />
    <section className="inbound-heading">
      <p className="crm-kicker">INBOUND INQUIRIES</p>
      <h2>Website Leads</h2>
      <p>People who submitted the public website form. This is separate from the outbound prospect queue above.</p>
    </section>
    <div className="crm-stats">
      <article><span>Total Leads</span><strong>{leads.length}</strong></article>
      <article><span>New</span><strong>{leads.filter(l => !l.status || l.status === 'New').length}</strong></article>
      <article><span>Quoted</span><strong>{leads.filter(l => l.status === 'Quoted').length}</strong></article>
      <article><span>Won</span><strong>{leads.filter(l => l.status === 'Won').length}</strong></article>
    </div>
    <div className="crm-toolbar">{['All', ...statuses].map(s => <button className={filter === s ? 'active' : ''} key={s} onClick={() => setFilter(s)}>{s}</button>)}</div>
    <div className="crm-grid">
      <aside className="lead-list">
        {visible.length === 0 && <p className="empty">No leads in this view.</p>}
        {visible.map(lead => <button key={lead.id} className={selected?.id === lead.id ? 'lead-row selected' : 'lead-row'} onClick={() => setSelectedId(lead.id)}>
          <div><strong>{lead.business || lead.name || 'Unnamed lead'}</strong><span>{lead.name}</span></div>
          <div><span className={`status-pill ${(lead.status || 'New').toLowerCase()}`}>{lead.status || 'New'}</span><small>{lead.createdAt?.toDate ? lead.createdAt.toDate().toLocaleDateString() : ''}</small></div>
        </button>)}
      </aside>
      <section className="lead-detail">
        {!selected ? <div className="empty">Select a lead.</div> : <>
          <div className="detail-head"><div><p className="crm-kicker">LEAD</p><h2>{selected.business || selected.name}</h2><p>{selected.name}</p></div><select value={selected.status || 'New'} onChange={e => saveLead({ status: e.target.value })}>{statuses.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="contact-actions">
            {selected.email && <a href={`mailto:${selected.email}?subject=New Bern Websites`}>Email Lead</a>}
            {selected.phone && <a href={`tel:${selected.phone}`}>Call Lead</a>}
          </div>
          <div className="detail-grid"><div><span>Email</span><strong>{selected.email || '—'}</strong></div><div><span>Phone</span><strong>{selected.phone || '—'}</strong></div><div><span>Interested In</span><strong>{selected.package || '—'}</strong></div><div><span>Source</span><strong>{displaySource(selected)}</strong></div></div>
          <div className="project-box"><span>Project Request</span><p>{displayProject(selected)}</p></div>
          <label className="notes-box"><span>Internal Notes</span><textarea key={selected.id} defaultValue={selected.notes || ''} placeholder="Add call notes, follow-up details, quote information…" onBlur={e => saveLead({ notes: e.target.value })} /></label>
          <small className="save-note">{saving ? 'Saving…' : 'Notes save when you leave the field.'}</small>
          <OutreachComposer user={user} lead={selected} onSaved={saveLead} />
        </>}
      </section>
    </div>
  </div>;
}
