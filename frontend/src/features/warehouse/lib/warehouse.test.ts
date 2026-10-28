import { describe, expect, it } from 'vitest';
import type { StockDay, WarehouseRow } from '../../../services/api';
import {
  byUrgency,
  chartGeometry,
  formatDays,
  headline,
  nearestIndex,
  parseQuantity,
  stockBar,
  stockStatus,
  summary,
  toStockItem,
} from './warehouse';

function row(overrides: Partial<WarehouseRow>): WarehouseRow {
  return {
    ingredient_id: 1,
    name: 'Mąka',
    unit: 'kg',
    current_stock: '100.000',
    min_stock_level: '20.000',
    daily_usage: '5.000',
    days_left: 20,
    last_delivery_at: null,
    updated_at: null,
    ...overrides,
  };
}

function day(date: string, balance: string): StockDay {
  return { date, balance, received: '0', used: '0', corrected: '0' };
}

describe('stockStatus', () => {
  it('flags stock below minimum and below 150% of it', () => {
    expect(stockStatus(19, 20)).toBe('critical');
    expect(stockStatus(20, 20)).toBe('warning');
    expect(stockStatus(29.9, 20)).toBe('warning');
    expect(stockStatus(30, 20)).toBe('good');
  });

  it('treats ingredients without a minimum as fine', () => {
    expect(stockStatus(0, 0)).toBe('good');
  });
});

describe('byUrgency', () => {
  it('puts critical first, then the ingredient that runs out sooner', () => {
    const items = [
      toStockItem(row({ ingredient_id: 1, name: 'Sól', current_stock: '25', days_left: 30 })),
      toStockItem(row({ ingredient_id: 2, name: 'Olej', current_stock: '5', days_left: 1 })),
      toStockItem(row({ ingredient_id: 3, name: 'Cukier', current_stock: '25', days_left: 5 })),
    ];
    expect(items.sort(byUrgency).map((item) => item.name)).toEqual(['Olej', 'Cukier', 'Sól']);
  });
});

describe('headline and summary', () => {
  it('counts ingredients below minimum with Polish plurals', () => {
    const items = [
      toStockItem(row({ ingredient_id: 1, current_stock: '1' })),
      toStockItem(row({ ingredient_id: 2, current_stock: '2' })),
    ];
    expect(headline(items)).toBe('2 surowce poniżej minimum');
    expect(headline([toStockItem(row({}))])).toBe('Zapasy w normie');
  });

  it('names the most urgent ingredients first', () => {
    const items = [
      toStockItem(row({ ingredient_id: 1, name: 'Olej', current_stock: '1', days_left: 0.4 })),
      toStockItem(row({ ingredient_id: 2, name: 'Mąka' })),
    ];
    const text = summary(items).map((segment) => segment.text).join('');
    expect(text).toBe('Olej starczy na mniej niż dzień. 1 z 2 surowców ma bezpieczny zapas.');
  });
});

describe('formatDays', () => {
  it('rounds down and uses Polish plurals', () => {
    expect(formatDays(null)).toBe('brak zużycia');
    expect(formatDays(1.9)).toBe('1 dzień');
    expect(formatDays(3.2)).toBe('3 dni');
  });
});

describe('stockBar', () => {
  it('places the minimum at a quarter of the bar and caps overflow', () => {
    expect(stockBar(toStockItem(row({ current_stock: '20' }))).fill).toBeCloseTo(1 / 4);
    expect(stockBar(toStockItem(row({ current_stock: '100' })))).toEqual({ fill: 1, overflow: true });
  });
});

describe('parseQuantity', () => {
  it('accepts comma or dot decimals up to three places', () => {
    expect(parseQuantity('12,5')).toBe(12.5);
    expect(parseQuantity(' 3.125 ')).toBe(3.125);
    expect(parseQuantity('1,2345')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
    expect(parseQuantity('abc')).toBeNull();
  });
});

describe('chartGeometry', () => {
  it('maps days across the width and keeps the minimum inside the scale', () => {
    const series = [day('2026-10-01', '40'), day('2026-10-02', '10'), day('2026-10-03', '30')];
    const geometry = chartGeometry(series, 20, 200, 100);

    expect(geometry.points.map((p) => p.x)).toEqual([0, 100, 200]);
    expect(geometry.points[1].y).toBeGreaterThan(geometry.points[0].y);
    expect(geometry.minimumY).not.toBeNull();
    expect(geometry.minimumY!).toBeGreaterThan(0);
    expect(geometry.minimumY!).toBeLessThan(100);
    expect(nearestIndex(geometry.points, 140)).toBe(1);
    expect(nearestIndex(geometry.points, 999)).toBe(2);
  });
});
