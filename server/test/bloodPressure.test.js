import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyBloodPressure, isControlled, summarizeBloodPressures } from '../src/bloodPressure.js';

test('classifies pregnancy-relevant blood pressure thresholds', () => {
  assert.equal(classifyBloodPressure(118, 76), 'NORMAL');
  assert.equal(classifyBloodPressure(134, 84), 'ELEVATED');
  assert.equal(classifyBloodPressure(142, 91), 'HIGH');
  assert.equal(classifyBloodPressure(165, 112), 'CRITICAL');
  assert.equal(classifyBloodPressure(88, 58), 'LOW');
});

test('uses the study control target below 140/90', () => {
  assert.equal(isControlled({ systolic: 139, diastolic: 89 }), true);
  assert.equal(isControlled({ systolic: 140, diastolic: 80 }), false);
  assert.equal(isControlled({ systolic: 120, diastolic: 90 }), false);
});

test('summarizes latest, average, categories and control rate', () => {
  const summary = summarizeBloodPressures([
    { systolic: 120, diastolic: 80, measuredAt: new Date('2026-10-20T01:00:00Z') },
    { systolic: 145, diastolic: 92, measuredAt: new Date('2026-10-21T01:00:00Z') },
    { systolic: 130, diastolic: 86, measuredAt: new Date('2026-10-22T01:00:00Z') },
  ], 30);

  assert.equal(summary.count, 3);
  assert.equal(summary.latest.systolic, 130);
  assert.deepEqual(summary.average, { systolic: 132, diastolic: 86 });
  assert.equal(summary.controlledCount, 2);
  assert.equal(summary.controlRate, 67);
  assert.equal(summary.categories.NORMAL, 1);
  assert.equal(summary.categories.ELEVATED, 1);
  assert.equal(summary.categories.HIGH, 1);
});
