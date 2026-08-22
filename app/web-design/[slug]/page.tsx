import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LeadForm from '../../../components/LeadForm';
import { getMarketPage, marketPages } from '../../../lib/market-pages';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return marketPages.map(page => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getMarketPage(slug);
  if (!page) return {};
  return {
    title: `${page.title} | New Bern Websites`,
    description: page.description,
    alternates: { canonical: `/web-design/${page.slug}` },
  };
}

export default async function MarketPageRoute({ params }: Props) {
  const { slug } = await params;
  const page = getMarketPage(slug);
  if (!page) notFound();
  const schedule = `/schedule?${new URLSearchParams({ source: `market-${page.slug}` })}`;

  return (
    <main className="market-page">
      <header className="simple-header market-header"><a href="/"><strong>NEW BERN</strong><span>WEBSITES</span></a><nav><a href="/#work">Our Work</a><a href="/#pricing">Packages</a><a className="button gold" href={schedule}>Schedule 15 Minutes</a></nav></header>
      <section className="market-hero">
        <div><p className="eyebrow light-eye">{page.eyebrow}</p><h1>{page.title}</h1><p>{page.description}</p><div className="actions"><a className="button gold" href={schedule}>Schedule 15 Minutes →</a><a className="button outline-light" href="#review">Request a Free Audit</a></div></div>
        <aside><span>BUILT FOR</span><strong>{page.audience}</strong><p>{page.localNote}</p></aside>
      </section>
      <section className="market-opportunities"><div className="section-title"><p className="eyebrow">A BETTER CUSTOMER PATH</p><h2>Built around how local customers <em>actually choose.</em></h2></div><div className="market-grid">{page.opportunities.map((item, index) => <article key={item.title}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div></section>
      <section className="market-proof"><div><p className="eyebrow light-eye">ONE LOCAL PARTNER</p><h2>Design, copy, development, hosting, and launch—handled.</h2><p>Every project includes mobile optimization, lead forms, local SEO foundations, SSL, deployment, launch support, and 30 days of Captain 97.1 local business underwriting acknowledgments.</p></div><div className="market-prices"><article><span>TURNKEY WEBSITE</span><strong>$2,500</strong><small>$1,250 to start · $1,250 before launch</small></article><article><span>WEBSITE + MEDIA</span><strong>$3,500</strong><small>$1,750 to start · $1,750 before launch</small></article></div></section>
      <section className="market-form-section" id="review"><div><p className="eyebrow">FREE WEBSITE AUDIT</p><h2>Let’s identify the clearest next step.</h2><p>Send the current website—or tell us you are starting from scratch. We’ll respond with a useful recommendation, not a generic sales presentation.</p><a href="tel:+12525154389">Prefer the phone? 252-515-4389</a></div><div className="form-card"><LeadForm /></div></section>
      <footer className="audit-footer"><span>New Bern Websites · Serving Eastern North Carolina</span><a href="mailto:kyle@newbernwebsites.com">Kyle@NewBernWebsites.com</a><a href="/">NewBernWebsites.com</a></footer>
    </main>
  );
}
