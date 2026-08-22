import type { Metadata } from 'next';
import styles from '../concept-sites.module.css';

export const metadata: Metadata = { title: 'Calico Creek Custom Homes | Concept by New Bern Websites', description: 'A custom home builder website concept created by New Bern Websites.' };

export default function CalicoCreekHomes() {
  return <main className={`${styles.shell} ${styles.builder}`}>
    <div className={styles.conceptBar}><span>Concept website created by New Bern Websites · Fictional business</span><a href="/#work">← Return to portfolio</a></div>
    <header className={styles.nav}><a className={styles.brand} href="#top">CALICO CREEK <small>CUSTOM HOMES</small></a><nav><a href="#homes">Homes</a><a href="#process">Process</a><a href="#about">Our Story</a><a className={styles.cta} href="#contact">Start a Conversation</a></nav></header>
    <section className={styles.hero} id="top"><div className={styles.heroInner}><p className={styles.eyebrow}>CUSTOM HOMES · COASTAL NORTH CAROLINA</p><h1>Built around<br/>the way you live.</h1><p>Thoughtful homes shaped by coastal light, honest materials, and the people who will call them home.</p><div className={styles.actions}><a className={styles.button} href="#homes">Explore Our Homes</a></div></div></section>
    <section className={styles.stats}><div><strong>24</strong><span>Years Building</span></div><div><strong>86</strong><span>Homes Completed</span></div><div><strong>12</strong><span>Coastal Communities</span></div><div><strong>1</strong><span>Dedicated Team</span></div></section>
    <section className={styles.section} id="homes"><div className={styles.sectionHead}><p className={styles.eyebrow}>SELECTED HOMES</p><h2>Architecture with a sense of place.</h2><p>Every Calico Creek home begins with the land, the view, and a clear understanding of how our clients want to live.</p></div><div className={styles.cards}>
      <article className={styles.card}><div className={styles.cardImage} style={{backgroundImage:'url(https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=85)'}}/><div className={styles.cardBody}><h3>The Trent River House</h3><p>Natural textures, generous porches, and uninterrupted views across the water.</p></div></article>
      <article className={styles.card}><div className={styles.cardImage} style={{backgroundImage:'url(https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1200&q=85)'}}/><div className={styles.cardBody}><h3>Pine Bluff Retreat</h3><p>A modern family home grounded in warm timber and quiet, enduring details.</p></div></article>
      <article className={styles.card}><div className={styles.cardImage} style={{backgroundImage:'url(https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=85)'}}/><div className={styles.cardBody}><h3>Olde Towne Revival</h3><p>Historic proportions reinterpreted for bright, effortless contemporary living.</p></div></article>
    </div></section>
    <section className={styles.split} id="process"><div className={styles.splitImage} style={{backgroundImage:'url(https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85)'}}/><div className={styles.splitCopy}><p className={styles.eyebrow}>OUR APPROACH</p><h2>A personal process, from first sketch to front door.</h2><p>We manage architecture, selections, construction, and communication as one coordinated experience. You always know what is happening, what comes next, and who to call.</p><ul className={styles.list}><li>Site and lifestyle discovery</li><li>Architectural planning and selections</li><li>Transparent project milestones</li><li>Craft-led construction and handoff</li></ul></div></section>
    <section className={styles.quote} id="about"><blockquote>“They didn’t simply build the house we described. They understood what we wanted our life here to feel like.”</blockquote><p>THE WILLIAMS FAMILY · RIVER BEND</p></section>
    <section className={styles.contact} id="contact"><div><p className={styles.eyebrow}>YOUR HOME STARTS HERE</p><h2>Let’s talk about the place you have in mind.</h2></div><a className={styles.button} href="/#contact">Schedule a Consultation</a></section>
    <footer className={styles.footer}><span>Calico Creek Custom Homes · New Bern, North Carolina</span><span>Concept build · Not a real business</span></footer>
  </main>;
}
