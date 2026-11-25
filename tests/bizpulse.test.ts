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
  generateDocxReportUint8Array,
  generatePdfReportBytes,
} from '../src/services/reportGenerator';
import {
  DurableSaasStore,
  isAdminEmail,
  normalizeTierId,
  resolveEffectivePlan,
} from '../server/billingStore';
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
