export type IndustryType = 
  | 'Trades / Contracting'
  | 'Retail / E-commerce'
  | 'Professional Services'
  | 'Hospitality & Food'
  | 'IT & Managed Services'
  | 'Manufacturing & Engineering'
  | 'Healthcare & Wellness'
  | 'Transport & Logistics'
  | 'Other';

export type BusinessStructureType = 
  | 'Owner-operated'
  | 'Family business'
  | 'Partnership'
  | 'Company with management team';

export interface BusinessProfile {
  caseId: string;
  name: string;
  industry: IndustryType;
  businessType: BusinessStructureType;
  country: string;
  currency: string;
  yearsOperating: number | string;
  employeeCount: number;
  subcontractorCount: number;
  turnoverRange?: string;
  mainProductsServices: string;
  mainCustomerTypes: string;
  primaryObjective: string;
  primaryConcern: string;
  isDemonstrationCase: boolean;
  createdAt: string;
  updatedAt: string;
}

export type HealthDimensionKey =
  | 'direction'
  | 'customers'
  | 'sales'
  | 'pricingMargins'
  | 'money'
  | 'operations'
  | 'people'
  | 'ownerDependency'
  | 'competition'
  | 'scalability'
  | 'technology'
  | 'sustainability';

export type HealthStatus = 'healthy' | 'needs_attention' | 'at_risk' | 'not_sure' | 'unanswered';

export interface HealthDimensionInput {
  key: HealthDimensionKey;
  title: string;
  description: string;
  status: HealthStatus;
  notes: string;
  evidenceType: 'owner_reported' | 'verified' | 'assumption' | 'hypothesis' | 'unknown';
}

export interface DimensionScoreDetail {
  key: HealthDimensionKey;
  title: string;
  status: HealthStatus;
  score: number | null; // 0 to 100, or null if unanswered
  color: 'green' | 'amber' | 'red' | 'blue';
  explanation: string;
  whatMeasured: string;
  whyMatters: string;
  evidenceUsed: string;
  gapDiagnosis: string;
  recommendedStep: string;
}

export interface TopPriorityItem {
  rank: 1 | 2 | 3;
  key: HealthDimensionKey;
  title: string;
  status: HealthStatus;
  rationale: string;
  recommendedFocus: string;
}

export interface OverallHealthAssessment {
  overallScore: number | null; // 0 to 100, or null when 0 dimensions answered
  overallRating: 'Healthy' | 'Needs Attention' | 'At Risk' | 'Incomplete / Missing Information';
  scoreLabel: string;
  overallExplanation?: string;
  dimensionScores?: DimensionScoreDetail[];
  answeredCount?: number;
  unsureCount?: number;
  unansweredCount?: number;
  dataVisibilityScore?: number; // % of dimensions confirmed vs not_sure/unanswered
  topThreePriorities?: TopPriorityItem[];
  criticalRisksIdentified: string[];
  strongestAreas: string[];
  missingEvidenceAreas: string[];
  mainDrivers: string[];
  assessmentDate: string;
  scoringWeightRules: string;
  isProvisional: boolean;
}

export interface FinancialData {
  annualRevenue: number | null;
  directCosts: number | null;
  operatingExpenses: number | null;
  operatingProfit: number | null;
  cashInBank: number | null;
  accountsReceivable: number | null;
  overdueReceivables: number | null;
  accountsPayable: number | null;
  creditFacilityLimit: number | null;
  creditFacilityUsed: number | null;
  customerCount: number | null;
  top5ConcentrationPercent: number | null;
  top12ConcentrationPercent: number | null;
  standardPaymentTermsDays: number | null;
  actualPaymentDelayDays: number | null;
  pricingReviewLastYears: number | null;
}

export interface RecommendationActionItem {
  id: string;
  priority: 'Priority 1 (Urgent)' | 'Priority 2 (High)' | 'Priority 3 (Medium)';
  ownerRole: string;
  timeframe: string;
  action: string;
  expectedImpact: string;
  completed?: boolean;
}

export interface RecommendationChallenge {
  id: string;
  questionOrChallenge: string;
  coachResponse: string;
  createdAt: string;
}

export type OpportunityHorizon = '0-30 Days' | '30-90 Days' | '90-180 Days';

export const PROFIT_LEAKAGE_AREAS = [
  '1. Pricing Too Low',
  '2. Unbilled Extra or Out-of-Scope Work',
  '3. Weak Quoting or Low Win Rates',
  '4. Slow Invoicing or Late Collections',
  '5. Poor Margin Tracking',
  '6. Unprofitable or Low-Value Customers',
  '7. Excessive Discounting',
  '8. Ineffective Marketing or Poor Lead Follow-Up',
  '9. High Employee or Contractor Rework',
  '10. Inefficient Scheduling or Idle Capacity',
  '11. Poor Inventory or Supplier Cost Control',
  '12. Lack of Repeat Business / Upsell / Cross-Sell',
  '13. Over-Reliance on 1–2 Big Customers or Channels',
  '14. Software or Admin Duplication',
  '15. Missed AI / Automation Time Savings',
  '16. Tax or Cash Timing Errors',
] as const;

export interface ProfitOpportunityItem {
  id: string;
  area: string;
  title: string;
  horizon: OpportunityHorizon;
  evidenceBasis: string;
  whyHappening?: string;
  infoNeeded?: string;
  whatToDoFirst?: string;
  illustrativeExample?: string;
  estimatedFinancialImpact: string;
  effortCost: string;
  risks: string[];
  linkedCrmId?: string;
}

export type SustainabilityBusinessChoice =
  | 'Stabilise'
  | 'Improve'
  | 'Expand'
  | 'Restructure'
  | 'Reconsider';

export interface SustainabilityAreaItem {
  area: string;
  status: 'green' | 'amber' | 'red' | 'blue';
  assessment: string;
  keyDriverOrGap: string;
}

export interface SustainabilityAssessment {
  currentPositionSummary: string;
  futureOutlook6to12Months: string;
  recommendedChoice: SustainabilityBusinessChoice;
  choiceRationale: string;
  areas: SustainabilityAreaItem[];
  keyAssumptions: string[];
  disclaimer: string;
}

export interface RecommendationOutput {
  initialObservation: string;
  commercialWhy: string;
  sustainabilityRisks?: string[];
  sustainabilityAssessment?: SustainabilityAssessment;
  hiddenProfitOpportunities?: string[];
  revenueFlowImprovements?: string[];
  profitOpportunities?: ProfitOpportunityItem[];
  knownsVsAssumptions: {
    knowns: string[];
    assumptions: string[];
    unknowns: string[];
  };
  missingEvidence: string[];
  contextualQuestions: string[];
  initialRecommendation: string;
  immediateAction: string;
  actionItems?: RecommendationActionItem[];
  challenges?: RecommendationChallenge[];
  specialistAdviceNeeded: string | null;
  generatedAt: string;
}

export interface DocumentMetricFound {
  label: string;
  value: string;
  sourceBasis: 'document_verified' | 'owner_reported';
}

export interface UploadedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  summary: string;
  verifiedFacts: string[];
  ownerSuppliedClaims: string[];
  assumptionsFlagged: string[];
  missingFinancialFigures: string[];
  earningPotentialAssessment: string;
  risksIdentified: string[];
  opportunitiesIdentified: string[];
  metricsFound: DocumentMetricFound[];
  extractedPreview?: string;
}

export interface CrossDocumentSynthesis {
  summary: string;
  trends: string[];
  unusualMovements: string[];
  conservativeScenario: string;
  baseScenario: string;
  optimisticScenario: string;
  verifiedFiguresUsed: string[];
  dataGaps: string[];
  synthesizedAt: string;
}

export interface CoachSuggestedAction {
  id: string;
  title: string;
  ownerRole: string;
  priority: 'Priority 1 (Urgent)' | 'Priority 2 (High)' | 'Priority 3 (Medium)';
  timeframe: string;
  targetType: 'action_plan' | 'crm_followup';
  savedToPlan?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
  metadata?: {
    topic?: string;
    role?: string;
    estimatesAndAssumptions?: string[];
    followUpQuestions?: string[];
    suggestedActions?: CoachSuggestedAction[];
  };
}

export type TurnaroundHorizon =
  | '30 Days (Quick Wins & Control)'
  | '60 Days (Systems & Margin Fixes)'
  | '90 Days (Sustainable Growth)'
  | 'Horizon 1 (First 7 Days)'
  | 'Horizon 2 (Days 8–30)'
  | 'Horizon 3 (Days 31–90)';

export interface TurnaroundAction {
  id: string;
  horizon: TurnaroundHorizon;
  priority: 'Priority 1 (Urgent)' | 'Priority 2 (High)' | 'Priority 3 (Medium)';
  businessIssue?: string;
  rationale?: string;
  action: string;
  accountableRole: string;
  timeframe: string;
  requiredInformationOrResources: string[];
  measurableSuccessIndicator: string;
  dependencyOrRisk: string;
  status?: 'pending' | 'in_progress' | 'completed';
  completed?: boolean;
  decisionStatus?: 'pending_review' | 'accepted' | 'modified' | 'rejected';
  targetCompletionDate?: string;
  estimatedCostEffort?: string;
  intendedImprovement?: string;
  actualResult?: string;
  metricLink?: string;
  sourceTag?: string;
}

export interface ReportedFinancials {
  revenue: number;
  directCosts: number;
  operatingExpenses: number;
  reportedOperatingProfit: number;
  accountsReceivable: number;
  overdue60Days: number;
  reportedPaymentDelayDays: string;
  supplierPayables: number;
  cashInBank: number;
  overdraftLimit: number;
  overdraftUsed: number;
  activeCustomers: number;
  top5RevenueConcentration: number;
  top12RecurringConcentration: number;
  staffCount?: number;
  subcontractorCount?: number;
  subcontractors?: number;
  customerLoss12Months?: number;
  pricingFrozenYears?: number;
  estimatedCostInflationPct?: number;
}

export interface CustomDashboardMetric {
  id: string;
  name: string;
  area: string;
  currentValue: string;
  targetBenchmark: string;
  warningThreshold: string;
  criticalThreshold: string;
  accountableRole: string;
  frequency: string;
  explanation: string;
  isSupplied: boolean;
}

export type PaymentStatus = 'free' | 'pending' | 'paid' | 'failed' | 'refunded';
export type SubscriptionTierId =
  | 'free_trial'
  | 'starter_monthly'
  | 'growth_monthly'
  | 'business_plus_monthly'
  | 'essential_monthly'
  | 'founding_monthly';
export type SubscriptionTier = SubscriptionTierId;

export interface PaymentRecord {
  sessionId: string;
  caseId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  tier: string;
  unlockedAt?: string;
  receiptUrl?: string;
  paymentMethod?: string;
}

export interface CaseUsageStats {
  recommendationsCount: number;
  coachMessagesCount: number;
  documentsAnalyzedCount: number;
}

export interface AccountUsageSummary {
  monthKey: string;
  limits: {
    maxCustomCases: number;
    coachMessagesPerMonth: number;
    documentAuditsPerMonth: number;
    recommendationsPerMonth: number;
  };
  used: {
    coachMessages: number;
    documentAudits: number;
    recommendations: number;
  };
  remaining: {
    coachMessages: number;
    documentAudits: number;
    recommendations: number;
  };
  tokenUsage: {
    promptTokens: number;
    outputTokens: number;
    thinkingTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    estimatedCostNzd: number;
    requestCount: number;
  };
  subscription: {
    tierId: 'free_trial' | 'starter_monthly' | 'growth_monthly' | 'business_plus_monthly';
    planName: string;
    priceMonthlyNzd: number;
    status: string;
    currentPeriodEnd?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeConfigured: boolean;
    billingMode?: 'live' | 'test' | 'unconfigured';
    pilotMode?: boolean;
    isAdmin?: boolean;
  };
}

export type ReportFontFamily = 'sans' | 'serif' | 'mono';
export type ReportFontSize = 'sm' | 'base' | 'lg';
export type ReportBlockAlign = 'left' | 'center' | 'justify';

export interface ReportCustomBlock {
  id: string;
  heading: string;
  body: string;
  fontFamily: ReportFontFamily;
  fontSize: ReportFontSize;
  bold?: boolean;
  italic?: boolean;
  align?: ReportBlockAlign;
  accent?: 'slate' | 'blue' | 'green' | 'amber';
  updatedAt: string;
}

export interface ReportEditorSettings {
  fontFamily: ReportFontFamily;
  fontSize: ReportFontSize;
  sectionOrder?: string[];
}

export type CrmRecordType = 'Customer' | 'Prospect' | 'Lead' | 'Partner';
export type CrmTier = 'Champion' | 'Steady Core' | 'Margin Squeeze' | 'Chronic Drain' | 'Prospect';
export type CrmSalesStage =
  | 'Lead'
  | 'Contacted'
  | 'Qualified'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'
  | 'Dormant';
export type CrmStatus = 'Active' | 'Follow-Up Due' | 'At Risk' | 'Paused' | 'Closed Won' | 'Closed Lost';

export interface CrmInteraction {
  id: string;
  date: string;
  type: 'Call' | 'Email' | 'Meeting' | 'Proposal' | 'Note';
  summary: string;
  outcome?: string;
}

export interface CrmRecord {
  id: string;
  companyOrName: string;
  contactPerson: string;
  email: string;
  phone: string;
  recordType: CrmRecordType;
  tier: CrmTier;
  salesStage: CrmSalesStage;
  status: CrmStatus;
  opportunityValue: number;
  monthlyValue: number;
  nextFollowUpDate: string;
  leadSource: string;
  notes: string;
  interactions: CrmInteraction[];
  createdAt: string;
  updatedAt: string;
}

export type RoiCategory =
  | 'Sales & Marketing'
  | 'Hiring & Capacity'
  | 'Pricing & Margin'
  | 'Systems & Automation'
  | 'Client Retention'
  | 'Other';

export interface RoiScenario {
  id: string;
  name: string;
  category: RoiCategory;
  dataOrigin?: 'user_entered' | 'draft_estimate';
  linkedCrmId?: string;
  linkedCrmLabel?: string;
  upfrontInvestment: number;
  monthlyOperatingCost: number;
  expectedMonthlyRevenue: number;
  grossMarginPct: number;
  monthsHorizon: number;
  confidencePct: number;
  assumptionsNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessDevSuggestion {
  title: string;
  targetSegment: string;
  channel: string;
  rationale: string;
  messageDraft: string;
  linkedCrmId?: string;
}

export interface BusinessDevPlan {
  idealCustomerProfile: string;
  targetOpportunities: string[];
  followUpPriorities: string[];
  outreachSuggestions: BusinessDevSuggestion[];
  generatedAt: string;
}

export interface ChallengeRound {
  id: string;
  roundNumber: number;
  contradictionOrBlindSpot: string;
  scenarioContext: string;
  question: string;
  ownerResponse?: string;
  businessImplication?: string;
  respondedAt?: string;
}

export interface ChallengeNextAction {
  id: string;
  action: string;
  ownerRole: string;
  priority: 'Priority 1 (Urgent)' | 'Priority 2 (High)' | 'Priority 3 (Medium)';
  timeframe: string;
  rationale: string;
  addedToPlan?: boolean;
}

export interface ChallengeConclusion {
  keyInsights: string[];
  recommendedDecisions: string[];
  nextActions: ChallengeNextAction[];
  concludedAt: string;
}

export interface ChallengeMeSession {
  id: string;
  focusTopic: string;
  status: 'active' | 'concluded';
  contradictionsDetected: string[];
  questionableAssumptions: string[];
  blindSpots: string[];
  rounds: ChallengeRound[];
  conclusion?: ChallengeConclusion | null;
  startedAt: string;
  updatedAt: string;
}

export interface ContinuityMetricSnapshot {
  healthScore: number | null;
  healthRating: string;
  dataVisibilityScore: number | null;
  cashInBank: number | null;
  overdueReceivables: number | null;
  accountsReceivable: number | null;
  accountsPayable: number | null;
  annualRevenue: number | null;
  operatingProfit: number | null;
  openPipelineValue: number;
  overdueFollowUpsCount: number;
  actionsTotal: number;
  actionsCompleted: number;
}

export interface ContinuityBaseline {
  capturedAt: string;
  primaryConcern: string;
  primaryObjective: string;
  initialRecommendationSummary: string;
  snapshot: ContinuityMetricSnapshot;
  dimensionStatuses: Record<HealthDimensionKey, HealthStatus>;
}

export interface WeeklyPulseEntry {
  id: string;
  weekOf: string;
  createdAt: string;
  snapshot: ContinuityMetricSnapshot;
  deltaVsBaseline: {
    healthScoreDelta: number | null;
    cashDelta: number | null;
    overdueArDelta: number | null;
    actionsCompletedDelta: number;
  };
  completedThisWeek: string[];
  stalledActions: string[];
  emergingConcerns: string[];
  emergingOpportunities: string[];
  nextWeekPriorities: string[];
  ownerNote: string;
  aiPulseSummary?: string;
  missingDataPrompt?: string[];
}

export interface MonthlyReviewEntry {
  id: string;
  reviewMonth: string;
  createdAt: string;
  snapshot: ContinuityMetricSnapshot;
  comparisonToBaseline: {
    healthScoreChange: number | null;
    cashChange: number | null;
    overdueArChange: number | null;
    pipelineChange: number;
    improvedAreas: string[];
    deterioratedAreas: string[];
    unresolvedIssues: string[];
  };
  comparisonToPreviousReview?: {
    previousMonth: string;
    healthScoreChange: number | null;
    cashChange: number | null;
    overdueArChange: number | null;
  } | null;
  revenueOpportunities: string[];
  profitLeakageAlerts: string[];
  cashFlowConcerns: string[];
  actionOutcomesReviewed: string[];
  nextThreePriorities: string[];
  missingInfoNeeded: string[];
  executiveSummary: string;
  ownerReflection: string;
}

export interface QuarterlySustainabilityReview {
  id: string;
  quarterLabel: string;
  createdAt: string;
  snapshot: ContinuityMetricSnapshot;
  resilienceTrend: 'Strengthening' | 'Mixed / Holding' | 'Under Strain' | 'Insufficient Data';
  strategicChoice: SustainabilityBusinessChoice | 'Pending Evidence';
  longTermRisks: string[];
  longTermOpportunities: string[];
  recommendedAdjustments: string[];
  ownerDependencyStatus: HealthStatus;
  customerConcentrationPct: number | null;
  missingInfoNeeded: string[];
  executiveSummary: string;
}

export interface MembershipContinuity {
  joiningBaseline: ContinuityBaseline | null;
  weeklyPulses: WeeklyPulseEntry[];
  monthlyReviews: MonthlyReviewEntry[];
  quarterlyReviews: QuarterlySustainabilityReview[];
}

export type KpiCategoryId =
  | 'revenue_sales'
  | 'profitability'
  | 'cash_flow'
  | 'customers'
  | 'operational_efficiency'
  | 'growth_sustainability';

export type KpiTrendStatus = 'Improving' | 'Declining' | 'Stable' | 'Insufficient Data';

export type KpiBusinessTypePreset =
  | 'trades_contractors'
  | 'it_msp'
  | 'professional_services'
  | 'retail'
  | 'general_sme';

export type KpiUnitType = 'currency' | 'percent' | 'number' | 'days' | 'hours' | 'score';

export type KpiDirection = 'higher_is_better' | 'lower_is_better';

export interface KpiHistoryPoint {
  periodLabel: string;
  recordedAt: string;
  actualValue: number | null;
  targetValue: number | null;
  comment?: string;
  inputs?: Record<string, number | null>;
}

export interface TrackedKpiRecord {
  id: string;
  catalogKey?: string;
  name: string;
  category: KpiCategoryId;
  categoryLabel: string;
  explanation: string;
  unit: KpiUnitType;
  direction: KpiDirection;
  formulaType: string;
  formulaDescription: string;
  inputValues: Record<string, number | null>;
  baselineValue: number | null;
  targetValue: number | null;
  previousValue: number | null;
  latestActualValue: number | null;
  aiInterpretation: string;
  recommendedAction: string;
  nextReviewDate: string;
  ownerComment: string;
  isAutoSyncedFromCase?: boolean;
  isCustom?: boolean;
  history: KpiHistoryPoint[];
  updatedAt: string;
}

export interface KpiRecommendedSuggestion {
  catalogKey: string;
  name: string;
  category: KpiCategoryId;
  categoryLabel: string;
  clearBusinessReason: string;
}

export interface KpiTrackerState {
  selectedPreset: KpiBusinessTypePreset;
  selectedKpiIds: string[];
  kpis: TrackedKpiRecord[];
  recommendedAdditionalKpis: KpiRecommendedSuggestion[];
  lastAiReviewedAt?: string | null;
}

export interface CaseRecord {
  id: string;
  profile: BusinessProfile;
  healthInputs: Record<HealthDimensionKey, HealthDimensionInput>;
  overallHealth: OverallHealthAssessment | null;
  financials: FinancialData | null;
  recommendations: RecommendationOutput | null;
  uploadedDocuments?: UploadedDocument[];
  crossDocumentSynthesis?: CrossDocumentSynthesis | null;
  conversations: ChatMessage[];
  actionPlan: TurnaroundAction[];
  sprintCompleted?: Record<string, boolean>;
  dashboardMetrics: CustomDashboardMetric[];
  crmContacts?: CrmRecord[];
  roiScenarios?: RoiScenario[];
  businessDevPlan?: BusinessDevPlan | null;
  challengeSession?: ChallengeMeSession | null;
  continuity?: MembershipContinuity | null;
  kpiTracker?: KpiTrackerState | null;
  reportBlocks?: ReportCustomBlock[];
  reportEditorSettings?: ReportEditorSettings;
  pilotFeedback?: PilotFeedbackEntry[];
  subscriptionTier?: SubscriptionTierId;
  usageStats?: CaseUsageStats;
  paymentStatus?: PaymentStatus;
  paymentRecord?: PaymentRecord | null;
  isUnlocked?: boolean;
  updatedAt: string;
}

export interface PilotFeedbackEntry {
  id: string;
  area: string;
  rating: number;
  comment: string;
  caseName?: string;
  createdAt: string;
}

export interface ScriptPreset {
  id: string;
  title: string;
  description: string;
  category: 'Cash Collection' | 'Contract & Pricing' | 'Service Boundaries' | 'Client Retention';
  defaultPrompt: string;
}

export interface GrowthOptionAnalysis {
  id: 'Option A' | 'Option B' | 'Option C';
  title: string;
  proposedAction: string;
  upfrontCashRequirement: string;
  likelyOngoingCommitments: string;
  whatMustBeTrue: string[];
  commercialAssumptionsToTest: string[];
  routeToRevenueAndCash: string;
  principalRisks: string[];
  evidenceRequiredBeforeCommitment: string[];
  approvalConditions: string[];
  deferralConditions: string[];
  rejectionConditions: string[];
  calculationFramework: {
    formula: string;
    requiredInputs: string[];
    explanation: string;
  };
}

export interface RiskMapItem {
  id: string;
  category: string;
  reportedSymptom: string;
  possibleUnderlyingCause: string;
  evidenceCurrentlyAvailable: string[];
  evidenceStillRequired: string[];
  potentialCommercialConsequence: string;
  urgency: 'Immediate (Within 7 Days)' | 'High (Within 30 Days)' | 'Medium (Within 90 Days)';
  recommendedFirstAction: string;
  hypothesisToTest: string;
  confirmationCriteria: string;
  disproofCriteria: string;
}

export interface MissingInformationItem {
  priority: 'Immediate (Next 48–72 Hours)' | 'Secondary (Within 14–30 Days)';
  category: string;
  item: string;
  decisionItEnables: string;
  sourceOrMethod: string;
  ownerQuestion: string;
}

export interface WeeklyDashboardKPI {
  id: string;
  name: string;
  area: string;
  currentReportedValue: string;
  targetBenchmark: string;
  warningThreshold: string;
  criticalThreshold: string;
  accountableRole: string;
  measurementFrequency: string;
  explanation: string;
  criteriaExplanation: string;
}
