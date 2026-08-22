export type MarketPage = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  audience: string;
  localNote: string;
  opportunities: Array<{ title: string; detail: string }>;
};

const location = (slug: string, city: string, note: string): MarketPage => ({
  slug,
  eyebrow: `WEB DESIGN FOR ${city.toUpperCase()}`,
  title: `Professional websites for ${city} businesses.`,
  description: `New Bern Websites builds complete, conversion-focused websites for businesses in ${city} and across Eastern North Carolina—with the design, copy, mobile experience, hosting, and launch handled for you.`,
  audience: `${city} service companies, professional practices, retailers, restaurants, builders, and locally owned businesses`,
  localNote: note,
  opportunities: [
    { title: 'Win the local search', detail: `Clear ${city}-specific service content helps nearby customers understand where you work and why they should contact you.` },
    { title: 'Turn mobile visits into calls', detail: 'Fast pages, obvious services, and direct calls to action make it easier for a prospect to take the next step.' },
    { title: 'Look established immediately', detail: 'Professional design, authentic messaging, and strong proof help local buyers trust the business before the first conversation.' },
  ],
});

export const marketPages: MarketPage[] = [
  location('new-bern', 'New Bern', 'Local service, local support, and one month of Captain 97.1 underwriting included with every website.'),
  location('kinston', 'Kinston', 'A practical website partner for Lenoir County businesses that need a stronger digital storefront and a clearer lead path.'),
  location('havelock', 'Havelock', 'Built for businesses serving Havelock, Cherry Point, military families, and the surrounding coastal market.'),
  location('morehead-city', 'Morehead City', 'Website design shaped for Carteret County businesses, coastal services, hospitality, marine work, and professional practices.'),
  location('jacksonville', 'Jacksonville', 'Conversion-focused websites for businesses serving Jacksonville, Camp Lejeune, and Onslow County.'),
  location('greenville', 'Greenville', 'Professional websites for growing Pitt County businesses that need stronger positioning, better mobile performance, and more qualified inquiries.'),
  location('washington', 'Washington', 'Local website design for Washington and Beaufort County businesses serving customers along the Inner Banks.'),
  location('goldsboro', 'Goldsboro', 'Complete website design for Goldsboro and Wayne County businesses—with simple fixed pricing and no technical handoffs.'),
  {
    slug: 'contractors',
    eyebrow: 'WEBSITES FOR CONTRACTORS',
    title: 'Turn completed work into the next qualified project.',
    description: 'We build contractor websites around service areas, project proof, mobile quote requests, and the questions homeowners ask before they call.',
    audience: 'general contractors, roofers, remodelers, electricians, plumbers, HVAC companies, landscapers, and specialty trades',
    localNote: 'The goal is not more anonymous traffic. It is more calls and quote requests from customers you actually want.',
    opportunities: [
      { title: 'Project proof', detail: 'Organize finished work into convincing galleries and case studies instead of leaving it buried on social media.' },
      { title: 'Service-area visibility', detail: 'Give every priority service and market a clear search path without producing thin, repetitive pages.' },
      { title: 'Faster quote requests', detail: 'Make it easy to call, describe the project, and share the information needed for a productive first conversation.' },
    ],
  },
  {
    slug: 'marine-businesses',
    eyebrow: 'WEBSITES FOR MARINE BUSINESSES',
    title: 'A coastal website built to earn waterfront work.',
    description: 'We create high-trust websites for marine construction, boat services, marinas, dealers, charter companies, and waterfront businesses across Eastern North Carolina.',
    audience: 'bulkhead contractors, dock builders, boat lifts, marinas, boat services, dealers, charter operators, and waterfront specialists',
    localNote: 'Marine customers buy confidence. Strong project imagery and a clear explanation of the work matter as much as the service list.',
    opportunities: [
      { title: 'Show the actual work', detail: 'Use waterfront project imagery, materials, equipment, and results to establish capability immediately.' },
      { title: 'Explain specialized services', detail: 'Give bulkheads, docks, lifts, repairs, and permitting their own clear paths instead of compressing everything into one paragraph.' },
      { title: 'Capture coastal searches', detail: 'Connect each service to the communities, waterways, and counties the business serves.' },
    ],
  },
  {
    slug: 'home-builders',
    eyebrow: 'WEBSITES FOR HOME BUILDERS',
    title: 'Make the quality of the website match the quality of the homes.',
    description: 'We build refined websites for custom builders and remodelers with project storytelling, an intentional consultation path, and room for the details that distinguish the work.',
    audience: 'custom home builders, residential contractors, remodelers, architects, designers, and design-build firms',
    localNote: 'A high-value project starts with trust. The website should make the process, experience, and finished work feel credible before the first meeting.',
    opportunities: [
      { title: 'Curated portfolios', detail: 'Present fewer, stronger projects with context about the scope, decisions, and finished result.' },
      { title: 'A better consultation path', detail: 'Set expectations and collect the right project details without making the first inquiry feel like paperwork.' },
      { title: 'Premium positioning', detail: 'Use typography, photography, pacing, and copy that support the value of a custom build.' },
    ],
  },
  {
    slug: 'restaurants',
    eyebrow: 'WEBSITES FOR RESTAURANTS',
    title: 'Help hungry customers decide—and act—faster.',
    description: 'We build mobile-first restaurant websites that put the menu, hours, directions, reservations, catering, and atmosphere exactly where customers expect them.',
    audience: 'restaurants, cafés, breweries, bars, food trucks, caterers, and hospitality businesses',
    localNote: 'Most restaurant visits begin on a phone. The essentials should be obvious in seconds, not hidden behind a PDF or a social feed.',
    opportunities: [
      { title: 'Mobile essentials first', detail: 'Surface the menu, hours, location, phone number, and reservation or ordering path without unnecessary searching.' },
      { title: 'Authentic food and atmosphere', detail: 'Professional on-location media helps customers understand the experience before they arrive.' },
      { title: 'Own the customer relationship', detail: 'Use the website to promote events, catering, gift cards, and updates without depending entirely on third-party platforms.' },
    ],
  },
];

export function getMarketPage(slug: string) {
  return marketPages.find(page => page.slug === slug);
}
