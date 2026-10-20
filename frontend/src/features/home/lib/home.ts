import type { HomeAlert, HomeOrder, HomeOrders, HomeRoute, HomeRouteStop, HomeShift, ProductionStage } from '../../../services/api';

export interface Segment {
  text: string;
  strong?: boolean;
}

export interface Arc<K extends string> {
  key: K;
  length: number;
  offset: number;
}

export type LaneKey = 'planned' | 'in_production' | 'in_delivery' | 'delivered';

export interface LaneCard {
  key: string;
  clientName: string;
  initials: string;
  detail: string;
  pieces: number;
  failed: boolean;
}

export interface Lane {
  key: LaneKey;
  cards: LaneCard[];
  pieces: number;
}

export interface AlertView {
  key: string;
  tone: 'critical' | 'warning';
  title: string;
  detail: string;
  href: string;
}

export interface TrendBar {
  date: string;
  label: string;
  value: number;
  height: number;
  today: boolean;
}

export const LANE_ORDER: LaneKey[] = ['planned', 'in_production', 'in_delivery', 'delivered'];
export const STAGE_ORDER: ProductionStage[] = ['done', 'baking', 'proofing', 'dividing', 'mixing'];

export function plural(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one;
  const tens = count % 100;
  const units = count % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

export function greeting(fullName: string, hour: number): string {
  const name = firstName(fullName);
  const hello = hour >= 18 || hour < 4 ? 'Dobry wieczór' : 'Dzień dobry';
  return name ? `${hello}, ${name}` : hello;
}

export function formatHeroDate(now: Date): string {
  const day = now.toLocaleDateString('pl-PL', { weekday: 'long' });
  const date = now.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
  const time = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${date} · ${time}`;
}

export function formatClock(value: string): string {
  return new Date(value).toLocaleTimeString('pl-PL', { hour: 'numeric', minute: '2-digit' });
}

export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}.${month}`;
}

export function daySummary(orders: HomeOrders): Segment[] {
  if (orders.total === 0) return [{ text: 'Na dziś nie ma jeszcze żadnych zamówień.' }];
  const { delivered, in_delivery, in_production, planned, failed } = orders.by_status;
  const progress = [
    delivered && `${delivered} ${plural(delivered, 'dotarło', 'dotarły', 'dotarło')}`,
    in_delivery && `${in_delivery} w drodze`,
    in_production && `${in_production} w produkcji`,
    planned && `${planned} ${plural(planned, 'czeka', 'czekają', 'czeka')} na start`,
    failed && `${failed} ${plural(failed, 'nieudane', 'nieudane', 'nieudanych')}`,
  ].filter(Boolean);
  return [
    { text: 'Dziś ' },
    { text: `${orders.total} ${plural(orders.total, 'zamówienie', 'zamówienia', 'zamówień')}`, strong: true },
    { text: ' i ' },
    { text: `${orders.pieces} szt.`, strong: true },
    { text: ` na ${orders.routes} ${plural(orders.routes, 'trasie', 'trasach', 'trasach')}. ` },
    { text: `${progress.join(', ')}.` },
  ];
}

export function shiftSummary(shift: HomeShift): Segment[] {
  const day = formatShortDate(shift.delivery_date);
  if (!shift.has_plan) {
    const pieces = shift.pieces || shift.standing_pieces;
    return [
      { text: 'Plan produkcji na ' },
      { text: day, strong: true },
      { text: pieces > 0 ? ` jeszcze nie powstał, a do upieczenia jest ${pieces} szt.` : ' jeszcze nie powstał.' },
    ];
  }
  const batches = shift.batches.length;
  const { done, baking, proofing, dividing, mixing } = shift.stages;
  const progress = [
    done && `${done} ${plural(done, 'gotowa', 'gotowe', 'gotowych')}`,
    baking && `${baking} w piecu`,
    proofing && `${proofing} ${plural(proofing, 'garuje', 'garują', 'garuje')}`,
    dividing && `${dividing} w dzieleniu`,
    mixing && `${mixing} w mieszaniu`,
  ].filter(Boolean);
  return [
    { text: 'Na dostawę ' },
    { text: day, strong: true },
    { text: ': ' },
    { text: `${batches} ${plural(batches, 'dzieża', 'dzieże', 'dzieży')}`, strong: true },
    { text: ' i ' },
    { text: `${shift.pieces} szt.`, strong: true },
    { text: progress.length > 0 ? ` (${progress.join(', ')}).` : '' },
  ];
}

export function donutArcs<K extends string>(
  counts: Record<K, number>,
  order: K[],
  circumference: number,
  gap = 3,
): Arc<K>[] {
  const total = order.reduce((sum, key) => sum + counts[key], 0);
  if (total === 0) return [];
  const visible = order.filter((key) => counts[key] > 0);
  const spacing = visible.length > 1 ? gap : 0;
  let offset = 0;
  return visible.map((key) => {
    const share = (counts[key] / total) * circumference;
    const arc = { key, length: Math.max(share - spacing, 0), offset };
    offset += share;
    return arc;
  });
}

export function initials(name: string): string {
  const words = name.replace(/[„”"'«»]/g, ' ').split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
}

export function buildLanes(items: HomeOrder[]): Lane[] {
  const lanes = new Map<LaneKey, Map<string, LaneCard>>(LANE_ORDER.map((key) => [key, new Map()]));
  for (const item of items) {
    const laneKey: LaneKey = item.status === 'failed' ? 'delivered' : item.status;
    const cards = lanes.get(laneKey)!;
    const cardKey = `${item.client_id}-${item.status}`;
    const card = cards.get(cardKey);
    if (card) {
      card.pieces += item.quantity;
      card.detail = `${card.detail}, ${item.product_name}`;
    } else {
      cards.set(cardKey, {
        key: cardKey,
        clientName: item.client_name,
        initials: initials(item.client_name),
        detail: item.product_name,
        pieces: item.quantity,
        failed: item.status === 'failed',
      });
    }
  }
  return LANE_ORDER.map((key) => {
    const cards = [...lanes.get(key)!.values()];
    return { key, cards, pieces: cards.reduce((sum, card) => sum + (card.failed ? 0 : card.pieces), 0) };
  });
}

function joinNames(names: string[]): string {
  const lower = names.map((name, index) => (index === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1)));
  if (lower.length === 2) return `${lower[0]} i ${lower[1]}`;
  return lower.join(', ');
}

function amount(value: string): string {
  return Number(value).toLocaleString('pl-PL', { maximumFractionDigits: 3 });
}

export function alertView(alert: HomeAlert): AlertView {
  switch (alert.kind) {
    case 'failed_deliveries': {
      const count = alert.items.length;
      return {
        key: alert.kind,
        tone: 'critical',
        title: `${count} ${plural(count, 'nieudana dostawa', 'nieudane dostawy', 'nieudanych dostaw')}`,
        detail: alert.items.map((item) => `${item.client_name} (${formatShortDate(item.date)})`).join(' · '),
        href: '/logistics',
      };
    }
    case 'low_stock': {
      const names = alert.items.map((item) => item.name);
      return {
        key: alert.kind,
        tone: 'critical',
        title: names.length <= 2
          ? `${joinNames(names)} poniżej minimum`
          : `${names.length} surowców poniżej minimum`,
        detail: alert.items.map((item) => `${item.name} ${amount(item.current)} / ${amount(item.minimum)} ${item.unit}`).join(' · '),
        href: '/warehouse',
      };
    }
    case 'missing_plan':
      return {
        key: alert.kind,
        tone: 'warning',
        title: `Brak planu produkcji na ${formatShortDate(alert.items[0].date)}`,
        detail: 'Dzisiejsza zmiana nie ma jeszcze rozpisanych dzież.',
        href: '/production',
      };
    case 'day_not_closed':
      return {
        key: alert.kind,
        tone: 'warning',
        title: `Dzień ${formatShortDate(alert.items[0].date)} niezamknięty`,
        detail: 'Zamknij go w Finansach, żeby raport trafił do księgowej.',
        href: '/finance/reports',
      };
  }
}

const WEEKDAY_SHORT = ['nd', 'pn', 'wt', 'śr', 'cz', 'pt', 'so'];

export function trendBars(trend: { date: string; revenue: string }[]): TrendBar[] {
  const values = trend.map((day) => Number(day.revenue));
  const max = Math.max(...values, 0);
  return trend.map((day, index) => {
    const today = index === trend.length - 1;
    return {
      date: day.date,
      label: today ? 'dziś' : WEEKDAY_SHORT[new Date(`${day.date}T00:00:00`).getDay()],
      value: values[index],
      height: max > 0 ? Math.max(Math.round((values[index] / max) * 100), values[index] > 0 ? 4 : 0) : 0,
      today,
    };
  });
}

const STOP_RANK: Record<HomeRouteStop['status'], number> = { delivered: 0, failed: 1, in_delivery: 2, waiting: 3 };

export function progressStops(stops: HomeRouteStop[]): HomeRouteStop[] {
  return [...stops].sort(
    (a, b) =>
      STOP_RANK[a.status] - STOP_RANK[b.status] ||
      (a.delivered_at ?? '').localeCompare(b.delivered_at ?? '') ||
      a.client_name.localeCompare(b.client_name, 'pl')
  );
}

export function routeLabel(route: HomeRoute): string {
  if (route.state === 'done') {
    return route.last_delivery ? `zakończona ${formatClock(route.last_delivery.delivered_at)}` : 'zakończona';
  }
  if (route.state === 'on_road') {
    const progress = `${route.delivered_stops}/${route.total_stops}`;
    return route.last_delivery
      ? `${progress} · ostatnio ${formatClock(route.last_delivery.delivered_at)}`
      : `w drodze ${progress}`;
  }
  return 'czeka na towar';
}