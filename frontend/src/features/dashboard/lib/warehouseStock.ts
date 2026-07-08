export type StockStatus = 'critical' | 'warning' | 'good';

export interface StockStatusResult {
  pct: number;
  status: StockStatus;
}

export const STOCK_STATUS_COLORS: Record<StockStatus, string> = {
  critical: '#dc2626',
  warning: '#d97706',
  good: '#059669',
};

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  critical: 'Poniżej minimum',
  warning: 'Zbliża się do minimum',
  good: 'OK',
};

export function computeStockStatus(currentStock: number, minStockLevel: number): StockStatusResult {
  if (minStockLevel <= 0) {
    return { pct: Infinity, status: 'good' };
  }

  const pct = (currentStock / minStockLevel) * 100;
  let status: StockStatus;
  if (pct < 100) {
    status = 'critical';
  } else if (pct < 150) {
    status = 'warning';
  } else {
    status = 'good';
  }

  return { pct, status };
}
