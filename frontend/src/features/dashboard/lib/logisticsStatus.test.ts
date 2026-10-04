import { describe, expect, it } from 'vitest';
import { getDriverNextStep, getNextStep } from './logisticsStatus';

describe('getDriverNextStep', () => {
  it('lets the driver only mark in-delivery orders as delivered', () => {
    expect(getDriverNextStep('in_delivery')?.status).toBe('delivered');
  });

  it.each(['planned', 'in_production', 'delivered', 'failed', 'cancelled'] as const)(
    'offers no action for %s orders',
    (status) => {
      expect(getDriverNextStep(status)).toBeNull();
    }
  );
});

describe('getNextStep', () => {
  it.each([
    ['planned', 'in_delivery'],
    ['in_production', 'in_delivery'],
    ['in_delivery', 'delivered'],
    ['failed', 'in_delivery'],
  ] as const)('moves %s orders to %s', (from, to) => {
    expect(getNextStep(from)?.status).toBe(to);
  });

  it('offers no action for delivered and cancelled orders', () => {
    expect(getNextStep('delivered')).toBeNull();
    expect(getNextStep('cancelled')).toBeNull();
  });
});