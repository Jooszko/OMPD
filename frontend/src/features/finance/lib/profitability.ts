import type { ProfitabilityProduct } from '../../../services/api';

export type MarginLevel = 'high' | 'medium' | 'low' | 'incomplete' | 'no_recipe';

export interface MarginGroup {
  level: MarginLevel;
  title: string;
  hint: string;
  items: ProfitabilityProduct[];
}

const GROUPS: Omit<MarginGroup, 'items'>[] = [
  { level: 'high', title: 'Wysoka marża', hint: '50% i więcej' },
  { level: 'medium', title: 'Średnia marża', hint: '25–50%' },
  { level: 'low', title: 'Niska marża – do przejrzenia ceny', hint: 'poniżej 25%' },
  { level: 'incomplete', title: 'Niepełne dane', hint: 'brakuje cen składników – koszt jest zaniżony' },
  { level: 'no_recipe', title: 'Bez receptury', hint: 'dodaj recepturę w zakładce Produkty, aby policzyć koszt' },
];

export function marginLevel(product: ProfitabilityProduct): MarginLevel {
  if (!product.has_recipe || product.margin_pct === null) return 'no_recipe';
  if (product.missing_prices.length > 0) return 'incomplete';
  if (product.margin_pct >= 50) return 'high';
  if (product.margin_pct >= 25) return 'medium';
  return 'low';
}

function byPeriodMargin(a: ProfitabilityProduct, b: ProfitabilityProduct): number {
  return Number(b.period_margin ?? 0) - Number(a.period_margin ?? 0) || a.name.localeCompare(b.name, 'pl');
}

/** Products split into margin levels; empty groups are left out. */
export function groupByMargin(products: ProfitabilityProduct[]): MarginGroup[] {
  return GROUPS.map((group) => ({
    ...group,
    items: products.filter((product) => marginLevel(product) === group.level).sort(byPeriodMargin),
  })).filter((group) => group.items.length > 0);
}

function isComplete(product: ProfitabilityProduct): boolean {
  return product.has_recipe && product.missing_prices.length === 0 && product.margin_pct !== null;
}

/** Products with full cost data that sold anything in the period, best period margin first. */
export function profitRanking(products: ProfitabilityProduct[]): ProfitabilityProduct[] {
  return products.filter((product) => isComplete(product) && product.sold > 0).sort(byPeriodMargin);
}

export function lowestMargin(products: ProfitabilityProduct[]): ProfitabilityProduct | null {
  const complete = products.filter(isComplete);
  if (complete.length === 0) return null;
  return complete.reduce((lowest, product) => ((product.margin_pct ?? 0) < (lowest.margin_pct ?? 0) ? product : lowest));
}