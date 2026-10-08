import type { StopReturns } from '../../../services/api';

export type ReturnQuantities = Record<number, number>;

export function initialReturnQuantities(returns: StopReturns): ReturnQuantities {
  return Object.fromEntries(returns.items.map((item) => [item.product_id, item.returned_quantity]));
}

export function applyReturnQuantities(returns: StopReturns, quantities: ReturnQuantities): StopReturns {
  return {
    ...returns,
    items: returns.items.map((item) => ({ ...item, returned_quantity: quantities[item.product_id] ?? 0 })),
  };
}

export function summarizeReturns(
  returns: StopReturns,
  quantities: ReturnQuantities = initialReturnQuantities(returns)
): { count: number; value: number } {
  let count = 0;
  let value = 0;
  for (const item of returns.items) {
    const quantity = quantities[item.product_id] ?? 0;
    count += quantity;
    value += quantity * Number(item.unit_price);
  }
  return { count, value: Math.round(value * 100) / 100 };
}

export function clampReturnQuantity(raw: number, max: number): number {
  if (!Number.isFinite(raw)) return 0;
  return Math.min(max, Math.max(0, Math.trunc(raw)));
}

export function formatMoney(value: number): string {
  return value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
}