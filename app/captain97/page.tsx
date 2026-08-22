import type { Metadata } from 'next';
import LeadForm from '../../components/LeadForm';

export const metadata: Metadata = {
  title: 'Captain 97.1 Listener Website Review | New Bern Websites',
  description: 'Request a local website review from New Bern Websites, serving businesses across Eastern North Carolina.',
};

export default function Captain97LandingPage() {
  return (
    <main className="captain-page">
      <header className="captain-header">
        <a href="/" className="captain-brand"><strong>NEW BERN</strong><span>WEBSITES</span></a>
        <span>CAPTAIN 97.1 · EASTERN NORTH CAROLINA</span>
      </header>

      <section className="captain-hero">
        <div>
          <p className="eyebrow light-eye">HEARD ABOUT US ON CAPTAIN 97.1?</p>
          <h1>Let’s find the clearest way to improve your website.</h1>
          <p>Request a free 15-minute review. We’ll look at your current site—or your plans for a new one—and tell you what we would prioritize first.</p>
          <ul>
            <li>Turnkey website: $2,500</li>
            <li>Website plus professional photo and video: $3,500</li>
            <li>Both split 50% to begin and 50% after approval, before launch</li>
            <li>One month of Captain 97.1 underwriting included with every project</li>
          </ul>
        </div>

        <div className="form-card captain-form" id="review">
          <p className="eyebrow light-eye">FREE 15-MINUTE REVIEW</p>
          <h2>Tell us about your business.</h2>
          <p>Kyle will review your request and email you directly from Kyle@NewBernWebsites.com.</p>
          <LeadForm campaign="captain97" />
        </div>
      </section>

      <footer className="captain-footer">
        <span>New Bern Websites · 1423 South Glenburnie Road, Suite C · New Bern, NC 28562</span>
        <a href="tel:+12525154389">252-515-4389</a>
      </footer>
    </main>
  );
}
