export type CanonicalPlanTierId =
  | 'free_trial'
  | 'starter_monthly'
  | 'growth_monthly'
  | 'business_plus_monthly';

export interface PublicMembershipPlan {
  id: CanonicalPlanTierId;
  badge: string;
  name: string;
  audience: string;
  priceNzd: number;
  billingLabel: string;
  highlight?: boolean;
  limits: {
    maxCustomCases: number;
    coachMessagesPerMonth: number;
    documentAuditsPerMonth: number;
    recommendationsPerMonth: number;
  };
  features: string[];
}

export const PUBLIC_MEMBERSHIP_PLANS: PublicMembershipPlan[] = [
  {
    id: 'free_trial',
    badge: 'Free Starting Plan',
    name: 'Free Trial',
    audience: 'Test BizPulse on your real business before subscribing',
    priceNzd: 0,
    billingLabel: 'No card required',
    limits: {
      maxCustomCases: 1,
      coachMessagesPerMonth: 15,
      documentAuditsPerMonth: 2,
      recommendationsPerMonth: 3,
    },
    features: [
      '1 private business workspace (+ sample demo case)',
      '15 AI Coach & Challenge turns / month',
      '2 financial document audits / month',
      '3 diagnostic plans or continuity reviews / month',
      'Full 12-Capability scoring, CRM, ROI & exports',
    ],
  },
  {
    id: 'starter_monthly',
    badge: 'Starter',
    name: 'Starter Plan',
    audience: 'For sole operators and small trades/service businesses',
    priceNzd: 29,
    billingLabel: 'NZ$29 / month',
    limits: {
      maxCustomCases: 3,
      coachMessagesPerMonth: 35,
      documentAuditsPerMonth: 10,
      recommendationsPerMonth: 10,
    },
    features: [
      'Up to 3 active business workspaces',
      '35 AI Coach & Challenge turns / month',
      '10 financial document audits / month',
      '10 diagnostic plans or continuity reviews / month',
      'Weekly Pulse, Monthly Review, CRM, ROI & Exports',
    ],
  },
  {
    id: 'growth_monthly',
    badge: 'Most Popular',
    name: 'Growth Plan',
    audience: 'For growing SMEs (3–20 staff) running active monthly reviews',
    priceNzd: 59,
    billingLabel: 'NZ$59 / month',
    highlight: true,
    limits: {
      maxCustomCases: 10,
      coachMessagesPerMonth: 150,
      documentAuditsPerMonth: 40,
      recommendationsPerMonth: 30,
    },
    features: [
      'Up to 10 active business workspaces',
      '150 AI Coach & Challenge turns / month',
      '40 financial document audits / month',
      '30 diagnostic plans or continuity reviews / month',
      'Weekly Pulse, Monthly Review, CRM, ROI & Exports',
    ],
  },
  {
    id: 'business_plus_monthly',
    badge: 'Business Plus',
    name: 'Business Plus',
    audience: 'For multi-entity owners and high-cadence operators',
    priceNzd: 99,
    billingLabel: 'NZ$99 / month',
    limits: {
      maxCustomCases: 30,
      coachMessagesPerMonth: 500,
      documentAuditsPerMonth: 150,
      recommendationsPerMonth: 100,
    },
    features: [
      'Up to 30 active business workspaces',
      '500 AI Coach & Challenge turns / month',
      '150 financial document audits / month',
      '100 diagnostic plans or continuity reviews / month',
      'Expanded multi-entity continuity & AI usage tracking',
    ],
  },
];

export const MEMBERSHIP_BILLING_POLICIES = {
  currencyNotice:
    'All paid memberships are billed monthly in New Zealand Dollars (NZD).',
  gstNotice:
    'GST treatment is subject to final tax registration confirmation prior to public launch and will be clearly itemised on Stripe checkout invoices.',
  allowancePolicy:
    'If you reach a monthly AI allowance, all saved assessments, CRM contacts, ROI calculators, action plans, and PDF/Word/PowerPoint exports remain fully accessible. New AI runs resume on your monthly reset or upon upgrading.',
  cancellationPolicy:
    'Cancel anytime from Account & Billing. Paid memberships remain active until the end of the current paid monthly billing cycle with no lock-in contracts, after which your workspace returns safely to Free Trial limits without losing your saved data.',
};
