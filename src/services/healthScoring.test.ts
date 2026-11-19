import assert from 'node:assert/strict';
import { calculateOverallHealth, HEALTH_DIMENSION_ORDER } from './healthScoring';
import type { HealthDimensionInput, HealthDimensionKey, HealthStatus } from '../types/bizpulse';

const titles: Record<HealthDimensionKey, string> = {
  direction: 'Direction', customers: 'Customers', sales: 'Sales', money: 'Money',
  operations: 'Operations', people: 'People', ownerDependency: 'Owner Dependency', technology: 'Technology',
};
function inputs(statuses: HealthStatus[]): Record<HealthDimensionKey, HealthDimensionInput> {
  return Object.fromEntries(HEALTH_DIMENSION_ORDER.map((key, index) => [key, {
    key, title: titles[key], description: '', status: statuses[index], notes: '', evidenceType: 'owner_reported',
  }])) as Record<HealthDimensionKey, HealthDimensionInput>;
}
const all = (status: HealthStatus) => inputs(HEALTH_DIMENSION_ORDER.map(() => status));

const healthy = calculateOverallHealth(all('healthy'));
assert.equal(healthy.overallScore, 100);
assert.equal(healthy.overallRating, 'Healthy');
assert.ok(healthy.dimensionScores.every((item) => item.color === 'green' && item.score === 100));

const attention = calculateOverallHealth(all('needs_attention'));
assert.equal(attention.overallScore, 55);
assert.equal(attention.overallRating, 'Needs Attention');
assert.ok(attention.dimensionScores.every((item) => item.color === 'amber' && item.score === 55));

const risk = calculateOverallHealth(all('at_risk'));
assert.equal(risk.overallScore, 15);
assert.equal(risk.overallRating, 'At Risk');
assert.ok(risk.dimensionScores.every((item) => item.color === 'red' && item.score === 15));

const unsure = calculateOverallHealth(all('not_sure'));
assert.equal(unsure.overallScore, 40);
assert.equal(unsure.overallRating, 'Incomplete / Missing Information');
assert.ok(unsure.dimensionScores.every((item) => item.color === 'slate' && item.score === 40));

const unanswered = calculateOverallHealth(all('unanswered'));
assert.equal(unanswered.overallScore, null);
assert.equal(unanswered.overallRating, 'Incomplete / Missing Information');
assert.ok(unanswered.dimensionScores.every((item) => item.score === null));

const mixedStatuses: HealthStatus[] = ['healthy', 'needs_attention', 'at_risk', 'not_sure', 'healthy', 'needs_attention', 'healthy', 'unanswered'];
const mixed = calculateOverallHealth(inputs(mixedStatuses));
assert.deepEqual(mixed.dimensionScores.map((item) => item.status), mixedStatuses);
assert.deepEqual(mixed.dimensionScores.map((item) => item.color), ['green', 'amber', 'red', 'slate', 'green', 'amber', 'green', 'slate']);
assert.deepEqual(mixed.dimensionScores.map((item) => item.score), [100, 55, 15, 40, 100, 55, 100, null]);

const criticalMoney = inputs(['healthy', 'healthy', 'healthy', 'at_risk', 'healthy', 'healthy', 'healthy', 'healthy']);
const moneyRisk = calculateOverallHealth(criticalMoney);
assert.equal(moneyRisk.overallRating, 'At Risk');
assert.ok((moneyRisk.overallScore ?? 100) <= 44);

console.log('Health scoring tests passed: all status mappings, mixed answers, unanswered handling, and critical money override.');
