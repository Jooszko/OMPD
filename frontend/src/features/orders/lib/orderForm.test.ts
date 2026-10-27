import { describe, expect, it } from 'vitest';
import type { AppProduct, OrderDayStop } from '../../../services/api';
import {
  addProduct,
  isoWeekday,
  itemsFromStop,
  itemsTotals,
  orderFormError,
  removeProduct,
  searchProducts,
  setQuantity,
  standingItemsFor,
  type FormItem,
} from './orderForm';

const bread: AppProduct = { product_id: 1, name: 'Chleb pszenny 500g', category: 'bread', base_price: '4.50' };
const roll: AppProduct = { product_id: 2, name: 'Bułka pszenna', category: 'buns', base_price: '0.80' };
const cake: AppProduct = { product_id: 3, name: 'Sernik kawałek', category: 'pastry', base_price: '6.50' };

describe('isoWeekday', () => {
  it('counts from Monday like the backend', () => {
    expect(isoWeekday('2026-10-26')).toBe(0);
    expect(isoWeekday('2026-10-25')).toBe(6);
  });
});

describe('items', () => {
  it('adds a product once with its list price', () => {
    const items = addProduct(addProduct([], bread), bread);

    expect(items).toEqual([{ product_id: 1, product_name: 'Chleb pszenny 500g', price: 4.5, qty: 1 }]);
  });

  it('keeps quantities whole and within range', () => {
    const items = addProduct([], roll);

    expect(setQuantity(items, 2, 12.6)[0].qty).toBe(13);
    expect(setQuantity(items, 2, -4)[0].qty).toBe(0);
    expect(setQuantity(items, 2, Number.NaN)[0].qty).toBe(0);
    expect(setQuantity(items, 2, 50000)[0].qty).toBe(9999);
  });

  it('removes a product and sums pieces and value', () => {
    const items = setQuantity(addProduct(addProduct([], bread), roll), 2, 10);

    expect(itemsTotals(items)).toEqual({ pieces: 11, value: 12.5 });
    expect(removeProduct(items, 1).map((item) => item.product_id)).toEqual([2]);
  });

  it('searches without Polish letters and hides products already added', () => {
    const items: FormItem[] = addProduct([], roll);

    expect(searchProducts([bread, roll, cake], 'pszen', items).map((p) => p.name)).toEqual(['Chleb pszenny 500g']);
    expect(searchProducts([bread, roll, cake], 'BULKA', []).map((p) => p.name)).toEqual(['Bułka pszenna']);
  });
});

describe('prefill', () => {
  it('copies an existing order without cancelled lines', () => {
    const stop = {
      items: [
        { product_id: 1, product_name: 'Chleb', qty: 10, price: 4.2, status: 'planned' },
        { product_id: 2, product_name: 'Bułka', qty: 5, price: 0.8, status: 'cancelled' },
      ],
    } as OrderDayStop;

    expect(itemsFromStop(stop)).toEqual([{ product_id: 1, product_name: 'Chleb', price: 4.2, qty: 10 }]);
  });

  it('takes the standing basket of that weekday only', () => {
    const groups = [
      {
        client_id: 7,
        schedule: [
          { day: 1, items: [{ product_id: 2, product_name: 'Bułka', qty: 80, price: 0.8 }] },
          { day: 4, items: [{ product_id: 1, product_name: 'Chleb', qty: 5, price: 4.5 }] },
        ],
      },
    ];

    expect(standingItemsFor(groups, 7, 1)).toEqual([{ product_id: 2, product_name: 'Bułka', price: 0.8, qty: 80 }]);
    expect(standingItemsFor(groups, 7, 4)).toEqual([{ product_id: 1, product_name: 'Chleb', price: 4.5, qty: 5 }]);
    expect(standingItemsFor(groups, 7, 6)).toEqual([]);
  });
});

describe('orderFormError', () => {
  it('needs a client and at least one positive quantity', () => {
    expect(orderFormError(null, [])).toBe('Wybierz klienta.');
    expect(orderFormError(1, setQuantity(addProduct([], bread), 1, 0))).toMatch(/przynajmniej jeden produkt/);
    expect(orderFormError(1, addProduct([], bread))).toBeNull();
  });
});