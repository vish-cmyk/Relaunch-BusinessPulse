export interface RoadmapPillar {
  number: string;
  id: string;
  title: string;
  tagline: string;
  description: string;
  capabilities: string[];
  availableNowLabel?: string;
  availableNowTab?: string;
}

export const BIZPULSE_VISION = {
  headline: 'BizPulse – From Business Clarity to Business Growth',
  subheading: 'Gain Clarity. Shape Your Future, Here and Now.',
  introParagraphs: [
    'BizPulse is evolving into an AI-powered Business Health, Growth & Development Platform designed to help small and growing businesses make better decisions, identify opportunities and build sustainable performance.',
    "Our journey doesn't stop at understanding the health of your business. We aim to help you turn insights into practical actions, stronger customer relationships and new revenue opportunities.",
  ],
  commitmentTitle: 'Our Commitment',
  commitmentParagraphs: [
    'BizPulse will continue to evolve in response to the real challenges and needs of small businesses.',
    'Our approach is practical and progressive: introduce useful capabilities, learn from business owners, improve the experience and expand the platform responsibly.',
  ],
  ambitionLead: 'The ambition is simple:',
  ambitionStatement:
    'Help business owners understand where they stand today, recognise where they can improve, and identify what they can do next to build a stronger and more sustainable business.',
  disclaimer:
    'Roadmap features are planned for future releases. Availability, scope and sequencing may evolve as BizPulse develops.',
};

export const GROWTH_ROADMAP_PILLARS: RoadmapPillar[] = [
  {
    number: '01',
    id: 'crm',
    title: 'CRM & Customer Relationships',
    tagline: 'Build stronger customer relationships.',
    description:
      'A simple, practical customer relationship management system to help business owners organise customer and prospect information, understand their relationships and manage business opportunities.',
    capabilities: [
      'Customer and prospect records',
      'Contact and interaction history',
      'Customer classification and segmentation',
      'Opportunity and potential-value tracking',
      'Centralised customer relationship information',
    ],
    availableNowLabel: 'Explore Client Matrix Today',
    availableNowTab: 'clientmatrix',
  },
  {
    number: '02',
    id: 'lead-gen',
    title: 'AI-Assisted Lead Generation',
    tagline: 'Discover where your next customers could come from.',
    description:
      'Intelligent assistance to help businesses identify potential customers, explore target markets and develop practical prospecting strategies.',
    capabilities: [
      'Ideal customer profiling',
      'Target-market and industry opportunities',
      'Referral and partnership ideas',
      'Lead-generation campaigns',
      'Personalised prospecting messages and outreach suggestions',
    ],
    availableNowLabel: 'Draft Outreach in AI Coach',
    availableNowTab: 'aicoach',
  },
  {
    number: '03',
    id: 'pipeline',
    title: 'Lead Follow-up & Sales Pipeline',
    tagline: 'Turn opportunities into customers.',
    description:
      'A structured way to manage enquiries, follow-ups and potential business, helping owners avoid missed opportunities and maintain consistent customer engagement.',
    capabilities: [
      'Follow-up schedules and reminders',
      'Contact and activity tracking',
      'Enquiry and proposal monitoring',
      'Sales pipeline management',
      'Won, lost and dormant opportunity tracking',
      'Lead conversion insights',
    ],
    availableNowLabel: 'Review Weekly Scoreboard',
    availableNowTab: 'dashboard',
  },
  {
    number: '04',
    id: 'bizdev',
    title: 'Business Development Toolkit',
    tagline: 'Find new ways to improve revenue and profitability.',
    description:
      'A growing collection of practical tools to support better commercial decisions and business development.',
    capabilities: [
      'ROI and investment analysis',
      'Proposal and quotation assistance',
      'Revenue and profit opportunity identification',
      'Customer retention strategies',
      'Upselling and cross-selling opportunities',
      'Pricing and profitability insights',
      'Business development planning',
    ],
    availableNowLabel: 'Open Options & Cash Flow Tools',
    availableNowTab: 'options',
  },
];
