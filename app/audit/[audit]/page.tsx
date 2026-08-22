import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getProspectByAuditKey } from '../../../lib/prospect-store';
import { defaultAuditFindings, siteHost } from '../../../lib/prospect-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Props = { params: Promise<{ audit: string }> };
const getProspect = cache(getProspectByAuditKey);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { audit } = await params;
  const prospect = await getProspect(audit);
  return {
    title: prospect ? `${prospect.business} Website Review | New Bern Websites` : 'Private Website Review',
    description: 'A complimentary private website review prepared by New Bern Websites.',
    robots: { index: false, follow: false },
  };
}

export default async function AuditPage({ params }: Props) {
  const { audit } = await params;
  const prospect = await getProspect(audit);
  if (!prospect) notFound();

  const findings = prospect.auditFindings?.length ? prospect.auditFindings : defaultAuditFindings(prospect.observation);
  const schedule = `/schedule?${new URLSearchParams({ business: prospect.business, source: `audit-${audit}` })}`;
  const deposit = prospect.recommendedPackage === 'Media Website' ? '/pay/media-deposit' : '/pay/turnkey-deposit';
  const screenshot = `https://image.thum.io/get/width/1200/crop/760/noanimate/${prospect.sourceUrl}`;

  return (
    <main className="audit-page">
      <header className="simple-header audit-header">
        <a href="/"><strong>NEW BERN</strong><span>WEBSITES</span></a>
        <span>PRIVATE COMPLIMENTARY REVIEW</span>
      </header>

      <section className="audit-hero">
        <div>
          <p className="eyebrow light-eye">PREPARED FOR {prospect.business.toUpperCase()}</p>
          <h1>Three opportunities we see in your current website.</h1>
          <p>This short review is based on the public website at {siteHost(prospect.sourceUrl)}. It is meant to be useful whether or not you decide to work with us.</p>
          <div className="audit-actions"><a className="button gold" href={schedule}>Discuss This Review →</a><a className="button outline-light" href={prospect.sourceUrl} target="_blank" rel="noreferrer">Open Current Website ↗</a></div>
        </div>
        <div className="audit-browser">
          <div><i /><i /><i /><span>{siteHost(prospect.sourceUrl)}</span></div>
          <Image alt={`${prospect.business} website screenshot`} fill priority sizes="(max-width: 900px) 92vw, 46vw" src={screenshot} unoptimized />
        </div>
      </section>

      <section className="audit-findings">
        <div className="section-title"><p className="eyebrow">THE 60-SECOND REVIEW</p><h2>What we would <em>prioritize first.</em></h2></div>
        <div className="audit-grid">{findings.map((finding, index) => <article key={finding.title}><span>0{index + 1}</span><h3>{finding.title}</h3><p>{finding.detail}</p></article>)}</div>
      </section>

      <section className="audit-recommendation">
        <div>
          <p className="eyebrow light-eye">OUR RECOMMENDATION</p>
          <h2>{prospect.recommendedPackage === 'Media Website' ? 'Website + Professional Media' : 'Turnkey Website'}</h2>
          <p>{prospect.recommendedPackage === 'Media Website' ? 'A complete website plus professional on-location photography and video.' : 'A complete custom website with design, copy, mobile optimization, hosting, lead forms, and local SEO foundations.'}</p>
          <ul><li>50% to begin and 50% after approval, before launch</li><li>One month of Captain 97.1 underwriting included</li><li>First staging target within 21 days after complete intake</li></ul>
        </div>
        <div className="audit-price"><span>FIXED PROJECT PRICE</span><strong>{prospect.recommendedPackage === 'Media Website' ? '$3,500' : '$2,500'}</strong><small>{prospect.recommendedPackage === 'Media Website' ? '$1,750' : '$1,250'} kickoff deposit</small><a className="button gold full" href={schedule}>Schedule 15 Minutes</a><a className="audit-start" href={deposit}>Ready now? Start securely →</a></div>
      </section>

      <footer className="audit-footer"><span>Prepared by New Bern Websites · New Bern, North Carolina</span><a href="mailto:kyle@newbernwebsites.com">Kyle@NewBernWebsites.com</a><a href="tel:+12525154389">252-515-4389</a></footer>
    </main>
  );
}
