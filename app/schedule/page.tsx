import type { Metadata } from 'next';
import ScheduleForm from '../../components/ScheduleForm';

export const metadata: Metadata = {
  title: 'Schedule a Website Conversation | New Bern Websites',
  description: 'Request a focused 15-minute website conversation with New Bern Websites.',
};

type Props = { searchParams: Promise<{ business?: string; email?: string; source?: string }> };

export default async function SchedulePage({ searchParams }: Props) {
  const query = await searchParams;
  return (
    <main className="schedule-page">
      <header className="simple-header"><a href="/"><strong>NEW BERN</strong><span>WEBSITES</span></a><a href="tel:+12525154389">252-515-4389</a></header>
      <section className="schedule-shell">
        <div className="schedule-copy">
          <p className="eyebrow light-eye">15-MINUTE WEBSITE CONVERSATION</p>
          <h1>Pick a time that works for you.</h1>
          <p>This is a focused, no-pressure conversation about your current website, the opportunity we see, and the most practical next step.</p>
          <ul><li>No generic presentation</li><li>Clear fixed pricing</li><li>Specific recommendations</li><li>No obligation</li></ul>
        </div>
        <div className="schedule-card"><ScheduleForm defaultBusiness={query.business || ''} defaultEmail={query.email || ''} source={query.source || 'website'} /></div>
      </section>
    </main>
  );
}
