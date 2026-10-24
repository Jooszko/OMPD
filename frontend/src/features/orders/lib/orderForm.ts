import type { AppProduct, OrderDayStop } from '../../../services/api';
import { normalizeText } from './orders';

export interface FormItem {
  product_id: number;
  product_name: string;
  price: number;
  qty: number;
}

export interface StandingGroup {
  client_id: number;
  days_ids: number[];
  items: { product_id: number; product_name: string; qty: number; price: number }[];
}

export const MAX_QUANTITY = 9999;

export function isoWeekday(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

export function itemsFromStop(stop: OrderDayStop): FormItem[] {
  return stop.items
    .filter((item) => item.status !== 'cancelled')
    .map((item) => ({ product_id: item.product_id, product_name: item.product_name, price: item.price, qty: item.qty }));
}

export function standingItemsFor(groups: StandingGroup[], clientId: number, weekday: number): FormItem[] {
  const group = groups.find((entry) => entry.client_id === clientId && entry.days_ids.includes(weekday));
  return (group?.items ?? []).map((item) => ({
    product_id: item.product_id,
    product_name: item.product_name,
    price: item.price,
    qty: item.qty,
  }));
}

export function addProduct(items: FormItem[], product: AppProduct): FormItem[] {
  if (items.some((item) => item.product_id === product.product_id)) return items;
  return [...items, { product_id: product.product_id, product_name: product.name, price: Number(product.base_price), qty: 1 }];
}

export function setQuantity(items: FormItem[], productId: number, qty: number): FormItem[] {
  const clean = Math.min(MAX_QUANTITY, Math.max(0, Math.round(qty) || 0));
  return items.map((item) => (item.product_id === productId ? { ...item, qty: clean } : item));
}

export function removeProduct(items: FormItem[], productId: number): FormItem[] {
  return items.filter((item) => item.product_id !== productId);
}

export function itemsTotals(items: FormItem[]): { pieces: number; value: number } {
  return items.reduce(
    (totals, item) => ({ pieces: totals.pieces + item.qty, value: totals.value + item.qty * item.price }),
    { pieces: 0, value: 0 }
  );
}

export function searchProducts(products: AppProduct[], query: string, items: FormItem[], limit = 8): AppProduct[] {
  const needle = normalizeText(query.trim());
  const taken = new Set(items.map((item) => item.product_id));
  return products
    .filter((product) => !taken.has(product.product_id) && (!needle || normalizeText(product.name).includes(needle)))
    .slice(0, limit);
}

export function orderFormError(clientId: number | null, items: FormItem[]): string | null {
  if (clientId === null) return 'Wybierz klienta.';
  if (!items.some((item) => item.qty > 0)) return 'Dodaj przynajmniej jeden produkt z ilością większą od zera.';
  return null;
}