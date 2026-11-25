import {
  KpiBusinessTypePreset,
  KpiCategoryId,
  KpiDirection,
  KpiUnitType,
} from '../types/bizpulse';

export interface KpiCategoryMeta {
  id: KpiCategoryId;
  code: string;
  label: string;
  description: string;
}

export interface KpiInputFieldSpec {
  key: string;
  label: string;
  unit: KpiUnitType;
}

export interface KpiCatalogDefinition {
  catalogKey: string;
  name: string;
  category: KpiCategoryId;
  categoryLabel: string;
  explanation: string;
  unit: KpiUnitType;
  direction: KpiDirection;
  formulaType: string;
  formulaDescription: string;
  reviewCadenceDays: number;
  inputFields: KpiInputFieldSpec[];
}

export interface BusinessTypePresetMeta {
  id: KpiBusinessTypePreset;
  label: string;
  description: string;
  defaultKpiKeys: string[];
}

export const KPI_CATEGORIES: KpiCategoryMeta[] = [
  {
    id: 'revenue_sales',
    code: 'A',
    label: 'A. Revenue and Sales',
    description: 'Top-line run rate, sales pipeline conversion, job sizing, and repeat demand.',
  },
  {
    id: 'profitability',
    code: 'B',
    label: 'B. Profitability',
    description: 'Gross margin, net profitability, overhead ratio, and pricing power.',
  },
  {
    id: 'cash_flow',
    code: 'C',
    label: 'C. Cash Flow',
    description: 'Bank liquidity, debtor collection speed, overdue exposure, and forecast discipline.',
  },
  {
    id: 'customers',
    code: 'D',
    label: 'D. Customers',
    description: 'Client retention, concentration risk, acquisition cost, and service satisfaction.',
  },
  {
    id: 'operational_efficiency',
    code: 'E',
    label: 'E. Operational Efficiency',
    description: 'Team utilisation, revenue per head, rework control, delivery timeliness, and leakage.',
  },
  {
    id: 'growth_sustainability',
    code: 'F',
    label: 'F. Growth and Sustainability',
    description: 'Capital return, recurring base, dependency resilience, and business continuity.',
  },
];

export const KPI_CATALOG: KpiCatalogDefinition[] = [
  // A. Revenue and Sales
  {
    catalogKey: 'monthly_revenue',
    name: 'Monthly Revenue',
    category: 'revenue_sales',
    categoryLabel: 'A. Revenue and Sales',
    explanation: 'Tracks total invoiced sales generated per month against breakeven and growth targets.',
    unit: 'currency',
    direction: 'higher_is_better',
    formulaType: 'manual_or_case',
    formulaDescription: 'Monthly invoiced revenue (auto-synced as Annual Revenue / 12 when ledger is provided).',
    reviewCadenceDays: 30,
    inputFields: [{ key: 'monthlyRevenue', label: 'Monthly Revenue', unit: 'currency' }],
  },
  {
    catalogKey: 'revenue_growth_pct',
    name: 'Revenue Growth Percentage',
    category: 'revenue_sales',
    categoryLabel: 'A. Revenue and Sales',
    explanation: 'Measures period-on-period top-line expansion or contraction across comparable periods.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'revenue_growth',
    formulaDescription: '((Current Revenue − Previous Revenue) / Previous Revenue) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'currentRevenue', label: 'Current Period Revenue', unit: 'currency' },
      { key: 'previousRevenue', label: 'Previous Period Revenue', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'enquiry_conversion_rate',
    name: 'Enquiry-to-Customer Conversion Rate',
    category: 'revenue_sales',
    categoryLabel: 'A. Revenue and Sales',
    explanation: 'Shows what percentage of qualified quotes or enquiries convert into paying work.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'conversion_rate',
    formulaDescription: '(Won Customers / Total Qualified Enquiries) × 100',
    reviewCadenceDays: 14,
    inputFields: [
      { key: 'wonCustomers', label: 'Won Customers / Quotes Accepted', unit: 'number' },
      { key: 'totalEnquiries', label: 'Total Qualified Enquiries', unit: 'number' },
    ],
  },
  {
    catalogKey: 'avg_transaction_value',
    name: 'Average Transaction or Job Value',
    category: 'revenue_sales',
    categoryLabel: 'A. Revenue and Sales',
    explanation: 'Reveals whether job sizing, bundling, or scope management is lifting or eroding average order value.',
    unit: 'currency',
    direction: 'higher_is_better',
    formulaType: 'avg_transaction_value',
    formulaDescription: 'Total Period Revenue / Total Completed Jobs or Transactions',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'totalRevenue', label: 'Period Revenue', unit: 'currency' },
      { key: 'jobCount', label: 'Number of Jobs / Transactions', unit: 'number' },
    ],
  },
  {
    catalogKey: 'repeat_business_pct',
    name: 'Repeat Business Percentage',
    category: 'revenue_sales',
    categoryLabel: 'A. Revenue and Sales',
    explanation: 'Tracks how much revenue comes from existing clients rather than constantly hunting new leads.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'repeat_business_pct',
    formulaDescription: '(Repeat Customer Revenue / Total Period Revenue) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'repeatRevenue', label: 'Revenue from Existing Customers', unit: 'currency' },
      { key: 'totalRevenue', label: 'Total Period Revenue', unit: 'currency' },
    ],
  },

  // B. Profitability
  {
    catalogKey: 'gross_profit_margin',
    name: 'Gross Profit Margin',
    category: 'profitability',
    categoryLabel: 'B. Profitability',
    explanation: 'Measures profit left after direct materials, labour, and subcontractor costs to cover overheads.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'gross_margin',
    formulaDescription: '((Revenue − Direct Costs) / Revenue) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'revenue', label: 'Revenue', unit: 'currency' },
      { key: 'directCosts', label: 'Direct Costs (COGS / Job Labour)', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'net_profit_margin',
    name: 'Net Profit Margin',
    category: 'profitability',
    categoryLabel: 'B. Profitability',
    explanation: 'Tracks true bottom-line earnings retained from every dollar of revenue after all operating costs.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'net_margin',
    formulaDescription: '(Net Profit / Revenue) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'netProfit', label: 'Net / Operating Profit', unit: 'currency' },
      { key: 'revenue', label: 'Revenue', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'contribution_per_job',
    name: 'Contribution per Job or Service',
    category: 'profitability',
    categoryLabel: 'B. Profitability',
    explanation: 'Measures average gross dollar margin contributed by each completed job or service engagement.',
    unit: 'currency',
    direction: 'higher_is_better',
    formulaType: 'contribution_per_job',
    formulaDescription: '(Period Revenue − Direct Costs) / Completed Jobs or Services',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'revenue', label: 'Period Revenue', unit: 'currency' },
      { key: 'directCosts', label: 'Direct Job Costs', unit: 'currency' },
      { key: 'jobCount', label: 'Completed Jobs / Services', unit: 'number' },
    ],
  },
  {
    catalogKey: 'opex_pct_revenue',
    name: 'Operating Expenses as a Percentage of Revenue',
    category: 'profitability',
    categoryLabel: 'B. Profitability',
    explanation: 'Monitors overhead discipline so rent, admin, software, and indirect payroll do not outgrow sales.',
    unit: 'percent',
    direction: 'lower_is_better',
    formulaType: 'opex_pct',
    formulaDescription: '(Operating Expenses / Revenue) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'operatingExpenses', label: 'Operating Expenses', unit: 'currency' },
      { key: 'revenue', label: 'Revenue', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'pricing_effectiveness',
    name: 'Pricing Effectiveness',
    category: 'profitability',
    categoryLabel: 'B. Profitability',
    explanation: 'Compares realised billing/margin against quoted rates to expose discounting and scope erosion.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'pricing_effectiveness',
    formulaDescription: '(Realised Revenue or Rate / Standard Quoted Value) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'realisedValue', label: 'Actual Invoiced / Realised Value', unit: 'currency' },
      { key: 'quotedValue', label: 'Standard Quoted / Target Value', unit: 'currency' },
    ],
  },

  // C. Cash Flow
  {
    catalogKey: 'available_cash',
    name: 'Available Cash',
    category: 'cash_flow',
    categoryLabel: 'C. Cash Flow',
    explanation: 'Tracks cleared cash reserves immediately available to fund payroll, tax, and supplier bills.',
    unit: 'currency',
    direction: 'higher_is_better',
    formulaType: 'manual_or_case',
    formulaDescription: 'Cleared cash at bank (synced from Cash Flow Ledger when recorded).',
    reviewCadenceDays: 7,
    inputFields: [{ key: 'cashInBank', label: 'Cleared Cash in Bank', unit: 'currency' }],
  },
  {
    catalogKey: 'accounts_receivable',
    name: 'Accounts Receivable',
    category: 'cash_flow',
    categoryLabel: 'C. Cash Flow',
    explanation: 'Total unpaid customer invoices currently tied up outside your bank account.',
    unit: 'currency',
    direction: 'lower_is_better',
    formulaType: 'manual_or_case',
    formulaDescription: 'Total open customer debtors ledger balance.',
    reviewCadenceDays: 7,
    inputFields: [{ key: 'accountsReceivable', label: 'Accounts Receivable Balance', unit: 'currency' }],
  },
  {
    catalogKey: 'overdue_receivables',
    name: 'Overdue Receivables',
    category: 'cash_flow',
    categoryLabel: 'C. Cash Flow',
    explanation: 'Measures aged customer invoices past agreed payment terms that directly strain working capital.',
    unit: 'currency',
    direction: 'lower_is_better',
    formulaType: 'manual_or_case',
    formulaDescription: 'Customer invoices past payment terms (e.g. >30–60 days overdue).',
    reviewCadenceDays: 7,
    inputFields: [{ key: 'overdueReceivables', label: 'Overdue Receivables', unit: 'currency' }],
  },
  {
    catalogKey: 'average_debtor_days',
    name: 'Average Debtor Days',
    category: 'cash_flow',
    categoryLabel: 'C. Cash Flow',
    explanation: 'Shows how many days on average customers take to pay after an invoice is issued.',
    unit: 'days',
    direction: 'lower_is_better',
    formulaType: 'debtor_days',
    formulaDescription: '(Accounts Receivable / Annual Revenue) × 365 (or reported actual collection delay days)',
    reviewCadenceDays: 14,
    inputFields: [
      { key: 'accountsReceivable', label: 'Accounts Receivable', unit: 'currency' },
      { key: 'annualRevenue', label: 'Annualised Revenue', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'accounts_payable',
    name: 'Accounts Payable',
    category: 'cash_flow',
    categoryLabel: 'C. Cash Flow',
    explanation: 'Tracks near-term supplier and tax obligations due to ensure cash headroom covers commitments.',
    unit: 'currency',
    direction: 'lower_is_better',
    formulaType: 'manual_or_case',
    formulaDescription: 'Total unpaid supplier bills and short-term payables.',
    reviewCadenceDays: 7,
    inputFields: [{ key: 'accountsPayable', label: 'Accounts Payable Balance', unit: 'currency' }],
  },
  {
    catalogKey: 'cashflow_forecast_accuracy',
    name: 'Cash-Flow Forecast Accuracy',
    category: 'cash_flow',
    categoryLabel: 'C. Cash Flow',
    explanation: 'Checks how closely actual monthly cash movement matched your rolling cash forecast.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'forecast_accuracy',
    formulaDescription: '100 − (|Actual Closing Cash − Forecast Closing Cash| / |Forecast Closing Cash|) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'actualCash', label: 'Actual Closing Cash', unit: 'currency' },
      { key: 'forecastCash', label: 'Forecast Closing Cash', unit: 'currency' },
    ],
  },

  // D. Customers
  {
    catalogKey: 'customer_retention',
    name: 'Customer Retention',
    category: 'customers',
    categoryLabel: 'D. Customers',
    explanation: 'Measures the percentage of starting customers retained across the review period.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'customer_retention',
    formulaDescription: '((Customers at End − New Customers Acquired) / Customers at Start) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'customersAtEnd', label: 'Customers at End of Period', unit: 'number' },
      { key: 'newCustomersAcquired', label: 'New Customers Acquired', unit: 'number' },
      { key: 'customersAtStart', label: 'Customers at Start of Period', unit: 'number' },
    ],
  },
  {
    catalogKey: 'customer_concentration',
    name: 'Customer Concentration',
    category: 'customers',
    categoryLabel: 'D. Customers',
    explanation: 'Tracks share of total revenue held by your top 5 clients—high concentration creates sudden shock risk.',
    unit: 'percent',
    direction: 'lower_is_better',
    formulaType: 'customer_concentration',
    formulaDescription: '(Top-5 Customer Revenue / Total Revenue) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'topClientsRevenue', label: 'Top-5 Clients Revenue', unit: 'currency' },
      { key: 'totalRevenue', label: 'Total Revenue', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'customer_acquisition_cost',
    name: 'Customer Acquisition Cost',
    category: 'customers',
    categoryLabel: 'D. Customers',
    explanation: 'Measures total sales and marketing outlay required to win each new paying customer.',
    unit: 'currency',
    direction: 'lower_is_better',
    formulaType: 'cac',
    formulaDescription: 'Total Sales & Marketing Spend / New Customers Acquired',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'salesMarketingSpend', label: 'Sales & Marketing Spend', unit: 'currency' },
      { key: 'newCustomersAcquired', label: 'New Customers Acquired', unit: 'number' },
    ],
  },
  {
    catalogKey: 'customer_satisfaction',
    name: 'Customer Complaints or Satisfaction',
    category: 'customers',
    categoryLabel: 'D. Customers',
    explanation: 'Logs client satisfaction score or open quality complaints so churn signals are caught early.',
    unit: 'score',
    direction: 'higher_is_better',
    formulaType: 'manual',
    formulaDescription: 'Owner-recorded client satisfaction / CSAT score (0–100 scale) or review rating.',
    reviewCadenceDays: 30,
    inputFields: [{ key: 'satisfactionScore', label: 'Customer Satisfaction Score (0–100)', unit: 'score' }],
  },

  // E. Operational Efficiency
  {
    catalogKey: 'staff_utilisation',
    name: 'Staff Utilisation',
    category: 'operational_efficiency',
    categoryLabel: 'E. Operational Efficiency',
    explanation: 'Measures how much paid team capacity converts into billable or productive client delivery.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'staff_utilisation',
    formulaDescription: '(Productive Hours / Available Working Hours) × 100',
    reviewCadenceDays: 14,
    inputFields: [
      { key: 'productiveHours', label: 'Productive / Billable Hours', unit: 'hours' },
      { key: 'availableHours', label: 'Available Working Hours', unit: 'hours' },
    ],
  },
  {
    catalogKey: 'revenue_per_employee',
    name: 'Revenue per Employee',
    category: 'operational_efficiency',
    categoryLabel: 'E. Operational Efficiency',
    explanation: 'Tracks annualised revenue generated per team member to spot overstaffing or pricing drag.',
    unit: 'currency',
    direction: 'higher_is_better',
    formulaType: 'revenue_per_employee',
    formulaDescription: 'Annualised Revenue / Total Active Team (Staff + Subcontractors)',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'annualRevenue', label: 'Annualised Revenue', unit: 'currency' },
      { key: 'teamCount', label: 'Active Staff & Subcontractors', unit: 'number' },
    ],
  },
  {
    catalogKey: 'rework_wastage',
    name: 'Rework and Wastage',
    category: 'operational_efficiency',
    categoryLabel: 'E. Operational Efficiency',
    explanation: 'Quantifies call-backs, scrap, defects, or repeat fixes as a share of delivery cost or hours.',
    unit: 'percent',
    direction: 'lower_is_better',
    formulaType: 'rework_pct',
    formulaDescription: '(Rework Hours or Cost / Total Delivery Hours or Cost) × 100',
    reviewCadenceDays: 14,
    inputFields: [
      { key: 'reworkAmount', label: 'Rework / Wastage Hours or Cost', unit: 'number' },
      { key: 'totalAmount', label: 'Total Delivery Hours or Cost', unit: 'number' },
    ],
  },
  {
    catalogKey: 'on_time_delivery',
    name: 'On-Time Delivery',
    category: 'operational_efficiency',
    categoryLabel: 'E. Operational Efficiency',
    explanation: 'Tracks percentage of jobs, projects, or SLA commitments completed by the promised date.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'on_time_pct',
    formulaDescription: '(Jobs Delivered On Time / Total Completed Jobs) × 100',
    reviewCadenceDays: 14,
    inputFields: [
      { key: 'onTimeJobs', label: 'Jobs Delivered On Time', unit: 'number' },
      { key: 'totalJobs', label: 'Total Completed Jobs', unit: 'number' },
    ],
  },
  {
    catalogKey: 'unbilled_work_hours',
    name: 'Unbilled Work or Service Hours',
    category: 'operational_efficiency',
    categoryLabel: 'E. Operational Efficiency',
    explanation: 'Captures scope creep, uninvoiced variations, and absorbed technician hours eroding margin.',
    unit: 'hours',
    direction: 'lower_is_better',
    formulaType: 'manual',
    formulaDescription: 'Total monthly hours worked for clients that were written off or never billed.',
    reviewCadenceDays: 14,
    inputFields: [{ key: 'unbilledHours', label: 'Unbilled Service / Variation Hours', unit: 'hours' }],
  },

  // F. Growth and Sustainability
  {
    catalogKey: 'return_on_investment',
    name: 'Return on Investment',
    category: 'growth_sustainability',
    categoryLabel: 'F. Growth and Sustainability',
    explanation: 'Evaluates net financial return earned on new equipment, hires, marketing, or expansion initiatives.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'roi_pct',
    formulaDescription: '(Net Financial Gain / Total Upfront Investment) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'netGain', label: 'Net Financial Benefit over Horizon', unit: 'currency' },
      { key: 'upfrontInvestment', label: 'Upfront Capital Investment', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'new_customer_growth',
    name: 'New Customer Growth',
    category: 'growth_sustainability',
    categoryLabel: 'F. Growth and Sustainability',
    explanation: 'Tracks net count of new paying clients won each period to replace natural churn.',
    unit: 'number',
    direction: 'higher_is_better',
    formulaType: 'manual',
    formulaDescription: 'Count of new paying clients onboarded during the review period.',
    reviewCadenceDays: 30,
    inputFields: [{ key: 'newCustomers', label: 'New Customers Won', unit: 'number' }],
  },
  {
    catalogKey: 'recurring_revenue',
    name: 'Recurring Revenue',
    category: 'growth_sustainability',
    categoryLabel: 'F. Growth and Sustainability',
    explanation: 'Measures contracted maintenance, retainer, or subscription revenue as a percentage of total turnover.',
    unit: 'percent',
    direction: 'higher_is_better',
    formulaType: 'recurring_revenue_pct',
    formulaDescription: '(Annualised Recurring Revenue / Total Annual Revenue) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'annualRecurringRevenue', label: 'Annualised Recurring Revenue', unit: 'currency' },
      { key: 'totalAnnualRevenue', label: 'Total Annual Revenue', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'major_customer_dependency',
    name: 'Revenue Dependency on Major Customers',
    category: 'growth_sustainability',
    categoryLabel: 'F. Growth and Sustainability',
    explanation: 'Monitors share of income reliant on the largest few accounts to protect business continuity.',
    unit: 'percent',
    direction: 'lower_is_better',
    formulaType: 'customer_concentration',
    formulaDescription: '(Largest Accounts Revenue / Total Revenue) × 100',
    reviewCadenceDays: 30,
    inputFields: [
      { key: 'topClientsRevenue', label: 'Major Customers Revenue', unit: 'currency' },
      { key: 'totalRevenue', label: 'Total Revenue', unit: 'currency' },
    ],
  },
  {
    catalogKey: 'business_continuity_risks',
    name: 'Business Continuity Risks',
    category: 'growth_sustainability',
    categoryLabel: 'F. Growth and Sustainability',
    explanation: 'Composite resilience health index (0–100) reflecting owner dependency, cash buffer, and systems strength.',
    unit: 'score',
    direction: 'higher_is_better',
    formulaType: 'manual_or_case',
    formulaDescription: 'Synced from the 12-Capability Business Health score (0–100, higher indicates lower continuity risk).',
    reviewCadenceDays: 30,
    inputFields: [{ key: 'continuityScore', label: 'Business Health & Continuity Score (0–100)', unit: 'score' }],
  },
];

export const KPI_BUSINESS_TYPE_PRESETS: BusinessTypePresetMeta[] = [
  {
    id: 'trades_contractors',
    label: 'Tradespeople and Contractors',
    description: 'Focuses on job margins, variation leakage, debtor days, cash reserves, and field utilisation.',
    defaultKpiKeys: [
      'monthly_revenue',
      'gross_profit_margin',
      'available_cash',
      'overdue_receivables',
      'average_debtor_days',
      'staff_utilisation',
      'unbilled_work_hours',
      'rework_wastage',
      'on_time_delivery',
    ],
  },
  {
    id: 'it_msp',
    label: 'IT and Managed Service Providers',
    description: 'Prioritises recurring revenue base, engineer utilisation, margin integrity, receivables, and SLA reliability.',
    defaultKpiKeys: [
      'monthly_revenue',
      'gross_profit_margin',
      'net_profit_margin',
      'available_cash',
      'overdue_receivables',
      'customer_retention',
      'staff_utilisation',
      'unbilled_work_hours',
      'recurring_revenue',
      'business_continuity_risks',
    ],
  },
  {
    id: 'professional_services',
    label: 'Professional and Business Services',
    description: 'Highlights billable utilisation, WIP/debtor collection speed, client retention, and revenue per advisor.',
    defaultKpiKeys: [
      'monthly_revenue',
      'gross_profit_margin',
      'net_profit_margin',
      'available_cash',
      'average_debtor_days',
      'customer_retention',
      'staff_utilisation',
      'revenue_per_employee',
      'unbilled_work_hours',
      'recurring_revenue',
    ],
  },
  {
    id: 'retail',
    label: 'Retail Businesses',
    description: 'Tracks sales growth, basket size, repeat footfall, gross margin, cash buffer, and stock shrinkage/wastage.',
    defaultKpiKeys: [
      'monthly_revenue',
      'revenue_growth_pct',
      'avg_transaction_value',
      'repeat_business_pct',
      'gross_profit_margin',
      'net_profit_margin',
      'available_cash',
      'rework_wastage',
    ],
  },
  {
    id: 'general_sme',
    label: 'General SMEs',
    description: 'Balanced executive scorecard covering sales momentum, profitability, liquidity, retention, and resilience.',
    defaultKpiKeys: [
      'monthly_revenue',
      'revenue_growth_pct',
      'gross_profit_margin',
      'net_profit_margin',
      'available_cash',
      'overdue_receivables',
      'customer_retention',
      'revenue_per_employee',
      'business_continuity_risks',
    ],
  },
];

export function getCatalogKpiByKey(catalogKey: string): KpiCatalogDefinition | undefined {
  return KPI_CATALOG.find((item) => item.catalogKey === catalogKey);
}

export function inferPresetFromIndustry(industry?: string): KpiBusinessTypePreset {
  const lower = (industry || '').toLowerCase();
  if (lower.includes('it') || lower.includes('managed service') || lower.includes('software') || lower.includes('msp')) {
    return 'it_msp';
  }
  if (
    lower.includes('trade') ||
    lower.includes('contract') ||
    lower.includes('electrical') ||
    lower.includes('plumb') ||
    lower.includes('build') ||
    lower.includes('construct') ||
    lower.includes('civil')
  ) {
    return 'trades_contractors';
  }
  if (
    lower.includes('professional') ||
    lower.includes('consult') ||
    lower.includes('account') ||
    lower.includes('legal') ||
    lower.includes('agency') ||
    lower.includes('service')
  ) {
    return 'professional_services';
  }
  if (lower.includes('retail') || lower.includes('shop') || lower.includes('hospitality') || lower.includes('store')) {
    return 'retail';
  }
  return 'general_sme';
}
