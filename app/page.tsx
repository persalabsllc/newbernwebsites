import LeadForm from '../components/LeadForm';

type IconName =
  | 'anchor'
  | 'sparkles'
  | 'device'
  | 'search'
  | 'shield'
  | 'layout'
  | 'camera'
  | 'calendar'
  | 'check';

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      {name === 'anchor' && (
        <>
          <circle cx="12" cy="5" r="2.25" />
          <path d="M12 7.25v11.5M8.5 10.5h7M5 14.5c.75 3 3.4 5.25 7 5.25s6.25-2.25 7-5.25M5 14.5l-1.5 2M19 14.5l1.5 2" />
        </>
      )}
      {name === 'sparkles' && (
        <>
          <path d="M12 2.75c.35 3.25 2.1 5 5.25 5.35-3.15.35-4.9 2.1-5.25 5.35-.35-3.25-2.1-5-5.25-5.35C9.9 7.75 11.65 6 12 2.75Z" />
          <path d="M18.5 14.25c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3ZM5.25 14.75c.15 1.25.85 1.95 2.1 2.1-1.25.15-1.95.85-2.1 2.1-.15-1.25-.85-1.95-2.1-2.1 1.25-.15 1.95-.85 2.1-2.1Z" />
        </>
      )}
      {name === 'device' && (
        <>
          <rect x="5" y="2.75" width="14" height="18.5" rx="2.25" />
          <path d="M9.25 6h5.5M11 17.75h2" />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="10.5" cy="10.5" r="5.75" />
          <path d="m15 15 4.25 4.25M7.75 10.5h5.5M10.5 7.75v5.5" />
        </>
      )}
      {name === 'shield' && (
        <>
          <path d="M12 2.75 19 5.5v5.25c0 4.4-2.7 8.15-7 10.5-4.3-2.35-7-6.1-7-10.5V5.5l7-2.75Z" />
          <path d="m8.75 11.75 2 2 4.5-4.75" />
        </>
      )}
      {name === 'layout' && (
        <>
          <rect x="3" y="3.5" width="18" height="17" rx="2.25" />
          <path d="M3 8.5h18M9 8.5v12" />
        </>
      )}
      {name === 'camera' && (
        <>
          <path d="M8.25 6.25 9.5 4h5l1.25 2.25H19A2 2 0 0 1 21 8.25v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2h3.25Z" />
          <circle cx="12" cy="12.5" r="3.25" />
        </>
      )}
      {name === 'calendar' && (
        <>
          <rect x="3.25" y="5.25" width="17.5" height="15.5" rx="2.25" />
          <path d="M7.5 2.75v5M16.5 2.75v5M3.25 10h17.5M7 14h2M11 14h2M15 14h2M7 17.25h2M11 17.25h2" />
        </>
      )}
      {name === 'check' && <path d="m5.25 12.25 4.1 4.1L18.75 7" />}
    </svg>
  );
}

const included = [
  'Custom professional design',
  'Domain registration & setup',
  'First-year Vercel hosting',
  'Mobile optimization',
  'Contact & lead forms',
  'Local SEO foundations',
  'SSL, security & deployment',
  'Launch support',
];

const packages = [
  {
    name: 'Turnkey Website',
    price: '$2,500',
    deposit: '$1,250 to start',
    balance: '$1,250 before launch',
    desc: 'A complete business website from concept to launch.',
    icon: 'layout' as IconName,
    items: [
      'Custom website design & development',
      'Domain setup + first-year hosting',
      'Mobile optimization',
      'Lead & contact forms',
      'Local SEO foundations',
      'SSL, security & deployment',
    ],
  },
  {
    name: 'Website + Professional Media',
    price: '$3,500',
    deposit: '$1,750 to start',
    balance: '$1,750 before launch',
    featured: true,
    desc: 'Everything in Turnkey, plus we come to your business and capture it properly.',
    icon: 'camera' as IconName,
    items: [
      'Everything in Turnkey Website',
      'On-location photography',
      'Professional video capture',
      'Custom visual content',
      'Authentic team, space & work imagery',
      'Launch-ready media library',
    ],
  },
];

const process = [
  ['1', 'Discovery', 'We learn about your business, goals and style.'],
  ['2', 'Design & Build', 'We design, develop and bring your site to life.'],
  ['3', 'Media (Optional)', 'We capture photos and video at your location.'],
  ['4', 'Launch', 'We test, deploy and get you live.'],
];

const features: Array<[IconName, string, string]> = [
  ['sparkles', 'Custom Design', 'Built for Your Brand'],
  ['device', 'Mobile Ready', 'Looks Great Everywhere'],
  ['search', 'SEO Setup', 'Get Found Locally'],
  ['shield', 'Fast & Secure', 'SSL, Hosting, Updates'],
];

function Brand() {
  return (
    <span className="brand">
      <span className="brand-emblem"><Icon name="anchor" /></span>
      <span>
        <strong>NEW BERN</strong>
        <small>WEBSITES</small>
        <i>We Handle Everything.</i>
      </span>
    </span>
  );
}

export default function Home() {
  return (
    <main className="marketing-page">
      <header className="site-header">
        <a className="brand-link" href="#top" aria-label="New Bern Websites home">
          <Brand />
        </a>
        <nav aria-label="Primary navigation">
          <a href="#top">Home</a>
          <a href="#services">Services</a>
          <a href="#pricing">Packages</a>
          <a href="#process">Process</a>
          <a href="#contact">Contact</a>
          <a className="nav-cta" href="#contact">Start Your Website <span aria-hidden="true">→</span></a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-shade" aria-hidden="true" />
        <div className="hero-inner">
          <p className="eyebrow light-eye">BUILT IN NEW BERN. BUILT FOR NEW BERN.</p>
          <h1>Your Business Deserves<br />a <em>Better Website.</em></h1>
          <p className="lead">Beautiful, high-performance websites for local businesses — with the domain, hosting, design, development and launch handled for you.</p>
          <div className="actions">
            <a className="button gold" href="#contact">Start Your Website <span aria-hidden="true">→</span></a>
            <a className="button outline-light" href="#pricing">See Packages</a>
          </div>
          <p className="micro"><strong>50% to start.</strong> Final 50% before launch.</p>
        </div>
        <div className="local-note"><em>Local. Professional. Trusted.</em><span>New Bern, NC</span></div>
      </section>

      <section className="feature-strip" id="services" aria-label="Website features">
        {features.map(([icon, title, subtitle]) => (
          <div key={title}>
            <span className="feature-icon"><Icon name={icon} /></span>
            <span><strong>{title}</strong><small>{subtitle}</small></span>
          </div>
        ))}
      </section>

      <section className="packages" id="pricing">
        <div className="section-title">
          <p className="eyebrow">WE HANDLE EVERYTHING.</p>
          <h2>Simple Packages. <em>Big Results.</em></h2>
          <p>Choose the package that fits your business. We handle everything so you can focus on what you do best.</p>
        </div>
        <div className="package-layout">
          <aside className="included">
            <h3>Everything You Need.<br />All Included.</h3>
            {included.map(item => <p key={item}><Icon name="check" />{item}</p>)}
          </aside>
          <div className="package-cards">
            {packages.map(item => (
              <article className={item.featured ? 'package-card featured' : 'package-card'} key={item.name}>
                {item.featured && <div className="popular">MOST POPULAR</div>}
                <span className="package-icon"><Icon name={item.icon} /></span>
                <h3>{item.name}</h3>
                <p className="desc">{item.desc}</p>
                <div className="price">{item.price}</div>
                <small>Simple 50/50 payment plan</small>
                <strong className="monthly">{item.deposit}</strong>
                <span className="balance-copy">{item.balance}</span>
                <ul>{item.items.map(listItem => <li key={listItem}><Icon name="check" />{listItem}</li>)}</ul>
                <a className="button package-button" href="#contact">Get Started <span aria-hidden="true">→</span></a>
              </article>
            ))}
          </div>
        </div>

        <div className="radio-card">
          <div className="radio-mark">97.1</div>
          <div>
            <p className="eyebrow light-eye">WEBSITE + LOCAL EXPOSURE</p>
            <h3>Don’t just launch your website. Tell New Bern about it.</h3>
            <p>Add a three-month promotional campaign on Captain 97.1 to either website package.</p>
          </div>
          <div className="radio-price"><span>3 MONTHS</span><strong>+$500</strong></div>
        </div>

        <div className="payment-bar">
          <div>
            <span className="payment-icon"><Icon name="calendar" /></span>
            <span><strong>Simple Payment Plan</strong><small>50% kickoff deposit, then the final 50% after approval and before launch.</small></span>
          </div>
          <div><span>$2,500 →</span><strong>2 × $1,250</strong></div>
          <div><span>$3,500 →</span><strong>2 × $1,750</strong></div>
        </div>
      </section>

      <section className="process-contact" id="process">
        <div className="process-side">
          <p className="eyebrow">OUR PROCESS</p>
          <h2>Easy. Professional.<br /><em>Completely handled.</em></h2>
          <div className="process-grid">
            {process.map(([number, title, description]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <div className="lower-grid">
            <article className="custom-card">
              <p className="eyebrow">LARGER PROJECTS?</p>
              <h3>Custom solutions are welcome.</h3>
              <p>E-commerce, booking systems, customer portals, catalogs and specialized integrations are available by custom quote.</p>
            </article>
            <article className="care-card">
              <p className="eyebrow">AFTER YEAR ONE</p>
              <h3>New Bern Websites Care</h3>
              <div><strong>$49</strong><span>/month</span></div>
              <p>Hosting · Domain renewal coordination · SSL · Security · Monitoring · Reasonable content updates</p>
            </article>
          </div>
        </div>
        <div className="form-card" id="contact">
          <p className="eyebrow light-eye">LET’S BUILD IT.</p>
          <h2>Start Your Website</h2>
          <p>Tell us a little about your business and we’ll be in touch.</p>
          <LeadForm />
          <div className="office">
            <span>NEW BERN OFFICE</span>
            <strong>1423 South Glenburnie Road, Suite C</strong>
            <small>New Bern, NC 28562</small>
          </div>
        </div>
      </section>

      <section className="local-banner">
        <div>
          <p className="eyebrow light-eye">PROUDLY LOCAL</p>
          <h2>Let’s build something great.</h2>
          <p>Your website. Our expertise. A stronger New Bern.</p>
        </div>
        <a href="#contact" className="button gold">Start Your Website <span aria-hidden="true">→</span></a>
      </section>

      <footer>
        <div className="footer-brand"><Brand /></div>
        <div><strong>Contact</strong><p>1423 South Glenburnie Road, Suite C<br />New Bern, NC 28562</p><p>newbernwebsites.com</p></div>
        <div><strong>Quick Links</strong><p><a href="#services">Services</a> · <a href="#pricing">Packages</a><br /><a href="#process">Process</a> · <a href="#contact">Contact</a></p></div>
        <div><strong>Local business. Local support.</strong><p>Serving New Bern and Eastern North Carolina.</p></div>
      </footer>
    </main>
  );
}
