import type { LogisticsOrder } from '../../../services/api';

export type OrderStatus = LogisticsOrder['status'];

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  planned: '#6b7280',
  in_production: '#d97706',
  in_delivery: '#2563eb',
  delivered: '#059669',
  cancelled: '#dc2626',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  planned: 'Zaplanowane',
  in_production: 'W produkcji',
  in_delivery: 'W dostawie',
  delivered: 'Dostarczone',
  cancelled: 'Anulowane',
};

interface NextStep {
  status: OrderStatus;
  label: string;
}

const NEXT_STEP: Partial<Record<OrderStatus, NextStep>> = {
  planned: { status: 'in_delivery', label: 'Wydaj do dostawy' },
  in_production: { status: 'in_delivery', label: 'Wydaj do dostawy' },
  in_delivery: { status: 'delivered', label: 'Oznacz jako dostarczone' },
};

export function getNextStep(status: OrderStatus): NextStep | null {
  return NEXT_STEP[status] ?? null;
}
