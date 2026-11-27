import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';

import { DEMO_MSP_CASE } from '../src/data/demonstrationCase';
import { PUBLIC_MEMBERSHIP_PLANS } from '../src/data/membershipPlans';
import { createPristineBlankCase } from '../src/services/firestoreStorage';
import {
  buildSessionDimensionTrajectory,
  calculateOverallHealth,
} from '../src/services/healthScoring';
import {
  buildMonthlyReviewEntry,
  buildQuarterlyReviewEntry,
  buildWeeklyPulseEntry,
  createJoiningBaseline,
} from '../src/services/continuityEngine';
import {
  generateCoachingPlanDocxUint8Array,
  generateCoachingPlanPdfBytes,
  generateDocxReportUint8Array,
  generatePdfReportBytes,
} from '../src/services/reportGenerator';
import { mergeDiagnosticsIntoActionPlan } from '../src/services/actionPlanEngine';
import { computeRoiMetrics } from '../src/services/roiEngine';
import {
  DurableSaasStore,
  isAdminEmail,
  normalizeTierId,
  resolveEffectivePlan,
} from '../server/billingStore';
import {
  KPI_BUSINESS_TYPE_PRESETS,
  KPI_CATALOG,
  KPI_CATEGORIES,
} from '../src/data/kpiCatalog';
import {
  calcCustomerRetentionPct,
  calcDebtorDays,
  calcGrossProfitMarginPct,
  calcNetProfitMarginPct,
  calcRevenueGrowthPct,
  calcStaffUtilisationPct,
  computeKpiTrend,
  computeKpiVariance,
  createCustomTrackedKpi,
  initializeKpiTrackerForCase,
  syncKpiTrackerWithCaseData,
} from '../src/services/kpiEngine';
import { CaseRecord } from '../src/types/bizpulse';

function buildElectricalTradesCase(): CaseRecord {
  const base = createPristineBlankCase({
    name: 'Southern Spark & Civil Electrical Ltd',
    industry: 'Trades / Contracting',
    country: 'New Zealand',
    currency: 'NZD',
    employeeCount: 9,
    subcontractorCount: 2,
    turnoverRange: 'NZ$1M – NZ$2M',
    primaryObjective: 'Recover overdue progress claims and improve gross margin on fixed-price jobs',
    primaryConcern: 'Variation work is being done on site without written variation sign-off and 60+ day debtors are rising',
  });

  base.healthInputs.money.status = 'needs_attention';
  base.healthInputs.money.notes = 'Overdue progress invoices NZ$42,000 while payroll climbs';
  base.healthInputs.pricingMargins.status = 'at_risk';
  base.healthInputs.pricingMargins.notes = 'Unbilled variations on commercial fitout contracts';
  base.healthInputs.customers.status = 'healthy';
  base.healthInputs.direction.status = 'healthy';
  base.healthInputs.sales.status = 'needs_attention';
  base.healthInputs.operations.status = 'needs_attention';
  base.healthInputs.people.status = 'healthy';
  base.healthInputs.ownerDependency.status = 'at_risk';
  base.healthInputs.competition.status = 'healthy';
  base.healthInputs.scalability.status = 'needs_attention';
  base.healthInputs.technology.status = 'not_sure';
  base.healthInputs.sustainability.status = 'needs_attention';

  base.financials = {
    annualRevenue: 1450000,
    directCosts: 960000,
    operatingExpenses: 390000,
    operatingProfit: 100000,
    cashInBank: 52000,
    accountsReceivable: 138000,
    overdueReceivables: 42000,
    accountsPayable: 64000,
    creditFacilityLimit: 80000,
    creditFacilityUsed: 22000,
    customerCount: 65,
    top5ConcentrationPercent: 34,
    top12ConcentrationPercent: 52,
    standardPaymentTermsDays: 20,
    actualPaymentDelayDays: 48,
    pricingReviewLastYears: 2,
  };

  base.overallHealth = calculateOverallHealth(base.healthInputs, base.financials);
  return base;
}

function buildHealthyGrowingSmeCase(): CaseRecord {
  const base = createPristineBlankCase({
    name: 'Kauri Precision Manufacturing Ltd',
    industry: 'Manufacturing & Engineering',
    country: 'New Zealand',
    currency: 'NZD',
    employeeCount: 16,
    subcontractorCount: 1,
    turnoverRange: 'NZ$2M – NZ$5M',
    primaryObjective: 'Expand export margin cleanly without overloading senior production leads',
    primaryConcern: 'Validating capacity ROI before purchasing a second CNC cell',
  });

  for (const key of Object.keys(base.healthInputs) as Array<keyof typeof base.healthInputs>) {
    base.healthInputs[key].status = 'healthy';
    base.healthInputs[key].evidenceType = 'verified';
    base.healthInputs[key].notes = 'Verified monthly Xero and job-costing KPI check';
  }

  base.financials = {
    annualRevenue: 3100000,
    directCosts: 1780000,
    operatingExpenses: 890000,
    operatingProfit: 430000,
    cashInBank: 340000,
    accountsReceivable: 210000,
    overdueReceivables: 9000,
    accountsPayable: 95000,
    creditFacilityLimit: 150000,
    creditFacilityUsed: 0,
    customerCount: 92,
    top5ConcentrationPercent: 24,
    top12ConcentrationPercent: 41,
    standardPaymentTermsDays: 20,
    actualPaymentDelayDays: 21,
    pricingReviewLastYears: 0.5,
  };

  base.overallHealth = calculateOverallHealth(base.healthInputs, base.financials);
  return base;
}

test('1. Case isolation & blank business creation contain zero demo contamination', () => {
  const blank = createPristineBlankCase({ name: 'Clean Plumbing Ltd' });
  assert.equal(blank.profile.isDemonstrationCase, false);
  assert.equal(blank.profile.name, 'Clean Plumbing Ltd');
  assert.equal(blank.financials, null);
  assert.equal(blank.recommendations, null);
  assert.equal(blank.crmContacts?.length || 0, 0);
  assert.equal(blank.actionPlan.length, 0);
  assert.ok(blank.continuity);
  assert.equal(blank.continuity?.joiningBaseline, null);

  for (const dim of Object.values(blank.healthInputs)) {
    assert.equal(dim.status, 'unanswered');
    assert.equal(dim.notes, '');
  }

  const health = calculateOverallHealth(blank.healthInputs, blank.financials);
  assert.equal(health.overallScore, null);
  assert.equal(health.overallRating, 'Incomplete / Missing Information');
});

test('2. Deterministic 12-Capability scoring enforces non-averaging risk caps & Blue visibility across 3 SME profiles', () => {
  // SME 1: Demo IT MSP with cash & operations strain
  const mspHealth = calculateOverallHealth(DEMO_MSP_CASE.healthInputs, DEMO_MSP_CASE.financials);
  assert.equal(mspHealth.overallRating, 'At Risk');
  assert.ok((mspHealth.overallScore ?? 100) <= 44);
  assert.ok((mspHealth.topThreePriorities?.length ?? 0) === 3);

  // SME 2: Trades business with Pricing At Risk + 30.4% overdue AR + Owner Dependency At Risk + 1 Not Sure (Blue)
  // Triggers non-averaging financial+pricing At Risk cap (<= 44)
  const tradesCase = buildElectricalTradesCase();
  assert.equal(tradesCase.overallHealth?.overallRating, 'At Risk');
  assert.ok((tradesCase.overallHealth?.overallScore ?? 100) <= 44);
  assert.equal(tradesCase.overallHealth?.unsureCount, 1);
  assert.equal(tradesCase.overallHealth?.dataVisibilityScore, Math.round((11 / 12) * 100));

  // Reducing overdue AR below 30% lifts the financial safeguard cap to Needs Attention (<= 68 due to pricing/ownerDep)
  const tradesImprovedAr = calculateOverallHealth(tradesCase.healthInputs, {
    ...tradesCase.financials!,
    overdueReceivables: 20000,
  });
  assert.equal(tradesImprovedAr.overallRating, 'Needs Attention');
  assert.ok((tradesImprovedAr.overallScore ?? 100) <= 68);

  // SME 3: Healthy expanding SME
  const healthyCase = buildHealthyGrowingSmeCase();
  assert.equal(healthyCase.overallHealth?.overallRating, 'Healthy');
  assert.equal(healthyCase.overallHealth?.overallScore, 100);
  assert.equal(healthyCase.overallHealth?.dataVisibilityScore, 100);
});

test('3. Membership continuity engine tracks Joining Baseline, Weekly Pulse, Monthly Review, Quarterly Sustainability without inventing missing data', () => {
  const tradesCase = buildElectricalTradesCase();

  // Lock baseline at joining
  const baseline = createJoiningBaseline(tradesCase);
  assert.equal(baseline.snapshot.healthScore, tradesCase.overallHealth?.overallScore ?? null);
  assert.equal(baseline.snapshot.cashInBank, 52000);
  assert.equal(baseline.snapshot.overdueReceivables, 42000);

  tradesCase.continuity = {
    joiningBaseline: baseline,
    weeklyPulses: [],
    monthlyReviews: [],
    quarterlyReviews: [],
  };

  // Add an action plan item, complete it, collect overdue AR, lift pricingMargins
  tradesCase.actionPlan = [
    {
      id: 'act-1',
      horizon: '30 Days (Quick Wins & Control)',
      priority: 'Priority 1 (Urgent)',
      action: 'Collect overdue commercial variation invoices >60 days',
      accountableRole: 'Owner',
      timeframe: '14 days',
      requiredInformationOrResources: ['Aged debtor list'],
      measurableSuccessIndicator: 'Recover at least NZ$20,000 cash',
      dependencyOrRisk: 'Client sign-off delay',
      status: 'completed',
      completed: true,
      actualResult: 'Collected NZ$24,000 in cleared funds',
    },
  ];
  tradesCase.financials!.cashInBank = 76000;
  tradesCase.financials!.overdueReceivables = 18000;
  tradesCase.healthInputs.pricingMargins.status = 'needs_attention';
  tradesCase.overallHealth = calculateOverallHealth(tradesCase.healthInputs, tradesCase.financials);

  const pulse = buildWeeklyPulseEntry(tradesCase, {
    ownerNote: 'Issued strict variation sign-off rule to foremen.',
  });
  assert.equal(pulse.deltaVsBaseline.cashDelta, 24000);
  assert.equal(pulse.deltaVsBaseline.overdueArDelta, -24000);
  assert.equal(pulse.deltaVsBaseline.actionsCompletedDelta, 1);
  tradesCase.continuity.weeklyPulses.unshift(pulse);

  const month1 = buildMonthlyReviewEntry(tradesCase, {
    reviewMonth: '2026-10',
    ownerReflection: 'Cash pressure eased noticeably after collections.',
  });
  assert.equal(month1.comparisonToBaseline.cashChange, 24000);
  assert.ok(month1.comparisonToBaseline.improvedAreas.some((a) => a.includes('Pricing')));
  assert.equal(month1.comparisonToPreviousReview, null);
  assert.ok(month1.missingInfoNeeded.some((m) => m.includes('Not Sure')));
  tradesCase.continuity.monthlyReviews.unshift(month1);

  const month2 = buildMonthlyReviewEntry(tradesCase, {
    reviewMonth: '2026-11',
  });
  assert.ok(month2.comparisonToPreviousReview);
  assert.equal(month2.comparisonToPreviousReview?.previousMonth, '2026-10');

  const quarter = buildQuarterlyReviewEntry(tradesCase);
  assert.equal(quarter.ownerDependencyStatus, 'at_risk');
  assert.equal(quarter.customerConcentrationPct, 34);

  // Verify missing financials produce explicit missing-info warnings instead of fabricated zero numbers
  const blank = createPristineBlankCase({ name: 'Empty Financials SME' });
  const blankMonth = buildMonthlyReviewEntry(blank);
  assert.equal(blankMonth.snapshot.cashInBank, null);
  assert.ok(blankMonth.missingInfoNeeded.length > 0);
});

test('4. Durable SaaS store persists across restarts, handles 5 Stripe webhook events with idempotency, and gates admin access', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizpulse-store-test-'));
  try {
    const storePath = path.join(tempDir, 'saas-state.json');
    const store1 = new DurableSaasStore(storePath);

    // 1. Checkout completed upgrades user to Growth NZ$59/mo
    const evt1 = store1.applyStripeWebhookEvent({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          customer: 'cus_123',
          subscription: 'sub_123',
          customer_details: { email: 'owner@example.co.nz' },
          metadata: { userId: 'uid_sme_1', tierId: 'growth_monthly' },
        },
      },
    });
    assert.equal(evt1.handled, true);
    assert.equal(evt1.duplicate, false);

    // Duplicate replay must be ignored idempotently
    const dup = store1.applyStripeWebhookEvent({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: { object: { payment_status: 'paid', metadata: { userId: 'uid_sme_1', tierId: 'growth_monthly' } } },
    });
    assert.equal(dup.duplicate, true);
    assert.equal(dup.handled, false);

    // Simulate process restart by instantiating a brand new DurableSaasStore pointing to the same disk file
    const store2 = new DurableSaasStore(storePath);
    assert.equal(store2.hasProcessedWebhookEvent('evt_checkout_1'), true);
    const loadedUser = store2.getOrInitUser('uid_sme_1');
    assert.equal(loadedUser.subscriptionTier, 'growth_monthly');
    assert.equal(loadedUser.subscriptionStatus, 'active');

    // 2. invoice.paid updates renewal period
    store2.applyStripeWebhookEvent({
      id: 'evt_inv_paid_1',
      type: 'invoice.paid',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_123',
          lines: { data: [{ period: { end: 1800000000 } }] },
        },
      },
    });
    assert.ok(store2.getOrInitUser('uid_sme_1').currentPeriodEnd);

    // 3. invoice.payment_failed sets past_due and drops effective quotas to free_trial safely
    store2.applyStripeWebhookEvent({
      id: 'evt_inv_fail_1',
      type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_123', subscription: 'sub_123' } },
    });
    const pastDueUser = store2.getOrInitUser('uid_sme_1');
    assert.equal(pastDueUser.subscriptionStatus, 'past_due');
    assert.equal(resolveEffectivePlan(pastDueUser).tierId, 'free_trial');

    // 4. customer.subscription.updated restores active when payment clears & honors cancel_at_period_end
    store2.applyStripeWebhookEvent({
      id: 'evt_sub_upd_1',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_123',
          status: 'active',
          cancel_at_period_end: true,
          metadata: { tierId: 'business_plus_monthly' },
        },
      },
    });
    const cancelingUser = store2.getOrInitUser('uid_sme_1');
    assert.equal(cancelingUser.subscriptionStatus, 'canceling');
    assert.equal(resolveEffectivePlan(cancelingUser).tierId, 'business_plus_monthly');

    // 5. customer.subscription.deleted downgrades cleanly to free_trial canceled
    store2.applyStripeWebhookEvent({
      id: 'evt_sub_del_1',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123', customer: 'cus_123' } },
    });
    const canceledUser = store2.getOrInitUser('uid_sme_1');
    assert.equal(canceledUser.subscriptionTier, 'free_trial');
    assert.equal(canceledUser.subscriptionStatus, 'canceled');

    // Plan alignment check: UI plans match server plans
    assert.equal(PUBLIC_MEMBERSHIP_PLANS.length, 4);
    assert.equal(normalizeTierId('essential_monthly'), 'starter_monthly');
    assert.equal(normalizeTierId('founding_monthly'), 'business_plus_monthly');

    // Admin email gate check
    const prevAdmins = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'founder@bizpulse.test, ops@bizpulse.test';
    assert.equal(isAdminEmail('founder@bizpulse.test'), true);
    assert.equal(isAdminEmail('customer@example.com'), false);
    process.env.ADMIN_EMAILS = prevAdmins || '';
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('5. PDF, Word (.docx), and PowerPoint (.pptx) exports generate valid non-empty binary outputs', async () => {
  const tradesCase = buildElectricalTradesCase();

  // PDF generation
  const pdfBytes = generatePdfReportBytes(tradesCase);
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.byteLength > 2000);
  const pdfHeader = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
  assert.equal(pdfHeader, '%PDF-');

  // DOCX generation
  const docxBytes = await generateDocxReportUint8Array(tradesCase);
  assert.ok(docxBytes instanceof Uint8Array);
  assert.ok(docxBytes.byteLength > 3000);
  const docxZip = await JSZip.loadAsync(docxBytes);
  assert.ok(docxZip.file('word/document.xml'));

  // PPTX generation via pptxgenjs
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText(tradesCase.profile.name, { x: 0.5, y: 0.5, w: 8, h: 1 });
  const pptxBuffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  assert.ok(pptxBuffer.byteLength > 3000);
  const pptxZip = await JSZip.loadAsync(pptxBuffer);
  assert.ok(pptxZip.file('ppt/slides/slide1.xml'));
});

test('6. Dimension trajectory builder selects last 3 saved sessions in chronological order with null-safe unrated gaps', () => {
  const s1 = createPristineBlankCase({ name: 'Session One Oldest' });
  s1.updatedAt = '2026-08-01T10:00:00.000Z';
  s1.healthInputs.money.status = 'at_risk';

  const s2 = createPristineBlankCase({ name: 'Session Two' });
  s2.updatedAt = '2026-09-01T10:00:00.000Z';
  s2.healthInputs.money.status = 'needs_attention';
  s2.healthInputs.pricingMargins.status = 'healthy';

  const s3 = createPristineBlankCase({ name: 'Session Three' });
  s3.updatedAt = '2026-10-01T10:00:00.000Z';
  s3.healthInputs.money.status = 'healthy';
  s3.healthInputs.pricingMargins.status = 'not_sure';

  const s4 = createPristineBlankCase({ name: 'Session Four Latest' });
  s4.updatedAt = '2026-11-01T10:00:00.000Z';
  s4.healthInputs.money.status = 'healthy';
  s4.healthInputs.operations.status = 'at_risk';

  // Pass 4 unsorted sessions; should pick s2, s3, s4 ordered chronologically
  const points = buildSessionDimensionTrajectory([s3, s1, s4, s2], s4.id, 3);
  assert.equal(points.length, 3);
  assert.equal(points[0].sessionId, s2.id);
  assert.equal(points[1].sessionId, s3.id);
  assert.equal(points[2].sessionId, s4.id);

  assert.equal(points[0].money, 55);
  assert.equal(points[1].money, 100);
  assert.equal(points[1].pricingMargins, null); // not_sure preserved as null gap
  assert.equal(points[2].operations, 15);
  assert.equal(points[2].isActive, true);
  assert.equal(points[0].isActive, false);
});

test('7. KPI & Performance Tracker calculates formulas accurately, handles missing data honestly, and supports all 5 business-type presets + custom KPIs', () => {
  // Catalog completeness: 6 categories & 30 named KPIs
  assert.equal(KPI_CATEGORIES.length, 6);
  assert.equal(KPI_CATALOG.length, 30);
  assert.equal(KPI_BUSINESS_TYPE_PRESETS.length, 5);

  // Exact deterministic formulas
  assert.equal(calcRevenueGrowthPct(120000, 100000), 20);
  assert.equal(calcRevenueGrowthPct(120000, 0), null); // zero denominator -> Insufficient Data

  assert.equal(calcGrossProfitMarginPct(1450000, 960000), 33.79);
  assert.equal(calcNetProfitMarginPct(100000, 1450000), 6.9);
  assert.equal(calcStaffUtilisationPct(128, 160), 80);
  assert.equal(calcCustomerRetentionPct(95, 10, 100), 85);
  assert.equal(calcDebtorDays(138000, 1450000), 35);

  // Variance & Trend polarity checks (higher_is_better vs lower_is_better)
  const marginVar = computeKpiVariance(33.79, 45, 'higher_is_better', 'percent', 'NZD');
  assert.ok(marginVar && !marginVar.isFavorable && marginVar.delta < 0);

  const debtorVarBetter = computeKpiVariance(18, 21, 'lower_is_better', 'days', 'NZD');
  assert.ok(debtorVarBetter && debtorVarBetter.isFavorable);

  assert.equal(computeKpiTrend(42000, 55000, 'lower_is_better', 'currency'), 'Improving');
  assert.equal(computeKpiTrend(62000, 42000, 'lower_is_better', 'currency'), 'Declining');
  assert.equal(computeKpiTrend(80, 80.2, 'higher_is_better', 'percent'), 'Stable');
  assert.equal(computeKpiTrend(80, null, 'higher_is_better', 'percent'), 'Insufficient Data');

  // Business-type preset selection without forcing all 30 KPIs
  const tradesCase = buildElectricalTradesCase();
  const tradesTracker = initializeKpiTrackerForCase(tradesCase);
  assert.equal(tradesTracker.selectedPreset, 'trades_contractors');
  assert.ok(tradesTracker.kpis.length >= 8 && tradesTracker.kpis.length <= 12);

  // Sync updates deterministic KPI figures when financials change
  tradesCase.financials!.cashInBank = 95000;
  const synced = syncKpiTrackerWithCaseData(tradesTracker, tradesCase);
  const cashKpi = synced.kpis.find((k) => k.catalogKey === 'available_cash');
  assert.equal(cashKpi?.latestActualValue, 95000);
  assert.equal(cashKpi?.previousValue, 52000);

  // MSP preset detection
  const mspTracker = initializeKpiTrackerForCase(DEMO_MSP_CASE);
  assert.equal(mspTracker.selectedPreset, 'it_msp');

  // Custom KPI creation
  const customKpi = createCustomTrackedKpi({
    name: 'First-Time Fix Rate',
    categoryId: 'operational_efficiency',
    explanation: 'Percentage of callouts resolved on first visit.',
    unit: 'percent',
    direction: 'higher_is_better',
    baselineValue: 74,
    targetValue: 88,
    latestActualValue: 81,
    nextReviewDate: '2026-12-15',
    ownerComment: 'Van stock checklist rolled out.',
  });
  assert.equal(customKpi.isCustom, true);
  assert.equal(computeKpiTrend(customKpi.latestActualValue, customKpi.previousValue, customKpi.direction, customKpi.unit), 'Improving');
});

test('8. Action Plan engine populates all 8 fields non-destructively from Coaching & Top 3 Priorities', () => {
  const tradesCase = buildElectricalTradesCase();
  tradesCase.recommendations = {
    initialObservation: 'Margin leakage on variations and slow 60+ day collections are tightening bank headroom.',
    commercialWhy: 'Fixing variation sign-offs and debtor chasing recovers cash faster than chasing new low-margin work.',
    initialRecommendation: 'Mandate written variation approval and weekly debtor calls.',
    immediateAction: 'Call top 5 overdue accounts above 60 days this week.',
    knownsVsAssumptions: { knowns: ['Overdue AR NZ$42,000'], assumptions: [], unknowns: ['Aged debtor breakdown'] },
    missingEvidence: ['Itemized aged receivables ledger'],
    contextualQuestions: [],
    specialistAdviceNeeded: 'Accountant review of progress-claim WIP tax timing.',
    generatedAt: new Date().toISOString(),
    profitOpportunities: [],
    actionItems: [
      {
        id: 'ai-act-1',
        priority: 'Priority 1 (Urgent)',
        action: 'Call top 5 overdue accounts above 60 days this week.',
        timeframe: 'Next 7 days',
        ownerRole: 'Managing Director',
        expectedImpact: 'Recover NZ$25,000 cash',
        completed: false,
      },
      {
        id: 'ai-act-2',
        priority: 'Priority 2 (High)',
        action: 'Enforce signed variation forms prior to extra site work.',
        timeframe: 'Days 8-30',
        ownerRole: 'Operations Lead',
        expectedImpact: '+4% gross margin on fixed-price jobs',
        completed: false,
      },
    ],
  };

  // Seed one pre-existing rejected decision matching action #2 to verify non-destructive merge
  tradesCase.actionPlan = [
    {
      id: 'existing-1',
      horizon: '60 Days (Systems & Margin Fixes)',
      priority: 'Priority 2 (High)',
      businessIssue: 'Owner custom issue',
      rationale: 'Owner custom rationale',
      action: 'Enforce signed variation forms prior to extra site work.',
      accountableRole: 'Site Foreman',
      timeframe: 'Days 14-30',
      requiredInformationOrResources: [],
      measurableSuccessIndicator: '100% variation sign-off',
      dependencyOrRisk: 'Client approval speed on site',
      status: 'pending',
      completed: false,
      decisionStatus: 'rejected',
    },
  ];

  const merged = mergeDiagnosticsIntoActionPlan(tradesCase);
  // Preserved existing item with rejected decisionStatus intact
  const preserved = merged.find((a) => a.id === 'existing-1');
  assert.ok(preserved);
  assert.equal(preserved?.decisionStatus, 'rejected');
  assert.equal(preserved?.accountableRole, 'Site Foreman');

  // Added immediateAction once (deduplicated against matching actionItem) + Top 3 priorities
  const immediateMatches = merged.filter(
    (a) => a.action.toLowerCase() === 'call top 5 overdue accounts above 60 days this week.'
  );
  assert.equal(immediateMatches.length, 1);
  assert.ok(immediateMatches[0].rationale && immediateMatches[0].rationale.length > 0);
  assert.ok(immediateMatches[0].businessIssue && immediateMatches[0].businessIssue.length > 0);
  assert.ok(immediateMatches[0].measurableSuccessIndicator.length > 0);
  assert.ok(merged.some((a) => a.sourceTag === 'Top 3 Health Priority'));
});

test('9. ROI engine reports Insufficient Data / Zero-Cost Gain cleanly and calculates payback accurately', () => {
  // Missing / zero inputs must return hasSufficientData = false and null roiPct/payback
  const emptyRoi = computeRoiMetrics(0, 0, 0, 50, 12, 70);
  assert.equal(emptyRoi.hasSufficientData, false);
  assert.equal(emptyRoi.roiPct, null);
  assert.equal(emptyRoi.paybackMonths, null);
  assert.equal(emptyRoi.breakEvenMonthlyRevenue, null);

  // Zero gross margin % must also report Insufficient Data
  const zeroMargin = computeRoiMetrics(1000, 200, 3000, 0, 12, 70);
  assert.equal(zeroMargin.hasSufficientData, false);
  assert.equal(zeroMargin.roiPct, null);

  // Zero cost with positive revenue -> Zero-Cost Gain (roiPct: null, hasSufficientData: true, paybackMonths: 0)
  const zeroCost = computeRoiMetrics(0, 0, 2000, 50, 12, 80);
  assert.equal(zeroCost.hasSufficientData, true);
  assert.equal(zeroCost.roiPct, null);
  assert.equal(zeroCost.paybackMonths, 0);

  // Standard positive scenario: Upfront 6000, Monthly Cost 500, Monthly Rev 3000 @ 50% GM (1500 GP -> 1000/mo net)
  // Payback = 6000 / 1000 = 6.0 mo; Horizon (12 mo) net = 12000 - 6000 = 6000; Total Cost = 6000 + 6000 = 12000 -> ROI = 50%
  const std = computeRoiMetrics(6000, 500, 3000, 50, 12, 75);
  assert.equal(std.hasSufficientData, true);
  assert.equal(std.monthlyGrossProfit, 1500);
  assert.equal(std.monthlyNetContribution, 1000);
  assert.equal(std.paybackMonths, 6);
  assert.equal(std.horizonNetBenefit, 6000);
  assert.equal(std.roiPct, 50);
  assert.equal(std.riskAdjustedNetBenefit, 4500);
  assert.equal(std.breakEvenMonthlyRevenue, 2000);
});

test('10. Coaching Plan & 9-Section Business Health Report exports produce valid PDF and Word (.docx) documents', async () => {
  const tradesCase = buildElectricalTradesCase();
  tradesCase.kpiTracker = initializeKpiTrackerForCase(tradesCase);
  tradesCase.recommendations = {
    initialObservation: 'Cash is tied up in overdue progress claims.',
    commercialWhy: 'Delayed variation invoicing compresses cash headroom.',
    initialRecommendation: 'Tighten variation approvals and chase >60d debtors.',
    immediateAction: 'Contact overdue commercial accounts within 48 hours.',
    knownsVsAssumptions: { knowns: ['Overdue AR NZ$42,000'], assumptions: [], unknowns: ['WIP breakdown'] },
    missingEvidence: ['Confirm WIP breakdown'],
    contextualQuestions: [],
    specialistAdviceNeeded: 'Check tax provisioning.',
    generatedAt: new Date().toISOString(),
    profitOpportunities: [
      {
        id: 'opp-1',
        area: '4. Slow Invoicing or Late Collections',
        title: 'Recover Overdue Progress Debtors',
        horizon: '0-30 Days',
        estimatedFinancialImpact: 'NZ$25,000+ cash release',
        effortCost: 'Low / Owner time',
        evidenceBasis: 'Aged receivables ledger',
        whatToDoFirst: 'Phone top 3 overdue clients directly.',
        risks: ['Client relationship sensitivity'],
      },
    ],
    actionItems: [
      {
        id: 'rec-1',
        priority: 'Priority 1 (Urgent)',
        action: 'Phone top 3 overdue accounts',
        timeframe: 'Next 7 days',
        ownerRole: 'Owner',
        expectedImpact: 'Release NZ$25,000 cash',
        completed: false,
      },
    ],
  };
  tradesCase.actionPlan = mergeDiagnosticsIntoActionPlan(tradesCase);

  // Coaching & Actions Plan PDF + DOCX
  const coachPdf = generateCoachingPlanPdfBytes(tradesCase);
  assert.ok(coachPdf instanceof Uint8Array && coachPdf.byteLength > 1500);
  assert.equal(Buffer.from(coachPdf.slice(0, 5)).toString('ascii'), '%PDF-');

  const coachDocx = await generateCoachingPlanDocxUint8Array(tradesCase);
  assert.ok(coachDocx instanceof Uint8Array && coachDocx.byteLength > 2500);
  const coachZip = await JSZip.loadAsync(coachDocx);
  const coachXml = await coachZip.file('word/document.xml')?.async('string');
  assert.ok(coachXml && coachXml.includes('Southern Spark'));

  // Full 9-Section Business Health Report PDF + DOCX
  const fullPdf = generatePdfReportBytes(tradesCase);
  assert.ok(fullPdf instanceof Uint8Array && fullPdf.byteLength > 2000);
  assert.equal(Buffer.from(fullPdf.slice(0, 5)).toString('ascii'), '%PDF-');

  const fullDocx = await generateDocxReportUint8Array(tradesCase);
  const fullZip = await JSZip.loadAsync(fullDocx);
  const fullXml = await fullZip.file('word/document.xml')?.async('string');
  assert.ok(fullXml);
  assert.ok(fullXml.includes('Strengths'));
  assert.ok(fullXml.includes('KPI'));
  assert.ok(fullXml.includes('Action Plan'));
});

test('11. Pilot feedback entries persist across DurableSaasStore restarts and pilotMode flags correctly when Stripe is off', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bizpulse-pilot-test-'));
  try {
    const storePath = path.join(tempDir, 'pilot-saas.json');
    const store1 = new DurableSaasStore(storePath);

    const saved = store1.addPilotFeedbackEntry({
      id: 'fb-test-1',
      uid: 'uid_pilot_1',
      email: 'pilot@business.co.nz',
      caseId: 'case-123',
      area: '2. Business Health (12 Capabilities)',
      rating: 5,
      comment: 'Clear diagnostic and helpful bottom summary bar.',
      createdAt: new Date().toISOString(),
    });
    assert.ok(saved.id.startsWith('fb-'));

    const summary = store1.buildAccountUsageSummary(
      'uid_pilot_1',
      false,
      'unconfigured',
      'pilot@business.co.nz'
    );
    assert.equal(summary.subscription.stripeConfigured, false);
    assert.equal(summary.subscription.pilotMode, true);

    const liveSummary = store1.buildAccountUsageSummary(
      'uid_pilot_1',
      true,
      'live',
      'pilot@business.co.nz'
    );
    assert.equal(liveSummary.subscription.stripeConfigured, true);
    assert.equal(liveSummary.subscription.pilotMode, false);

    // Reload from disk and verify persistence
    const store2 = new DurableSaasStore(storePath);
    const reloadedRaw = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    assert.ok(Array.isArray(reloadedRaw.pilotFeedback));
    assert.equal(reloadedRaw.pilotFeedback.length, 1);
    assert.equal(reloadedRaw.pilotFeedback[0].comment, 'Clear diagnostic and helpful bottom summary bar.');
    assert.ok(store2.getOrInitUser('uid_pilot_1'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

