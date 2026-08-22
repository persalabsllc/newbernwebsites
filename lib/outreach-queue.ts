export type OutreachLead = {
  key: string;
  business: string;
  email: string;
  subject: string;
  body: string;
};

// Every address below was copied from the business's own public website.
// Keep this queue intentionally small while the new sending domain builds trust.
export const OUTREACH_QUEUE: OutreachLead[] = [
  {
    key: 'dlo-construction-2026-08',
    business: 'DLO Construction',
    email: 'dlocontractorsllc@gmail.com',
    subject: 'A quick website observation',
    body: [
      'Hi DLO Construction team,',
      '',
      'I was reviewing your online booking flow and noticed that several starting prices repeat and the request page still shows a 2035 footer with a third-party label. Those small details can make an otherwise strong contractor look less current right when a homeowner is deciding whether to request a quote.',
      '',
      'I run New Bern Websites locally. We rebuild service-business sites around a cleaner quote path, mobile clarity, and local search visibility.',
      '',
      "If improving that flow is already on your list, I can send a short outline of what I'd change.",
      '',
      'Kyle',
      'New Bern Websites',
    ].join('\r\n'),
  },
  {
    key: 'atlantic-coast-landscape-2026-08',
    business: 'Atlantic Coast Landscape',
    email: 'info@atlanticcoastlandscape.net',
    subject: 'Quick thought on your contact page',
    body: [
      'Hi Atlantic Coast Landscape team,',
      '',
      'I was looking through your site and noticed that the contact path asks prospects to complete a fairly long form plus image verification before they can reach you. On a phone, that extra friction can cost otherwise solid quote requests.',
      '',
      'I run New Bern Websites locally. We build service-business sites around a faster mobile quote path, clear proof of work, and local search visibility.',
      '',
      "If simplifying that path is useful, I can send a short outline of what I'd change.",
      '',
      'Kyle',
      'New Bern Websites',
    ].join('\r\n'),
  },
  {
    key: 'new-bern-referrals-2026-08',
    business: 'New Bern Business Referral Network',
    email: 'newbernreferrals@gmail.com',
    subject: 'Small issue on the NBBRN homepage',
    body: [
      'Hi NBBRN team,',
      '',
      'I noticed the live homepage is still showing placeholder testimonial copy and names such as “Founder of xyz.com.” Because the site represents a group of trusted local businesses, that section may be undercutting the credibility the rest of the organization has built.',
      '',
      'I run New Bern Websites locally. We help organizations clean up those trust gaps and make the path from visitor to inquiry much clearer.',
      '',
      "If it would help, I can send a short outline of the changes I'd prioritize.",
      '',
      'Kyle',
      'New Bern Websites',
    ].join('\r\n'),
  },
];
