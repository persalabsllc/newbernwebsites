import type { Metadata } from 'next';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Captain 97.1 Website Case Study | New Bern Websites',
  description: 'See how New Bern Websites built the live digital home for Captain 97.1, Carolina’s Dock Rock.',
};

const delivered = [
  ['Live listening', 'A persistent streaming experience makes the station immediately usable instead of treating the website as a static brochure.'],
  ['Now-playing information', 'Current programming and song information give listeners a reason to keep the site open while they listen.'],
  ['Programming schedule', 'Host and show information is organized into a clear weekly experience for listeners and advertisers.'],
  ['Local utility', 'Weather, station information, advertiser paths, and contact forms make the site useful beyond the audio player.'],
  ['Mobile-first design', 'The listening and discovery experience is structured for the phones where most station interactions begin.'],
  ['A platform that can grow', 'The site can support programming updates, advertiser campaigns, promotions, and future station features.'],
];

export default function CaptainCaseStudyPage() {
  return (
    <main className="case-page">
      <header className="simple-header case-header"><a href="/"><strong>NEW BERN</strong><span>WEBSITES</span></a><a href="/#work">← Back to Our Work</a></header>
      <section className="case-hero"><div><p className="eyebrow light-eye">LIVE PRODUCTION WEBSITE · CAPTAIN 97.1</p><h1>A digital home built for a local radio brand.</h1><p>Captain 97.1 needed more than a station information page. It needed a listening experience, a programming hub, and a credible home for listeners, community partners, and advertisers.</p><div className="actions"><a className="button gold" href="https://www.captain97.com/" target="_blank" rel="noreferrer">Visit Captain97.com ↗</a><a className="button outline-light" href="/schedule?source=captain-case-study">Discuss Your Website</a></div></div><div className="captain-case-mark"><span>CAPTAIN</span><strong>97.1</strong><i>CAROLINA&apos;S DOCK ROCK</i></div></section>
      <section className="case-screen"><div><p className="eyebrow">THE LIVE PRODUCT</p><h2>Designed around listening—not just looking.</h2><p>The visual system carries the relaxed coastal identity into a polished, functional experience while keeping live listening and programming easy to reach.</p></div><div className="case-browser"><div><i /><i /><i /><span>captain97.com</span></div><Image alt="Captain 97.1 live website" fill sizes="(max-width: 900px) 92vw, 58vw" src="https://image.thum.io/get/width/1400/crop/900/noanimate/https://www.captain97.com/" unoptimized /></div></section>
      <section className="case-delivered"><div className="section-title"><p className="eyebrow">WHAT WE DELIVERED</p><h2>One connected <em>station experience.</em></h2></div><div className="case-grid">{delivered.map(([title, detail], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{detail}</p></article>)}</div></section>
      <section className="case-result"><div><p className="eyebrow light-eye">THE RESULT</p><h2>A real, working example of how we handle specialized projects.</h2><p>Captain97.com demonstrates the same principle behind every New Bern Websites project: understand what the business actually needs customers to do, then build the design and technology around that journey.</p></div><aside><strong>LIVE NOW</strong><span>Captain97.com</span><a className="button gold full" href="/schedule?source=captain-case-study">Schedule 15 Minutes →</a></aside></section>
      <footer className="audit-footer"><span>Case study by New Bern Websites · New Bern, NC</span><a href="mailto:kyle@newbernwebsites.com">Kyle@NewBernWebsites.com</a><a href="tel:+12525154389">252-515-4389</a></footer>
    </main>
  );
}
