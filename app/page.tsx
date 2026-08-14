const packages = [
  {
    name: "Turnkey Website",
    price: "$2,500",
    monthly: "$625/mo for 4 months",
    featured: false,
    description: "A complete business website from concept to launch. We handle the technical side from beginning to end.",
    items: [
      "Custom website design & development",
      "Domain setup & first-year hosting",
      "Mobile optimization",
      "Lead & contact forms",
      "Basic local SEO setup",
      "SSL, security & deployment",
    ],
  },
  {
    name: "Website + Professional Media",
    price: "$3,500",
    monthly: "$875/mo for 4 months",
    featured: true,
    description: "Everything in our turnkey package, plus we come to your business to capture the photography and video your site deserves.",
    items: [
      "Everything in Turnkey Website",
      "On-location photography",
      "Professional video capture",
      "Custom visual content for your website",
      "Authentic imagery of your team, space & work",
      "Launch-ready media library",
    ],
  },
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="New Bern Websites home">
          <span className="brand-mark">NB</span>
          <span className="brand-copy">
            <strong>New Bern</strong>
            <span>Websites</span>
          </span>
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#services">Services</a>
          <a href="#pricing">Pricing</a>
          <a href="#process">Process</a>
          <a href="#contact" className="nav-cta">Start Your Website</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-kicker">Built in New Bern. Built for New Bern.</div>
        <h1>
          Your business deserves a <em>better website.</em>
        </h1>
        <p className="hero-lead">
          Beautiful, high-end websites for local businesses — with the domain, hosting,
          design, development and launch handled for you.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href="#contact">Start Your Website</a>
          <a className="button button-ghost" href="#pricing">See Packages</a>
        </div>
        <div className="hero-note">Starting at <strong>$625/month</strong> with our simple payment plan.</div>
      </section>

      <section className="statement" id="services">
        <div className="eyebrow">We handle everything.</div>
        <h2>One local team. One polished digital presence.</h2>
        <p>
          You run your business. We handle the website — strategy, design, development,
          domain setup, hosting, launch and the details that usually turn a website project
          into a headache.
        </p>
        <div className="service-grid">
          {[
            ["01", "Design & Development", "Custom-built websites designed around your business, not a generic template."],
            ["02", "Domain & Hosting", "We connect the domain, configure hosting, SSL and launch infrastructure."],
            ["03", "Photography & Video", "Choose our full media package and we come to you to capture the real business."],
            ["04", "Local SEO Foundations", "Technical and on-page basics to help search engines understand where you are and what you do."],
          ].map(([number, title, text]) => (
            <article className="service-card" key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <div className="section-heading">
          <div className="eyebrow">Simple pricing</div>
          <h2>Choose how hands-off you want to be.</h2>
          <p>No mystery retainers. No confusing menu of technical services. Pick the level that fits your business and we take it from there.</p>
        </div>
        <div className="pricing-grid">
          {packages.map((pkg) => (
            <article className={`pricing-card ${pkg.featured ? "featured" : ""}`} key={pkg.name}>
              {pkg.featured && <div className="popular">Most Popular</div>}
              <h3>{pkg.name}</h3>
              <div className="price">{pkg.price}</div>
              <div className="monthly">or {pkg.monthly}</div>
              <p>{pkg.description}</p>
              <ul>
                {pkg.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <a className="button button-primary full" href="#contact">Choose This Package</a>
            </article>
          ))}
        </div>

        <div className="radio-card">
          <div>
            <div className="eyebrow">Optional local launch boost</div>
            <h3>Add 3 months on Captain 97.1 for $500.</h3>
            <p>Don&apos;t just launch your new website. Tell New Bern about it with a three-month radio campaign on Captain 97.1.</p>
          </div>
          <div className="radio-price">+$500</div>
        </div>
      </section>

      <section className="payment-section">
        <div>
          <div className="eyebrow">Simple payment plan</div>
          <h2>A premium website without one big upfront bill.</h2>
        </div>
        <div className="payment-copy">
          <p>Start with 25% when your project begins. The remaining 75% is split over the following three months.</p>
          <div className="payment-example">
            <span>$2,500 website</span>
            <strong>4 payments of $625</strong>
          </div>
          <div className="payment-example">
            <span>$3,500 website + media</span>
            <strong>4 payments of $875</strong>
          </div>
        </div>
      </section>

      <section className="process" id="process">
        <div className="section-heading light">
          <div className="eyebrow">Our process</div>
          <h2>From “we need a website” to live.</h2>
        </div>
        <div className="process-grid">
          {[
            ["01", "Tell us about your business", "We learn what you do, who you serve and what the website needs to accomplish."],
            ["02", "We build the foundation", "We organize the structure, messaging, design direction, domain and hosting."],
            ["03", "We create", "Your site is designed and developed. Media-package clients get an on-location photo and video session."],
            ["04", "We launch", "We complete final checks, connect the domain and put your new website live."],
          ].map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="custom-projects">
        <div className="eyebrow">Need something bigger?</div>
        <h2>Custom projects are welcome.</h2>
        <p>E-commerce, booking systems, customer portals, advanced integrations, larger catalogs and specialized builds are available by custom quote.</p>
      </section>

      <section className="contact" id="contact">
        <div>
          <div className="eyebrow">Let&apos;s build it.</div>
          <h2>Ready for a website that represents your business properly?</h2>
          <p>Tell us a little about your business and the kind of website you have in mind. We&apos;ll take it from there.</p>
        </div>
        <form className="lead-form" action="mailto:hello@newbernwebsites.com" method="post" encType="text/plain">
          <label>
            Your name
            <input name="name" type="text" placeholder="Your name" required />
          </label>
          <label>
            Business name
            <input name="business" type="text" placeholder="Business name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="you@business.com" required />
          </label>
          <label>
            What do you need?
            <textarea name="project" rows={5} placeholder="Tell us about your business and what you want the new website to do." />
          </label>
          <button className="button button-primary full" type="submit">Start Your Website</button>
        </form>
      </section>

      <footer>
        <div className="footer-brand">
          <strong>New Bern Websites</strong>
          <span>We Handle Everything.</span>
        </div>
        <div className="footer-right">
          <span>New Bern, North Carolina</span>
          <span>newbernwebsites.com</span>
        </div>
      </footer>
    </main>
  );
}
