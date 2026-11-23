export interface RoadmapPillar {
  number: string;
  id: string;
  title: string;
  tagline: string;
  description: string;
  releaseStatus: string;
  capabilities: string[];
  availableNowLabel?: string;
  availableNowTab?: string;
}

export const BIZPULSE_VISION = {
  headline: 'BizPulse – From Business Clarity to Business Growth',
  subheading: 'Gain Clarity. Shape Your Future, Here and Now.',
  introParagraphs: [
    'BizPulse is an AI-powered Business Health, Growth & Development Platform designed to help small and growing businesses make better decisions, identify opportunities and build sustainable performance.',
    "Our journey doesn't stop at understanding the health of your business. Basic CRM, sales pipeline follow-ups, ROI & break-even modeling, and connected business development are integrated directly into your active workspace today.",
  ],
  commitmentTitle: 'Our Commitment',
  commitmentParagraphs: [
    'BizPulse continues to evolve in response to the real challenges and needs of small businesses.',
    'Our approach is practical and progressive: keep Business Health connected to customer relationships, financial ROI, and practical growth execution — then expand automation responsibly in future releases.',
  ],
  ambitionLead: 'The ambition is simple:',
  ambitionStatement:
    'Help business owners understand where they stand today, manage customer relationships and opportunities systematically, evaluate financial ROI transparently, and execute sustainable growth.',
  disclaimer:
    'Release 1 includes live Basic CRM, pipeline tracking, editable ROI & break-even modeling, and AI-assisted business development. Advanced multi-channel automation and external accounting/CRM syncing are planned for Phase 2 releases.',
};

export const GROWTH_ROADMAP_PILLARS: RoadmapPillar[] = [
  {
    number: '01',
    id: 'crm',
    title: 'CRM & Customer Relationships',
    tagline: 'Build stronger customer relationships.',
    releaseStatus: 'Active in Release 1',
    description:
      'A simple, practical customer relationship management system integrated directly with your Business Health and portfolio margin matrix.',
    capabilities: [
      'Customer, prospect, lead and partner records',
      'Contact details and timestamped interaction history',
      'Customer tier classification and concentration link',
      'Opportunity and monthly recurring value tracking',
      'Per-business isolated workspace persistence',
    ],
    availableNowLabel: 'Open CRM & Clients',
    availableNowTab: 'clientmatrix',
  },
  {
    number: '02',
    id: 'lead-gen',
    title: 'AI-Assisted Lead Generation',
    tagline: 'Discover where your next customers could come from.',
    releaseStatus: 'Active in Release 1',
    description:
      'Intelligent business development planning connected to your health scores, financials, and CRM pipeline to generate tailored prospecting strategies and outreach drafts.',
    capabilities: [
      'Health- & CRM-grounded ideal customer profiling',
      'Target-market and partnership opportunities',
      'Priority follow-up triage for due/at-risk accounts',
      'Personalised prospecting messages & AI Coach scripts',
      'Phase 2: Automated multi-channel campaign tracking',
    ],
    availableNowLabel: 'Open Business Development & CRM',
    availableNowTab: 'clientmatrix',
  },
  {
    number: '03',
    id: 'pipeline',
    title: 'Lead Follow-up & Sales Pipeline',
    tagline: 'Turn opportunities into customers.',
    releaseStatus: 'Active in Release 1',
    description:
      'A structured way to track enquiries, follow-up dates, sales stages, and overdue follow-up alerts across your CRM and Monday Scoreboard.',
    capabilities: [
      'Follow-up dates & overdue reminder alerts',
      'Interaction logging (Calls, Emails, Meetings, Proposals)',
      'Sales stage progression (Lead → Qualified → Proposal → Won/Lost)',
      'Active pipeline value & follow-up KPIs on Scoreboard',
      'Phase 2: Automated calendar & email reminder triggers',
    ],
    availableNowLabel: 'Review Pipeline & Scoreboard',
    availableNowTab: 'dashboard',
  },
  {
    number: '04',
    id: 'bizdev',
    title: 'ROI & Financial Analysis Toolkit',
    tagline: 'Evaluate opportunities with transparent numbers.',
    releaseStatus: 'Active in Release 1',
    description:
      'Editable ROI calculator, break-even analysis, and revenue/margin sensitivity modeling linked directly to CRM opportunities and Cash Flow liquidity.',
    capabilities: [
      'Editable ROI %, payback period & net benefit calculator',
      'Transparent formulas & break-even monthly revenue checks',
      'Conservative / Base / Optimistic margin sensitivity matrix',
      'Liquidity guardrail against bank cash & overdraft headroom',
      'One-click evaluation of CRM opportunities & AI stress-testing',
    ],
    availableNowLabel: 'Open ROI & Options Workbench',
    availableNowTab: 'options',
  },
];

